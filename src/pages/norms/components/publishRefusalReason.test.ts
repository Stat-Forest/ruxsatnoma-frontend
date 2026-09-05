/**
 * The pure decision `PublishConfirmDialog`'s callers rely on to turn one of
 * the four refusals (task-4 brief) into a reason key — see
 * `ParamsTab.test.tsx`'s own describe block for the end-to-end version of
 * the same four cases, rendered with real copy.
 */
import { ApiError } from '../../../api/errors';
import { publishRefusalReason } from './publishRefusalReason';

test('not_draft', () => {
  const error = new ApiError('ERR-NORM-005', 'not a draft', { reason: 'not_draft' });
  expect(publishRefusalReason(error)).toBe('not_draft');
});

test('not_maker_checker', () => {
  const error = new ApiError('ERR-NORM-005', 'maker cannot check', { reason: 'not_maker_checker' });
  expect(publishRefusalReason(error)).toBe('not_maker_checker');
});

test('period_overlap', () => {
  const error = new ApiError('ERR-NORM-005', 'overlap', { reason: 'period_overlap' });
  expect(publishRefusalReason(error)).toBe('period_overlap');
});

test('forbidden — ERR-ACL-001 carries no details.reason of its own', () => {
  const error = new ApiError('ERR-ACL-001', 'forbidden');
  expect(publishRefusalReason(error)).toBe('forbidden');
});

test('an ERR-NORM-005 with an unrecognised reason falls back to unknown, not a guess', () => {
  const error = new ApiError('ERR-NORM-005', 'something else', { reason: 'something_new' });
  expect(publishRefusalReason(error)).toBe('unknown');
});

test('a non-ApiError (a network failure, a thrown string) is unknown', () => {
  expect(publishRefusalReason(new Error('network down'))).toBe('unknown');
  expect(publishRefusalReason('boom')).toBe('unknown');
});
