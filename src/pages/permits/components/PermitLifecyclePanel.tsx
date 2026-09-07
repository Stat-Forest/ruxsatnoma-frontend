import { useRef, useState } from 'react';
import { AlertTriangle, Ban, PauseCircle, PlayCircle, Upload } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../../auth/useAuth';
import { apiErrorMessage } from '../../../i18n/errorMessages';
import type { UiLanguage } from '../../../i18n/context';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useLanguage, useT } from '../../../i18n/useT';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/Overlay';
import { FormField, Input, Select, Textarea } from '../../../components/ui/FormControls';
import { ApiError } from '../../../api/errors';
import { buildMockSignature, PINFL_PATTERN } from '../../../lib/eimzoMock';
import { PERMITS_MANAGE } from '../permissions';
import {
  EXPLANATION_REQUIRED_CODE,
  reasonAppliesTo,
  uploadDecisionDocument,
  usePermitStatusReasons,
  useResumePermit,
  useRevokePermit,
  useSuspendPermit,
  type LifecycleAct,
  type PermitCardOut,
} from '../lifecycle';
import { decisionDocumentBytes } from '../lifecycleDocument';
import { pickLocalizedName } from '../format';

const ACT_TO_STATUS: Record<LifecycleAct, 'suspended' | 'active' | 'revoked'> = {
  suspend: 'suspended',
  resume: 'active',
  revoke: 'revoked',
};

const ACT_TITLE_KEY: Record<LifecycleAct, string> = {
  suspend: 'permits.lifecycle.suspendModalTitle',
  resume: 'permits.lifecycle.resumeModalTitle',
  revoke: 'permits.lifecycle.revokeModalTitle',
};

const ACT_SUBMIT_KEY: Record<LifecycleAct, string> = {
  suspend: 'permits.lifecycle.confirmSuspend',
  resume: 'permits.lifecycle.confirmResume',
  revoke: 'permits.lifecycle.confirmRevoke',
};

/** Every reason `POST /permits/{id}/{suspend,resume,revoke}` documents
 *  refusing (`lifecycle_router.py`, `decisions.decide`), turned into copy
 *  an operator can act on. */
function lifecycleErrorMessage(t: (key: string) => string, err: ApiError, lang: UiLanguage): string {
  const reason = (err.details as { reason?: string } | undefined)?.reason;
  if (err.code === 'ERR-VAL-001') {
    if (reason === 'doc_file_required') return t('permits.lifecycle.errDocRequired');
    if (reason === 'legal_basis_required') return t('permits.lifecycle.errLegalBasisRequired');
    if (reason === 'reason_not_applicable') return t('permits.lifecycle.errReasonNotApplicable');
    if (reason === 'reason_archived' || reason === 'reason_out_of_validity' || reason === 'reason_not_found') {
      return t('permits.lifecycle.errReasonInvalid');
    }
  }
  if (err.code === 'ERR-PERM-001') return t('permits.lifecycle.errBadTransition');
  if (err.code === 'ERR-ACL-002') return t('permits.lifecycle.errWrongZone');
  if (err.code === 'ERR-ACL-001') return t('permits.lifecycle.errWrongSigner');
  if (err.code === 'ERR-SIGN-001') return t('permits.lifecycle.errSignatureInvalid');
  return apiErrorMessage(err, lang);
}

function useLifecycleMutationFor(act: LifecycleAct, permitId: string) {
  const suspend = useSuspendPermit(permitId);
  const resume = useResumePermit(permitId);
  const revoke = useRevokePermit(permitId);
  return act === 'suspend' ? suspend : act === 'resume' ? resume : revoke;
}

