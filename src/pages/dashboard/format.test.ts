import { formatCompactMoney, formatDelta, formatHectares, formatPercent, formatReviewDays } from './format';

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

// --- J3: occupancy percent and period-over-period delta --------------------

test('an occupancy percent renders to one decimal with a % suffix', () => {
  expect(formatPercent('42.50')).toBe('42.5%');
});

test('zero contours in scope reads as "—", never as a measured 0%', () => {
  expect(formatPercent(null)).toBe('—');
});

test('no comparison available renders as nothing, not a fabricated ±0', () => {
  expect(formatDelta(12, null)).toBeNull();
});

test('an unchanged figure between periods reads as ±0, not as no comparison', () => {
  expect(formatDelta(12, 12)).toBe('±0');
});

test('a positive delta carries a leading +, a negative one the real minus sign', () => {
  expect(formatDelta(12, 9)).toBe('+3');
  expect(formatDelta(9, 12)).toBe('−3');
});
