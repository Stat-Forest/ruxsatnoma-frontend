/**
 * The report lifecycle panel — the task this whole track exists for.
 * Mirrors `pages/permits/components/PermitLifecyclePanel.tsx`'s shape (one
 * panel, small per-action modals), but driven by `transitions.ts::actionsFor`
 * rather than a hand-written `if (report.status === ...)` chain — exactly
 * the drift `transitions.ts` exists to prevent (this file's own plan,
 * "Global Constraint 10").
 *
 * Gating, per action spec matching the report's current status:
 *   - the actor holds `spec.permission` (or `is_superuser`), AND
 *   - `!spec.requiresHeadIdentity || isHeadOfReportOrg(me, report)`.
 * If NO action for this status has a satisfied permission, `noPermission`
 * renders. If an action's permission IS satisfied but its identity check
 * fails, `noPermissionSign` renders instead of that action's button — the
 * situation where an `executor_head` of a DIFFERENT leshoz holds
 * `reports.sign` nationally but must not see a working Sign/Return button
 * for a report that isn't theirs (`service._assert_report_signer`, mirrored
 * client-side by `transitions.ts::isHeadOfReportOrg`).
 */
import { useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, PenLine, RotateCcw, Send, Undo2 } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { useT } from '../../i18n/useT';
import { ApiError } from '../../api/errors';
import { Button } from '../../components/ui/button';
import { FormField, Input, Textarea } from '../../components/ui/FormControls';
import { satisfies } from '../../shell/navigation';
import { buildMockSignature, PINFL_PATTERN } from '../../lib/eimzoMock';
import { ConfirmDialog } from './ConfirmDialog';
import { reportDocumentBytes } from './reportDocument';
import { reportErrorMessage, reportViolations, violationMessageKey } from './errors';
import {
  actionsFor,
  isHeadOfReportOrg,
  type ReportActionSpec,
} from './transitions';
import { useApproveReport, useReturnReport, useReviseReport, useSignReport, useSubmitReport } from './queries';
import type { ReportOut } from './api';

function asApiError(err: unknown): ApiError | null {
  return err instanceof ApiError ? err : null;
}

type OpenAction = 'submit' | 'sign' | 'return' | 'approve' | 'revise' | null;

const ACTION_ICON: Record<ReportActionSpec['action'], ReactNode> = {
  submit: <Send className="h-4 w-4" />,
  sign: <PenLine className="h-4 w-4" />,
  return: <Undo2 className="h-4 w-4" />,
  approve: <CheckCircle2 className="h-4 w-4" />,
  revise: <RotateCcw className="h-4 w-4" />,
};

const ACTION_LABEL_KEY: Record<ReportActionSpec['action'], string> = {
  submit: 'reports.lifecycle.submitButton',
  sign: 'reports.lifecycle.signButton',
  return: 'reports.lifecycle.returnButton',
  approve: 'reports.lifecycle.approveButton',
  revise: 'reports.lifecycle.reviseButton',
};

