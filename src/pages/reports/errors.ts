import { ApiError } from '../../api/errors';

/** Mirrors `service.py`'s refusal order for `ERR-REP-001` — one branch per
 *  `details.reason` the service actually raises (see this plan's error
 *  table). A generic "something went wrong" for a specific refusal is a
 *  defect (task brief). */
export function reportErrorMessage(t: (key: string) => string, err: ApiError): string {
  const reason = (err.details as { reason?: string } | undefined)?.reason;
  if (err.code === 'ERR-REP-001') {
    switch (reason) {
      case 'not_editable': return t('reports.data.error.notEditable');
      case 'form_version_exists': return t('reports.forms.create.error.versionExists');
      case 'not_draft': return t('reports.forms.activate.error.notDraft');
      case 'already_archived': return t('reports.forms.archive.error.alreadyArchived');
      case 'duplicate_period': return t('reports.create.error.duplicatePeriod');
      case 'not_submitted': return t('reports.lifecycle.errNotSubmitted');
      case 'not_returnable': return t('reports.lifecycle.errNotReturnable');
      case 'not_head_approved': return t('reports.lifecycle.errNotHeadApproved');
      case 'not_approved': return t('reports.lifecycle.errNotApproved');
      default: return err.message;
    }
  }
  if (err.code === 'ERR-REP-003') return t('reports.create.error.formNotActive');
  if (err.code === 'ERR-SIGN-001') return t('reports.lifecycle.errSignerNotAuthorized');
  if (err.code === 'ERR-ACL-002') return t('reports.lifecycle.errZone');
  if (err.code === 'ERR-SYS-003') return t('reports.detail.notFound');
  return err.message;
}

/** `ERR-REP-002`'s `details.checks` — `rules.check_rows`'s own shape. */
export interface ReportCheckViolation { row_index: number; code: string; message: string }

export function reportViolations(err: ApiError): ReportCheckViolation[] {
  const details = err.details as { checks?: unknown } | undefined;
  return Array.isArray(details?.checks) ? (details.checks as ReportCheckViolation[]) : [];
}

/** `rules.py`'s two known codes today; any other code (a future rule) still
 *  renders — the generic message, never a blank line. */
export function violationMessageKey(code: string): string {
  if (code === 'paid_exceeds_total') return 'reports.lifecycle.violation.paid_exceeds_total';
  if (code === 'period_reversed') return 'reports.lifecycle.violation.period_reversed';
  return 'reports.lifecycle.violation.generic';
}
