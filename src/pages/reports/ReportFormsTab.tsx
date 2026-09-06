/**
 * The report FORMS tab (template side) — `GET/POST /reports/forms`,
 * `.../activate`, `.../archive`. Same `active` mounted-but-hidden gate
 * `pages/norms/NormsPage.tsx` established for every tab body (see that
 * file's own header comment): `ReportsPage.tsx` (task 4) mounts both tabs
 * up front and only toggles `hidden`, so this tab's own list query needs an
 * explicit `enabled` gate or it would fire on page load even while the
 * Reports tab is the one showing.
 *
 * Read access (the list itself) needs only `reports.view` — every visitor
 * who can open this page sees the catalog; only the write actions (add,
 * activate, archive) are gated on `reports.forms.manage`, mirroring
 * `permissions.py`'s own split.
 */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { apiError, ApiError } from '../../api/errors';
import { useAuth } from '../../auth/useAuth';
import { useLanguage, useT } from '../../i18n/useT';
import { Alert } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { FormField, Select } from '../../components/ui/FormControls';
import { StatusBadge, type StatusType } from '../../components/ui/StatusBadge';
import { ConfirmDialog } from './ConfirmDialog';
import { formatDate, pickLocalizedName } from './format';
import { reportErrorMessage } from './errors';
import { REPORTS_FORMS_MANAGE } from './permissions';
import { useActivateReportForm, useArchiveReportForm, useReportFormsList } from './queries';
import { ReportFormCreateModal } from './ReportFormCreateModal';
import type { ReportFormOut } from './api';

const PAGE_SIZE = 50;

function statusTone(status: string): StatusType {
  switch (status) {
    case 'active':
      return 'approved';
    case 'archived':
      return 'info';
    default:
      return 'draft';
  }
}

function periodTypeLabelKey(periodType: string): string {
  switch (periodType) {
    case 'month':
      return 'reports.forms.periodType.month';
    case 'quarter':
      return 'reports.forms.periodType.quarter';
    case 'year':
      return 'reports.forms.periodType.year';
    default:
      return periodType;
  }
}

function statusLabelKey(status: string): string {
  switch (status) {
    case 'draft':
      return 'reports.forms.status.draft';
    case 'active':
      return 'reports.forms.status.active';
    case 'archived':
      return 'reports.forms.status.archived';
    default:
      return status;
  }
}

/** `GET /api/v1/refs/activity-types` needs no permission code — "form
 *  dictionaries for every authenticated user" (`refs_router.py`'s own
 *  docstring, quoted in `pages/permits/useRefsLookup.ts`). Kept as a local
 *  query rather than imported, per this module's own self-contained-folder
 *  convention (Global Constraint 11). */
function useActivityTypes(active: boolean) {
  return useQuery({
    queryKey: ['reports', 'refs', 'activity-types'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/refs/activity-types', {});
      if (error) throw apiError(error);
      return data;
    },
    enabled: active,
    staleTime: 5 * 60_000,
  });
}

