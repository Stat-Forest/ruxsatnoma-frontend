import { describe, expect, test } from 'vitest';
import {
  addMonths,
  daysInMonth,
  firstWeekdayMon0,
  formatQuantity,
  isIsoDateInWindows,
  isoDaySpan,
  parseWindows,
  unitLabel,
} from './seasonCalendar';

describe('parseWindows', () => {
  test('keeps well-formed MM-DD pairs', () => {
    expect(parseWindows([{ from: '11-01', to: '03-31' }])).toEqual([{ from: '11-01', to: '03-31' }]);
  });

  test('drops a malformed entry rather than crashing — never a 500 on pre-existing bad data', () => {
    expect(parseWindows([{ from: '2026-11-01', to: '03-31' }, { from: '05-01', to: '09-30' }])).toEqual([
      { from: '05-01', to: '09-30' },
    ]);
    expect(parseWindows([{ from: 'nope' }, null, 'garbage', 42])).toEqual([]);
  });

  test('a non-array input is treated as no windows at all', () => {
    expect(parseWindows(undefined)).toEqual([]);
    expect(parseWindows(null)).toEqual([]);
  });
});

describe('isIsoDateInWindows', () => {
  test('no windows at all means no restriction (season_source: "none")', () => {
    expect(isIsoDateInWindows('2026-07-15', [])).toBe(true);
  });

  test('a plain, non-wrapping window', () => {
    const windows = [{ from: '05-01', to: '09-30' }];
    expect(isIsoDateInWindows('2026-05-01', windows)).toBe(true); // inclusive start
    expect(isIsoDateInWindows('2026-09-30', windows)).toBe(true); // inclusive end
    expect(isIsoDateInWindows('2026-07-15', windows)).toBe(true); // mid-window
    expect(isIsoDateInWindows('2026-04-30', windows)).toBe(false); // just before
    expect(isIsoDateInWindows('2026-10-01', windows)).toBe(false); // just after
  });

  // Decision #177's own worked example: "11-01" -> "03-31".
  describe('a window that wraps the new year', () => {
    const windows = [{ from: '11-01', to: '03-31' }];

    test('a date on the Nov/Dec side of the wrap', () => {
      expect(isIsoDateInWindows('2026-11-01', windows)).toBe(true);
      expect(isIsoDateInWindows('2026-12-25', windows)).toBe(true);
    });

    test('a date on the Jan-Mar side of the wrap, in the FOLLOWING year', () => {
      expect(isIsoDateInWindows('2027-01-15', windows)).toBe(true);
      expect(isIsoDateInWindows('2027-03-31', windows)).toBe(true); // inclusive end
    });

    test('a date genuinely outside the window, mid-year', () => {
      expect(isIsoDateInWindows('2026-06-15', windows)).toBe(false);
      expect(isIsoDateInWindows('2027-04-01', windows)).toBe(false); // just past the wrap
      expect(isIsoDateInWindows('2026-10-31', windows)).toBe(false); // just before the wrap
    });
  });

  test('any matching window is enough when several are configured', () => {
    const windows = [
      { from: '05-01', to: '06-30' },
      { from: '09-01', to: '10-31' },
    ];
    expect(isIsoDateInWindows('2026-05-15', windows)).toBe(true);
    expect(isIsoDateInWindows('2026-10-15', windows)).toBe(true);
    expect(isIsoDateInWindows('2026-07-15', windows)).toBe(false);
  });
});

test('isoDaySpan counts whole calendar days, in UTC', () => {
  expect(isoDaySpan('2026-01-01', '2026-01-31')).toBe(30);
  expect(isoDaySpan('2026-01-01', '2026-01-01')).toBe(0);
});

test('addMonths/daysInMonth/firstWeekdayMon0 stay consistent across a year boundary', () => {
  expect(addMonths('2026-12', 1)).toBe('2027-01');
  expect(addMonths('2026-01', -1)).toBe('2025-12');
  expect(daysInMonth('2026-02')).toBe(28); // not a leap year
  expect(daysInMonth('2028-02')).toBe(29); // leap year
  // 2026-01-01 is a Thursday -> Monday-first index 3.
  expect(firstWeekdayMon0('2026-01')).toBe(3);
});

describe('unit rendering — decision #177, item 3', () => {
  const t = (key: string) => (key === 'wizard.step3.conditionalHead' ? 'shartli bosh' : key);

  test('grazing\'s "sb" renders through the conditional-head term, not the missing quantityUnit.sb key', () => {
    expect(unitLabel('sb', t, 'uz_latn')).toBe('shartli bosh');
  });

  test('a known non-grazing unit renders its translated label', () => {
    expect(unitLabel('ha', t, 'uz_latn')).toBe('ga');
    expect(unitLabel('hive', t, 'uz_latn')).toBe('ari uyasi');
  });

  test('an unknown or absent unit is NOT guessed at as a word', () => {
    expect(unitLabel('kg', t, 'uz_latn')).toBeNull();
    expect(unitLabel(null, t, 'uz_latn')).toBeNull();
    expect(unitLabel(undefined, t, 'uz_latn')).toBeNull();
  });

  test('formatQuantity renders a bare number for an unknown unit, a labelled one otherwise', () => {
    expect(formatQuantity('40.0000', 'sb', t, 'uz_latn')).toBe('40 shartli bosh');
    expect(formatQuantity('2.5000', 'ha', t, 'uz_latn')).toBe('2,5 ga');
    expect(formatQuantity('7', 'unknown_unit', t, 'uz_latn')).toBe('7');
  });
});