function LifecycleDecisionModal({
  act,
  permit,
  onClose,
}: {
  act: LifecycleAct;
  permit: PermitCardOut;
  onClose: () => void;
}) {
  const t = useT();
  const { lang } = useLanguage();
  const errorText = useApiErrorText();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reasonItemId, setReasonItemId] = useState('');
  const [legalBasis, setLegalBasis] = useState('');
  const [pinfl, setPinfl] = useState('');
  const [pinflTouched, setPinflTouched] = useState(false);
  const [docFile, setDocFile] = useState<{ id: string; name: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const reasons = usePermitStatusReasons();
  // `grounds._kinds` — never offer a ground the server would refuse with
  // `reason_not_applicable` for THIS act (house rule).
  const applicable = (reasons.data ?? []).filter((r) => reasonAppliesTo(r, act));
  const selectedItem = applicable.find((r) => r.id === reasonItemId);
  // `_assert_decision_doc` — required for suspend/revoke, never resume
  // (PS-06 "the cause was removed" is a fact about the world, not a
  // document).
  const requiresDoc = act === 'suspend' || act === 'revoke';
  // `grounds.EXPLANATION_REQUIRED` — matched by CODE, mirroring the backend
  // constant exactly.
  const requiresLegalBasis = selectedItem?.code === EXPLANATION_REQUIRED_CODE;

  const uploadMutation = useMutation({ mutationFn: (file: File) => uploadDecisionDocument(file) });
  const mutation = useLifecycleMutationFor(act, permit.id);
  const apiError = mutation.error instanceof ApiError ? mutation.error : null;

  async function handleFileChange(file: File) {
    setUploadError(null);
    try {
      const uploaded = await uploadMutation.mutateAsync(file);
      setDocFile({ id: uploaded.id, name: file.name });
    } catch (err) {
      setUploadError(errorText(err, t('permits.lifecycle.errUploadFailed')));
    }
  }

  const pinflValid = PINFL_PATTERN.test(pinfl);
  const canSubmit =
    reasonItemId !== '' &&
    (!requiresLegalBasis || legalBasis.trim().length > 0) &&
    (!requiresDoc || docFile !== null) &&
    !mutation.isPending;

  async function handleSubmit() {
    if (!pinflValid) {
      setPinflTouched(true);
      return;
    }
    if (!selectedItem) return;
    const documentBytes = decisionDocumentBytes({
      permitId: permit.id,
      series: permit.series,
      number: permit.number,
      toStatus: ACT_TO_STATUS[act],
      reasonCode: selectedItem.code,
      legalBasis: legalBasis || null,
      docFileId: docFile?.id ?? null,
    });
    const pkcs7 = await buildMockSignature({ pinfl, documentBytes });
    mutation.mutate(
      {
        reason_item_id: reasonItemId,
        legal_basis: legalBasis.trim() || null,
        doc_file_id: docFile?.id ?? null,
        pkcs7,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t(ACT_TITLE_KEY[act])}
      subtitle={t('permits.lifecycle.eriHint')}
      maxWidth="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            {t('permits.lifecycle.cancelButton')}
          </Button>
          <Button
            variant={act === 'revoke' ? 'danger' : 'primary'}
            isLoading={mutation.isPending}
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {t(ACT_SUBMIT_KEY[act])}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label={t('permits.lifecycle.reasonLabel')} required>
          <Select
            value={reasonItemId}
            onChange={(e) => setReasonItemId(e.target.value)}
            options={[
              { value: '', label: t('permits.lifecycle.selectPlaceholder') },
              ...applicable.map((r) => ({ value: r.id, label: pickLocalizedName(r.name, lang) || r.code })),
            ]}
          />
        </FormField>

        <FormField label={t('permits.lifecycle.legalBasisLabel')} required={requiresLegalBasis}>
          <Textarea
            value={legalBasis}
            onChange={(e) => setLegalBasis(e.target.value)}
            maxLength={2000}
            placeholder={t('permits.lifecycle.legalBasisPlaceholder')}
          />
        </FormField>

        {requiresDoc && (
          <FormField label={t('permits.lifecycle.docLabel')} required helperText={t('permits.lifecycle.docRequiredHint')}>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<Upload className="w-3.5 h-3.5" />}
                isLoading={uploadMutation.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                {t('permits.lifecycle.docChooseButton')}
              </Button>
              {docFile && <span className="text-xs text-[#1A1F24] font-semibold truncate">{docFile.name}</span>}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileChange(file);
                }}
              />
            </div>
            {uploadError && <p className="text-xs text-[#B91C1C] mt-1">{uploadError}</p>}
          </FormField>
        )}

        <FormField
          label={t('permits.lifecycle.pinflLabel')}
          required
          helperText={t('permits.lifecycle.pinflHelp')}
          error={pinflTouched && !pinflValid ? t('permits.lifecycle.pinflError') : undefined}
        >
          <Input
            inputMode="numeric"
            value={pinfl}
            onChange={(e) => setPinfl(e.target.value.replace(/\D/g, '').slice(0, 14))}
            onBlur={() => setPinflTouched(true)}
            placeholder="31708860250017"
          />
        </FormField>

        {apiError && (
          <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl text-xs text-[#991B1B] space-y-1">
            <p>{lifecycleErrorMessage(t, apiError, lang)}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

/**
 * E3 (`docs/plans/06-frontend-screens.md`, С13) — suspend, resume, revoke.
 * Gated on `permits.manage` (`executor_head` alone) as a UI hint; the
 * backend re-checks the signer's role AND organization for real
 * (`_decision_signer_refusal`).
 *
 * **`pending_signatures` renders fact #2 of the task brief as what it is,
 * never as a disabled-looking action**: a paid but unsigned permit can
 * today be neither revoked nor expired (`tz/12` #16, open with the Agency)
 * — no button is offered here that `_assert_transition` would refuse with
 * `bad_transition` (house rule: don't offer what the backend would refuse).
 */
export function PermitLifecyclePanel({ permit }: { permit: PermitCardOut }) {
  const { me } = useAuth();
  const t = useT();
  const [modalAct, setModalAct] = useState<LifecycleAct | null>(null);

  const canManage = !!me && (me.is_superuser || me.permissions.includes(PERMITS_MANAGE));

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs font-sans space-y-4">
      <h2 className="text-base font-bold text-[#1A1F24] border-b border-[#E4E7EA] pb-3">
        {t('permits.lifecycle.panelTitle')}
      </h2>

      {(permit.status === 'active' || permit.status === 'suspended') && (
        <>
          {canManage ? (
            <div className="flex flex-col sm:flex-row gap-2">
              {permit.status === 'active' && (
                <Button
                  variant="outline"
                  fullWidth
                  leftIcon={<PauseCircle className="w-4 h-4" />}
                  onClick={() => setModalAct('suspend')}
                >
                  {t('permits.lifecycle.suspendButton')}
                </Button>
              )}
              {permit.status === 'suspended' && (
                <Button
                  variant="primary"
                  fullWidth
                  leftIcon={<PlayCircle className="w-4 h-4" />}
                  onClick={() => setModalAct('resume')}
                >
                  {t('permits.lifecycle.resumeButton')}
                </Button>
              )}
              <Button variant="danger" fullWidth leftIcon={<Ban className="w-4 h-4" />} onClick={() => setModalAct('revoke')}>
                {t('permits.lifecycle.revokeButton')}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-[#5A646D] bg-[#F8F9FA] p-3 rounded-xl border border-[#E4E7EA]">
              {t('permits.lifecycle.noPermission')}
            </p>
          )}
        </>
      )}

      {permit.status === 'pending_signatures' && (
        <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-xs text-[#92400E] flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{t('permits.lifecycle.pendingSignaturesNote')}</span>
        </div>
      )}

      {(permit.status === 'revoked' || permit.status === 'expired' || permit.status === 'archived') && (
        <p className="text-xs text-[#5A646D] bg-[#F8F9FA] p-3 rounded-xl border border-[#E4E7EA]">
          {t('permits.lifecycle.terminalNote')}
        </p>
      )}

      {modalAct && <LifecycleDecisionModal act={modalAct} permit={permit} onClose={() => setModalAct(null)} />}
    </div>
  );
}
