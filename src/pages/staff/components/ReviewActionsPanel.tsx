import { useState } from 'react';
import { HelpCircle, MessageCircleQuestion, Undo2 } from 'lucide-react';
import { useAuth } from '../../../auth/useAuth';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useLanguage, useT } from '../../../i18n/useT';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/Overlay';
import { Checkbox, FormField, Select, Textarea } from '../../../components/ui/FormControls';
import { ApiError } from '../../../api/errors';
import {
  useRejectionReasons,
  useRequestInfo,
  useReturnApplication,
  type ApplicationCardOut,
  type ApplicationTimelineOut,
} from '../queries';
import { formatDateTime, localizedName } from '../format';

const REVIEW_PERMISSION = 'applications.review';
const DECIDE_PERMISSION = 'applications.decide';

/** The `applications` columns an applicant actually fills in through the
 *  wizard — a curated SUBSET of what `_APPLICATION_FIELD_NAMES` (every
 *  column of the table) would accept. Ruling (plan 06.5): a free-text key
 *  field would let a typo vanish silently into a 422 `unknown_field`; this
 *  picklist stays a valid subset even if the server's own field set grows,
 *  it just stops being complete — which is the safer way for the two to
 *  drift. */
const FIELD_OPTIONS: { key: string; labelKey: string }[] = [
  { key: 'contour_id', labelKey: 'staff.infoRequest.field.contour' },
  { key: 'period_from', labelKey: 'staff.infoRequest.field.periodFrom' },
  { key: 'period_to', labelKey: 'staff.infoRequest.field.periodTo' },
  { key: 'quantity', labelKey: 'staff.infoRequest.field.quantity' },
  { key: 'benefit_category_item_id', labelKey: 'staff.infoRequest.field.benefit' },
  { key: 'activity_type_id', labelKey: 'staff.infoRequest.field.activityType' },
  { key: 'requested_area_ha', labelKey: 'staff.infoRequest.field.area' },
];

function RequestInfoModal({ applicationId, onClose }: { applicationId: string; onClose: () => void }) {
  const t = useT();
  const errorText = useApiErrorText();
  const [message, setMessage] = useState('');
  const mutation = useRequestInfo(applicationId);
  const apiError = mutation.error instanceof ApiError ? mutation.error : null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('staff.infoRequest.requestModalTitle')}
      subtitle={t('staff.infoRequest.requestModalSubtitle')}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            {t('staff.infoRequest.cancel')}
          </Button>
          <Button
            variant="primary"
            isLoading={mutation.isPending}
            disabled={message.trim().length === 0}
            onClick={() => mutation.mutate(message.trim(), { onSuccess: onClose })}
          >
            {t('staff.infoRequest.sendButton')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormField label={t('staff.infoRequest.messageLabel')} required>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            placeholder={t('staff.infoRequest.messagePlaceholder')}
          />
        </FormField>
        {apiError && (
          <p className="text-xs text-[#B91C1C]" role="alert">
            {errorText(apiError)}
          </p>
        )}
      </div>
    </Modal>
  );
}

