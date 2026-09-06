/**
 * F5's write routes refuse for a wider set of reasons than F6/F7's four
 * (task-6 brief: this screen has its own permission family and its own
 * service rules — `_assert_norm_zone`, `_assert_may_publish`, the
 * yield-required guard for grazing, `published_overlaps`,
 * `no_published_contour`). One switch per action's own fallback line,
 * covering every reason `norms/service.py`'s norm-lifecycle functions
 * actually raise, so a refusal is always rendered as what it is rather than
 * a bare "action failed."
 */
import { ApiError } from '../../../api/errors';

export type NormActionKind = 'submitReview' | 'returnToDraft' | 'approve' | 'returnToReview' | 'publish' | 'archive';

function reasonOf(error: ApiError): string | undefined {
  return (error.details as { reason?: string } | undefined)?.reason;
}

export function normActionErrorText(error: unknown, action: NormActionKind, t: (key: string) => string): string {
  if (!(error instanceof ApiError)) return t(`norms.norms.action.error.${action}.generic`);

  // `_assert_norm_zone` — a bare ERR-ACL-002 with no `reason` means the
  // contour is outside the actor's own zone; WITH `reason:
  // central_publication_required` it is `_assert_may_publish`'s own refusal
  // (`publish`/`return-to-review` only).
  if (error.code === 'ERR-ACL-002') {
    return reasonOf(error) === 'central_publication_required'
      ? t('norms.norms.action.error.centralPublicationRequired')
      : t('norms.norms.action.error.outsideZone');
  }
  if (error.code === 'ERR-ACL-001') return t('norms.norms.action.error.forbidden');
  if (error.code === 'ERR-NORM-005') {
    switch (reasonOf(error)) {
      case 'bad_transition':
        return t('norms.norms.action.error.badTransition');
      case 'period_overlap':
        return t('norms.norms.action.error.periodOverlap');
      case 'no_published_contour':
        return t('norms.norms.action.error.noPublishedContour');
      default:
        break;
    }
  }
  if (error.code === 'ERR-VAL-001') {
    switch (reasonOf(error)) {
      case 'yield_required':
        return t('norms.norms.action.error.yieldRequired');
      case 'geobotanic_doc_required':
        return t('norms.norms.action.error.geobotanicDocRequired');
      case 'approval_doc_required':
        return t('norms.norms.action.error.approvalDocRequired');
      default:
        break;
    }
  }
  return `${error.code}: ${error.message}`;
}
