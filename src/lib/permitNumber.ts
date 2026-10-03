/**
 * One box for a permit's number, typed the way it is printed — «А № 000002»,
 * «А 000002», «а2», «A-000002» — split into the `series` and `number` query
 * parameters `GET /permits` and `GET /public/permits/check` accept separately.
 *
 * The series is stored CYRILLIC («А», U+0410: `permits/repo.py::next_number`),
 * but a reader types it on a Latin keyboard, and `series` is matched exactly —
 * a Latin «A» would quietly find nothing. So every Latin letter that looks the
 * same as a Cyrillic capital is folded into that capital before it is sent.
 */

/** `permits/service.py::SERIES_MAX_LENGTH` — a longer series is a 422. */
const SERIES_MAX_LENGTH = 8;

const LATIN_LOOKALIKES: Record<string, string> = {
  A: 'А',
  B: 'В',
  C: 'С',
  E: 'Е',
  H: 'Н',
  K: 'К',
  M: 'М',
  O: 'О',
  P: 'Р',
  T: 'Т',
  X: 'Х',
};

export interface PermitNo {
  series?: string;
  number?: number;
}

/**
 * `{}` for an empty box, `{series}` / `{number}` for half a number (a list
 * filter can use either on its own), `null` when the text is not a permit
 * number at all — letters after the digits, a zero, a number past
 * `Number.MAX_SAFE_INTEGER` — so a caller can say so instead of sending a
 * query that answers "nothing found" for a typo.
 */
export function parsePermitNo(raw: string): PermitNo | null {
  const compact = raw.toUpperCase().replace(/[^\p{L}\d]/gu, '');
  if (!compact) return {};
  const match = /^(\p{L}*)(\d*)$/u.exec(compact);
  if (!match) return null;
  const [, letters, digits] = match;
  const result: PermitNo = {};
  if (letters) {
    if (letters.length > SERIES_MAX_LENGTH) return null;
    result.series = Array.from(letters, (ch) => LATIN_LOOKALIKES[ch] ?? ch).join('');
  }
  if (digits) {
    const number = Number(digits);
    if (!Number.isSafeInteger(number) || number <= 0) return null;
    result.number = number;
  }
  return result;
}
