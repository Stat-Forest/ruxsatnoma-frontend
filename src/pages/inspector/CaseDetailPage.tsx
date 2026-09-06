/**
 * С15/С16 — one violation case an inspection act opened (`GET
 * /inspections/cases/{id}` -> `CaseCardOut`). Six actions, each its OWN
 * gated block per `service.py`'s own rules — never a single "manage"
 * toggle, since each has a different eligible actor and a different set of
 * reachable statuses (house rule: an action the backend would refuse is
 * not offered):
 *
 * - Request explanation — `status === 'opened'` AND (`cases.manage` OR
 *   `acts.write`, since an inspector CAN request one on a case their own
 *   act opened).
 * - Record explanation — `status === 'explanation_requested'` AND
 *   (`cases.manage` OR the viewer IS the case's own applicant).
 * - Decide / Resolve appeal / Close — `cases.manage` only, full stop,
 *   further narrowed by status (`opened`/`explanation_requested`/
 *   `explained` for decide, `appealed` for resolve, `decided` for close).
 * - File appeal — the case's own applicant only, `status === 'decided'`,
 *   and only while there is no OTHER open appeal already
 *   (`ERR-INSP-001 appeal_already_open`).
 */
import { useRef, useState } from 'react';
import { useParams } from 'react-router';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { useLanguage, useT } from '../../i18n/useT';
import { Button } from '../../components/ui/button';
import { FormField, Input, Select, Textarea } from '../../components/ui/FormControls';
import { StatusBadge, type StatusType } from '../../components/ui/StatusBadge';
import { ApiError } from '../../api/errors';
import { formatDate, formatDateTime, formatMoney, pickLocalizedName } from './format';
import { INSPECTIONS_ACTS_WRITE, INSPECTIONS_CASES_MANAGE } from './permissions';
import {
  uploadActFile,
  useAppealCase,
  useCase,
  useCloseCase,
  useDecideCase,
  useRequestExplanation,
  useResolveAppeal,
  useSubmitExplanation,
  useViolationTypes,
  type AppealOut,
  type DecisionIn,
} from './queries';

const CASE_STATUS_BADGE: Record<string, StatusType> = {
  opened: 'pending',
  explanation_requested: 'pending',
  explained: 'info',
  decided: 'approved',
  appealed: 'warning',
  closed: 'approved',
  archived: 'draft',
};

const CASE_STATUS_LABEL_KEY: Record<string, string> = {
  opened: 'inspector.cases.status.opened',
  explanation_requested: 'inspector.cases.status.explanationRequested',
  explained: 'inspector.cases.status.explained',
  decided: 'inspector.cases.status.decided',
  appealed: 'inspector.cases.status.appealed',
  closed: 'inspector.cases.status.closed',
  archived: 'inspector.cases.status.archived',
};

const DECISION_LABEL_KEY: Record<string, string> = {
  warning: 'inspector.caseDetail.decision.warning',
  suspend: 'inspector.caseDetail.decision.suspend',
  revoke: 'inspector.caseDetail.decision.revoke',
  transfer: 'inspector.caseDetail.decision.transfer',
};

/** A status/decision code is a plain `string` on the wire — an
 *  unrecognised value falls back to the raw code rather than crashing or
 *  showing a translation-key placeholder. */
function labelOr(map: Record<string, string>, value: string, t: (key: string) => string): string {
  const key = map[value];
  return key ? t(key) : value;
}

/** Mirrors `repo.get_open_appeal`'s own idea: an appeal is open until it
 *  has a `result` — `file appeal` stays hidden while one already is. */
function hasOpenAppeal(appeals: AppealOut[]): boolean {
  return appeals.some((appeal) => appeal.result == null);
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-2 border-b border-[#F0F2F4] last:border-0 text-sm">
      <dt className="text-[#5A646D]">{label}</dt>
      <dd className="font-semibold text-[#1A1F24] text-right">{value}</dd>
    </div>
  );
}

function MutationError({ error }: { error: unknown }) {
  const errorText = useApiErrorText();
  if (!(error instanceof ApiError)) return null;
  return (
    <p className="text-xs text-[#B91C1C]" role="alert">
      {errorText(error)}
    </p>
  );
}

