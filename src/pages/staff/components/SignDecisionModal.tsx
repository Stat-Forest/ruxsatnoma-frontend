import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Modal } from '../../../components/ui/Overlay';
import { Button } from '../../../components/ui/button';
import { FormField, Input, Select, Textarea } from '../../../components/ui/FormControls';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import {
  buildMockSignature,
  eimzoErrorMessageKey,
  isEimzoMock,
  PINFL_PATTERN,
  signDocument,
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
  onClose: () => void;
  onSubmitApprove: (pkcs7: string) => void;
  onSubmitReject: (input: { pkcs7: string; reason_item_id: string; legal_basis: string }) => void;
}

/**
 * The one place both decision routes get their `pkcs7` from. Under the
 * mock, a real E-IMZO client's certificate is stood in for by asking the
 * operator for the PINFL it would carry (see `lib/eimzoMock.ts`'s own
 * docstring for why `GET /auth/me` cannot supply it); in real mode
 * (fix wave, finding 2) there is no PINFL box at all — the certificate the
 * signer picks in E-IMZO carries that identity, task 10's own rule applied
 * here. Nothing about the DECISION itself is faked either way: the bytes
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
  onClose,
  onSubmitApprove,
  onSubmitReject,
}: SignDecisionModalProps) {
  const { lang } = useLanguage();
  const t = useT();
  const errorText = useApiErrorText();
  const [pinfl, setPinfl] = useState('');
  const [reasonItemId, setReasonItemId] = useState('');
  const [legalBasis, setLegalBasis] = useState('');
  // Set only once the operator has actually tried to submit with the PINFL
  // field empty — an empty field is normal before that point and should not
  // shout at someone who has not touched the form yet.
  const [pinflTouched, setPinflTouched] = useState(false);
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
      : 'Hujjat yuklanmadi.'
    : null;

  // Mock mode only — a real certificate carries the signer's identity, no
  // PINFL box to validate (task 10's own rule, applied here per fix wave
  // finding 2).
  const pinflValid = !isEimzoMock() || PINFL_PATTERN.test(pinfl);
  // `pinflValid` is deliberately NOT part of `canSubmit`: with it there, an
  // empty field simply disabled the button and a click did nothing at all —
  // no error, no feedback (the defect this task fixes). The button stays
  // clickable so `handleSubmit` below can run its own check and say why it
  // refused, the same way `PermitSignaturesPanel.tsx::handleSign` already
  // does for the permit's own signature slots.
  const canSubmit =
    packageQuery.data !== undefined &&
    !isSubmitting &&
    !signing &&
    (mode === 'approve' || (reasonItemId !== '' && legalBasis.trim().length > 0));

  async function handleSubmit() {
    if (isEimzoMock() && !PINFL_PATTERN.test(pinfl)) {
      setPinflTouched(true);
      return;
    }
    if (!packageQuery.data) return;
    setEimzoErrorKey(null);
    let pkcs7: string;
    if (isEimzoMock()) {
      pkcs7 = await buildMockSignature({ pinfl, documentBytes: packageQuery.data });
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
      onSubmitReject({ pkcs7, reason_item_id: reasonItemId, legal_basis: legalBasis });
    }
  }

  const apiError = error instanceof ApiError ? error : null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={mode === 'approve' ? 'Arizani tasdiqlash' : 'Arizani rad etish'}
      subtitle="ERI (E-IMZO) bilan tasdiqlanadi — demo rejimida mock imzo"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Bekor qilish
          </Button>
          <Button
            variant={mode === 'approve' ? 'primary' : 'danger'}
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            isLoading={isSubmitting || signing}
          >
            {mode === 'approve' ? 'Tasdiqlash va imzolash' : 'Rad etish va imzolash'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {loadingPackage && (
          <div className="flex items-center gap-2 text-xs text-[#5A646D]">
            <Loader2 className="w-4 h-4 animate-spin" /> Imzolanadigan hujjat yuklanmoqda (GET .../package)...
          </div>
        )}
        {packageError && (
          <p className="text-xs text-[#B91C1C] flex items-center gap-1.5" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0" /> {packageError}
          </p>
        )}

        {mode === 'reject' && (
          <>
            <FormField label="Rad etish sababi" required>
              <Select
                value={reasonItemId}
                onChange={(e) => setReasonItemId(e.target.value)}
                options={[
                  { value: '', label: 'Tanlang...' },
                  ...(rejectionReasons.data ?? []).map((r) => ({ value: r.id, label: localizedName(r.name, lang) || r.code })),
                ]}
              />
            </FormField>
            <FormField label="Huquqiy asos (legal_basis)" required>
              <Textarea
                value={legalBasis}
                onChange={(e) => setLegalBasis(e.target.value)}
                placeholder="Masalan: VMQ 278-son, 12-band"
                maxLength={2000}
              />
            </FormField>
          </>
        )}

        {isEimzoMock() && (
          <FormField
            label="ERI sertifikatingiz PINFL (JSHSHIR)"
            required
            helperText="14 xonali raqam — mock ERI uchun kiritiladi, haqiqiy E-IMZO kalitida bu avtomatik oʻqiladi."
            error={
              (pinflTouched || pinfl !== '') && !pinflValid
                ? pinfl === ''
                  ? 'PINFL kiritilishi shart — bu maydondagi 14 xonali raqam faqat namuna sifatida koʻrsatilgan.'
                  : '14 xonali raqam boʻlishi kerak'
                : undefined
            }
          >
            <Input
              inputMode="numeric"
              value={pinfl}
              onChange={(e) => setPinfl(e.target.value.replace(/\D/g, '').slice(0, 14))}
              onBlur={() => setPinflTouched(true)}
              placeholder="31207854315218"
            />
          </FormField>
        )}

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
