/**
 * The reports list tab (`GET /reports`) — organization/status/form filters,
 * a `DataTable<ReportOut>`, pagination, and "Create report" gated on
 * `reports.manage`. Same `active` mounted-but-hidden gate every tab in this
 * app takes (`pages/norms/NormsPage.tsx`'s own header comment).
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { ApiError } from '../../api/errors';
import { useAuth } from '../../auth/useAuth';
import { useLanguage, useT } from '../../i18n/useT';
import { Alert } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { FormField, Select } from '../../components/ui/FormControls';
import { StatusBadge } from '../../components/ui/StatusBadge';
import type { UiLanguage } from '../../i18n/context';
import { formatDate, pickLocalizedName } from './format';
import { REPORTS_MANAGE } from './permissions';
import { REPORT_STATUSES, statusLabelKey } from './transitions';
import { useLeshozOrganizations, useReportForm, useReportFormsList, useReportsList } from './queries';
import { ReportCreateModal } from './ReportCreateModal';
import type { ReportOut } from './api';

const PAGE_SIZE = 20;

/** One hook call per distinct `form_id` actually rendered — react-query's
 *  own cache de-duplicates repeat ids across rows, so this needs no batch
 *  endpoint (task brief's own note). A dedicated cell component, not an
 *  inline call inside the column's `accessor`, because a `useQuery` cannot
 *  be called from a plain function — only from a component. */
function FormNameCell({ formId, lang }: { formId: string; lang: UiLanguage }) {
  const form = useReportForm(formId);
  if (!form.data) return <span className="text-[#9AA3AB]">…</span>;
  return <>{pickLocalizedName(form.data.name, lang) || form.data.code}</>;
}

interface FilterState {
  organizationId: string;
  status: string;
  formId: string;
}

const EMPTY_FILTERS: FilterState = { organizationId: '', status: '', formId: '' };

export function ReportsListTab({ active }: { active: boolean }) {
  const t = useT();
  const { lang } = useLanguage();
  const { me } = useAuth();

  const organizations = useLeshozOrganizations(active);
  // Every form regardless of status — a filter should not hide reports whose
  // form has since been archived (task brief's own instruction).
  const allForms = useReportFormsList({ page: 1, page_size: 100 });

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<FilterState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const canCreate = !!me && (me.is_superuser || me.permissions.includes(REPORTS_MANAGE));

  const list = useReportsList({
    organization_id: applied.organizationId || undefined,
    status: applied.status || undefined,
    form_id: applied.formId || undefined,
    page,
    page_size: PAGE_SIZE,
  });

  function applyFilters() {
    setApplied(filters);
    setPage(1);
  }
  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
  }

  function organizationName(id: string): string {
    const found = organizations.data?.items.find((org) => org.id === id);
    return found ? pickLocalizedName(found.name, lang) || found.code : id;
  }

  const rows = list.data?.items ?? [];
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;

  const columns: Column<ReportOut>[] = [
    {
      key: 'form_id',
      header: t('reports.list.col.form'),
      accessor: (row) => <FormNameCell formId={row.form_id} lang={lang} />,
    },
    {
      key: 'organization_id',
      header: t('reports.list.col.organization'),
      accessor: (row) => organizationName(row.organization_id),
    },
    {
      key: 'period_start',
      header: t('reports.list.col.period'),
      accessor: (row) => (
        <span className="whitespace-nowrap">
          {formatDate(row.period_start)} – {formatDate(row.period_end)}
        </span>
      ),
    },
    {
      key: 'version_no',
      header: t('reports.list.col.version'),
      accessor: (row) => (
        <span className="inline-flex items-center gap-1.5">
          {row.version_no}
          {row.parent_report_id != null && (
            <span className="rounded-full bg-[#F0F7F1] px-1.5 py-0.5 text-[10px] font-semibold text-[#123522]">↺</span>
          )}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('reports.list.col.status'),
      accessor: (row) => <StatusBadge status="info" label={t(statusLabelKey(row.status))} size="sm" showIcon={false} />,
    },
    {
      key: 'updated_at',
      header: t('reports.list.col.updatedAt'),
      accessor: (row) => <span className="whitespace-nowrap">{formatDate(row.updated_at)}</span>,
    },
    {
      key: 'open',
      header: '',
      accessor: (row) => (
        <Link to={`/reports/${row.id}`} className="text-xs font-bold text-[#2E7D4F] hover:underline">
          {t('reports.list.actions.open')} →
        </Link>
      ),
    },
  ];

  return (
    <div data-testid="reports-tab-list" className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-[#E4E7EA] bg-white p-4 sm:p-6 shadow-xs">
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3">
          <FormField label={t('reports.list.filter.organization')}>
            <Select
              data-testid="reports-filter-organization"
              value={filters.organizationId}
              onChange={(e) => setFilters((f) => ({ ...f, organizationId: e.target.value }))}
              options={[
                { value: '', label: t('reports.list.filter.organizationAll') },
                ...(organizations.data?.items ?? []).map((org) => ({
                  value: org.id,
                  label: pickLocalizedName(org.name, lang) || org.code,
                })),
              ]}
            />
          </FormField>
          <FormField label={t('reports.list.filter.status')}>
            <Select
              data-testid="reports-filter-status"
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              options={[
                { value: '', label: t('reports.list.filter.statusAll') },
                ...REPORT_STATUSES.map((status) => ({ value: status, label: t(statusLabelKey(status)) })),
              ]}
            />
          </FormField>
          <FormField label={t('reports.list.filter.form')}>
            <Select
              data-testid="reports-filter-form"
              value={filters.formId}
              onChange={(e) => setFilters((f) => ({ ...f, formId: e.target.value }))}
              options={[
                { value: '', label: t('reports.list.filter.formAll') },
                ...(allForms.data?.items ?? []).map((form) => ({
                  value: form.id,
                  label: pickLocalizedName(form.name, lang) || form.code,
                })),
              ]}
            />
          </FormField>
        </div>
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={resetFilters}>
            {t('reports.list.filter.reset')}
          </Button>
          <Button variant="primary" size="sm" className="w-full sm:w-auto" onClick={applyFilters}>
            {t('reports.list.filter.apply')}
          </Button>
        </div>
      </div>

      {list.error && (
        <Alert variant="danger">
          <span data-testid="reports-list-error">
            {list.error instanceof ApiError ? list.error.message : t('reports.list.loadError')}
          </span>
        </Alert>
      )}

      {canCreate && (
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            className="w-full sm:w-auto"
            data-testid="reports-create"
            leftIcon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => setCreateOpen(true)}
          >
            {t('reports.list.actions.create')}
          </Button>
        </div>
      )}

      <div data-testid="reports-table" className="w-full overflow-x-auto">
        <DataTable<ReportOut>
          columns={columns}
          data={rows}
          isLoading={list.isLoading}
          emptyTitle={t('reports.list.emptyTitle')}
          emptyDescription={t('reports.list.emptyDescription')}
          pagination={{ currentPage: page, totalPages, onPageChange: setPage, totalRecords: list.data?.total }}
        />
      </div>

      {createOpen && <ReportCreateModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}
