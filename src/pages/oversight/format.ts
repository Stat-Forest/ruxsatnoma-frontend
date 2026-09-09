/**
 * Display helpers for the oversight register (Track 3, stage 6.7 J3). Local
 * to this folder for the same reason `dashboard/format.ts` is local to its
 * own (that file's own header) — a small helper duplicated is cheaper than a
 * shared module every track has to merge around.
 */

/** The LAST 8 characters of a uuid — the same shortening
 *  `staff/format.ts::shortId` / `permits/format.ts::shortId` already use,
 *  duplicated here per this codebase's own convention rather than imported
 *  across page folders. F15 (`docs/plans/07.3-findings.md`): the seeded ids
 *  are uuid7, whose LEADING characters are a millisecond timestamp — two
 *  different records logged moments apart in the same seed run once showed
 *  as the identical "eight characters" here, which is exactly the wrong
 *  place for that in an oversight/audit register. The trailing characters
 *  are the random tail (RFC 9562), not derived from the clock. */
export function shortId(id: string | null): string {
  return id ? id.slice(-8) : '—';
}

export const OBJECT_TYPE_LABEL_KEYS: Record<string, string> = {
  application: 'leadership.oversight.object.application',
  permit: 'leadership.oversight.object.permit',
  invoice: 'leadership.oversight.object.invoice',
  report: 'leadership.oversight.object.report',
  inspection_act: 'leadership.oversight.object.act',
  act: 'leadership.oversight.object.act',
};

/** `object_type` + a shortened `object_id` — `"—"` when either is missing,
 *  never one half of a pair with the other silently dropped. */
export function formatObject(
  objectType: string | null,
  objectId: string | null,
  t?: (key: string) => string,
): string {
  if (!objectType || !objectId) return '—';
  let typeLabel = objectType;
  const key = OBJECT_TYPE_LABEL_KEYS[objectType];
  if (key && t) {
    const translated = t(key);
    if (translated && translated !== key) typeLabel = translated;
  } else if (t) {
    if (objectType === 'application') typeLabel = t('archive.typeApplication');
    else if (objectType === 'permit') typeLabel = t('archive.typePermit');
  }
  return `${typeLabel} · ${shortId(objectId)}`;
}

export const EVENT_TYPE_LABEL_KEYS: Record<string, string> = {
  application_submitted: 'leadership.oversight.event.application_submitted',
  'application.submitted': 'leadership.oversight.event.application_submitted',
  application_approved: 'leadership.oversight.event.application_approved',
  'application.approved': 'leadership.oversight.event.application_approved',
  application_rejected: 'leadership.oversight.event.application_rejected',
  'application.rejected': 'leadership.oversight.event.application_rejected',
  application_cancelled: 'leadership.oversight.event.application_cancelled',
  'application.cancelled': 'leadership.oversight.event.application_cancelled',
  payment_confirmed: 'leadership.oversight.event.payment_confirmed',
  'payment.confirmed': 'leadership.oversight.event.payment_confirmed',
  permit_issued: 'leadership.oversight.event.permit_issued',
  'permit.issued': 'leadership.oversight.event.permit_issued',
  permit_revoked: 'leadership.oversight.event.permit_revoked',
  'permit.revoked': 'leadership.oversight.event.permit_revoked',
  permit_suspended: 'leadership.oversight.event.permit_suspended',
  'permit.suspended': 'leadership.oversight.event.permit_suspended',
  report_submitted: 'leadership.oversight.event.report_submitted',
  'report.submitted': 'leadership.oversight.event.report_submitted',
  report_approved: 'leadership.oversight.event.report_approved',
  'report.approved': 'leadership.oversight.event.report_approved',
  inspection_act_created: 'leadership.oversight.event.inspection_act_created',
  'inspection.act_created': 'leadership.oversight.event.inspection_act_created',
};

export function formatEventType(
  eventType: string | null | undefined,
  t?: (key: string) => string,
): string {
  if (!eventType) return '—';
  const key = EVENT_TYPE_LABEL_KEYS[eventType];
  if (key && t) {
    const translated = t(key);
    if (translated && translated !== key) return translated;
  }
  return eventType;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}, ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/**
 * The neutral-to-alarming 4-step badge palette for a risk level — copied
 * verbatim from `dashboard/components/RiskIndicatorsCard.tsx`'s own
 * (module-private) palette rather than imported across page folders, so this
 * screen's badges and the dashboard card's own breakdown agree pixel-for-
 * pixel on what "high" looks like. Keep the two hand-in-sync if either ever
 * changes.
 */
const RISK_LEVEL_BADGE_CLASS: Record<string, string> = {
  low: 'bg-[#F8F9FA] text-[#5A646D] border-[#E4E7EA]',
  medium: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
  high: 'bg-[#FFEDD5] text-[#C2410C] border-[#FDBA74]',
  critical: 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]',
};

export function riskLevelBadgeClass(level: string): string {
  return RISK_LEVEL_BADGE_CLASS[level] ?? RISK_LEVEL_BADGE_CLASS.low;
}

/** `low`/`medium`/`high`/`critical` are generic words with an unambiguous
 *  translation, unlike `RI-01`..`RI-15` (a domain code rendered raw — see
 *  `queries.ts::RiskIndicatorCode`). */
export const RISK_LEVEL_LABEL_KEYS: Record<string, string> = {
  low: 'leadership.oversight.level.low',
  medium: 'leadership.oversight.level.medium',
  high: 'leadership.oversight.level.high',
  critical: 'leadership.oversight.level.critical',
};

export const RISK_STATUS_LABEL_KEYS: Record<string, string> = {
  new: 'leadership.oversight.status.new',
  in_review: 'leadership.oversight.status.inReview',
  closed: 'leadership.oversight.status.closed',
};

/** `RiskIndicatorOut.rn_status` / `OversightEventOut.rn_status` — the check
 *  constraint allows `internal|pending|sent|failed`, but nothing in this
 *  codebase ever moves it past `internal` today (RN transport, `tz/09`, does
 *  not exist yet). Rendered as a plain badge showing whatever the field
 *  actually says — never implying anything has been transmitted anywhere. */
export const RN_STATUS_LABEL_KEYS: Record<string, string> = {
  internal: 'leadership.oversight.rnStatus.internal',
  pending: 'leadership.oversight.rnStatus.pending',
  sent: 'leadership.oversight.rnStatus.sent',
  failed: 'leadership.oversight.rnStatus.failed',
};
