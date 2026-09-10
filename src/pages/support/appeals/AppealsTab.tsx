/**
 * Staff triage of citizens' appeals (`appeals` tab) — visible only once
 * `SupportPage` has already gated it on `public.appeals.manage`; this
 * component does not re-check the permission itself, the same way
 * `FaqAdminTab` doesn't either.
 */
import { useState } from 'react';
import { DataTable, type Column } from '../../../components/ui/DataTable';
import { FormField, Select } from '../../../components/ui/FormControls';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useT } from '../../../i18n/useT';
import { formatDateTime } from '../format';
import type { AppealAdminOut, AppealStatus } from './api';
import { AppealDetailPanel } from './AppealDetailPanel';
import { useAppealsList } from './queries';

const PAGE_SIZE = 20;
const APPEAL_STATUSES: AppealStatus[] = ['new', 'in_progress', 'answered', 'closed'];

const STATUS_LABEL_KEY: Record<AppealStatus, string> = {
  new: 'support.appeals.statusNew',
  in_progress: 'support.appeals.statusInProgress',
  answered: 'support.appeals.statusAnswered',
  closed: 'support.appeals.statusClosed',
};

export function AppealsTab() {
  const t = useT();
  const errorText = useApiErrorText();
  const [status, setStatus] = useState<AppealStatus | ''>('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useAppealsList({ status, page, page_size: PAGE_SIZE });
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: Column<AppealAdminOut>[] = [
    {
      key: 'number',
      header: t('support.appeals.colNumber'),
      accessor: (row) => (
        <button
          data-testid={`appeal-open-${row.id}`}
          onClick={() => setSelectedId(row.id)}
          className="cursor-pointer font-mono font-semibold text-[#2E7D4F] hover:underline"
        >
          {row.number}
        </button>
      ),
    },
    { key: 'applicant_name', header: t('support.appeals.colApplicant'), accessor: (row) => <span className="block max-w-[220px] truncate">{row.applicant_name}</span> },
    { key: 'subject', header: t('support.appeals.colSubject'), accessor: (row) => <span className="block max-w-[260px] truncate">{row.subject}</span> },
    { key: 'status', header: t('support.appeals.colStatus'), accessor: (row) => t(STATUS_LABEL_KEY[row.status as AppealStatus] ?? row.status) },
    { key: 'created_at', header: t('support.appeals.colCreated'), accessor: (row) => formatDateTime(row.created_at) },
  ];

  return (
    <div className="space-y-5" data-testid="appeals-tab">
      <div>
        <h2 className="text-base font-bold text-[#1A1F24]">{t('support.appeals.title')}</h2>
        <p className="mt-1 text-xs text-[#5A646D]">{t('support.appeals.subtitle')}</p>
      </div>

      <div className="max-w-xs">
        <FormField label={t('support.appeals.filterStatus')} htmlFor="appeals-status-filter">
          <Select
            id="appeals-status-filter"
            data-testid="appeals-status-filter"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as AppealStatus | '');
              setPage(1);
            }}
            options={[
              { value: '', label: t('support.common.all') },
              ...APPEAL_STATUSES.map((s) => ({ value: s, label: t(STATUS_LABEL_KEY[s]) })),
            ]}
          />
        </FormField>
      </div>

      {list.error && (
        <div role="alert" data-testid="appeals-error" className="rounded-2xl border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]">
          {list.error instanceof ApiError ? errorText(list.error) : t('support.appeals.loadFailed')}
        </div>
      )}

      <DataTable
        columns={columns}
        data={list.data?.items ?? []}
        isLoading={list.isLoading}
        loadingText={t('support.common.loading')}
        emptyTitle={t('support.appeals.empty')}
        emptyDescription=""
        pagination={{ currentPage: page, totalPages, onPageChange: setPage, totalRecords: total }}
        onRowClick={(row) => setSelectedId(row.id)}
      />

      {selectedId && <AppealDetailPanel appealId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
