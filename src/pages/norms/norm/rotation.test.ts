import { parseRestYears, restYearsToText, rotationYears } from './rotation';

test('parseRestYears accepts comma- and space-separated integers', () => {
  expect(parseRestYears('2027, 2029')).toEqual({ years: [2027, 2029] });
  expect(parseRestYears('2027 2029')).toEqual({ years: [2027, 2029] });
  expect(parseRestYears('')).toEqual({ years: [] });
});

test('parseRestYears refuses a non-integer token, matching the schema\'s int list', () => {
  expect(parseRestYears('2027a')).toEqual({ error: true });
  expect(parseRestYears('2027, abc')).toEqual({ error: true });
  expect(parseRestYears('2027.5')).toEqual({ error: true });
});

test('restYearsToText/rotationYears round-trip through the wire shape', () => {
  expect(restYearsToText([2027, 2029])).toBe('2027, 2029');
  expect(rotationYears({ rest_years: [2027, 2029] })).toEqual([2027, 2029]);
  expect(rotationYears(null)).toEqual([]);
  expect(rotationYears({ rest_years: ['2027'] })).toEqual([]); // strings are not read back as years
});
