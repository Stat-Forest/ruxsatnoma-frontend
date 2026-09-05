import { formatCompactMoney, formatHectares, formatReviewDays } from './format';

test('a sum in the millions is shown as millions, the way the tile reads it', () => {
  expect(formatCompactMoney(3680000)).toBe('3.68 mln UZS');
});

test('a sum below a million keeps its digits rather than rounding to 0.0 mln', () => {
  expect(formatCompactMoney(420000)).toBe('420 000 UZS');
});

test('zero is a real answer, not a dash', () => {
  expect(formatCompactMoney(0)).toBe('0 UZS');
});

test('an area always carries one decimal, so 61 and 61.04 do not read as different precisions', () => {
  expect(formatHectares(61)).toBe('61.0');
  expect(formatHectares(42.64)).toBe('42.6');
});

test('a review that finished the same day reads as under a day, not as zero', () => {
  expect(formatReviewDays(0.4)).toBe('<1');
  expect(formatReviewDays(0)).toBe('<1');
});

test('a review measured in days is rounded to whole days', () => {
  expect(formatReviewDays(8.6)).toBe('9');
});
