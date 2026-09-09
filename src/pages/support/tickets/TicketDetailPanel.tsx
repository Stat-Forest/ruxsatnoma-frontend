/**
 * A ticket's own thread and actions, in a `Drawer` (reads better than a
 * `Modal` for a scrolling conversation). `canManage` is passed down from
 * `TicketsTab`, itself already computed with `satisfies('help.tickets.
 * manage', me)` — no second permission check here.
 *
 * Assignment offers only "assign to me": no backend route lists candidate
 * assignees scoped to `help.tickets.manage` (`GET /admin/users` needs the
 * unrelated `auth.users.view`/`.manage`) — see `help/router.py`'s own
 * `assign_ticket` route and `admin/users_router.py`. A named-colleague
 * picker is out of scope for this reason, not an oversight.
 *
 * Ticket message bodies are untrusted, user-authored text — rendered as a
 * plain text node with `white-space: pre-wrap`, never as markup.
 */
import { useState } from 'react';
import { useAuth } from '../../../auth/useAuth';
import { Alert } from '../../../components/ui/Feedback';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/FormControls';
import { Drawer } from '../../../components/ui/Overlay';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useT } from '../../../i18n/useT';
import { formatDateTime } from '../format';
import type { TicketMessageOut, TicketStatus, TicketWithMessagesOut } from './api';
import { useAddTicketMessage, useAssignTicket, useCloseTicket, useResolveTicket, useTicket } from './queries';

const STATUS_LABEL_KEY: Record<string, string> = {
  new: 'support.tickets.statusNew',
  in_progress: 'support.tickets.statusInProgress',
  resolved: 'support.tickets.statusResolved',
  closed: 'support.tickets.statusClosed',
};

export interface TicketDetailPanelProps {
  ticketId: string;
  canManage: boolean;
  onClose: () => void;
}

export function TicketDetailPanel({ ticketId, canManage, onClose }: TicketDetailPanelProps) {
  const t = useT();
  const errorText = useApiErrorText();
  const detail = useTicket(ticketId);

  return (
    <Drawer isOpen onClose={onClose} title={detail.data ? detail.data.number : t('support.common.loading')}>
      {detail.isLoading ? (
        <p className="py-8 text-center text-sm text-[#5A646D]">{t('support.common.loading')}</p>
      ) : detail.error ? (
        <p className="py-8 text-center text-sm text-[#991B1B]" role="alert">
          {detail.error instanceof ApiError ? errorText(detail.error) : t('support.tickets.loadFailed')}
        </p>
      ) : detail.data ? (
        <TicketDetail ticket={detail.data} canManage={canManage} />
      ) : null}
    </Drawer>
  );
}

function TicketDetail({ ticket, canManage }: { ticket: TicketWithMessagesOut; canManage: boolean }) {
  const t = useT();
  const errorText = useApiErrorText();
  const { me } = useAuth();
  const [reply, setReply] = useState('');

  const addMessage = useAddTicketMessage(ticket.id);
  const assign = useAssignTicket(ticket.id);
  const resolve = useResolveTicket(ticket.id);
  const close = useCloseTicket(ticket.id);

  const status = ticket.status as TicketStatus;
  const actionFailure = addMessage.error ?? assign.error ?? resolve.error ?? close.error;

  function submitReply() {
    if (!reply.trim()) return;
    addMessage.mutate({ body: reply.trim() }, { onSuccess: () => setReply('') });
  }

  return (
    <div className="space-y-5" data-testid={`ticket-detail-${ticket.id}`}>
      <div>
        <p className="break-words text-sm font-semibold text-[#1A1F24]">{ticket.subject}</p>
        <p className="mt-1 text-xs text-[#5A646D]">{t(STATUS_LABEL_KEY[status] ?? status)}</p>
      </div>

      {actionFailure && (
        <Alert variant="danger">
          {actionFailure instanceof ApiError ? errorText(actionFailure) : t('support.tickets.actionFailed')}
        </Alert>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {canManage && status !== 'closed' && (
          <Button
            variant="secondary"
            size="sm"
            isLoading={assign.isPending}
            onClick={() => me && assign.mutate(me.user.id)}
            className="w-full sm:w-auto"
          >
            {t('support.tickets.actionAssignMe')}
          </Button>
        )}
        {canManage && status === 'in_progress' && (
          <Button variant="primary" size="sm" isLoading={resolve.isPending} onClick={() => resolve.mutate()} className="w-full sm:w-auto">
            {t('support.tickets.actionResolve')}
          </Button>
        )}
        {status !== 'closed' && (
          <Button variant="danger" size="sm" isLoading={close.isPending} onClick={() => close.mutate()} className="w-full sm:w-auto">
            {t('support.tickets.actionClose')}
          </Button>
        )}
      </div>

      <div className="space-y-3" data-testid="ticket-messages">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A646D]">{t('support.tickets.messagesTitle')}</h3>
        {ticket.messages.map((message) => (
          <MessageRow key={message.id} message={message} ticket={ticket} myUserId={me?.user.id ?? null} />
        ))}
      </div>

      {status === 'closed' ? (
        <Alert variant="info">{t('support.tickets.closedNotice')}</Alert>
      ) : (
        <div className="space-y-2">
          <Textarea
            data-testid="ticket-reply-input"
            placeholder={t('support.tickets.replyPlaceholder')}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            maxLength={5000}
          />
          <Button variant="primary" size="sm" isLoading={addMessage.isPending} onClick={submitReply} className="w-full sm:w-auto">
            {t('support.tickets.replySubmit')}
          </Button>
        </div>
      )}
    </div>
  );
}

function MessageRow({
  message,
  ticket,
  myUserId,
}: {
  message: TicketMessageOut;
  ticket: TicketWithMessagesOut;
  myUserId: string | null;
}) {
  const t = useT();
  const fromRequester = message.author_id === ticket.user_id;
  const isMe = message.author_id === myUserId;

  return (
    <div
      data-testid={`ticket-message-${message.id}`}
      className={`rounded-xl border p-3 text-sm ${fromRequester ? 'border-[#E4E7EA] bg-white' : 'border-[#2E7D4F]/30 bg-[#F0F7F1]'}`}
    >
      <div className="mb-1 flex items-center justify-between text-xs font-semibold text-[#5A646D]">
        <span>
          {fromRequester ? t('support.tickets.messageFromRequester') : t('support.tickets.messageFromStaff')}
          {isMe ? ` (${t('support.tickets.you')})` : ''}
        </span>
        <span>{formatDateTime(message.created_at)}</span>
      </div>
      <p className="break-words whitespace-pre-wrap text-[#1A1F24]">{message.body}</p>
    </div>
  );
}
