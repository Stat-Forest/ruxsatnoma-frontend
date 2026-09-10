import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Modal } from '../../../components/ui/Overlay';
import { Button } from '../../../components/ui/button';
import { FormField, Select, Textarea } from '../../../components/ui/FormControls';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import {
  buildMockSignature,
  eimzoErrorMessageKey,
  isEimzoMock,
  MockSignerNotice,
  signDocument,
  useMockSigner,
} from '../../../lib/eimzo';
import { useLanguage, useT } from '../../../i18n/useT';
import { useApplicationPackage, useRejectionReasons } from '../queries';
import { localizedName } from '../format';

export type DecisionMode = 'approve' | 'reject';

interface SignDecisionModalProps {
  mode: DecisionMode;
  applicationId: string;
  isSubmitting: boolean;
  error: unknown;
  /**
   * Non-null while the application's own benefit claim is `rejected`
   * (ruling #182): `legal_basis` becomes optional in that case, and leaving
   * it blank means "use the verifier's own reason" — `decision.reject`
   * fills it from `benefit_rejection_reason` server-side. `null`/`undefined`
   * for every other application (including `mode === 'approve'`, which
   * never reads this) keeps the original rule: a missing `legal_basis` is
   * refused.
   */
  benefitRejectionReason?: string | null;
  onClose: () => void;
  onSubmitApprove: (pkcs7: string) => void;
  onSubmitReject: (input: { pkcs7: string; reason_item_id: string; legal_basis: string | null }) => void;
}

const SIGN_DECISION_I18N = {
  uz_latn: {
    approveTitle: 'Arizani tasdiqlash',
    rejectTitle: 'Arizani rad etish',
    subtitle: 'ERI (E-IMZO) bilan tasdiqlanadi — demo rejimida mock imzo',
    cancel: 'Bekor qilish',
    approveSubmit: 'Tasdiqlash va imzolash',
    rejectSubmit: 'Rad etish va imzolash',
    loadingPackage: 'Imzolanadigan hujjat yuklanmoqda (GET .../package)...',
    packageErrorFallback: 'Hujjat yuklanmadi.',
    reasonLabel: 'Rad etish sababi',
    selectPlaceholder: 'Tanlang...',
    legalBasisLabel: 'Huquqiy asos (legal_basis)',
    legalBasisPlaceholder: 'Masalan: VMQ 278-son, 12-band',
  },
  uz_cyrl: {
    approveTitle: 'Аризани тасдиқлаш',
    rejectTitle: 'Аризани рад этиш',
    subtitle: 'ЭРИ (E-IMZO) билан тасдиқланади — демо режимида мок имзо',
    cancel: 'Бекор қилиш',
    approveSubmit: 'Тасдиқлаш ва имзолаш',
    rejectSubmit: 'Рад этиш ва имзолаш',
    loadingPackage: 'Имзоланадиган ҳужжат юкланмоқда (GET .../package)...',
    packageErrorFallback: 'Ҳужжат юкланмади.',
    reasonLabel: 'Рад этиш сабаби',
    selectPlaceholder: 'Танланг...',
    legalBasisLabel: 'Ҳуқуқий асос (legal_basis)',
    legalBasisPlaceholder: 'Масалан: ВМҚ 278-сон, 12-банд',
  },
  ru: {
    approveTitle: 'Утверждение заявления',
    rejectTitle: 'Отклонение заявления',
    subtitle: 'Подтверждается ЭЦП (E-IMZO) — в демо-режиме тестовая подпись',
    cancel: 'Отмена',
    approveSubmit: 'Утвердить и подписать',
    rejectSubmit: 'Отклонить и подписать',
    loadingPackage: 'Загрузка подписываемого документа (GET .../package)...',
    packageErrorFallback: 'Документ не загружен.',
    reasonLabel: 'Причина отклонения',
    selectPlaceholder: 'Выберите...',
    legalBasisLabel: 'Правовое основание (legal_basis)',
    legalBasisPlaceholder: 'Например: ПКМ № 278, пункт 12',
  },
  en: {
    approveTitle: 'Approve application',
    rejectTitle: 'Reject application',
    subtitle: 'Confirmed with EDS (E-IMZO) — mock signature in demo mode',
    cancel: 'Cancel',
    approveSubmit: 'Approve and sign',
    rejectSubmit: 'Reject and sign',
    loadingPackage: 'Loading document package to sign (GET .../package)...',
    packageErrorFallback: 'Failed to load document.',
    reasonLabel: 'Rejection reason',
    selectPlaceholder: 'Select...',
    legalBasisLabel: 'Legal basis (legal_basis)',
    legalBasisPlaceholder: 'For example: Resolution No. 278, item 12',
  },
  kaa: {
    approveTitle: 'Arzanı tastıyıqlaw',
    rejectTitle: 'Arzanı biykar etiw',
    subtitle: 'ERI (E-IMZO) menen tastıyıqlanadı — demo rejiminde mock imzo',
    cancel: 'Biykar etiw',
    approveSubmit: 'Tastıyıqlaw hám qol qoyıw',
    rejectSubmit: 'Biykar etiw hám qol qoyıw',
    loadingPackage: 'Qol qoyılatuǵın hújjet júklenbekte (GET .../package)...',
    packageErrorFallback: 'Hújjet júklenbedi.',
    reasonLabel: 'Biykar etiw sebebi',
    selectPlaceholder: 'Saylań...',
    legalBasisLabel: 'Huqıqıy tiykar (legal_basis)',
    legalBasisPlaceholder: 'Mısalı: VMQ 278-san, 12-bánt',
  },
};

