import {
  activePermitsSummary,
  applicationsInProgress,
  areaByActivity,
  contourRows,
  monthlySeries,
  nearestExpiry,
  reviewStats,
  seasonalPayments,
} from './metrics';
import { application, invoice, permit } from './fixtures';

/** Every "today" below is this date, so a fixture's `period_to` reads as a
 *  fixed number of days away rather than drifting with the wall clock. */
const TODAY = '2026-09-05';

// --- tile 1: active permits and their area -------------------------------

test('the area tile sums only ACTIVE permits', () => {
  const summary = activePermitsSummary([
    permit({ status: 'active', area_ha: '42.6000' }),
    permit({ status: 'active', area_ha: '18.4000' }),
    permit({ status: 'expired', area_ha: '99.0000' }),
    permit({ status: 'pending_signatures', area_ha: '77.0000' }),
  ]);

  expect(summary.count).toBe(2);
  expect(summary.totalAreaHa).toBeCloseTo(61.0);
});

test('no permits reads as zero area, never NaN', () => {
  expect(activePermitsSummary([])).toEqual({ count: 0, totalAreaHa: 0 });
});

// --- tile 2: applications still moving -----------------------------------

test('an application in progress is one that is not yet finished', () => {
  const summary = applicationsInProgress([
    application({ status: 'SUBMITTED' }),
    application({ status: 'IN_REVIEW' }),
    application({ status: 'INVOICED' }),
    application({ status: 'CANCELLED' }),
    application({ status: 'PERMIT_ISSUED' }),
    application({ status: 'REJECTED' }),
  ]);

  expect(summary.count).toBe(3);
});

test('only an INVOICED application is waiting for the citizen to pay', () => {
  const summary = applicationsInProgress([
    application({ status: 'INVOICED' }),
    application({ status: 'INVOICED' }),
    application({ status: 'IN_REVIEW' }),
  ]);

  expect(summary.awaitingPayment).toBe(2);
});

// --- tile 3: the season's money ------------------------------------------

test('the season total is the sum of the active permits own amounts', () => {
  const summary = seasonalPayments(
    [
      permit({ status: 'active', amount: '2680000.00' }),
      permit({ status: 'active', amount: '1000000.00' }),
      permit({ status: 'revoked', amount: '5000000.00' }),
    ],
    [],
  );

  expect(summary.totalAmount).toBeCloseTo(3680000);
});

test('the receipt share counts paid invoices against all of them', () => {
  const summary = seasonalPayments(
    [],
    [invoice({ paid_at: '2026-04-12T10:00:00+05:00' }), invoice({ paid_at: null })],
  );

  expect(summary.receiptsConfirmedPct).toBe(50);
});

test('with no invoice at all the receipt share is unknown, not 100%', () => {
  expect(seasonalPayments([], []).receiptsConfirmedPct).toBeNull();
});

// --- tile 4: the nearest expiry (replaces the field-inspection tile) ------

test('the nearest expiry is the soonest ACTIVE permit still ahead of today', () => {
  const nearest = nearestExpiry(
    [
      permit({ status: 'active', period_to: '2026-11-26' }),
      permit({ status: 'active', period_to: '2026-09-26' }),
      permit({ status: 'expired', period_to: '2026-09-06' }),
    ],
    TODAY,
  );

  expect(nearest?.daysLeft).toBe(21);
});

test('a permit whose period ended is not the nearest expiry', () => {
  const nearest = nearestExpiry([permit({ status: 'active', period_to: '2026-09-01' })], TODAY);

  expect(nearest).toBeNull();
});

// --- the dynamics chart ---------------------------------------------------

test('the dynamics chart returns one point per month of the window', () => {
  const series = monthlySeries({ applications: [], permits: [], invoices: [] }, { today: TODAY, months: 6 });

  expect(series).toHaveLength(6);
  expect(series[0].key).toBe('2026-04');
  expect(series[5].key).toBe('2026-09');
});

test('each event lands in the month it happened in', () => {
  const series = monthlySeries(
    {
      applications: [
        application({ submitted_at: '2026-06-10T10:00:00+05:00' }),
        application({ submitted_at: '2026-06-20T10:00:00+05:00' }),
      ],
      permits: [permit({ issued_at: '2026-07-01T10:00:00+05:00' })],
      invoices: [invoice({ paid_at: '2026-08-15T10:00:00+05:00' })],
    },
    { today: TODAY, months: 6 },
  );

  const at = (key: string) => series.find((point) => point.key === key)!;
  expect(at('2026-06').applications).toBe(2);
  expect(at('2026-07').permits).toBe(1);
  expect(at('2026-08').payments).toBe(1);
});

test('an event older than the window is left out rather than folded into the first month', () => {
  const series = monthlySeries(
    { applications: [application({ submitted_at: '2024-01-10T10:00:00+05:00' })], permits: [], invoices: [] },
    { today: TODAY, months: 6 },
  );

  expect(series.reduce((sum, point) => sum + point.applications, 0)).toBe(0);
});

