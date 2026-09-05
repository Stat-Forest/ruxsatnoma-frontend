import { yieldError } from './yield';

test('empty text is valid — yield is optional', () => {
  expect(yieldError('')).toBeNull();
  expect(yieldError('   ')).toBeNull();
});

test('a leading minus is refused as negative', () => {
  expect(yieldError('-1')).toBe('negative');
});

test('non-numeric text is invalid', () => {
  expect(yieldError('abc')).toBe('invalid');
});

test('more than 4 fractional digits is refused, mirroring decimal_places=4', () => {
  expect(yieldError('1.12345')).toBe('tooManyDigits');
  expect(yieldError('1.1234')).toBeNull();
});

test('more than 10 total significant digits is refused, mirroring max_digits=10', () => {
  expect(yieldError('123456.1234')).toBeNull(); // 6 + 4 = 10, exactly the bound
  expect(yieldError('1234567.1234')).toBe('tooManyDigits'); // 7 + 4 = 11
});

test('a plain positive number is valid', () => {
  expect(yieldError('0')).toBeNull();
  expect(yieldError('12.5')).toBeNull();
});