/**
 * The one place both decision routes get their `pkcs7` from. Under the
 * mock, a real E-IMZO client's certificate is stood in for by an envelope
 * carrying the signed-in user's own PINFL (`useMockSigner` — read from
 * `GET /auth/me`, never typed in); in real mode (fix wave, finding 2) the
 * certificate the signer picks in E-IMZO carries that identity, task 10's
 * own rule applied here. Either way this modal is a plain confirmation.
 * Nothing about the DECISION itself is faked: the bytes
 * signed are the real `GET /applications/{id}/package` response, fetched
 * fresh on open (ruling 23 — the package is priced afresh on every call),
 * DETACHED (`signatures.service.sign()` -> `verify_detached`), and the
 * signature is verified for real by that same call.
 */
export function SignDecisionModal({
  mode,
  applicationId,
  isSubmitting,
  error,
  benefitRejectionReason,
  onClose,
  onSubmitApprove,
  onSubmitReject,
}: SignDecisionModalProps) {
  const { lang } = useLanguage();
  // `tr` carries this modal's own strings; `t` resolves the shared E-IMZO
  // failure keys, which live in the app-wide catalogue rather than here.
  const t = useT();
  const tr = SIGN_DECISION_I18N[lang] ?? SIGN_DECISION_I18N.uz_latn;
  const errorText = useApiErrorText();
  const signer = useMockSigner();
  const [reasonItemId, setReasonItemId] = useState('');
  const [legalBasis, setLegalBasis] = useState('');
  // Real mode only: `signDocument` runs BEFORE `onSubmitApprove`/
  // `onSubmitReject` ever fire, so its own failure never reaches the
  // mutation's `error` prop — kept apart, same reason
  // `PermitLifecyclePanel.tsx`'s own `eimzoErrorKey` is.
  const [eimzoErrorKey, setEimzoErrorKey] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  const rejectionReasons = useRejectionReasons();
  const packageQuery = useApplicationPackage(applicationId);
  const loadingPackage = packageQuery.isLoading;
  const packageError = packageQuery.error
    ? packageQuery.error instanceof ApiError
      ? errorText(packageQuery.error)
      : tr.packageErrorFallback
    : null;

  // `signer.blocked` (mock mode, no PINFL on the account) disables the
  // button — unlike the old empty-field case there is nothing the operator
  // could type to fix it, and `MockSignerNotice` below says why.
  // Ruling #182: with a benefit-claim rejection reason on hand, `legal_basis`
  // is optional — the server fills it from that reason when this field is
  // left blank (`legalBasisRequired` below feeds both the button gate and
  // the field's own `required` marker).
  const legalBasisRequired = mode === 'reject' && !benefitRejectionReason;
  const canSubmit =
    packageQuery.data !== undefined &&
    !isSubmitting &&
    !signing &&
    !signer.blocked &&
    (mode === 'approve' || (reasonItemId !== '' && (!legalBasisRequired || legalBasis.trim().length > 0)));

  async function handleSubmit() {
    if (!packageQuery.data) return;
    setEimzoErrorKey(null);
    let pkcs7: string;
    if (isEimzoMock()) {
      if (signer.pinfl === null) return;
      pkcs7 = await buildMockSignature({ pinfl: signer.pinfl, documentBytes: packageQuery.data, fullName: signer.fullName });
    } else {
      // Real mode: DETACHED — `signatures.service.sign()` hashes the exact
      // `GET /applications/{id}/package` bytes fetched above and calls
      // `adapter.verify_detached(document, pkcs7)`; no PINFL to type in,
      // the signer's own certificate carries that identity.
      setSigning(true);
      try {
        pkcs7 = await signDocument(new Uint8Array(packageQuery.data));
      } catch (err) {
        setEimzoErrorKey(eimzoErrorMessageKey(err));
        return;
      } finally {
        setSigning(false);
      }
    }
    if (mode === 'approve') {
      onSubmitApprove(pkcs7);
    } else {
      // A blank field sends `null`, never `''` — `''` would still read as
      // "given but empty" to a caller checking only `!== undefined`, and the
      // whole point of leaving it blank is "use the verifier's own reason".
      onSubmitReject({ pkcs7, reason_item_id: reasonItemId, legal_basis: legalBasis.trim() || null });
    }
  }

  const apiError = error instanceof ApiError ? error : null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={mode === 'approve' ? tr.approveTitle : tr.rejectTitle}
      subtitle={tr.subtitle}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {tr.cancel}
          </Button>
          <Button
            variant={mode === 'approve' ? 'primary' : 'danger'}
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            isLoading={isSubmitting || signing}
          >
            {mode === 'approve' ? tr.approveSubmit : tr.rejectSubmit}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {loadingPackage && (
          <div className="flex items-center gap-2 text-xs text-[#5A646D]">
            <Loader2 className="w-4 h-4 animate-spin" /> {tr.loadingPackage}
          </div>
        )}
        {packageError && (
          <p className="text-xs text-[#B91C1C] flex items-center gap-1.5" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0" /> {packageError}
          </p>
        )}

        {mode === 'reject' && (
          <>
            <FormField label={tr.reasonLabel} required>
              <Select
                value={reasonItemId}
                onChange={(e) => setReasonItemId(e.target.value)}
                options={[
                  { value: '', label: tr.selectPlaceholder },
                  ...(rejectionReasons.data ?? []).map((r) => ({ value: r.id, label: localizedName(r.name, lang) || r.code })),
                ]}
              />
            </FormField>
            <FormField
              label={tr.legalBasisLabel}
              required={legalBasisRequired}
              helperText={!legalBasisRequired ? t('staff.decision.benefit.legalBasisOptionalHint') : undefined}
            >
              <Textarea
                value={legalBasis}
                onChange={(e) => setLegalBasis(e.target.value)}
                placeholder={tr.legalBasisPlaceholder}
                maxLength={2000}
              />
            </FormField>
          </>
        )}

        <MockSignerNotice signer={signer} />

        {eimzoErrorKey && (
          <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl text-xs text-[#991B1B] space-y-1">
            <p>{t(eimzoErrorKey)}</p>
          </div>
        )}

        {apiError && (
          <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl text-xs text-[#991B1B] space-y-1">
            <p>{errorText(apiError)}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
