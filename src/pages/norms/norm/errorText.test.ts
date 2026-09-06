import { ApiError } from '../../../api/errors';
import { normActionErrorText } from './errorText';

const t = (key: string) => key;

test('a bare ERR-ACL-002 (no reason) is the zone refusal', () => {
  const error = new ApiError('ERR-ACL-002', 'x');
  expect(normActionErrorText(error, 'publish', t)).toBe('norms.norms.action.error.outsideZone');
});

test('ERR-ACL-002 with central_publication_required is the scope refusal, distinct from a bare zone mismatch', () => {
  const error = new ApiError('ERR-ACL-002', 'x', { reason: 'central_publication_required' });
  expect(normActionErrorText(error, 'publish', t)).toBe('norms.norms.action.error.centralPublicationRequired');
});

test('ERR-ACL-001 is a bare permission refusal', () => {
  const error = new ApiError('ERR-ACL-001', 'x');
  expect(normActionErrorText(error, 'archive', t)).toBe('norms.norms.action.error.forbidden');
});

test.each([
  ['bad_transition', 'norms.norms.action.error.badTransition'],
  ['period_overlap', 'norms.norms.action.error.periodOverlap'],
  ['no_published_contour', 'norms.norms.action.error.noPublishedContour'],
])('ERR-NORM-005 reason %s maps to its own sentence', (reason, expected) => {
  const error = new ApiError('ERR-NORM-005', 'x', { reason });
  expect(normActionErrorText(error, 'publish', t)).toBe(expected);
});

test.each([
  ['yield_required', 'norms.norms.action.error.yieldRequired'],
  ['geobotanic_doc_required', 'norms.norms.action.error.geobotanicDocRequired'],
  ['approval_doc_required', 'norms.norms.action.error.approvalDocRequired'],
])('ERR-VAL-001 reason %s maps to its own sentence', (reason, expected) => {
  const error = new ApiError('ERR-VAL-001', 'x', { reason });
  expect(normActionErrorText(error, 'approve', t)).toBe(expected);
});

test('an unrecognised error renders its own code and message rather than a generic fallback', () => {
  const error = new ApiError('ERR-SYS-000', 'boom');
  expect(normActionErrorText(error, 'publish', t)).toBe('ERR-SYS-000: boom');
});

test('a non-ApiError falls back to the action\'s own generic sentence', () => {
  expect(normActionErrorText(new Error('network down'), 'submitReview', t)).toBe(
    'norms.norms.action.error.submitReview.generic',
  );
});
