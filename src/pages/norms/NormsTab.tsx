/**
 * F5 — the norms register (`GET/POST /norms`, `PATCH .../{id}`, and six
 * lifecycle POSTs). Every one of these routes answers `NormOut` DIRECTLY —
 * not the `{item, warnings}` envelope F6/F7's own `/publish` uses (task-6
 * brief's own warning) — so this screen never reads a `.item`/`.warnings`
 * field the way `TariffsTab.tsx`/`ParamsTab.tsx` do; a mutation's own
 * `onSuccess` data IS the updated row.
 *
 * Permissions are a THIRD family (`norms.manage`/`norms.approve`/
 * `norms.publish`), distinct from `norms.tariffs.manage`/`.publish` — a
 * caller holding only the tariffs pair sees this tab (ruling R1's menu
 * entry is "any one of" the two top-level permissions) but no button on it,
 * exactly the same "an action the backend would refuse is not offered" rule
 * `ParamsTab.tsx`/`TariffsTab.tsx` already apply.
 *
 * The six-transition topology lives in ONE table, `norm/transitions.ts`'s
 * `NORM_ACTIONS` — this component reads it (`actionsFor(row.status)`) rather
 * than hard-coding "if status is X show button Y" five times over, the same
 * "one table, not five branches" the brief asks for.
 */
import { useMemo, useState } from 'react';
import { Pencil, Plus, RotateCcw } from 'lucide-react';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { FormField, Select } from '../../components/ui/FormControls';
import { Alert } from '../../components/ui/Feedback';
import { StatusBadge, type StatusType } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/button';
import { ApiError } from '../../api/errors';
import { useAuth } from '../../auth/useAuth';
import { useLanguage, useT } from '../../i18n/useT';
import { satisfies } from '../../shell/navigation';
import { pickLocalizedName, useActivityTypes } from './refs';
import { NormApproveDialog } from './norm/NormApproveDialog';
import { NormFormModal } from './norm/NormFormModal';
import { NormTransitionDialog } from './norm/NormTransitionDialog';
import { normActionErrorText, type NormActionKind } from './norm/errorText';
import { NORMS_MANAGE } from './norm/labels';
import { NORM_EDITABLE_STATUSES, NORM_STATUSES, actionsFor, statusLabelKey, type NormActionSpec } from './norm/transitions';
import { useApproveNorm, useContourNumbers, useNormTransition, useNormsList } from './norm/queries';
import type { NormOut } from './norm/api';

const PAGE_SIZE = 50;

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-');
  if (!y || !m || !d) return value;
  return `${d}.${m}.${y}`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function statusTone(status: string): StatusType {
  switch (status) {
    case 'review':
      return 'pending';
    case 'approved':
      return 'warning';
    case 'published':
      return 'approved';
    case 'archived':
      return 'info';
    default:
      return 'draft';
  }
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? `${error.code}: ${error.message}` : fallback;
}

const ACTION_KIND: Record<string, NormActionKind> = {
  'submit-review': 'submitReview',
  'return-to-draft': 'returnToDraft',
  approve: 'approve',
  'return-to-review': 'returnToReview',
  publish: 'publish',
  archive: 'archive',
};

interface FilterState {
  activityTypeId: string;
  status: string;
}

const EMPTY_FILTERS: FilterState = { activityTypeId: '', status: '' };