test('an application never submitted contributes to no month', () => {
  const series = monthlySeries(
    { applications: [application({ submitted_at: null })], permits: [], invoices: [] },
    { today: TODAY, months: 6 },
  );

  expect(series.reduce((sum, point) => sum + point.applications, 0)).toBe(0);
});

// --- the footer under the chart ------------------------------------------

test('the average review time counts only applications that were decided', () => {
  const stats = reviewStats([
    application({ submitted_at: '2026-04-01T00:00:00+05:00', decided_at: '2026-04-11T00:00:00+05:00' }),
    application({ submitted_at: '2026-05-01T00:00:00+05:00', decided_at: '2026-05-09T00:00:00+05:00' }),
    application({ submitted_at: '2026-06-01T00:00:00+05:00', decided_at: null }),
  ]);

  expect(stats.avgReviewDays).toBe(9);
});

test('SLA is met when the decision landed on or before the deadline', () => {
  const stats = reviewStats([
    application({
      sla_deadline_at: '2026-04-15T00:00:00+05:00',
      decided_at: '2026-04-14T00:00:00+05:00',
      submitted_at: '2026-04-01T00:00:00+05:00',
    }),
    application({
      sla_deadline_at: '2026-05-15T00:00:00+05:00',
      decided_at: '2026-05-20T00:00:00+05:00',
      submitted_at: '2026-05-01T00:00:00+05:00',
    }),
  ]);

  expect(stats.slaOnTimePct).toBe(50);
});

test('an application with no SLA deadline is left out of the SLA share', () => {
  const stats = reviewStats([
    application({ sla_deadline_at: null, decided_at: '2026-04-14T00:00:00+05:00' }),
  ]);

  expect(stats.slaOnTimePct).toBeNull();
});

test('the success share weighs approved outcomes against rejected ones', () => {
  const stats = reviewStats([
    application({ status: 'PERMIT_ISSUED' }),
    application({ status: 'APPROVED' }),
    application({ status: 'INVOICED' }),
    application({ status: 'REJECTED' }),
    application({ status: 'IN_REVIEW' }),
  ]);

  expect(stats.approvedPct).toBe(75);
});

test('the history line spans the first and last application years', () => {
  const stats = reviewStats([
    application({ created_at: '2024-03-01T00:00:00+05:00' }),
    application({ created_at: '2026-09-01T00:00:00+05:00' }),
  ]);

  expect(stats.total).toBe(2);
  expect(stats.yearsFrom).toBe(2024);
  expect(stats.yearsTo).toBe(2026);
});

// --- the donut ------------------------------------------------------------

test('the donut splits the active area by activity type', () => {
  const slices = areaByActivity([
    permit({ status: 'active', activity_type_id: 'grazing', area_ha: '42.6000' }),
    permit({ status: 'active', activity_type_id: 'haymaking', area_ha: '18.4000' }),
    permit({ status: 'expired', activity_type_id: 'haymaking', area_ha: '50.0000' }),
  ]);

  expect(slices).toHaveLength(2);
  expect(slices[0]).toMatchObject({ activityTypeId: 'grazing', areaHa: 42.6 });
  expect(slices[0].pct).toBeCloseTo(69.8, 1);
});

test('two permits on the same activity are one slice', () => {
  const slices = areaByActivity([
    permit({ status: 'active', activity_type_id: 'grazing', area_ha: '20.0000' }),
    permit({ status: 'active', activity_type_id: 'grazing', area_ha: '22.6000' }),
  ]);

  expect(slices).toHaveLength(1);
  expect(slices[0].areaHa).toBeCloseTo(42.6);
  expect(slices[0].pct).toBe(100);
});

// --- the bar chart --------------------------------------------------------

test('each active permit is a bar carrying its area and the days it has left', () => {
  const rows = contourRows(
    [
      permit({ status: 'active', contour_id: 'c-1', area_ha: '42.6000', period_to: '2026-11-26' }),
      permit({ status: 'active', contour_id: 'c-2', area_ha: '18.4000', period_to: '2026-09-26' }),
    ],
    TODAY,
  );

  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({ contourId: 'c-1', areaHa: 42.6, daysLeft: 82 });
  expect(rows[1].daysLeft).toBe(21);
});

test('a permit already past its end date shows no negative days', () => {
  const rows = contourRows([permit({ status: 'active', period_to: '2026-08-01' })], TODAY);

  expect(rows[0].daysLeft).toBe(0);
});

test('the bars are ordered by the area they cover, largest first', () => {
  const rows = contourRows(
    [
      permit({ status: 'active', contour_id: 'small', area_ha: '12.0000' }),
      permit({ status: 'active', contour_id: 'big', area_ha: '42.6000' }),
    ],
    TODAY,
  );

  expect(rows.map((row) => row.contourId)).toEqual(['big', 'small']);
});
