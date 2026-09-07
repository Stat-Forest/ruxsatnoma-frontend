/**
 * F14 (`docs/plans/07.3-findings.md`) — `pickLocalizedName` used to
 * hard-code `uz_cyrl` for the `uz_latn` UI, true only before decision #90
 * made `uz_latn` the required (backfilled) field of every `LocalizedName`.
 * This is what made the permit document print
 * `Vakolatli organ: Бурчмулла ДЎХ` on an otherwise Latin page.
 */
import { pickLocalizedName, shortId } from './format';

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
