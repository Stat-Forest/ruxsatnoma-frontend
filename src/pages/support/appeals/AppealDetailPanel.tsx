/**
 * One citizen's appeal — number, contact, subject/body (untrusted text,
 * rendered plain with `white-space: pre-wrap`, never as markup), and
 * exactly the action set `public.models.APPEAL_TRANSITIONS` plus the two
 * mutating routes' own narrower rules allow:
 *   new         -> [Взять в работу, Ответить, Закрыть]
 *   in_progress -> [Ответить, Закрыть]
 *   answered    -> [Закрыть]
 *   closed      -> none (terminal)
 *
 * No deadline/SLA field anywhere on `AppealAdminOut` or the `CitizenAppeal`
 * model (verified directly against `backend/app/modules/public/schemas.py`
 * and `models.py`) — this panel renders nothing here, rather than computing
 * one client-side with no backend-sourced policy.
 */
import { useState } from 'react';
import { Alert } from '../../../components/ui/Feedback';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/FormControls';
import { Drawer } from '../../../components/ui/Overlay';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useT } from '../../../i18n/useT';
import { formatDateTime } from '../format';
import { readContact, type AppealAdminOut, type AppealStatus } from './api';
import { useAdvanceAppealStatus, useAnswerAppeal, useAppeal } from './queries';

const STATUS_LABEL_KEY: Record<string, string> = {
  new: 'support.appeals.statusNew',
  in_progress: 'support.appeals.statusInProgress',
  answered: 'support.appeals.statusAnswered',
  closed: 'support.appeals.statusClosed',
};

export interface AppealDetailPanelProps {
  appealId: string;
  onClose: () => void;
}

export function AppealDetailPanel({ appealId, onClose }: AppealDetailPanelProps) {
  const t = useT();
  const errorText = useApiErrorText();
  const detail = useAppeal(appealId);

  return (
    <Drawer isOpen onClose={onClose} title={detail.data ? detail.data.number : t('support.common.loading')}>
      {detail.isLoading ? (
        <p className="py-8 text-center text-sm text-[#5A646D]">{t('support.common.loading')}</p>
      ) : detail.error ? (
        <p className="py-8 text-center text-sm text-[#991B1B]" role="alert">
          {detail.error instanceof ApiError ? errorText(detail.error) : t('support.appeals.loadFailed')}
        </p>
      ) : detail.data ? (
        <AppealDetail appeal={detail.data} />
      ) : null}
    </Drawer>
  );
}

function AppealDetail({ appeal }: { appeal: AppealAdminOut }) {
  const t = useT();
  const errorText = useApiErrorText();
  const [answering, setAnswering] = useState(false);
  const [answerText, setAnswerText] = useState('');

  const advance = useAdvanceAppealStatus(appeal.id);
  const answer = useAnswerAppeal(appeal.id);

  const status = appeal.status as AppealStatus;
  const contact = readContact(appeal.contact);
  const actionFailure = advance.error ?? answer.error;

  function submitAnswer() {
    if (!answerText.trim()) return;
    answer.mutate(answerText.trim(), {
      onSuccess: () => {
        setAnswering(false);
        setAnswerText('');
      },
    });
  }

  return (
    <div className="space-y-5" data-testid={`appeal-detail-${appeal.id}`}>
      <div>
        <p className="break-words text-sm font-semibold text-[#1A1F24]">{appeal.applicant_name}</p>
        <p className="mt-1 text-xs text-[#5A646D]">{t(STATUS_LABEL_KEY[status] ?? status)}</p>
      </div>

      {(contact.phone || contact.email) && (
        <div className="space-y-1 rounded-xl border border-[#E4E7EA] bg-[#F8F9FA] p-3 text-sm" data-testid="appeal-contact">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A646D]">{t('support.appeals.detailContact')}</h3>
          {contact.phone && (
            <p className="break-words">
              <span className="text-[#5A646D]">{t('support.appeals.contactPhone')}: </span>
              {contact.phone}
            </p>
          )}
          {contact.email && (
            <p className="break-words">
              <span className="text-[#5A646D]">{t('support.appeals.contactEmail')}: </span>
              {contact.email}
            </p>
          )}
        </div>
      )}

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A646D]">{t('support.appeals.detailSubject')}</h3>
        <p className="mt-1 break-words text-sm font-semibold text-[#1A1F24]">{appeal.subject}</p>
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A646D]">{t('support.appeals.detailBody')}</h3>
        <p className="mt-1 break-words whitespace-pre-wrap text-sm text-[#1A1F24]">{appeal.body}</p>
      </div>

      {appeal.answer_text && (
        <div className="rounded-xl border border-[#2E7D4F]/30 bg-[#F0F7F1] p-3" data-testid="appeal-answer">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A646D]">{t('support.appeals.detailAnswer')}</h3>
          <p className="mt-1 break-words whitespace-pre-wrap text-sm text-[#1A1F24]">{appeal.answer_text}</p>
          {appeal.answered_at && (
            <p className="mt-2 text-xs text-[#5A646D]">
              {t('support.appeals.answeredAt')}: {formatDateTime(appeal.answered_at)}
            </p>
          )}
        </div>
      )}

      {actionFailure && (
        <Alert variant="danger">
          {actionFailure instanceof ApiError ? errorText(actionFailure) : t('support.appeals.actionFailed')}
        </Alert>
      )}

      {status === 'closed' ? (
        <Alert variant="info">{t('support.appeals.terminalNotice')}</Alert>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {status === 'new' && (
              <Button variant="secondary" size="sm" isLoading={advance.isPending} onClick={() => advance.mutate('in_progress')} className="w-full sm:w-auto">
                {t('support.appeals.actionTakeInProgress')}
              </Button>
            )}
            {(status === 'new' || status === 'in_progress') && !answering && (
              <Button variant="primary" size="sm" onClick={() => setAnswering(true)} className="w-full sm:w-auto">
                {t('support.appeals.actionAnswer')}
              </Button>
            )}
            <Button variant="danger" size="sm" isLoading={advance.isPending} onClick={() => advance.mutate('closed')} className="w-full sm:w-auto">
              {t('support.appeals.actionClose')}
            </Button>
          </div>

          {answering && (
            <div className="space-y-2">
              <Textarea
                data-testid="appeal-answer-input"
                placeholder={t('support.appeals.answerPlaceholder')}
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                maxLength={5000}
              />
              <Button variant="primary" size="sm" isLoading={answer.isPending} onClick={submitAnswer} className="w-full sm:w-auto">
                {t('support.appeals.answerSubmit')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
