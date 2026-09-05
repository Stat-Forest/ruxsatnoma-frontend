/**
 * `POST .../publish` checks refusals in a fixed order (task-4 brief), and
 * the SAME route shape backs both `/rule-parameters/{id}/publish` and
 * task 5's `/tariffs/{id}/publish` (`PublishOut`'s own docstring: `item` is
 * `Any` precisely because it carries either row type). Pulling the
 * code/reason matching out of `ParamsTab` into its own pure function means
 * task 5 reuses the DECISION, not just the dialog that renders it — each
 * caller still supplies its own sentence per reason, under its own i18n
 * namespace (`norms.params.*` here), but neither has to re-derive which of
 * the four cases an `ApiError` represents.
 */
import { ApiError } from '../../../api/errors';

export type PublishRefusalReason =
  | 'not_draft'
  | 'not_maker_checker'
  | 'period_overlap'
  | 'forbidden'
  | 'unknown';

const KNOWN_REASONS = new Set(['not_draft', 'not_maker_checker', 'period_overlap']);

export function publishRefusalReason(error: unknown): PublishRefusalReason {
  if (!(error instanceof ApiError)) return 'unknown';
  // ERR-ACL-001 (403) carries no `details.reason` of its own — the caller
  // simply lacks `norms.tariffs.publish`/`.manage` altogether, checked
  // BEFORE the maker-checker/period rules that all answer `ERR-NORM-005`.
  if (error.code === 'ERR-ACL-001') return 'forbidden';
  if (error.code === 'ERR-NORM-005') {
    const reason = (error.details as { reason?: string } | undefined)?.reason;
    if (reason && KNOWN_REASONS.has(reason)) return reason as PublishRefusalReason;
  }
  return 'unknown';
}
