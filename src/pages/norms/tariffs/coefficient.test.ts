import { coefficientError } from './coefficient';

test('empty text is required', () => {
  expect(coefficientError('')).toBe('required');
  expect(coefficientError('   ')).toBe('required');
});

test('a leading minus is refused as negative, distinctly from a garbled number', () => {
  expect(coefficientError('-1')).toBe('negative');
  expect(coefficientError('-0.5')).toBe('negative');
});

test('non-numeric text is invalid', () => {
  expect(coefficientError('abc')).toBe('invalid');
  expect(coefficientError('1.2.3')).toBe('invalid');
  expect(coefficientError('1,5')).toBe('invalid');
});

test('more than 6 fractional digits is refused, mirroring decimal_places=6', () => {
  expect(coefficientError('1.1234567')).toBe('tooManyDigits');
  expect(coefficientError('1.123456')).toBeNull();
});

test('more than 12 total significant digits is refused, mirroring max_digits=12', () => {
  expect(coefficientError('1234567.123456')).toBe('tooManyDigits'); // 7 + 6 = 13
  expect(coefficientError('123456.123456')).toBeNull(); // 6 + 6 = 12
});

test('insignificant leading zeros in the integer part do not count toward max_digits', () => {
  // Approximates pydantic's own Decimal.as_tuple() digit count (this file's
  // own header comment) — "000001.5" is really just "1.5", two significant
  // digits, not eight.
  expect(coefficientError('000001.5')).toBeNull();
});

test('a plain integer and zero are both valid', () => {
  expect(coefficientError('0')).toBeNull();
  expect(coefficientError('10')).toBeNull();
  expect(coefficientError('1.5')).toBeNull();
});
