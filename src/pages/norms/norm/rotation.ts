/**
 * `NormIn.rotation` (`Rotation { rest_years: number[] }`) — INTEGERS, on
 * purpose (`schemas.py`'s own docstring: written as strings, the shape a
 * JSON form happily produces, used to compare `int` against `str` and pass
 * silently for a resting year). Edited as one comma/space-separated text
 * field and parsed to `number[]` only on submit, so a typo (`"2027a"`) is
 * refused here rather than reaching the wire as a string the check would
 * silently mis-compare.
 */
export function parseRestYears(text: string): { years: number[] } | { error: true } {
  const trimmed = text.trim();
  if (trimmed === '') return { years: [] };
  const tokens = trimmed.split(/[,\s]+/).filter((t) => t !== '');
  const years: number[] = [];
  for (const token of tokens) {
    if (!/^\d+$/.test(token)) return { error: true };
    years.push(Number(token));
  }
  return { years };
}

export function restYearsToText(years: number[]): string {
  return years.join(', ');
}

/** Same read-defensively reasoning as `season.ts::seasonToRows` —
 *  `NormOut.rotation` is a bare `Record<string, unknown> | null` on the
 *  wire. */
export function rotationYears(rotation: Record<string, unknown> | null | undefined): number[] {
  const restYears = rotation?.rest_years;
  if (!Array.isArray(restYears)) return [];
  return restYears.filter((y): y is number => typeof y === 'number');
}
