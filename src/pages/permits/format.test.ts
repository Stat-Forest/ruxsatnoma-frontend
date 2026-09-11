/**
 * F14 (`docs/plans/07.3-findings.md`) — `pickLocalizedName` used to
 * hard-code `uz_cyrl` for the `uz_latn` UI, true only before decision #90
 * made `uz_latn` the required (backfilled) field of every `LocalizedName`.
 * This is what made the permit document print
 * `Vakolatli organ: Бурчмулла ДЎХ` on an otherwise Latin page.
 */
import { normalizePermitSeries, pickLocalizedName, shortId } from './format';

const name = { uz_cyrl: 'Бурчмулла ДЎХ', uz_latn: 'Burchmulla DXX', ru: 'Бурчмуллинский ЛХ' };

test('a uz_latn reader gets the uz_latn field, never uz_cyrl', () => {
  expect(pickLocalizedName(name, 'uz_latn')).toBe('Burchmulla DXX');
});

test('a ru reader gets the ru field', () => {
  expect(pickLocalizedName(name, 'ru')).toBe('Бурчмуллинский ЛХ');
});

test('missing uz_latn (old, un-backfilled data) falls back honestly', () => {
  expect(pickLocalizedName({ uz_cyrl: 'Бурчмулла ДЎХ' }, 'uz_latn')).toBe('Бурчмулла ДЎХ');
});

test('no name at all reads as an empty string', () => {
  expect(pickLocalizedName(null, 'uz_latn')).toBe('');
});

// F15: two uuid7s sharing a leading timestamp must not render as the same
// truncated fingerprint (the applicant/organization fallback IDs on the
// permit requisites and timeline panels).
test('shortId reads the trailing, non-timestamp characters of a uuid7', () => {
  const first = '01a06d97-1234-7000-8000-0000000000aa';
  const second = '01a06d97-1234-7000-8000-0000000000bb';
  expect(shortId(first)).not.toBe(shortId(second));
});

// A2 (final review): the archive by-number modal now shares this
// normalisation with the permits register's own `toPermitsQuery` — a Latin
// keyboard's 'A' must resolve to the same Cyrillic series every seeded
// permit carries (`permit_series` setting), or the lookup silently misses.
const CYRILLIC_A = 'А'; // 'А'
const CYRILLIC_A_LOWER = 'а'; // 'а'

test('normalizePermitSeries maps Latin A/a to Cyrillic А', () => {
  expect(normalizePermitSeries('A')).toBe(CYRILLIC_A);
  expect(normalizePermitSeries('a')).toBe(CYRILLIC_A);
});

test('normalizePermitSeries maps lowercase Cyrillic а to uppercase Cyrillic А', () => {
  expect(normalizePermitSeries(CYRILLIC_A_LOWER)).toBe(CYRILLIC_A);
});

test('normalizePermitSeries trims surrounding whitespace', () => {
  expect(normalizePermitSeries('  A  ')).toBe(CYRILLIC_A);
});

test('normalizePermitSeries leaves an already-correct or unrelated series as typed', () => {
  expect(normalizePermitSeries(CYRILLIC_A)).toBe(CYRILLIC_A);
  expect(normalizePermitSeries('B')).toBe('B');
});
