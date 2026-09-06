/**
 * "New ticket" form — any authenticated user, including a `help.tickets.
 * manage` holder filing their own request. No file attachment UI: `file_id`
 * stays unset from this screen, the same simplification `announcements/
 * api.ts` documents for its own `file_ids`.
 */
import { useState } from 'react';
import { Modal } from '../../../components/ui/Overlay';
import { Button } from '../../../components/ui/button';
import { FormField, Input, Textarea } from '../../../components/ui/FormControls';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useT } from '../../../i18n/useT';
import { useCreateTicket } from './queries';

export interface TicketFormModalProps {
  onClose: () => void;
  /** Called with the freshly created ticket's id so the caller can open its
   *  detail panel immediately — the filer should see their own ticket
   *  number right away, not have to find it again in the list. */
  onCreated: (ticketId: string) => void;
}

export function TicketFormModal({ onClose, onCreated }: TicketFormModalProps) {
  const t = useT();
  const toErrorText = useApiErrorText();
  const create = useCreateTicket();

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const failure = create.error;
  const errorText =
    validationError ?? (failure instanceof ApiError ? toErrorText(failure) : failure ? failure.message : null);

  function submit() {
    if (!subject.trim() || !body.trim()) {
      setValidationError(t('support.tickets.createFailed'));
      return;
    }
    setValidationError(null);
    create.mutate(
      { subject: subject.trim(), body: body.trim() },
      { onSuccess: (ticket) => onCreated(ticket.id) },
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('support.tickets.newTicket')}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t('support.common.cancel')}
          </Button>
          <Button variant="primary" size="sm" onClick={submit} isLoading={create.isPending}>
            {t('support.tickets.formSubmit')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {errorText && (
          <div role="alert" data-testid="ticket-form-error" className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] p-3 text-xs text-[#991B1B]">
            {errorText}
          </div>
        )}

        <FormField label={t('support.tickets.formSubject')} htmlFor="ticket-form-subject" required>
          <Input
            id="ticket-form-subject"
            data-testid="ticket-form-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={255}
          />
        </FormField>

        <FormField label={t('support.tickets.formBody')} htmlFor="ticket-form-body" required>
          <Textarea
            id="ticket-form-body"
            data-testid="ticket-form-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
          />
        </FormField>
      </div>
    </Modal>
  );
}
