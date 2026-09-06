import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Modal } from '../../../components/ui/Overlay';
import { Button } from '../../../components/ui/button';
import { FormField, Input, Select, Textarea } from '../../../components/ui/FormControls';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { buildMockSignature, PINFL_PATTERN } from '../../../lib/eimzoMock';
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
 * The one place both decision routes get their `pkcs7` from. A real E-IMZO
 * client reads the signer's own certificate off an inserted key; this mocks
 * that step by asking the operator for the PINFL their certificate would
 * carry (see `lib/eimzoMock.ts`'s own docstring for why `GET /auth/me` cannot
 * supply it). Nothing about the DECISION itself is faked: the bytes signed
 * are the real `GET /applications/{id}/package` response, fetched fresh on
 * open (ruling 23 — the package is priced afresh on every call), and the
 * signature is verified for real by `signatures.service.sign()`.
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
  const errorText = useApiErrorText();
  const [pinfl, setPinfl] = useState('');
  const [reasonItemId, setReasonItemId] = useState('');
  const [legalBasis, setLegalBasis] = useState('');
  // Set only once the operator has actually tried to submit with the PINFL
  // field empty — an empty field is normal before that point and should not
  // shout at someone who has not touched the form yet.
  const [pinflTouched, setPinflTouched] = useState(false);

  const rejectionReasons = useRejectionReasons();
  const packageQuery = useApplicationPackage(applicationId);
  const loadingPackage = packageQuery.isLoading;
  const packageError = packageQuery.error
    ? packageQuery.error instanceof ApiError
      ? errorText(packageQuery.error)
      : 'Hujjat yuklanmadi.'
    : null;

  const pinflValid = PINFL_PATTERN.test(pinfl);
  // `pinflValid` is deliberately NOT part of `canSubmit`: with it there, an
  // empty field simply disabled the button and a click did nothing at all —
  // no error, no feedback (the defect this task fixes). The button stays
  // clickable so `handleSubmit` below can run its own check and say why it
  // refused, the same way `PermitSignaturesPanel.tsx::handleSign` already
  // does for the permit's own signature slots.
  const canSubmit =
    packageQuery.data !== undefined &&
    !isSubmitting &&
    (mode === 'approve' || (reasonItemId !== '' && legalBasis.trim().length > 0));

  async function handleSubmit() {
    if (!pinflValid) {
      setPinflTouched(true);
      return;
    }
    if (!packageQuery.data) return;
    const pkcs7 = await buildMockSignature({ pinfl, documentBytes: packageQuery.data });
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
            isLoading={isSubmitting}
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
                  ...(rejectionReasons.data ?? []).map((r) => ({ value: r.id, label: localizedName(r.name) || r.code })),
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

        {apiError && (
          <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl text-xs text-[#991B1B] space-y-1">
            <p>{errorText(apiError)}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
