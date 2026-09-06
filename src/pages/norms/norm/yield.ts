/**
 * `NormIn.yield_c_per_ha` / `NormPatch.yield_c_per_ha` —
 * `Decimal(ge=0, max_digits=10, decimal_places=4)`, and OPTIONAL (`None` is
 * valid — "every other activity is legitimately yield-free", `service.py`'s
 * own comment). Unlike `tariffs/coefficient.ts`'s `coefficientError` (which
 * treats empty text as a `required` error), an empty field here is a valid
 * "no yield set" — `service.publish_norm` only refuses that for a GRAZING
 * norm, a fact this form surfaces as a warning at publish time rather than
 * as a blanket required-field rule the schema itself does not carry.
 *
 * Same approximation of `max_digits` as `coefficient.ts` (strips
 * insignificant leading zeros before counting) — see that file's header for
 * the exact caveat.
 */
export type YieldError = 'invalid' | 'negative' | 'tooManyDigits';

export function yieldError(text: string): YieldError | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (trimmed.startsWith('-')) return 'negative';
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return 'invalid';
  const [integerPart, fractionalPart = ''] = trimmed.split('.');
  if (fractionalPart.length > 4) return 'tooManyDigits';
  const significantIntegerDigits = integerPart.replace(/^0+(?=\d)/, '').length;
  if (significantIntegerDigits + fractionalPart.length > 10) return 'tooManyDigits';
  return null;
}
