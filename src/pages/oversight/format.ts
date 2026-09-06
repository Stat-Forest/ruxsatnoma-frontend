/**
 * Display helpers for the oversight register (Track 3, stage 6.7 J3). Local
 * to this folder for the same reason `dashboard/format.ts` is local to its
 * own (that file's own header) — a small helper duplicated is cheaper than a
 * shared module every track has to merge around.
 */

/** The first 8 characters of a uuid — the same shortening
 *  `staff/format.ts::shortId` / `permits/format.ts::shortId` already use,
 *  duplicated here per this codebase's own convention rather than imported
 *  across page folders. */
export function shortId(id: string | null): string {
  return id ? id.slice(0, 8) : '—';
}

/** `object_type` + a shortened `object_id` — `"—"` when either is missing,
 *  never one half of a pair with the other silently dropped. */
export function formatObject(objectType: string | null, objectId: string | null): string {
  if (!objectType || !objectId) return '—';
  return `${objectType} · ${shortId(objectId)}`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
