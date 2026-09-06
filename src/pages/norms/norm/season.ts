/**
 * `NormIn.season` (`Season { windows: SeasonWindow[] }`) — a list of
 * `{from, to}` MM-DD windows `checks._in_window` reads (`schemas.py`'s own
 * docstring). Edited as a list of draft rows, converted to the wire shape
 * only on submit — the same "draft rows, converted on submit" split
 * `tariffs/benefitModifiers.ts` uses for the identical reason (a row can be
 * mid-edit, e.g. `to` typed but `from` still empty, without that being a
 * value worth submitting).
 */
import { MONTH_DAY_PATTERN } from './labels';

export interface SeasonWindowRow {
  from: string;
  to: string;
}

export type SeasonWindowError = 'fromInvalid' | 'toInvalid';

export function seasonWindowError(row: SeasonWindowRow): SeasonWindowError | null {
  if (!MONTH_DAY_PATTERN.test(row.from)) return 'fromInvalid';
  if (!MONTH_DAY_PATTERN.test(row.to)) return 'toInvalid';
  return null;
}

/** A row with EITHER field still empty is a window the operator has not
 *  finished typing — dropped silently, the same "no code chosen yet" logic
 *  `benefitModifiers.ts::rowsToBenefitModifiers` documents. A row with both
 *  fields typed but one INVALID is not dropped: the form blocks submit on
 *  it instead (see `NormFormModal.tsx`), so this function is only ever
 *  called after that check has already passed. */
export function rowsToSeason(rows: SeasonWindowRow[]): { windows: SeasonWindowRow[] } | undefined {
  const windows = rows.filter((row) => row.from !== '' && row.to !== '');
  if (windows.length === 0) return undefined;
  return { windows };
}

/** `NormOut.season` is a bare `Record<string, unknown> | null` on the wire
 *  (it echoes whatever JSONB is stored, with no re-validation on read) — so
 *  this reads it defensively rather than assuming the exact `Season` shape
 *  `NormIn` sends, the same caution `RuleParameterOut.value` (`unknown`)
 *  already requires elsewhere in this track. A malformed stored row (there
 *  is no route that could write one through THIS form, but `norms` is a
 *  read-only view onto whatever the database actually holds) degrades to no
 *  rows rather than throwing. */
export function seasonToRows(season: Record<string, unknown> | null | undefined): SeasonWindowRow[] {
  const windows = season?.windows;
  if (!Array.isArray(windows)) return [];
  return windows
    .filter((w): w is { from: unknown; to: unknown } => typeof w === 'object' && w !== null)
    .map((w) => ({ from: typeof w.from === 'string' ? w.from : '', to: typeof w.to === 'string' ? w.to : '' }));
}
