import { useState } from 'react';
import { Modal } from '../../../components/ui/Overlay';
import { Button } from '../../../components/ui/button';
import { FormField, Textarea } from '../../../components/ui/FormControls';
import { Alert } from '../../../components/ui/Feedback';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useT } from '../../../i18n/useT';
import { useRejectBenefitClaim } from '../queries';

export interface RejectClaimModalProps {
  applicationId: string;
  onClose: () => void;
  onRejected: () => void;
}

/**
 * The rejection reason (rulings #181/#182, moved unchanged from stage 9's
 * `src/pages/benefits/RejectClaimModal.tsx`): "a rejection without a reason
 * must be impossible in the UI, not merely refused by the server". The wire
 * already enforces `min_length=1` (`BenefitClaimRejectIn`), but this modal
 * does not lean on that — the submit button stays disabled until
 * `reason.trim()` is non-empty, so a blank submission never reaches `fetch`
 * at all, let alone the server's own 422.
 */
export function RejectClaimModal({ applicationId, onClose, onRejected }: RejectClaimModalProps) {
  const t = useT();
  const errorText = useApiErrorText();
  const [reason, setReason] = useState('');
  const reject = useRejectBenefitClaim(applicationId);
  const trimmed = reason.trim();

  function submit() {
    if (!trimmed) return;
    reject.mutate(trimmed, { onSuccess: onRejected });
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('staff.benefitClaim.reject.title')}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={reject.isPending}>
            {t('staff.benefitClaim.reject.cancel')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={submit}
            isLoading={reject.isPending}
            disabled={!trimmed}
            data-testid="reject-claim-submit"
          >
            {t('staff.benefitClaim.reject.submit')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormField
          label={t('staff.benefitClaim.reject.reasonLabel')}
          required
          error={reason.length > 0 && !trimmed ? t('staff.benefitClaim.reject.reasonRequired') : undefined}
        >
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('staff.benefitClaim.reject.reasonPlaceholder')}
            data-testid="reject-claim-reason"
          />
        </FormField>

        {reject.error && (
          <Alert variant="danger">
            {reject.error instanceof ApiError ? errorText(reject.error) : t('staff.benefitClaim.reject.error')}
          </Alert>
        )}
      </div>
    </Modal>
  );
}
