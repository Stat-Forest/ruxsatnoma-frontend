/**
 * The arithmetic behind the applicant's home screen — every tile, every chart
 * and every figure under the chart, derived from three lists the backend
 * already scopes to the caller. Pure functions on purpose: this is where the
 * screen can actually be wrong, so it is the part that carries tests, while
 * the components above it only arrange what these return.
 *
 * Two conventions run through the file.
 *
 * **Money and area arrive as strings.** `PermitOut.amount`/`area_ha` are
 * fixed-scale NUMERIC serialized as decimal strings, never JSON floats
 * (`permits/schemas.py::_trim_decimal`), so every one of them is parsed here
 * exactly once and a null reads as zero rather than NaN.
 *
 * **A `date` column is never re-parsed through `Date`.** `period_to` is a
 * plain calendar date; `new Date('2026-09-26')` is UTC midnight, which in
 * Tashkent is the 26th at 05:00 and silently shifts a day count by one. Day
 * arithmetic below goes through `dayNumber`, which reads the parts. A
 * `timestamptz` (`submitted_at`, `issued_at`, `paid_at`) is a real instant
 * and IS parsed through `Date`, in the viewer's own zone — the same choice
 * `applicant/format.ts::formatDateTime` already makes.
 */
import type { ApplicationOut, InvoiceOut, PermitOut } from './queries';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Days since the epoch for a plain `YYYY-MM-DD`, read from its parts so no
 *  timezone is ever applied to a date that does not have one. */
