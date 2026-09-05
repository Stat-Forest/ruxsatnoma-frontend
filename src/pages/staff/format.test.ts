/**
 * `slaStatus` (D3, 3.9b task 4) — the one fact this function exists to keep
 * honest: PENDING_INFO means the SLA clock is paused RIGHT NOW, whatever the
 * stored deadline says (`docs/status.md`'s fact #1).
 */
import { slaStatus } from './format';

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
