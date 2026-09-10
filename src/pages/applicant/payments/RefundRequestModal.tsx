import { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { FormField, Select, Textarea } from '../../../components/ui/FormControls';
import { Modal } from '../../../components/ui/Overlay';
import { Alert } from '../../../components/ui/Feedback';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useT, useLanguage } from '../../../i18n/useT';
import { pickName } from '../format';
import type { ClassifierItemOut } from '../api';
import { useRequestRefund } from './queries';

export interface BillableApplication {
  id: string;
  number: string | null;
  /** The newest invoice's status — shown beside the number so the citizen
   * picks the paid one, not the one they never paid. */
  invoiceStatus: string;
}

/** Stage 11, ruling R4 — the citizen's refund request. No free-text UUID: the
 * application is picked from those that carry an invoice (the page already
 * holds both lists), the basis from the LIVE `refund_reasons` classifier and
 * sent as the item's `id` — `RefundRequestIn.basis_item_id` is a UUID, and
 * sending the code is the exact bug the accountant's modal shipped with. */
export function RefundRequestModal({
  onClose,
  onSent,
  applications,
  reasons,
}: {
  onClose: () => void;
  onSent: () => void;
  applications: BillableApplication[];
  reasons: ClassifierItemOut[];
}) {
  const t = useT();
  const { lang } = useLanguage();
  const errorText = useApiErrorText();
  const [applicationId, setApplicationId] = useState('');
  const [basisItemId, setBasisItemId] = useState('');
  const [comment, setComment] = useState('');
  const mutation = useRequestRefund();

  // The two lists (applications, reasons) may still be loading when the
  // modal opens — the state above starts empty on purpose, not from
  // `applications[0]?.id`, which would freeze at '' forever once the props
  // arrive later. Re-derive the effective value on every render instead.
  const chosenApplicationId = applicationId || applications[0]?.id || '';
  const chosenBasisItemId = basisItemId || reasons[0]?.id || '';

  const error =
    mutation.error instanceof ApiError
      ? mutation.error.code === 'ERR-SYS-003'
        ? t('myPayments.refunds.requestNotFound')
        : errorText(mutation.error)
      : mutation.isError
        ? t('myPayments.refunds.requestFailed')
        : null;

  const canFile = applications.length > 0 && reasons.length > 0 && chosenApplicationId !== '' && chosenBasisItemId !== '';

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('myPayments.refunds.newRequest')}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            {t('myPayments.refunds.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!canFile}
            isLoading={mutation.isPending}
            onClick={() =>
              mutation.mutate(
                { application_id: chosenApplicationId, basis_item_id: chosenBasisItemId, comment: comment.trim() || null },
                {
                  onSuccess: () => {
                    onSent();
                    onClose();
                  },
                },
              )
            }
          >
            {t('myPayments.refunds.submit')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {applications.length === 0 && <Alert variant="warning">{t('myPayments.refunds.noBillableApplications')}</Alert>}
        <FormField label={t('myPayments.refunds.applicationLabel')} required htmlFor="refund-application">
          <Select
            id="refund-application"
            value={chosenApplicationId}
            onChange={(e) => setApplicationId(e.target.value)}
            disabled={applications.length === 0}
            options={applications.map((item) => ({
              value: item.id,
              label: `${item.number ?? item.id.slice(0, 8)} — ${item.invoiceStatus}`,
            }))}
          />
        </FormField>
        <FormField label={t('myPayments.refunds.basisLabel')} required htmlFor="refund-basis">
          <Select
            id="refund-basis"
            value={chosenBasisItemId}
            onChange={(e) => setBasisItemId(e.target.value)}
            options={reasons.map((item) => ({ value: item.id, label: pickName(item.name, lang) }))}
          />
        </FormField>
        <FormField label={t('myPayments.refunds.commentLabel')} htmlFor="refund-comment">
          <Textarea id="refund-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
        </FormField>
        {error && <Alert variant="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}
