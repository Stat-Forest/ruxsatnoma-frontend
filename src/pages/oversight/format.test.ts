/**
 * F15 (`docs/plans/07.3-findings.md`) — the seeded ids are uuid7, whose
 * LEADING characters are a millisecond timestamp. Two different records
 * logged moments apart in the same seed run used to render as the identical
 * "eight characters" in this oversight/audit register, which is exactly the
 * wrong place for that.
 */
import { formatObject, shortId } from './format';

test('two uuid7s sharing a timestamp prefix render as distinct fingerprints', () => {
  const first = '01a06d97-1234-7000-8000-0000000000aa';
  const second = '01a06d97-1234-7000-8000-0000000000bb';
  expect(shortId(first)).not.toBe(shortId(second));
});

test('a null id still reads as an em dash', () => {
  expect(shortId(null)).toBe('—');
});

test('formatObject still pairs the type with the (now trailing) fingerprint', () => {
  expect(formatObject('application', 'u0000000-0000-4000-8000-000000000001')).toBe('application · 00000001');
});