export function ReportFormsTab({ active }: { active: boolean }) {
  const t = useT();
  const { lang } = useLanguage();
  const { me } = useAuth();
  const activityTypes = useActivityTypes(active);

  const [statusFilter, setStatusFilter] = useState('');
  const [appliedStatus, setAppliedStatus] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [activateTarget, setActivateTarget] = useState<ReportFormOut | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ReportFormOut | null>(null);

  const canManageForms = !!me && (me.is_superuser || me.permissions.includes(REPORTS_FORMS_MANAGE));

  const list = useReportFormsList({ status: appliedStatus || undefined, page, page_size: PAGE_SIZE });
  const activate = useActivateReportForm();
  const archive = useArchiveReportForm();

  const rows = list.data?.items ?? [];
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;

  function activityTypeName(id: string | null): string {
    if (!id) return '—';
    const found = activityTypes.data?.find((item) => item.id === id);
    return found ? pickLocalizedName(found.name, lang) || found.code : id;
  }

  function applyFilters() {
    setAppliedStatus(statusFilter);
    setPage(1);
  }

  function resetFilters() {
    setStatusFilter('');
    setAppliedStatus('');
    setPage(1);
  }

  function openActivate(row: ReportFormOut) {
    activate.reset();
    setActivateTarget(row);
  }
  function closeActivate() {
    setActivateTarget(null);
    activate.reset();
  }

  function openArchive(row: ReportFormOut) {
    archive.reset();
    setArchiveTarget(row);
  }
  function closeArchive() {
    setArchiveTarget(null);
    archive.reset();
  }

  const columns: Column<ReportFormOut>[] = [
    { key: 'code', header: t('reports.forms.col.code'), accessor: (row) => <span className="font-mono text-xs">{row.code}</span> },
    { key: 'version', header: t('reports.forms.col.version'), accessor: (row) => row.version },
    {
      key: 'name',
      header: t('reports.forms.col.name'),
      accessor: (row) => <span className="font-semibold text-[#1A1F24]">{pickLocalizedName(row.name, lang) || row.code}</span>,
    },
    {
      key: 'period_type',
      header: t('reports.forms.col.periodType'),
      accessor: (row) => t(periodTypeLabelKey(row.period_type)),
    },
    {
      key: 'activity_type_id',
      header: t('reports.forms.col.activityType'),
      accessor: (row) => activityTypeName(row.activity_type_id),
    },
    {
      key: 'status',
      header: t('reports.forms.col.status'),
      accessor: (row) => <StatusBadge status={statusTone(row.status)} label={t(statusLabelKey(row.status))} size="sm" />,
    },
    {
      key: 'valid_from',
      header: t('reports.forms.col.validFrom'),
      accessor: (row) => <span className="whitespace-nowrap">{formatDate(row.valid_from)}</span>,
    },
  ];

  return (
    <div data-testid="reports-tab-forms" className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-[#E4E7EA] bg-white p-6 shadow-xs">
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3">
          <FormField label={t('reports.forms.filter.status')}>
            <Select
              data-testid="report-forms-filter-status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              options={[
                { value: '', label: t('reports.forms.filter.statusAll') },
                { value: 'draft', label: t('reports.forms.status.draft') },
                { value: 'active', label: t('reports.forms.status.active') },
                { value: 'archived', label: t('reports.forms.status.archived') },
              ]}
            />
          </FormField>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={resetFilters}>
            {t('reports.forms.filter.reset')}
          </Button>
          <Button variant="primary" size="sm" onClick={applyFilters}>
            {t('reports.forms.filter.apply')}
          </Button>
        </div>
      </div>

      {list.error && (
        <Alert variant="danger">
          <span data-testid="report-forms-error">
            {list.error instanceof ApiError ? list.error.message : t('reports.forms.loadError')}
          </span>
        </Alert>
      )}

      {canManageForms && (
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            data-testid="report-forms-add"
            leftIcon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => setCreateOpen(true)}
          >
            {t('reports.forms.actions.add')}
          </Button>
        </div>
      )}

      <div data-testid="report-forms-table">
        <DataTable<ReportFormOut>
          columns={columns}
          data={rows}
          isLoading={list.isLoading}
          emptyTitle={t('reports.forms.emptyTitle')}
          emptyDescription={t('reports.forms.emptyDescription')}
          pagination={{ currentPage: page, totalPages, onPageChange: setPage, totalRecords: list.data?.total }}
          actions={(row) => {
            const canActivate = row.status === 'draft' && canManageForms;
            const canArchive = row.status !== 'archived' && canManageForms;
            if (!canActivate && !canArchive) return null;
            return (
              <div className="flex items-center justify-end gap-1.5">
                {canActivate && (
                  <Button size="sm" variant="secondary" data-testid={`report-form-activate-${row.id}`} onClick={() => openActivate(row)}>
                    {t('reports.forms.actions.activate')}
                  </Button>
                )}
                {canArchive && (
                  <Button size="sm" variant="danger" data-testid={`report-form-archive-${row.id}`} onClick={() => openArchive(row)}>
                    {t('reports.forms.actions.archive')}
                  </Button>
                )}
              </div>
            );
          }}
        />
      </div>

      {createOpen && <ReportFormCreateModal onClose={() => setCreateOpen(false)} onSaved={() => setCreateOpen(false)} />}

      {activateTarget && (
        <ConfirmDialog
          title={t('reports.forms.activate.confirmTitle')}
          question={t('reports.forms.activate.confirmQuestion')}
          confirmLabel={t('reports.forms.activate.confirm')}
          cancelLabel={t('reports.forms.activate.cancel')}
          isPending={activate.isPending}
          errorMessage={
            activate.error instanceof ApiError ? reportErrorMessage(t, activate.error) : activate.error ? t('reports.forms.activate.error.generic') : null
          }
          onConfirm={() => activate.mutate(activateTarget.id, { onSuccess: closeActivate })}
          onClose={closeActivate}
        />
      )}

      {archiveTarget && (
        <ConfirmDialog
          title={t('reports.forms.archive.confirmTitle')}
          question={t('reports.forms.archive.confirmQuestion')}
          confirmLabel={t('reports.forms.archive.confirm')}
          cancelLabel={t('reports.forms.archive.cancel')}
          confirmVariant="danger"
          isPending={archive.isPending}
          errorMessage={
            archive.error instanceof ApiError ? reportErrorMessage(t, archive.error) : archive.error ? t('reports.forms.archive.error.generic') : null
          }
          onConfirm={() => archive.mutate(archiveTarget.id, { onSuccess: closeArchive })}
          onClose={closeArchive}
        />
      )}
    </div>
  );
}