function RequestExplanationBlock({ caseId }: { caseId: string }) {
  const t = useT();
  const mutation = useRequestExplanation(caseId);
  return (
    <div className="space-y-2">
      <Button size="touch" variant="primary" fullWidth isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
        {t('inspector.caseDetail.requestExplanationButton')}
      </Button>
      <MutationError error={mutation.error} />
    </div>
  );
}

/** `uploadActFile` (Task 1) is a generic `/files` upload despite its
 *  act-specific name — its own docstring already says so — reused here
 *  verbatim for the citizen's explanation attachment rather than
 *  duplicated or renamed, to keep this stage's diff to what it needs. */
function RecordExplanationBlock({ caseId }: { caseId: string }) {
  const t = useT();
  const errorText = useApiErrorText();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [fileId, setFileId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const mutation = useSubmitExplanation(caseId);

  async function handleFile(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      const uploaded = await uploadActFile(file);
      setFileId(uploaded.id);
    } catch (err) {
      setUploadError(errorText(err, t('inspector.caseDetail.attachFileError')));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 space-y-3 shadow-xs">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#5A646D]">{t('inspector.caseDetail.explanationTitle')}</p>
      <FormField label={t('inspector.caseDetail.explanationLabel')} required>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} />
      </FormField>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          isLoading={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {t('inspector.caseDetail.attachFileButton')}
        </Button>
        {fileId && <span className="text-xs text-[#1A1F24] font-semibold">{t('inspector.caseDetail.fileAttached')}</span>}
        <input
          ref={fileInputRef}
          type="file"
          data-testid="case-explanation-file-input"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void handleFile(file);
          }}
        />
      </div>
      {uploadError && (
        <p className="text-xs text-[#B91C1C]" role="alert">
          {uploadError}
        </p>
      )}
      <Button
        size="touch"
        variant="primary"
        fullWidth
        disabled={text.trim() === ''}
        isLoading={mutation.isPending}
        onClick={() => mutation.mutate({ text: text.trim(), file_id: fileId ?? undefined })}
      >
        {t('inspector.caseDetail.explanationSubmitButton')}
      </Button>
      <MutationError error={mutation.error} />
    </div>
  );
}

type DecisionValue = '' | DecisionIn['decision'];

function DecideBlock({ caseId }: { caseId: string }) {
  const t = useT();
  const [decision, setDecision] = useState<DecisionValue>('');
  const [damageAmount, setDamageAmount] = useState('');
  const [note, setNote] = useState('');
  const mutation = useDecideCase(caseId);

  function handleSubmit() {
    if (decision === '') return;
    mutation.mutate({
      decision,
      damage_amount: damageAmount.trim() || undefined,
      note: note.trim() || undefined,
    });
  }

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 space-y-3 shadow-xs">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#5A646D]">{t('inspector.caseDetail.decideTitle')}</p>
      <FormField label={t('inspector.caseDetail.decisionLabel')} required>
        <Select
          touchSize
          value={decision}
          onChange={(e) => setDecision(e.target.value as DecisionValue)}
          options={[
            { value: '', label: t('inspector.caseDetail.decisionPlaceholder') },
            { value: 'warning', label: t('inspector.caseDetail.decision.warning') },
            { value: 'suspend', label: t('inspector.caseDetail.decision.suspend') },
            { value: 'revoke', label: t('inspector.caseDetail.decision.revoke') },
            { value: 'transfer', label: t('inspector.caseDetail.decision.transfer') },
          ]}
        />
      </FormField>
      <FormField label={t('inspector.caseDetail.damageAmountLabel')}>
        <Input touchSize inputMode="decimal" value={damageAmount} onChange={(e) => setDamageAmount(e.target.value)} />
      </FormField>
      <FormField label={t('inspector.caseDetail.noteLabel')}>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
      </FormField>
      <Button size="touch" variant="primary" fullWidth disabled={decision === ''} isLoading={mutation.isPending} onClick={handleSubmit}>
        {t('inspector.caseDetail.decideSubmitButton')}
      </Button>
      <MutationError error={mutation.error} />
    </div>
  );
}

