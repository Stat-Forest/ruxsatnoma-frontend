/**
 * Pure-function tests for the benefit-verification office's own display
 * helpers — the queue ordering (`compareForQueue`) is the one place this
 * screen can genuinely be wrong, so it carries its own tests separate from
 * the rendering tests in `BenefitVerificationPage.test.tsx` (the same split
 * `pages/dashboard/metrics.ts`'s own header comment explains).
 */
import { compareForQueue, waitingDays, formatWaitingDays } from './format';
import type { ApplicationOut } from './api';

function claim(overrides: Partial<ApplicationOut> = {}): ApplicationOut {
  return {
    id: 'a1000000-0000-4000-8000-000000000001',
    number: 'RX-2026-000001',
    status: 'IN_REVIEW',
    applicant_id: 'p1000000-0000-4000-8000-000000000001',
    submitted_by_user_id: 'p1000000-0000-4000-8000-000000000001',
    on_behalf: 'self',
    representation_id: null,
    activity_type_id: 'ac000000-0000-4000-8000-000000000001',
    contour_id: null,
    contour_version_id: null,
    requested_area_ha: null,
    period_from: '2026-09-01',
    period_to: '2026-10-01',
    quantity: null,
    channel: 'portal',
    kind: 'new',
    benefit_category_item_id: 'bc000000-0000-4000-8000-000000000001',
    benefit_certificate_no: 'CERT-001',
    benefit_verification_status: 'pending',
    benefit_verified_by: null,
    benefit_verified_at: null,
    benefit_rejection_reason: null,
    rejection_reason_item_id: null,
    assigned_org_id: null,
    assigned_user_id: null,
    parent_application_id: null,
    sla_deadline_at: null,
    submitted_at: '2026-09-01T10:00:00Z',
    decided_at: null,
    created_at: '2026-09-01T09:00:00Z',
    updated_at: '2026-09-01T10:00:00Z',
    ...overrides,
  };
}

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-10T10:00:00Z') }));
afterEach(() => vi.useRealTimers());

test('waitingDays counts from submitted_at to now for a still-pending claim', () => {
  const row = claim({ submitted_at: '2026-09-05T10:00:00Z', benefit_verification_status: 'pending' });
  expect(waitingDays(row)).toBe(5);
});

test('waitingDays stops at the decision for a claim already verified — it does not keep counting', () => {
  const row = claim({
    submitted_at: '2026-09-01T10:00:00Z',
    benefit_verification_status: 'verified',
    benefit_verified_at: '2026-09-03T10:00:00Z',
  });
  // 2 days to the decision, not 9 days to "now" — an old verified claim must
  // not read as still waiting.
  expect(waitingDays(row)).toBe(2);
});

test('waitingDays falls back to created_at when submitted_at is missing', () => {
  const row = claim({ submitted_at: null, created_at: '2026-09-07T10:00:00Z' });
  expect(waitingDays(row)).toBe(3);
});

test('formatWaitingDays renders every dictionary language without throwing', () => {
  expect(formatWaitingDays(5, 'uz_latn')).toContain('5');
  expect(formatWaitingDays(1, 'ru')).toBe('1 день');
  expect(formatWaitingDays(5, 'ru')).toBe('5 дней');
  expect(formatWaitingDays(1, 'en')).toBe('1 day');
  expect(formatWaitingDays(5, 'en')).toBe('5 days');
});

test('compareForQueue puts every pending claim before every decided one', () => {
  const pendingNew = claim({ id: 'p-new', benefit_verification_status: 'pending', submitted_at: '2026-09-09T00:00:00Z' });
  const pendingOld = claim({ id: 'p-old', benefit_verification_status: 'pending', submitted_at: '2026-09-01T00:00:00Z' });
  const verified = claim({ id: 'v', benefit_verification_status: 'verified', benefit_verified_at: '2026-09-08T00:00:00Z' });
  const rejected = claim({ id: 'r', benefit_verification_status: 'rejected', benefit_verified_at: '2026-09-09T00:00:00Z' });

  const sorted = [verified, rejected, pendingNew, pendingOld].sort(compareForQueue);

  // Both pending claims come first, in SOME order between them (checked
  // next); both decided ones come after, whatever order they arrive in.
  expect(sorted.slice(0, 2).map((c) => c.id).sort()).toEqual(['p-new', 'p-old']);
  expect(sorted.slice(2).map((c) => c.id).sort()).toEqual(['r', 'v']);
});

test('compareForQueue orders pending claims oldest-waiting first — a FIFO queue', () => {
  const pendingNew = claim({ id: 'p-new', benefit_verification_status: 'pending', submitted_at: '2026-09-09T00:00:00Z' });
  const pendingOld = claim({ id: 'p-old', benefit_verification_status: 'pending', submitted_at: '2026-09-01T00:00:00Z' });

  const sorted = [pendingNew, pendingOld].sort(compareForQueue);

  expect(sorted.map((c) => c.id)).toEqual(['p-old', 'p-new']);
});

test('compareForQueue orders decided claims most-recently-decided first — its own history', () => {
  const olderDecision = claim({ id: 'older', benefit_verification_status: 'verified', benefit_verified_at: '2026-09-01T00:00:00Z' });
  const newerDecision = claim({ id: 'newer', benefit_verification_status: 'rejected', benefit_verified_at: '2026-09-08T00:00:00Z' });

  const sorted = [olderDecision, newerDecision].sort(compareForQueue);

  expect(sorted.map((c) => c.id)).toEqual(['newer', 'older']);
});