function dayNumber(date: string): number {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

function isActive(item: PermitOut): boolean {
  return item.status === 'active';
}

function percent(part: number, whole: number): number | null {
  if (whole === 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

// --- tile 1 ---------------------------------------------------------------

export interface ActivePermitsSummary {
  count: number;
  totalAreaHa: number;
}

/** Only `active` counts: a permit awaiting its signatures grants nothing yet,
 *  and a suspended, revoked or expired one grants nothing any more — showing
 *  either as land the citizen may use would be wrong in the direction that
 *  matters. */
export function activePermitsSummary(permits: PermitOut[]): ActivePermitsSummary {
  const active = permits.filter(isActive);
  return {
    count: active.length,
    totalAreaHa: active.reduce((sum, item) => sum + toNumber(item.area_ha), 0),
  };
}

// --- tile 2 ---------------------------------------------------------------

/** Everything between "submitted" and "finished". Plan 12 (R1): an
 *  application exists only from the moment it is filed, so there is no
 *  DRAFT state to exclude any more; `PERMIT_ISSUED`/`REJECTED`/`CANCELLED`/
 *  `EXPIRED_UNPAID`/`CLOSED`/`ARCHIVED` are done — what is left is what the
 *  citizen is still waiting on. */
const IN_PROGRESS: ReadonlySet<string> = new Set([
  'SUBMITTED',
  'IN_REVIEW',
  'PENDING_INFO',
  'RETURNED',
  'APPROVED',
  'INVOICED',
  'PAID',
]);

export interface ApplicationsInProgress {
  count: number;
  awaitingPayment: number;
}

export function applicationsInProgress(applications: ApplicationOut[]): ApplicationsInProgress {
  return {
    count: applications.filter((item) => IN_PROGRESS.has(item.status)).length,
    // `INVOICED` and nothing else: the invoice exists and the money has not
    // arrived. `PAID` is already past this point, `APPROVED` not yet at it.
    awaitingPayment: applications.filter((item) => item.status === 'INVOICED').length,
  };
}

// --- tile 3 ---------------------------------------------------------------

export interface SeasonalPayments {
  totalAmount: number;
  receiptsConfirmedPct: number | null;
}

/** The season's money is the sum the active permits themselves carry — the
 *  permit's `amount` is frozen into the issued document, so it is the figure
 *  the citizen actually owes for the land they hold. The receipt share is a
 *  different question answered by a different source: of the invoices that
 *  were raised, how many are settled. With no invoice at all the share is
 *  unknown rather than a triumphant 100%. */
export function seasonalPayments(permits: PermitOut[], invoices: InvoiceOut[]): SeasonalPayments {
  const paid = invoices.filter((item) => item.paid_at !== null).length;
  return {
    totalAmount: permits.filter(isActive).reduce((sum, item) => sum + toNumber(item.amount), 0),
    receiptsConfirmedPct: percent(paid, invoices.length),
  };
}

// --- tile 4 ---------------------------------------------------------------

export interface NearestExpiry {
  permit: PermitOut;
  daysLeft: number;
}

/** Replaces the design reference's "usage discipline / GPS geofencing" tile,
 *  which has no source in this system: field inspections are stage 4.1
 *  (`inspections`) and no module answers for them yet. This says something
 *  true and actionable from data that exists — when the citizen's soonest
 *  permit runs out. */
export function nearestExpiry(permits: PermitOut[], today: string): NearestExpiry | null {
  const ahead = permits
    .filter(isActive)
    .map((item) => ({ permit: item, daysLeft: daysBetween(today, item.period_to) }))
    .filter((row) => row.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft);
  return ahead[0] ?? null;
}

// --- the dynamics chart ---------------------------------------------------

export interface MonthPoint {
  key: string;
  applications: number;
  permits: number;
  payments: number;
}

/** `YYYY-MM` in the viewer's own zone, for a `timestamptz`. */
function monthKey(instant: string): string | null {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** One point per month of the window, oldest first, with a zero for a month
 *  where nothing happened — a gap in a time axis reads as missing data, and
 *  here it means "none that month", which is a fact worth drawing. Anything
 *  older than the window is dropped rather than folded into the first bucket,
 *  which would put years of history on one point and misreport a trend. */
export function monthlySeries(
  input: { applications: ApplicationOut[]; permits: PermitOut[]; invoices: InvoiceOut[] },
  window: { today: string; months: number },
): MonthPoint[] {
  const [year, month] = window.today.slice(0, 7).split('-').map(Number);
  const points = new Map<string, MonthPoint>();
  for (let back = window.months - 1; back >= 0; back--) {
    const cursor = new Date(Date.UTC(year, month - 1 - back, 1));
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;
    points.set(key, { key, applications: 0, permits: 0, payments: 0 });
  }

  const tally = (instant: string | null | undefined, field: keyof Omit<MonthPoint, 'key'>) => {
    if (!instant) return;
    const key = monthKey(instant);
    const point = key === null ? undefined : points.get(key);
    if (point) point[field] += 1;
  };

  for (const item of input.applications) tally(item.submitted_at, 'applications');
  for (const item of input.permits) tally(item.issued_at, 'permits');
  for (const item of input.invoices) tally(item.paid_at, 'payments');

  return [...points.values()];
}

// --- the figures under the chart -----------------------------------------

/** An application that reached a decision, one way or the other. `CANCELLED`
 *  and `EXPIRED_UNPAID` are the citizen's own doing and neither a success nor
 *  a refusal, so they weigh on neither side of the success share. */
const DECIDED_WELL: ReadonlySet<string> = new Set([
  'APPROVED',
  'INVOICED',
  'PAID',
  'PERMIT_ISSUED',
  'CLOSED',
  'ARCHIVED',
]);

export interface ReviewStats {
  avgReviewDays: number | null;
  slaOnTimePct: number | null;
  approvedPct: number | null;
  total: number;
  yearsFrom: number | null;
  yearsTo: number | null;
}

export function reviewStats(applications: ApplicationOut[]): ReviewStats {
  const reviewed = applications.filter((item) => item.submitted_at && item.decided_at);
  const reviewDays = reviewed.map(
    (item) => (new Date(item.decided_at!).getTime() - new Date(item.submitted_at!).getTime()) / MS_PER_DAY,
  );

  // Only an application that HAS a deadline and HAS been decided can be on
  // time or late; one still in review is not yet late, and one the backend
  // never gave a deadline (3.9b owns that field's population) cannot be
  // judged at all. Counting either as "on time" is how an SLA figure becomes
  // a decoration.
  const measurable = applications.filter((item) => item.sla_deadline_at && item.decided_at);
  const onTime = measurable.filter(
    (item) => new Date(item.decided_at!).getTime() <= new Date(item.sla_deadline_at!).getTime(),
  ).length;

  const concluded = applications.filter(
    (item) => DECIDED_WELL.has(item.status) || item.status === 'REJECTED',
  );
  const succeeded = concluded.filter((item) => DECIDED_WELL.has(item.status)).length;

  const years = applications
    .map((item) => new Date(item.created_at).getFullYear())
    .filter((year) => Number.isFinite(year));

  return {
    // The raw mean, not a rounded one: `format.ts::formatReviewDays` decides
    // how it reads, and rounding here would erase the difference between a
    // same-day decision and one nobody has taken.
    avgReviewDays: reviewDays.length
      ? reviewDays.reduce((sum, days) => sum + days, 0) / reviewDays.length
      : null,
    slaOnTimePct: percent(onTime, measurable.length),
    approvedPct: percent(succeeded, concluded.length),
    total: applications.length,
    yearsFrom: years.length ? Math.min(...years) : null,
    yearsTo: years.length ? Math.max(...years) : null,
  };
}

// --- the donut ------------------------------------------------------------

export interface ActivitySlice {
  activityTypeId: string;
  areaHa: number;
  pct: number;
}

/** The active area split by what it is used for. Largest slice first, so the
 *  legend reads in the same order as the ring. */
export function areaByActivity(permits: PermitOut[]): ActivitySlice[] {
  const byActivity = new Map<string, number>();
  for (const item of permits.filter(isActive)) {
    byActivity.set(item.activity_type_id, (byActivity.get(item.activity_type_id) ?? 0) + toNumber(item.area_ha));
  }
  const total = [...byActivity.values()].reduce((sum, area) => sum + area, 0);
  return [...byActivity.entries()]
    .map(([activityTypeId, areaHa]) => ({ activityTypeId, areaHa, pct: percent(areaHa, total) ?? 0 }))
    .sort((a, b) => b.areaHa - a.areaHa);
}

// --- the bar chart --------------------------------------------------------

export interface ContourRow {
  contourId: string;
  areaHa: number;
  daysLeft: number;
}

/** One bar per active permit: the land it covers and the time left on it.
 *  A permit whose end date has passed while its status is still `active`
 *  (the nightly expiry sweep runs once a day) shows zero days rather than a
 *  negative bar drawn below the axis. */
export function contourRows(permits: PermitOut[], today: string): ContourRow[] {
  return permits
    .filter(isActive)
    .map((item) => ({
      contourId: item.contour_id,
      areaHa: toNumber(item.area_ha),
      daysLeft: Math.max(0, daysBetween(today, item.period_to)),
    }))
    .sort((a, b) => b.areaHa - a.areaHa);
}
