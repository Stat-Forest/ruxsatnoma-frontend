/**
 * Display helpers for the home screen's headline figures. Local to this
 * folder for the same reason `applicant/format.ts` is local to its own: a
 * small helper duplicated is cheaper than a shared module every track has to
 * merge around.
 */

/** Thousands separated by a plain space — the same separator
 *  `applicant/format.ts::formatMoney` already uses, so one money figure never
 *  renders differently from another on a neighbouring screen. */
function withSeparators(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** A season's money as the tile shows it: millions once there are millions to
 *  show, full digits below that. Rounding 420 000 to "0.42 mln" reads as
 *  small change; rounding it to "0 mln" would be a lie. */
export function formatCompactMoney(amount: number): string {
  if (amount >= 1_000_000) {
    const millions = Math.round((amount / 1_000_000) * 100) / 100;
    return `${millions} mln UZS`;
  }
  return `${withSeparators(String(Math.round(amount)))} UZS`;
}

/** Hectares to one decimal, always — a mix of `61` and `61.04` in one column
 *  reads as two different measurements rather than one rounded two ways. */
export function formatHectares(area: number): string {
  return area.toFixed(1);
}

/** An average review time, in whole days. Anything under a day reads as
 *  "<1" rather than "0": a decision taken the same day is fast, and "0 kun"
 *  reads as a figure nobody computed. */
export function formatReviewDays(averageDays: number): string {
  return averageDays < 1 ? '<1' : String(Math.round(averageDays));
}

/** `OccupancyKpiOut.avg_occupied_pct` — a fixed-scale `NUMERIC` serialized as
 *  a decimal string, or `null` when the slice held zero contours. `null`
 *  renders as "—", never "0%": zero contours is an absent measurement, not a
 *  measured occupancy of zero. */
export function formatPercent(value: string | null): string {
  if (value === null) return '—';
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  return `${parsed.toFixed(1)}%`;
}

/** The change between the current and the previous period's same figure —
 *  `null` when the backend did not compute one (`compare_previous` was off,
 *  or the field has no prior-period twin). The sign uses U+2212 (real minus),
 *  the same convention this codebase's money/number formatting already
 *  follows, never the ASCII hyphen-minus. */
export function formatDelta(current: number, previous: number | null): string | null {
  if (previous === null) return null;
  const diff = current - previous;
  if (diff === 0) return '±0';
  return diff > 0 ? `+${diff}` : `−${Math.abs(diff)}`;
}