export function ReportLifecyclePanel({
  report,
  onRevised,
}: {
  report: ReportOut;
  onRevised: (newReportId: string) => void;
}) {
  const { me } = useAuth();
  const t = useT();
  const [open, setOpen] = useState<OpenAction>(null);
  const [pinfl, setPinfl] = useState('');
  const [pinflTouched, setPinflTouched] = useState(false);
  const [comment, setComment] = useState('');

  const submit = useSubmitReport(report.id);
  const sign = useSignReport(report.id);
  const returnMutation = useReturnReport(report.id);
  const approve = useApproveReport(report.id);
  const revise = useReviseReport(report.id);

  const specs = actionsFor(report.status);
  const permitted = !me ? [] : specs.filter((spec) => satisfies(spec.permission, me));
  const actionable = permitted.filter((spec) => !spec.requiresHeadIdentity || isHeadOfReportOrg(me, report));
  const blockedByIdentity = permitted.length > actionable.length;

  function closeAll() {
    setOpen(null);
    setPinfl('');
    setPinflTouched(false);
    setComment('');
    submit.reset();
    sign.reset();
    returnMutation.reset();
    approve.reset();
    revise.reset();
  }

  async function handleConfirmSign() {
    if (!PINFL_PATTERN.test(pinfl)) {
      setPinflTouched(true);
      return;
    }
    const documentBytes = reportDocumentBytes({
      reportId: report.id,
      formId: report.form_id,
      organizationId: report.organization_id,
      periodStart: report.period_start,
      periodEnd: report.period_end,
      versionNo: report.version_no,
      data: report.data,
    });
    const pkcs7 = await buildMockSignature({ pinfl, documentBytes });
    sign.mutate({ pkcs7 }, { onSuccess: closeAll });
  }

  function handleConfirmReturn() {
    if (!comment.trim()) return;
    returnMutation.mutate({ comment: comment.trim() }, { onSuccess: closeAll });
  }

  const submitErr = asApiError(submit.error);
  const signErr = asApiError(sign.error);
  const returnErr = asApiError(returnMutation.error);
  const approveErr = asApiError(approve.error);
  const reviseErr = asApiError(revise.error);

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs font-sans space-y-4">
      <h2 className="text-base font-bold text-[#1A1F24] border-b border-[#E4E7EA] pb-3">
        {t('reports.lifecycle.panelTitle')}
      </h2>

      {actionable.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actionable.map((spec) => (
            <Button
              key={spec.action}
              variant={spec.action === 'return' ? 'outline' : 'primary'}
              leftIcon={ACTION_ICON[spec.action]}
              data-testid={`report-action-${spec.action}`}
              onClick={() => setOpen(spec.action)}
            >
              {t(ACTION_LABEL_KEY[spec.action])}
            </Button>
          ))}
        </div>
      )}

      {actionable.length === 0 && blockedByIdentity && (
        <p className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-xs text-[#92400E] flex items-start gap-2" data-testid="report-no-permission-sign">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{t('reports.lifecycle.noPermissionSign')}</span>
        </p>
      )}

      {permitted.length === 0 && report.status === 'approved' && (
        <p className="text-xs text-[#5A646D] bg-[#F8F9FA] p-3 rounded-xl border border-[#E4E7EA]" data-testid="report-terminal-note">
          {t('reports.lifecycle.terminalNote')}
        </p>
      )}

      {permitted.length === 0 && report.status !== 'approved' && (
        <p className="text-xs text-[#5A646D] bg-[#F8F9FA] p-3 rounded-xl border border-[#E4E7EA]" data-testid="report-no-permission">
          {t('reports.lifecycle.noPermission')}
        </p>
      )}

      {open === 'submit' && (
        <ConfirmDialog
          title={t('reports.lifecycle.submitConfirmTitle')}
          question={t('reports.lifecycle.submitConfirmQuestion')}
          confirmLabel={t('reports.lifecycle.submitButton')}
          cancelLabel={t('reports.lifecycle.cancelButton')}
          isPending={submit.isPending}
          errorMessage={submitErr && submitErr.code !== 'ERR-REP-002' ? reportErrorMessage(t, submitErr) : null}
          onConfirm={() => submit.mutate(undefined, { onSuccess: closeAll })}
          onClose={closeAll}
        >
          {submitErr?.code === 'ERR-REP-002' && (
            <div data-testid="submit-violations" className="rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] p-3 space-y-1">
              <p className="text-sm font-bold text-[#991B1B]">{t('reports.lifecycle.violationsTitle')}</p>
              <ul className="list-disc pl-5 text-xs text-[#991B1B]">
                {reportViolations(submitErr).map((violation, index) => (
                  <li key={index}>
                    Row {violation.row_index + 1}: {t(violationMessageKey(violation.code))}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ConfirmDialog>
      )}

      {open === 'sign' && (
        <ConfirmDialog
          title={t('reports.lifecycle.signModalTitle')}
          subtitle={t('reports.lifecycle.signHint')}
          confirmLabel={t('reports.lifecycle.confirmSign')}
          cancelLabel={t('reports.lifecycle.cancelButton')}
          isPending={sign.isPending}
          confirmDisabled={!PINFL_PATTERN.test(pinfl)}
          errorMessage={signErr ? reportErrorMessage(t, signErr) : null}
          onConfirm={() => void handleConfirmSign()}
          onClose={closeAll}
        >
          <FormField
            label={t('reports.lifecycle.pinflLabel')}
            required
            helperText={t('reports.lifecycle.pinflHelp')}
            error={pinflTouched && !PINFL_PATTERN.test(pinfl) ? t('reports.lifecycle.pinflError') : undefined}
          >
            <Input
              inputMode="numeric"
              value={pinfl}
              onChange={(e) => setPinfl(e.target.value.replace(/\D/g, '').slice(0, 14))}
              onBlur={() => setPinflTouched(true)}
              placeholder="31708860250017"
            />
          </FormField>
        </ConfirmDialog>
      )}

      {open === 'return' && (
        <ConfirmDialog
          title={t('reports.lifecycle.returnModalTitle')}
          confirmLabel={t('reports.lifecycle.confirmReturn')}
          cancelLabel={t('reports.lifecycle.cancelButton')}
          confirmVariant="danger"
          isPending={returnMutation.isPending}
          confirmDisabled={!comment.trim()}
          errorMessage={returnErr ? reportErrorMessage(t, returnErr) : null}
          onConfirm={handleConfirmReturn}
          onClose={closeAll}
        >
          <FormField label={t('reports.lifecycle.commentLabel')} required>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={2000}
              placeholder={t('reports.lifecycle.commentPlaceholder')}
            />
          </FormField>
        </ConfirmDialog>
      )}

      {open === 'approve' && (
        <ConfirmDialog
          title={t('reports.lifecycle.confirmApproveTitle')}
          question={t('reports.lifecycle.confirmApproveQuestion')}
          confirmLabel={t('reports.lifecycle.confirmApprove')}
          cancelLabel={t('reports.lifecycle.cancelButton')}
          isPending={approve.isPending}
          errorMessage={approveErr ? reportErrorMessage(t, approveErr) : null}
          onConfirm={() => approve.mutate(undefined, { onSuccess: closeAll })}
          onClose={closeAll}
        />
      )}

      {open === 'revise' && (
        <ConfirmDialog
          title={t('reports.lifecycle.confirmReviseTitle')}
          question={t('reports.lifecycle.confirmReviseQuestion')}
          confirmLabel={t('reports.lifecycle.confirmRevise')}
          cancelLabel={t('reports.lifecycle.cancelButton')}
          isPending={revise.isPending}
          errorMessage={reviseErr ? reportErrorMessage(t, reviseErr) : null}
          onConfirm={() =>
            revise.mutate(undefined, {
              onSuccess: (newReport) => {
                closeAll();
                onRevised(newReport.id);
              },
            })
          }
          onClose={closeAll}
        />
      )}
    </div>
  );
}
