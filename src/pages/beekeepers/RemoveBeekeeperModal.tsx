import { useState } from 'react';
import { Modal } from '../../components/ui/Overlay';
import { Button } from '../../components/ui/button';
import { FormField, Textarea } from '../../components/ui/FormControls';
import { Alert } from '../../components/ui/Feedback';
import { ApiError } from '../../api/errors';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { useT } from '../../i18n/useT';
import type { BeekeeperOut } from './api';
import { useRemoveBeekeeper } from './queries';

export interface RemoveBeekeeperModalProps {
  beekeeper: BeekeeperOut;
  onClose: () => void;
  onRemoved: () => void;
}

/**
 * `POST /beekeepers/{id}/remove` — never a DELETE (`BeekeeperOut.status`
 * migration CHECK requires a `removed` row to carry a reason). The submit
 * button stays disabled until `reason.trim()` is non-empty, the same
 * client-side backstop `RejectClaimModal` (`pages/staff/components/`) uses
 * for its own mandatory reason.
 */
export function RemoveBeekeeperModal({ beekeeper, onClose, onRemoved }: RemoveBeekeeperModalProps) {
  const t = useT();
  const errorText = useApiErrorText();
  const [reason, setReason] = useState('');
  const remove = useRemoveBeekeeper(beekeeper.id);
  const trimmed = reason.trim();

  function submit() {
    if (!trimmed) return;
    remove.mutate(trimmed, { onSuccess: onRemoved });
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('beekeepers.remove.title')}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={remove.isPending}>
            {t('beekeepers.remove.cancel')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={submit}
            isLoading={remove.isPending}
            disabled={!trimmed}
            data-testid="remove-beekeeper-submit"
          >
            {t('beekeepers.remove.submit')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-[#E4E7EA] bg-[#F8F9FA] p-3">
          <p className="text-sm font-semibold text-[#1A1F24]">{beekeeper.full_name}</p>
          <p className="mt-0.5 font-mono text-[11px] text-[#5A646D]">{beekeeper.certificate_no}</p>
        </div>
        <FormField
          label={t('beekeepers.remove.reasonLabel')}
          required
          error={reason.length > 0 && !trimmed ? t('beekeepers.remove.reasonRequired') : undefined}
        >
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('beekeepers.remove.reasonPlaceholder')}
            data-testid="remove-beekeeper-reason"
          />
        </FormField>

        {remove.error && (
          <Alert variant="danger">
            {remove.error instanceof ApiError ? errorText(remove.error) : t('beekeepers.remove.error')}
          </Alert>
        )}
      </div>
    </Modal>
  );
}
