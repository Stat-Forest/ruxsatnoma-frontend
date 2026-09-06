import { rowsToSeason, seasonToRows, seasonWindowError } from './season';

test('seasonWindowError enforces the MM-DD pattern, no calendar validation beyond it', () => {
  expect(seasonWindowError({ from: '05-01', to: '09-30' })).toBeNull();
  // The backend's own pattern has no calendar semantics — "13-99" is a
  // syntactically valid MM-DD to it, and this mirrors that leniency exactly
  // rather than being stricter than the API (this file's own header note).
  expect(seasonWindowError({ from: '13-99', to: '09-30' })).toBeNull();
  expect(seasonWindowError({ from: '5-1', to: '09-30' })).toBe('fromInvalid');
  expect(seasonWindowError({ from: '05-01', to: '2026-09-30' })).toBe('toInvalid');
});

test('rowsToSeason drops a row where either field is still empty', () => {
  expect(rowsToSeason([{ from: '', to: '' }])).toBeUndefined();
  expect(rowsToSeason([{ from: '05-01', to: '' }])).toBeUndefined();
  expect(rowsToSeason([])).toBeUndefined();
});

test('rowsToSeason converts fully-typed rows to the wire shape', () => {
  expect(rowsToSeason([{ from: '05-01', to: '09-30' }])).toEqual({ windows: [{ from: '05-01', to: '09-30' }] });
});

test('seasonToRows reads the wire shape back, defensively against a malformed stored value', () => {
  expect(seasonToRows(null)).toEqual([]);
  expect(seasonToRows(undefined)).toEqual([]);
  expect(seasonToRows({})).toEqual([]);
  expect(seasonToRows({ windows: 'not-an-array' })).toEqual([]);
  expect(seasonToRows({ windows: [{ from: '05-01', to: '09-30' }] })).toEqual([{ from: '05-01', to: '09-30' }]);
  expect(seasonToRows({ windows: [{ from: 5, to: '09-30' }] })).toEqual([{ from: '', to: '09-30' }]);
});
