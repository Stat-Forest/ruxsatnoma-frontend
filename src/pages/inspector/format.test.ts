/**
 * F14 (`docs/plans/07.3-findings.md`) — copied verbatim from
 * `permits/format.ts`'s own stale `pickLocalizedName`, this returned
 * `uz_cyrl` for every language other than `'ru'`. Wrong since decision #90
 * made `uz_latn` the required (backfilled) field of every `LocalizedName`.
 */
import { pickLocalizedName } from './format';

const name = { uz_cyrl: 'Молхона текшируви', uz_latn: 'Molxona tekshiruvi', ru: 'Проверка фермы' };

test('a uz_latn reader gets the uz_latn field, never uz_cyrl', () => {
  expect(pickLocalizedName(name, 'uz_latn')).toBe('Molxona tekshiruvi');
});

test('a ru reader gets the ru field', () => {
  expect(pickLocalizedName(name, 'ru')).toBe('Проверка фермы');
});

test('a uz_cyrl reader still gets the uz_cyrl field', () => {
  expect(pickLocalizedName(name, 'uz_cyrl')).toBe('Молхона текшируви');
});

test('missing uz_latn (old, un-backfilled data) falls back honestly', () => {
  expect(pickLocalizedName({ uz_cyrl: 'Молхона текшируви' }, 'uz_latn')).toBe('Молхона текшируви');
});

test('no name at all reads as an empty string', () => {
  expect(pickLocalizedName(undefined, 'uz_latn')).toBe('');
});
