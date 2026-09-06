/**
 * The report lifecycle's one transition table — mirrors
 * `app/modules/reports/service.py`'s own status checks (`_assert_editable`,
 * `sign_report`, `return_report`, `approve_report`, `revise_report`), the
 * same "action/from/to/permission, one row per edge" idiom
 * `pages/norms/norm/transitions.ts` established for `NORM_ACTIONS`.
 *
 * `return` appears TWICE with different `from` and a different permission —
 * `service.return_report` really does branch by status: from `submitted` the
 * RAHBAR returns it (`returned_by="head"`, same identity check as `sign`);
 * from `head_approved` the CENTER returns it (`returned_by="center"`,
 * `reports.accept` alone, central-only by construction). Two rows, not one
 * with an OR'd permission, is how this table keeps that distinction visible
 * to whatever reads `requiresHeadIdentity`.
 */
import { REPORTS_ACCEPT, REPORTS_MANAGE, REPORTS_SIGN } from './permissions';

export const REPORT_STATUSES = ['created', 'submitted', 'head_approved', 'returned', 'approved'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** `service._EDITABLE_STATUSES` verbatim — `generate`/`PATCH data`/`submit`
 *  are only ever offered while the report is still the hodim's to work on. */
export const REPORT_EDITABLE_STATUSES: readonly ReportStatus[] = ['created', 'returned'];

export function statusLabelKey(status: string): string {
  return (REPORT_STATUSES as readonly string[]).includes(status) ? `reports.detail.status.${status}` : status;
}

export interface ReportActionSpec {
  action: 'submit' | 'sign' | 'return' | 'approve' | 'revise';
  from: ReportStatus;
  to: ReportStatus | 'new_revision';
  permission: string;
  /** `service._assert_report_signer` — required ONLY for the two
   *  leshoz-level actions taken on a SUBMITTED report (sign, and the
   *  rahbar's own return). The center's own return (from `head_approved`)
   *  and `approve` need no extra identity check: `reports.accept` is
   *  granted to `central_admin` alone by migration 0027's seed, so the
   *  permission itself already answers "who". */
  requiresHeadIdentity?: boolean;
}

export const REPORT_ACTIONS: readonly ReportActionSpec[] = [
  { action: 'submit', from: 'created', to: 'submitted', permission: REPORTS_MANAGE },
  { action: 'submit', from: 'returned', to: 'submitted', permission: REPORTS_MANAGE },
  { action: 'sign', from: 'submitted', to: 'head_approved', permission: REPORTS_SIGN, requiresHeadIdentity: true },
  { action: 'return', from: 'submitted', to: 'returned', permission: REPORTS_SIGN, requiresHeadIdentity: true },
  { action: 'return', from: 'head_approved', to: 'returned', permission: REPORTS_ACCEPT },
  { action: 'approve', from: 'head_approved', to: 'approved', permission: REPORTS_ACCEPT },
  { action: 'revise', from: 'approved', to: 'new_revision', permission: REPORTS_MANAGE },
];

export function actionsFor(status: string): ReportActionSpec[] {
  return REPORT_ACTIONS.filter((spec) => spec.from === status);
}

/** `service._assert_report_signer` mirrored client-side — a UI hint only,
 *  the backend re-checks for real. `reports.sign` alone is held by every
 *  `executor_head` nationally, so the permission code cannot tell "my org"
 *  from "some other leshoz"; this is what does. */
export function isHeadOfReportOrg(
  me: { role: { code: string }; zone: { organization_id: string | null } } | null,
  report: { organization_id: string },
): boolean {
  return !!me && me.role.code === 'executor_head' && me.zone.organization_id === report.organization_id;
}
