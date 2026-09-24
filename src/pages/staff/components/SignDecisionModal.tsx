import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Modal } from '../../../components/ui/Overlay';
import { Button } from '../../../components/ui/button';
import { FormField, Textarea } from '../../../components/ui/FormControls';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import {
  buildMockSignature,
  eimzoErrorMessageKey,
  isEimzoCancelled,
  isEimzoMock,
  MockSignerNotice,
  signDocument,
  useMockSigner,
} from '../../../lib/eimzo';
import { useLanguage, useT } from '../../../i18n/useT';
import { useApplicationPackage, useRejectionDefaults, useRejectionReasons, type RejectInput } from '../queries';
import { emptyGround, groundComplete, type GroundDraft } from '../groundDraft';
import { RejectionGroundsEditor } from './RejectionGroundsEditor';

export type DecisionMode = 'approve' | 'reject';

interface SignDecisionModalProps {
  mode: DecisionMode;
  applicationId: string;
  isSubmitting: boolean;
  error: unknown;
  /**
   * Non-null while the application's own benefit claim is `rejected`.
   * Ruling R8 (stage 16) retires ruling #182's server-side default: this no
   * longer makes any field optional — the server always requires the full
   * set of grounds — it only prefills the FIRST ground's `fact`, editable,
   * so the head does not retype what the leshoz already recorded.
   * `null`/`undefined` for every other application (including
   * `mode === 'approve'`, which never reads this) leaves the first ground
   * blank as usual.
   */
  benefitRejectionReason?: string | null;
  onClose: () => void;
  onSubmitApprove: (pkcs7: string) => void;
  onSubmitReject: (input: RejectInput) => void;
}

/** Every field of a ground, trimmed — the submitted body carries no leading
 *  or trailing whitespace a head's keyboard happened to leave behind. */
function trimAll(g: GroundDraft): GroundDraft {
  return {
    reason_item_id: g.reason_item_id.trim(),
    fact: g.fact.trim(),
    legal_document: g.legal_document.trim(),
    legal_clause: g.legal_clause.trim(),
    evidence: g.evidence.trim(),
    remedy: g.remedy.trim(),
  };
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
    reapplyLabel: 'Qayta murojaat',
    appealLabel: 'Shikoyat qilish',
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
    reapplyLabel: 'Қайта мурожаат',
    appealLabel: 'Шикоят қилиш',
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
    reapplyLabel: 'Повторное обращение',
    appealLabel: 'Обжалование',
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
    reapplyLabel: 'Re-applying',
    appealLabel: 'Appeal',
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
    reapplyLabel: 'Qayta múrájat',
    appealLabel: 'Shaǵım etiw',
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
  // Ruling R8 (stage 16): the rejected benefit claim's own reason prefills
  // the FIRST ground's `fact`, editable — never sent as-is.
  const [grounds, setGrounds] = useState<GroundDraft[]>(() => [emptyGround(benefitRejectionReason ?? '')]);
  const [reapply, setReapply] = useState<string | null>(null);
  const [appeal, setAppeal] = useState<string | null>(null);
  // Real mode only: `signDocument` runs BEFORE `onSubmitApprove`/
  // `onSubmitReject` ever fire, so its own failure never reaches the
  // mutation's `error` prop — kept apart, same reason
  // `PermitLifecyclePanel.tsx`'s own `eimzoErrorKey` is.
  const [eimzoErrorKey, setEimzoErrorKey] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  const rejectionReasons = useRejectionReasons();
  // Reject mode only — approve never needs the notice's default texts, and
  // the route stays unmocked wherever an approve-only test never expects it.
  const defaults = useRejectionDefaults(applicationId, { enabled: mode === 'reject' });
  // The user's own edit wins once they touch the field; the default fills
  // in once it has loaded, and only until then.
  const reapplyText = reapply ?? defaults.data?.reapply_text ?? '';
  const appealText = appeal ?? defaults.data?.appeal_text ?? '';
  const packageQuery = useApplicationPackage(applicationId);
  const loadingPackage = packageQuery.isLoading;
  const packageError = packageQuery.error
    ? packageQuery.error instanceof ApiError
      ? errorText(packageQuery.error)
      : tr.packageErrorFallback
    : null;

  // `signer.blocked` (mock mode, no PINFL on the account) disables the
  // button — unlike the old empty-field case there is nothing the operator
  // could type to fix it, and `MockSignerNotice` below says why. Ruling R3:
  // every ground's six fields are required, plus both notice texts.
  const canSubmit =
    packageQuery.data !== undefined &&
    !isSubmitting &&
    !signing &&
    !signer.blocked &&
    (mode === 'approve' ||
      (grounds.length > 0 && grounds.every(groundComplete) && reapplyText.trim() !== '' && appealText.trim() !== ''));

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
        // Cancel in the certificate picker is a decision, not a failure:
        // an error banner here would claim the document failed to sign.
        if (isEimzoCancelled(err)) return;
        setEimzoErrorKey(eimzoErrorMessageKey(err));
        return;
      } finally {
        setSigning(false);
      }
    }
    if (mode === 'approve') {
      onSubmitApprove(pkcs7);
    } else {
      onSubmitReject({
        pkcs7,
        grounds: grounds.map(trimAll),
        reapply_text: reapplyText.trim(),
        appeal_text: appealText.trim(),
      });
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
            <RejectionGroundsEditor value={grounds} onChange={setGrounds} reasons={rejectionReasons.data ?? []} />
            <FormField label={tr.reapplyLabel} required>
              <Textarea
                value={reapplyText}
                onChange={(e) => setReapply(e.target.value)}
                maxLength={2000}
              />
            </FormField>
            <FormField label={tr.appealLabel} required>
              <Textarea
                value={appealText}
                onChange={(e) => setAppeal(e.target.value)}
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
