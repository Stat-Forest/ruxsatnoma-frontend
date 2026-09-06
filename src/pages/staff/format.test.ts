/**
 * `slaStatus` (D3, 3.9b task 4) — the one fact this function exists to keep
 * honest: PENDING_INFO means the SLA clock is paused RIGHT NOW, whatever the
 * stored deadline says (`docs/status.md`'s fact #1).
 */
import { CHECK_RESULT_STYLE, localizedName, shortId, slaStatus, STATUS_LABELS, statusLabel } from './format';

const FUTURE = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
const SOON = new Date(Date.now() + 60 * 60 * 1000).toISOString();

test('PENDING_INFO is always "paused", even with a deadline already in the past', () => {
  expect(slaStatus('PENDING_INFO', PAST)).toBe('paused');
  expect(slaStatus('PENDING_INFO', FUTURE)).toBe('paused');
  expect(slaStatus('PENDING_INFO', null)).toBe('paused');
});

test('a null deadline outside PENDING_INFO is simply unknown, not overdue', () => {
  expect(slaStatus('IN_REVIEW', null)).toBeNull();
});

test('client-side fallback (no server verdict) compares the stored deadline to the wall clock', () => {
  expect(slaStatus('IN_REVIEW', PAST)).toBe('overdue');
  expect(slaStatus('IN_REVIEW', SOON)).toBe('soon');
  expect(slaStatus('IN_REVIEW', FUTURE)).toBe('normal');
});

test('the server verdict (sla_overdue) is preferred over recomputing from the deadline', () => {
  // A deadline that LOOKS overdue by the wall clock, but the server — which
  // knows the pause arithmetic and the business calendar — says it is not.
  expect(slaStatus('IN_REVIEW', PAST, false)).toBe('normal');
  expect(slaStatus('IN_REVIEW', FUTURE, true)).toBe('overdue');
});

test('RETURNED is never overdue, mirroring sla.SLA_ACTIVE_STATUSES exactly', () => {
  // `submit()` keeps the ORIGINAL deadline on a resubmission (ruling 16.1) —
  // a deadline that looks lapsed by the wall clock must not read as overdue
  // while the clock is not running.
  expect(slaStatus('RETURNED', PAST)).toBe('normal');
});

// F14 (`docs/plans/07.3-findings.md`): reference data used to reach staff
// screens in whatever language happened to come first in a fixed key order
// (`en`), never the account's own language. Decision #90 made `uz_latn` the
// required field of every `LocalizedName` (backfilled first).
describe('localizedName', () => {
  const name = { uz_cyrl: 'Чорва молларини боқиш', en: 'Livestock grazing', uz_latn: 'Chorva mollarini boqish' };

  test('a uz_latn account reads its own field, never English or Cyrillic', () => {
    expect(localizedName(name, 'uz_latn')).toBe('Chorva mollarini boqish');
  });

  test('a ru account reads its own field', () => {
    expect(localizedName({ ...name, ru: 'Выпас скота' }, 'ru')).toBe('Выпас скота');
  });

  test('missing uz_latn (old, un-backfilled data) falls back honestly, still never to English first', () => {
    expect(localizedName({ uz_cyrl: 'Чорва молларини боқиш', en: 'Livestock grazing' }, 'uz_latn')).toBe(
      'Чорва молларини боқиш',
    );
  });

  test('no name at all reads as an empty string', () => {
    expect(localizedName(null, 'uz_latn')).toBe('');
  });
});

// F16 (`docs/plans/07.3-findings.md`): staff lists used to print every
// status twice, in two languages — «Qoralama (Черновик)» — a development aid
// that shipped. The applicant's own screens never did this.
const CYRILLIC = /[А-Яа-яЁё]/;

test('no application status label carries a Russian gloss in brackets', () => {
  for (const label of Object.values(STATUS_LABELS)) {
    expect(label).not.toMatch(CYRILLIC);
    expect(label).not.toContain('(');
  }
  expect(statusLabel('SUBMITTED')).toBe('Yuborilgan');
});

test('no check-result label carries a Russian gloss in brackets', () => {
  for (const meta of Object.values(CHECK_RESULT_STYLE)) {
    expect(meta.label).not.toMatch(CYRILLIC);
    expect(meta.label).not.toContain('(');
  }
});

// F15 (`docs/plans/07.3-findings.md`): the seeded ids are uuid7, whose
// LEADING characters are a millisecond timestamp — two different actors
// created moments apart in the same seed run used to render as the
// identical "eight characters" here. The trailing, random tail actually
// tells them apart.
describe('shortId', () => {
  test('two uuid7s sharing a timestamp prefix render as distinct fingerprints', () => {
    const first = '01a06d97-1234-7000-8000-0000000000aa';
    const second = '01a06d97-1234-7000-8000-0000000000bb';
    expect(shortId(first)).not.toBe(shortId(second));
  });

  test('reads the trailing, non-timestamp characters', () => {
    expect(shortId('u0000000-0000-4000-8000-000000000001')).toBe('00000001');
  });
});
