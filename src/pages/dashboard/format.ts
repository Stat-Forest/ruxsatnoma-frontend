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