export function NormsTab({ active }: { active: boolean }) {
  const t = useT();
  const { lang } = useLanguage();
  const { me } = useAuth();
  const activityTypes = useActivityTypes(active);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<FilterState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const [formTarget, setFormTarget] = useState<NormOut | 'new' | null>(null);
  const [transitionTarget, setTransitionTarget] = useState<{ row: NormOut; spec: NormActionSpec } | null>(null);
  const [approveTarget, setApproveTarget] = useState<NormOut | null>(null);

  const transition = useNormTransition();
  const approve = useApproveNorm();

  const canManage = me != null && satisfies(NORMS_MANAGE, me);

  const list = useNormsList(
    {
      activity_type_id: applied.activityTypeId || undefined,
      status: applied.status || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    },
    active,
  );

  const rows = list.data?.items ?? [];
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;

  const contourIds = useMemo(
    () => Array.from(new Set((list.data?.items ?? []).map((r) => r.contour_id))),
    [list.data],
  );
  const contourNumbers = useContourNumbers(active ? contourIds : []);

  function applyFilters() {
    setApplied(filters);
    setPage(1);
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
  }

  function activityName(id: string): string {
    const found = activityTypes.data?.find((a) => a.id === id);
    return found ? pickLocalizedName(found.name, lang) || found.code : id;
  }

  function contourLabel(id: string): string {
    const number = contourNumbers.get(id);
    return number ? `№ ${number}` : id.slice(0, 8);
  }

  function openTransition(row: NormOut, spec: NormActionSpec) {
    transition.reset();
    setTransitionTarget({ row, spec });
  }

  function closeTransition() {
    setTransitionTarget(null);
    transition.reset();
  }

  function openApprove(row: NormOut) {
    approve.reset();
    setApproveTarget(row);
  }

  function closeApprove() {
    setApproveTarget(null);
    approve.reset();
  }

  const columns: Column<NormOut>[] = [
    {
      key: 'contour_id',
      header: t('norms.norms.col.contour'),
      accessor: (row) => <span className="font-mono text-xs font-semibold">{contourLabel(row.contour_id)}</span>,
    },
    {
      key: 'activity_type_id',
      header: t('norms.norms.col.activity'),
      accessor: (row) => <span className="text-xs">{activityName(row.activity_type_id)}</span>,
    },
    {
      key: 'status',
      header: t('norms.norms.col.status'),
      accessor: (row) => <StatusBadge status={statusTone(row.status)} label={t(statusLabelKey(row.status))} size="sm" />,
    },
    {
      key: 'yield_c_per_ha',
      header: t('norms.norms.col.yield'),
      accessor: (row) => <span className="font-mono text-xs">{row.yield_c_per_ha ?? '—'}</span>,
    },
    {
      key: 'max_sb',
      header: t('norms.norms.col.maxSb'),
      accessor: (row) => <span className="font-mono text-xs">{row.max_sb ?? '—'}</span>,
    },
    {
      key: 'effective_from',
      header: t('norms.norms.col.effectiveFrom'),
      accessor: (row) => <span className="whitespace-nowrap">{formatDate(row.effective_from)}</span>,
    },
    {
      key: 'effective_to',
      header: t('norms.norms.col.effectiveTo'),
      accessor: (row) => <span className="whitespace-nowrap">{formatDate(row.effective_to)}</span>,
    },
    {
      key: 'published_at',
      header: t('norms.norms.col.publishedAt'),
      accessor: (row) => <span className="whitespace-nowrap text-xs text-[#5A646D]">{formatDateTime(row.published_at)}</span>,
    },
  ];

  return (
    <div data-testid="norms-tab-norms" className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-[#E4E7EA] bg-white p-6 shadow-xs">
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
          <FormField label={t('norms.norms.filter.activityType')}>
            <Select
              data-testid="norms-filter-activity-type"
              value={filters.activityTypeId}
              onChange={(event) => setFilters((f) => ({ ...f, activityTypeId: event.target.value }))}
              options={[
                { value: '', label: t('norms.norms.filter.activityTypeAll') },
                ...(activityTypes.data ?? []).map((a) => ({ value: a.id, label: pickLocalizedName(a.name, lang) || a.code })),
              ]}
            />
          </FormField>
          <FormField label={t('norms.norms.filter.status')}>
            <Select
              data-testid="norms-filter-status"
              value={filters.status}
              onChange={(event) => setFilters((f) => ({ ...f, status: event.target.value }))}
              options={[
                { value: '', label: t('norms.norms.filter.statusAll') },
                ...NORM_STATUSES.map((status) => ({ value: status, label: t(statusLabelKey(status)) })),
              ]}
            />
          </FormField>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" leftIcon={<RotateCcw className="h-3.5 w-3.5" />} onClick={resetFilters}>
            {t('norms.norms.filter.reset')}
          </Button>
          <Button variant="primary" size="sm" onClick={applyFilters}>
            {t('norms.norms.filter.apply')}
          </Button>
        </div>
      </div>

      {list.error && (
        <Alert variant="danger">
          <span data-testid="norms-error">{errorText(list.error, t('norms.norms.loadError'))}</span>
        </Alert>
      )}

      {canManage && (
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            data-testid="norms-add"
            leftIcon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => setFormTarget('new')}
          >
            {t('norms.norms.actions.add')}
          </Button>
        </div>
      )}

      <div data-testid="norms-table">
        <DataTable<NormOut>
          columns={columns}
          data={rows}
          isLoading={list.isLoading}
          emptyTitle={t('norms.norms.emptyTitle')}
          emptyDescription={t('norms.norms.emptyDescription')}
          pagination={{ currentPage: page, totalPages, onPageChange: setPage, totalRecords: list.data?.total }}
          actions={(row) => {
            const canEdit = (NORM_EDITABLE_STATUSES as readonly string[]).includes(row.status) && canManage;
            const specs = me == null ? [] : actionsFor(row.status).filter((spec) => satisfies(spec.permission, me));
            if (!canEdit && specs.length === 0) return null;
            return (
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    data-testid={`norm-row-edit-${row.id}`}
                    leftIcon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => setFormTarget(row)}
                  >
                    {t('norms.norms.actions.edit')}
                  </Button>
                )}
                {specs.map((spec) => (
                  <Button
                    key={spec.action}
                    size="sm"
                    variant={spec.action === 'archive' ? 'danger' : 'secondary'}
                    data-testid={`norm-row-${spec.action}-${row.id}`}
                    onClick={() => (spec.action === 'approve' ? openApprove(row) : openTransition(row, spec))}
                  >
                    {t(`norms.norms.actions.${spec.action}`)}
                  </Button>
                ))}
              </div>
            );
          }}
        />
      </div>

      {formTarget !== null && (
        <NormFormModal
          mode={formTarget === 'new' ? 'create' : 'edit'}
          row={formTarget === 'new' ? undefined : formTarget}
          contourNumber={formTarget === 'new' ? undefined : contourNumbers.get(formTarget.contour_id)}
          onClose={() => setFormTarget(null)}
          onSaved={() => setFormTarget(null)}
        />
      )}

      {transitionTarget && (
        <NormTransitionDialog
          itemLabel={contourLabel(transitionTarget.row.contour_id)}
          tone={transitionTarget.spec.action === 'archive' ? 'danger' : 'primary'}
          labels={{
            title: t(`norms.norms.transition.${transitionTarget.spec.action}.title`),
            question: t(`norms.norms.transition.${transitionTarget.spec.action}.question`),
            confirm: t(`norms.norms.actions.${transitionTarget.spec.action}`),
            cancel: t('norms.norms.transition.cancel'),
          }}
          isPending={transition.isPending}
          errorMessage={
            transition.error
              ? normActionErrorText(transition.error, ACTION_KIND[transitionTarget.spec.action], t)
              : null
          }
          onConfirm={() => {
            const action = transitionTarget.spec.action;
            if (action === 'approve') return;
            transition.mutate({ action, id: transitionTarget.row.id }, { onSuccess: closeTransition });
          }}
          onClose={closeTransition}
        />
      )}

      {approveTarget && (
        <NormApproveDialog
          itemLabel={contourLabel(approveTarget.contour_id)}
          labels={{
            title: t('norms.norms.transition.approve.title'),
            question: t('norms.norms.transition.approve.question'),
            docLabel: t('norms.norms.transition.approve.docLabel'),
            docRequired: t('norms.norms.transition.approve.docRequired'),
            docUploading: t('norms.norms.form.docUploading'),
            docUploadFailed: t('norms.norms.form.docUploadFailed'),
            confirm: t('norms.norms.actions.approve'),
            cancel: t('norms.norms.transition.cancel'),
          }}
          isPending={approve.isPending}
          errorMessage={approve.error ? normActionErrorText(approve.error, 'approve', t) : null}
          onConfirm={(approvalDocId) =>
            approve.mutate({ id: approveTarget.id, approvalDocId }, { onSuccess: closeApprove })
          }
          onClose={closeApprove}
        />
      )}
    </div>
  );
}