function ResolveAppealBlock({ caseId }: { caseId: string }) {
  const t = useT();
  const [result, setResult] = useState('');
  const mutation = useResolveAppeal(caseId);
  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 space-y-3 shadow-xs">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#5A646D]">{t('inspector.caseDetail.resolveAppealTitle')}</p>
      <FormField label={t('inspector.caseDetail.resultLabel')} required>
        <Textarea value={result} onChange={(e) => setResult(e.target.value)} maxLength={2000} />
      </FormField>
      <Button
        size="touch"
        variant="primary"
        fullWidth
        disabled={result.trim() === ''}
        isLoading={mutation.isPending}
        onClick={() => mutation.mutate({ result: result.trim() })}
      >
        {t('inspector.caseDetail.resolveSubmitButton')}
      </Button>
      <MutationError error={mutation.error} />
    </div>
  );
}

function FileAppealBlock({ caseId }: { caseId: string }) {
  const t = useT();
  const [text, setText] = useState('');
  const mutation = useAppealCase(caseId);
  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 space-y-3 shadow-xs">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#5A646D]">{t('inspector.caseDetail.appealTitle')}</p>
      <FormField label={t('inspector.caseDetail.appealTextLabel')} required>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
      </FormField>
      <Button
        size="touch"
        variant="primary"
        fullWidth
        disabled={text.trim() === ''}
        isLoading={mutation.isPending}
        onClick={() => mutation.mutate({ text: text.trim() })}
      >
        {t('inspector.caseDetail.appealSubmitButton')}
      </Button>
      <MutationError error={mutation.error} />
    </div>
  );
}

function CloseBlock({ caseId }: { caseId: string }) {
  const t = useT();
  const mutation = useCloseCase(caseId);
  return (
    <div className="space-y-2">
      <Button size="touch" variant="danger" fullWidth isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
        {t('inspector.caseDetail.closeButton')}
      </Button>
      <MutationError error={mutation.error} />
    </div>
  );
}

