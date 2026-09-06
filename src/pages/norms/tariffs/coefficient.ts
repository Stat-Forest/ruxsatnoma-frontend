/**
 * `TariffIn.coefficient` / `TariffPatch.coefficient` is a
 * `Decimal(ge=0, max_digits=12, decimal_places=6)` (`schemas.py`) carried on
 * the wire as a STRING on `TariffOut` (`field_serializer` there says why —
 * never parsed into a `float` for display, brief's own instruction). This
 * form sends the operator's typed text straight through as a string too, so
 * the value that reaches the server is exactly what was typed — no
 * `Number()`/`parseFloat` round trip to lose a trailing zero or shift a
 * digit through binary floating point.
 *
 * The check below approximates pydantic's own `max_digits` count (which
 * pydantic reads off `Decimal.as_tuple().digits`, i.e. a signed integer's
 * significant digits after `Decimal` has parsed the string) by stripping
 * insignificant leading zeros from the integer part before counting — close
 * enough to catch an operator's typo before it becomes a round trip, but not
 * a byte-for-byte reimplementation of `Decimal`'s own digit-counting rules
 * (e.g. a value with trailing zeros in the fractional part past the 12th
 * significant digit is a corner `Decimal.as_tuple()` may count differently).
 * A mismatch on that exact edge still reaches the server's own 422, same
 * class of gap `params/valueEditor.ts`'s JSON branch already accepts.
 */
export type CoefficientError = 'required' | 'invalid' | 'negative' | 'tooManyDigits';

export function coefficientError(text: string): CoefficientError | null {
  const trimmed = text.trim();
  if (trimmed === '') return 'required';
  if (trimmed.startsWith('-')) return 'negative';
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return 'invalid';
  const [integerPart, fractionalPart = ''] = trimmed.split('.');
  if (fractionalPart.length > 6) return 'tooManyDigits';
  const significantIntegerDigits = integerPart.replace(/^0+(?=\d)/, '').length;
  if (significantIntegerDigits + fractionalPart.length > 12) return 'tooManyDigits';
  return null;
}
