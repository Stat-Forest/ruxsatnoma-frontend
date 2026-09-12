/**
 * С15/С16 — violation cases the inspector's own acts opened (`GET
 * /inspections/cases`: `view_any`/`cases.manage` see the zone, otherwise a
 * caller sees a case only if they are the inspector of the act that opened
 * it, or the case's own applicant — `service.py`). Paginated the same way
 * `TasksTab.tsx`/`ActsTab.tsx` already are. Read-only list: the case
 * decision/appeal/close actions live on the case detail page (task 7),
 * gated there on `inspections.cases.manage`.
 *
 * Stage 7.6 (ruling R8/#138, finding F3): an optional `applicantId` narrows
 * this SAME list to one applicant's repeat-violation history —
 * `CaseDetailPage`'s `prior_cases_count` links here rather than opening a
 * second list screen with its own pagination and zone-scoped query to keep
 * in step with this one. The backend runs `applicant_id` INSIDE
 * `_case_scope`, so a zoned viewer still sees only their own zone's cases
 * against that applicant — this tab does not additionally narrow anything.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Loader2 } from 'lucide-react';
import { useT } from '../../i18n/useT';
import { ExportXlsxButton } from '../../components/ui/ExportXlsxButton';
import { Select } from '../../components/ui/FormControls';
import { Button } from '../../components/ui/button';
import { Pagination } from '../../components/ui/Navigation';
import { StatusBadge, type StatusType } from '../../components/ui/StatusBadge';
import { ApiError } from '../../api/errors';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { formatDate } from './format';
import { useCasesList, type CaseOut } from './queries';
import { CLICKABLE_ROW_CLASS, clickableRowProps } from '../../lib/rowClick';

const PAGE_SIZE = 20;

type CaseStatusFilter = '' | 'opened' | 'explanation_requested' | 'explained' | 'decided' | 'appealed' | 'closed' | 'archived';

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

/** `CaseOut.status` is a plain `string` on the wire — an unrecognised value
 *  (a future status this list has never seen) falls back to the raw code
 *  rather than crashing or showing a translation-key placeholder. */
function labelOr(map: Record<string, string>, value: string, t: (key: string) => string): string {
  const key = map[value];
  return key ? t(key) : value;
}

/** A due date is worth calling out only while it still lies ahead — a past
 *  one is not "overdue" styling this pass deliberately skips (plan's own
 *  call), just no longer a useful "due" line to show at all. */
function isFutureDate(value: string | null): value is string {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
}

function CaseRow({ caseItem }: { caseItem: CaseOut }) {
  const t = useT();
  const navigate = useNavigate();

  return (
    <div
      {...clickableRowProps(() => navigate(`/inspections/cases/${caseItem.id}`))}
      className={`bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs space-y-2 ${CLICKABLE_ROW_CLASS}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold text-[#1A1F24] font-mono">{caseItem.number}</p>
        <StatusBadge
          status={CASE_STATUS_BADGE[caseItem.status] ?? 'info'}
          label={labelOr(CASE_STATUS_LABEL_KEY, caseItem.status, t)}
          size="sm"
          showIcon={false}
        />
      </div>
      {isFutureDate(caseItem.explanation_due_at) && (
        <p className="text-xs text-[#5A646D]">
          {t('inspector.cases.explanationDueLabel')} {formatDate(caseItem.explanation_due_at)}
        </p>
      )}
      {isFutureDate(caseItem.decision_due_at) && (
        <p className="text-xs text-[#5A646D]">
          {t('inspector.cases.decisionDueLabel')} {formatDate(caseItem.decision_due_at)}
        </p>
      )}
      <Button size="touch" variant="outline" fullWidth onClick={() => navigate(`/inspections/cases/${caseItem.id}`)}>
        {t('inspector.cases.openButton')}
      </Button>
    </div>
  );
}

export function CasesTab({ active, applicantId }: { active: boolean; applicantId?: string }) {
  const t = useT();
  const navigate = useNavigate();
  const errorText = useApiErrorText();
  const [status, setStatus] = useState<CaseStatusFilter>('');
  const [page, setPage] = useState(1);

  const filters = { status: status || undefined, applicant_id: applicantId, page, page_size: PAGE_SIZE };
  const list = useCasesList(filters, { enabled: active });
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4" data-testid="inspector-cases-tab">
      {applicantId && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#BFD9CB] bg-[#EFF7F1] px-4 py-3 text-sm text-[#1A1F24]"
          data-testid="cases-applicant-filter-banner"
        >
          <span>{t('inspector.cases.filteredByApplicant')}</span>
          <Button size="sm" variant="ghost" onClick={() => navigate('/inspections?tab=cases')}>
            {t('inspector.cases.clearApplicantFilter')}
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xs">
          <Select
            touchSize
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as CaseStatusFilter);
              setPage(1);
            }}
            options={[
              { value: '', label: t('inspector.cases.status.all') },
              { value: 'opened', label: t('inspector.cases.status.opened') },
              { value: 'explanation_requested', label: t('inspector.cases.status.explanationRequested') },
              { value: 'explained', label: t('inspector.cases.status.explained') },
              { value: 'decided', label: t('inspector.cases.status.decided') },
              { value: 'appealed', label: t('inspector.cases.status.appealed') },
              { value: 'closed', label: t('inspector.cases.status.closed') },
              { value: 'archived', label: t('inspector.cases.status.archived') },
            ]}
          />
        </div>
        <ExportXlsxButton path="/api/v1/inspections/cases" query={filters} className="w-full sm:w-auto sm:ml-auto" />
      </div>

      {list.error && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-2xl text-sm text-[#991B1B]" role="alert">
          {list.error instanceof ApiError ? errorText(list.error) : t('inspector.cases.loadError')}
        </div>
      )}

      {list.isLoading ? (
        <div className="py-12 text-center text-sm text-[#5A646D]">
          <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> {t('inspector.cases.loading')}
        </div>
      ) : (list.data?.items.length ?? 0) === 0 ? (
        <div className="py-12 text-center text-sm text-[#5A646D]">{t('inspector.cases.empty')}</div>
      ) : (
        <div className="space-y-3">
          {list.data!.items.map((caseItem) => (
            <CaseRow key={caseItem.id} caseItem={caseItem} />
          ))}
        </div>
      )}

      {list.data && list.data.total > 0 && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalRecords={list.data.total} />
      )}
    </div>
  );
}