function ReturnModal({ applicationId, onClose }: { applicationId: string; onClose: () => void }) {
  const t = useT();
  const { lang } = useLanguage();
  const errorText = useApiErrorText();
  const [reasonItemId, setReasonItemId] = useState('');
  const [legalBasis, setLegalBasis] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const reasons = useRejectionReasons();
  const mutation = useReturnApplication(applicationId);
  const apiError = mutation.error instanceof ApiError ? mutation.error : null;

  // `_return_reason_item`'s own fail-closed rule (`RETURNABLE_REASON_KINDS =
  // {"return", "both"}`) — an RJ-* code that types a REFUSAL (e.g. "plot
  // outside the forest fund") is never offered here: the server would answer
  // it with `reason_not_returnable`, and this house rule is "don't offer
  // what the backend would refuse."
  const returnable = (reasons.data ?? []).filter((r) => {
    const kind = (r.props as Record<string, unknown> | null)?.kind;
    return kind === 'return' || kind === 'both';
  });

  function toggleField(key: string, checked: boolean) {
    setFields((prev) => {
      const next = { ...prev };
      if (checked) next[key] = next[key] ?? '';
      else delete next[key];
      return next;
    });
  }

  const canSubmit =
    reasonItemId !== '' &&
    legalBasis.trim().length > 0 &&
    Object.keys(fields).length > 0 &&
    Object.values(fields).every((note) => note.trim().length > 0);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('staff.infoRequest.returnModalTitle')}
      subtitle={t('staff.infoRequest.returnModalSubtitle')}
      maxWidth="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            {t('staff.infoRequest.cancel')}
          </Button>
          <Button
            variant="primary"
            isLoading={mutation.isPending}
            disabled={!canSubmit}
            onClick={() =>
              mutation.mutate(
                { reason_item_id: reasonItemId, legal_basis: legalBasis, fields_to_fix: fields },
                { onSuccess: onClose },
              )
            }
          >
            {t('staff.infoRequest.returnSubmitButton')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label={t('staff.infoRequest.reasonLabel')} required>
          <Select
            value={reasonItemId}
            onChange={(e) => setReasonItemId(e.target.value)}
            options={[
              { value: '', label: t('staff.infoRequest.selectPlaceholder') },
              ...returnable.map((r) => ({ value: r.id, label: localizedName(r.name, lang) || r.code })),
            ]}
          />
        </FormField>
        <FormField label={t('staff.infoRequest.legalBasisLabel')} required>
          <Textarea
            value={legalBasis}
            onChange={(e) => setLegalBasis(e.target.value)}
            maxLength={2000}
            placeholder={t('staff.infoRequest.legalBasisPlaceholder')}
          />
        </FormField>
        <div>
          <span className="block text-xs font-semibold text-[#1A1F24] mb-2">
            {t('staff.infoRequest.fieldsToFixLabel')}
          </span>
          <div className="space-y-2">
            {FIELD_OPTIONS.map((f) => (
              <div key={f.key} className="border border-[#E4E7EA] rounded-xl p-3 space-y-2">
                <Checkbox label={t(f.labelKey)} checked={f.key in fields} onChange={(e) => toggleField(f.key, e.target.checked)} />
                {f.key in fields && (
                  <Textarea
                    value={fields[f.key]}
                    onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={t('staff.infoRequest.fieldNotePlaceholder')}
                    maxLength={500}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        {apiError && (
          <p className="text-xs text-[#B91C1C]" role="alert">
            {errorText(apiError)}
          </p>
        )}
      </div>
    </Modal>
  );
}

/**
 * D3 (`docs/plans/06-frontend-screens.md`) — return for correction and
 * request-info, the two 3.9b review-time actions that are neither a
 * decision (no ERI signature: `applications.review` holds no signing
 * purpose) nor "take into work" (`DecisionPanel`'s own). A separate panel
 * rather than folded into `DecisionPanel`, for exactly that difference.
 */
export function ReviewActionsPanel({
  card,
  timeline,
}: {
  card: ApplicationCardOut;
  timeline: ApplicationTimelineOut | undefined;
}) {
  const { me } = useAuth();
  const t = useT();
  const [modal, setModal] = useState<'requestInfo' | 'return' | null>(null);

  if (!me) return null;
  const canReview = me.is_superuser || me.permissions.includes(REVIEW_PERMISSION);
  const canDecide = me.is_superuser || me.permissions.includes(DECIDE_PERMISSION);
  const canReturn = canReview || canDecide;

  const openInfoRequest = timeline?.info_requests.find((r) => r.responded_at === null);
  const lastReturn = timeline?.status_history.filter((row) => row.to_status === 'RETURNED').at(-1);

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-5 shadow-xs space-y-3 font-sans">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A646D] border-b border-[#E4E7EA] pb-2">
        {t('staff.infoRequest.panelTitle')}
      </h3>

      {card.status === 'PENDING_INFO' && (
        <div className="p-3 bg-[#E0F2FE] border border-[#BAE6FD] rounded-xl text-xs text-[#0369A1] space-y-1">
          <p className="font-bold flex items-center gap-1.5">
            <MessageCircleQuestion className="w-4 h-4" /> {t('staff.infoRequest.pendingBanner')}
          </p>
          {openInfoRequest && (
            <>
              <p className="text-[#1A1F24]">{openInfoRequest.message}</p>
              <p className="text-[11px] font-mono">
                {t('staff.infoRequest.requestedAt')} {formatDateTime(openInfoRequest.requested_at)}
              </p>
            </>
          )}
          <p className="text-[11px]">{t('staff.infoRequest.pendingHint')}</p>
        </div>
      )}

      {card.status === 'RETURNED' && lastReturn && (
        <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-xs text-[#92400E] space-y-1">
          <p className="font-bold flex items-center gap-1.5">
            <Undo2 className="w-4 h-4" /> {t('staff.infoRequest.returnedBanner')}
          </p>
          {lastReturn.legal_basis && <p>{lastReturn.legal_basis}</p>}
          {lastReturn.fields_to_fix && (
            <ul className="list-disc list-inside space-y-0.5">
              {Object.entries(lastReturn.fields_to_fix).map(([field, note]) => (
                <li key={field}>
                  <span className="font-mono">{field}</span>: {String(note)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(card.status === 'SUBMITTED' || card.status === 'IN_REVIEW') && (
        <div className="space-y-2">
          {canReview && (
            <Button
              variant="outline"
              fullWidth
              leftIcon={<HelpCircle className="w-4 h-4" />}
              onClick={() => setModal('requestInfo')}
            >
              {t('staff.infoRequest.requestInfoButton')}
            </Button>
          )}
          {canReturn && (
            <Button
              variant="outline"
              fullWidth
              leftIcon={<Undo2 className="w-4 h-4" />}
              onClick={() => setModal('return')}
            >
              {t('staff.infoRequest.returnButton')}
            </Button>
          )}
          {!canReview && !canReturn && <p className="text-xs text-[#5A646D]">{t('staff.infoRequest.noPermission')}</p>}
        </div>
      )}

      {modal === 'requestInfo' && <RequestInfoModal applicationId={card.id} onClose={() => setModal(null)} />}
      {modal === 'return' && <ReturnModal applicationId={card.id} onClose={() => setModal(null)} />}
    </div>
  );
}