export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { me } = useAuth();
  const t = useT();
  const { lang } = useLanguage();
  const errorText = useApiErrorText();

  const caseQuery = useCase(id);
  const violationTypesQuery = useViolationTypes();

  if (caseQuery.isLoading) {
    return (
      <div className="py-16 text-center text-sm text-[#5A646D]" data-testid="case-detail-page">
        <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> {t('inspector.caseDetail.loading')}
      </div>
    );
  }

  if (caseQuery.error || !caseQuery.data) {
    return (
      <div className="py-16 text-center text-sm text-[#991B1B]" data-testid="case-detail-page" role="alert">
        {caseQuery.error instanceof ApiError ? errorText(caseQuery.error) : t('inspector.caseDetail.notFound')}
      </div>
    );
  }

  const item = caseQuery.data;
  const violationType = (violationTypesQuery.data ?? []).find((v) => v.id === item.violation_type_item_id);
  const violationTypeLabel = violationType
    ? pickLocalizedName(violationType.name, lang) || violationType.code
    : item.violation_type_item_id.slice(0, 8);

  // `service.py`'s own eligibility per action — see this file's header
  // comment for the full rules each of these six mirrors.
  const isCasesManager = !!me?.permissions.includes(INSPECTIONS_CASES_MANAGE);
  const isActsWriter = !!me?.permissions.includes(INSPECTIONS_ACTS_WRITE);
  const isApplicant = !!me?.applicant && me.applicant.id === item.applicant_id;

  const canRequestExplanation = item.status === 'opened' && (isCasesManager || isActsWriter);
  const canRecordExplanation = item.status === 'explanation_requested' && (isCasesManager || isApplicant);
  const canDecide = isCasesManager && ['opened', 'explanation_requested', 'explained'].includes(item.status);
  const canResolveAppeal = isCasesManager && item.status === 'appealed';
  const canFileAppeal = item.status === 'decided' && isApplicant && !hasOpenAppeal(item.appeals);
  const canClose = isCasesManager && item.status === 'decided';

  return (
    <div className="space-y-6 font-sans pb-16" data-testid="case-detail-page">
      <div className="border-b border-[#E4E7EA] pb-4 flex items-center justify-between gap-2">
        <h1 className="text-lg md:text-xl font-bold text-[#1A1F24] tracking-tight">{t('inspector.caseDetail.title')}</h1>
        <StatusBadge
          status={CASE_STATUS_BADGE[item.status] ?? 'info'}
          label={labelOr(CASE_STATUS_LABEL_KEY, item.status, t)}
          size="sm"
          showIcon={false}
        />
      </div>

      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs">
        <dl>
          <InfoRow label={t('inspector.caseDetail.numberLabel')} value={item.number} />
          <InfoRow label={t('inspector.caseDetail.violationTypeLabel')} value={violationTypeLabel} />
          {item.explanation_due_at && (
            <InfoRow label={t('inspector.cases.explanationDueLabel')} value={formatDate(item.explanation_due_at)} />
          )}
          {item.decision_due_at && (
            <InfoRow label={t('inspector.cases.decisionDueLabel')} value={formatDate(item.decision_due_at)} />
          )}
          {item.decision && (
            <InfoRow label={t('inspector.caseDetail.decisionLabel')} value={labelOr(DECISION_LABEL_KEY, item.decision, t)} />
          )}
          {item.damage_amount != null && (
            <InfoRow label={t('inspector.caseDetail.damageAmountLabel')} value={formatMoney(item.damage_amount)} />
          )}
          {item.decided_at && <InfoRow label={t('inspector.caseDetail.decidedAtLabel')} value={formatDateTime(item.decided_at)} />}
        </dl>
      </div>

      {item.explanation_text && (
        <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#5A646D]">{t('inspector.caseDetail.explanationTitle')}</p>
          <p className="text-sm text-[#1A1F24] whitespace-pre-wrap">{item.explanation_text}</p>
        </div>
      )}

      {canRequestExplanation && <RequestExplanationBlock caseId={item.id} />}
      {canRecordExplanation && <RecordExplanationBlock caseId={item.id} />}
      {canDecide && <DecideBlock caseId={item.id} />}
      {canResolveAppeal && <ResolveAppealBlock caseId={item.id} />}
      {canFileAppeal && <FileAppealBlock caseId={item.id} />}
      {canClose && <CloseBlock caseId={item.id} />}

      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#5A646D]">{t('inspector.caseDetail.historyTitle')}</p>
        {item.history.length === 0 ? (
          <p className="text-sm text-[#5A646D]">—</p>
        ) : (
          <ul className="space-y-2">
            {item.history.map((entry) => (
              <li key={entry.id} className="text-sm border-b border-[#F0F2F4] last:border-0 pb-2 last:pb-0">
                <p className="font-semibold text-[#1A1F24]">
                  {entry.from_status
                    ? `${labelOr(CASE_STATUS_LABEL_KEY, entry.from_status, t)} → ${labelOr(CASE_STATUS_LABEL_KEY, entry.to_status, t)}`
                    : labelOr(CASE_STATUS_LABEL_KEY, entry.to_status, t)}
                </p>
                <p className="text-xs text-[#5A646D]">{formatDateTime(entry.occurred_at)}</p>
                {entry.note && <p className="text-xs text-[#5A646D] mt-0.5">{entry.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#5A646D]">{t('inspector.caseDetail.appealsTitle')}</p>
        {item.appeals.length === 0 ? (
          <p className="text-sm text-[#5A646D]">{t('inspector.caseDetail.noAppeals')}</p>
        ) : (
          <ul className="space-y-2">
            {item.appeals.map((appeal) => (
              <li key={appeal.id} className="text-sm border-b border-[#F0F2F4] last:border-0 pb-2 last:pb-0">
                <p className="text-[#1A1F24] whitespace-pre-wrap">{appeal.text}</p>
                <p className="text-xs text-[#5A646D]">{formatDateTime(appeal.filed_at)}</p>
                <p className="text-xs mt-0.5">
                  {appeal.result ? (
                    <span className="text-[#1A1F24] font-semibold">{appeal.result}</span>
                  ) : (
                    <span className="text-[#B45309] font-semibold">{t('inspector.caseDetail.appealPending')}</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
