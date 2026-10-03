import { parsePermitNo } from './permitNumber';

test.each([
  ['А № 000002', { series: 'А', number: 2 }],
  ['А 000002', { series: 'А', number: 2 }],
  ['А№000002', { series: 'А', number: 2 }],
  ['а2', { series: 'А', number: 2 }],
  ['  А-000002 ', { series: 'А', number: 2 }],
])('reads the printed form %j as series + number', (raw, expected) => {
  expect(parsePermitNo(raw)).toEqual(expected);
});

test('a Latin lookalike is folded into the Cyrillic series the database stores', () => {
  // U+0041 in, U+0410 out: `series` is matched exactly server-side.
  expect(parsePermitNo('A 000002')).toEqual({ series: 'А', number: 2 });
  expect(parsePermitNo('a000002')).toEqual({ series: 'А', number: 2 });
  expect(parsePermitNo('ek 7')).toEqual({ series: 'ЕК', number: 7 });
});

test('half a number is still a filter', () => {
  expect(parsePermitNo('000155')).toEqual({ number: 155 });
  expect(parsePermitNo('А')).toEqual({ series: 'А' });
});

test('an empty box filters nothing', () => {
  expect(parsePermitNo('')).toEqual({});
  expect(parsePermitNo('  № ')).toEqual({});
});

test.each(['000002А', 'А 12 Б', '0', 'А 000000', 'АБВГДЕЖЗИ 1', '99999999999999999999'])(
  '%j is not a permit number',
  (raw) => {
    expect(parsePermitNo(raw)).toBeNull();
  },
);
