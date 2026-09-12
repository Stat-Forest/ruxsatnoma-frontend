/**
 * F6 — the tariffs register (`GET/POST /tariffs`, `PATCH .../{id}`,
 * `.../publish`, `.../archive`). Same `_Versioned` draft -> published ->
 * archived lifecycle as F7's rule parameters (`norms/service.py`'s own
 * `_Versioned` dataclass backs both), gated by the SAME two permission
 * codes — so this screen's write gating, the publish/archive dialogs and the
 * four-refusal handling are all REUSES of task 4's work
 * (`ParamsTab.tsx`/`components/`), not a second implementation of the same
 * rules.
 *
 * Three differences from rule parameters this screen exists to handle
 * (task-5 brief):
 *
 *  1. `TariffIn` carries `activity_type_id`/`livestock_group` as IDENTITY
 *     (`service._Versioned.key_filters` matches a tariff by them) rather
 *     than a free `code` — so the create form asks for them and the edit
 *     form shows them read-only, and the LIST filters by activity type
 *     instead of a code substring.
 *  2. `TariffOut.coefficient` is a STRING on the wire, rendered verbatim —
 *     never `Number(...)`/`parseFloat(...)`, so `"1.500000"` is not
 *     re-formatted into `1.5`.
 *  3. `GET /tariffs` always applies an "in force on `on_date`" period filter
 *     server-side (`repo.list_tariffs`: the router's own `on_date` query
 *     param defaults to `business_today()` when omitted, and that filter
 *     applies regardless of whether `status` is also given) — unlike
 *     `GET /rule-parameters`, which has no period notion at all and simply
 *     lists every row matching `code`/`status`. A DRAFT dated for a future
 *     `effective_from` will not appear in this screen's default (today)
 *     view; the filter bar's own `on_date` field lets an operator move that
 *     point forward to find it. This is direct backend behaviour (the route
 *     answers "what is in force on a date", not "every row"), not a defect
 *     introduced here — see the task-5 report for the full reasoning.
 *
 * Everything else (permission gating shape, ruling R3's self-publish
 * warning, ruling R4's before/after retroactivity warning, the four
 * publish refusals) is identical to `ParamsTab.tsx` and deliberately
 * implemented the same way so the two screens read as one family.
 */
import { useState } from 'react';
import { Pencil, Plus, RotateCcw } from 'lucide-react';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { ExportXlsxButton } from '../../components/ui/ExportXlsxButton';
import { FormField, Input, Select } from '../../components/ui/FormControls';
import { Alert } from '../../components/ui/Feedback';
import { StatusBadge, type StatusType } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../auth/useAuth';
import { apiErrorMessage } from '../../i18n/errorMessages';
import type { UiLanguage } from '../../i18n/context';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { useLanguage, useT } from '../../i18n/useT';
import { satisfies } from '../../shell/navigation';
import { ArchiveConfirmDialog } from './components/ArchiveConfirmDialog';
import { PublishConfirmDialog } from './components/PublishConfirmDialog';
import { publishRefusalReason } from './components/publishRefusalReason';
import { pickLocalizedName, useActivityTypes } from './refs';
import type { TariffOut } from './tariffs/api';
import { MANAGE_PERMISSION, PUBLISH_PERMISSION, TARIFF_STATUSES, livestockGroupLabelKey, quantityUnitLabelKey, statusLabelKey } from './tariffs/labels';
import { useArchiveTariff, usePublishTariff, useTariffsList } from './tariffs/queries';
import { TariffFormModal } from './tariffs/TariffFormModal';

/** The contract's own default (`limit` 1..200, default 50) — see
 *  `ParamsTab.tsx`'s identical note. */
const PAGE_SIZE = 50;

/** `date` (`YYYY-MM-DD`) as `DD.MM.YYYY`, duplicated per this track's own
 *  folder-local convention (`ParamsTab.tsx`'s identical function). */
function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-');
  if (!y || !m || !d) return value;
  return `${d}.${m}.${y}`;
}

function statusTone(status: string): StatusType {
  switch (status) {
    case 'published':
      return 'approved';
    case 'archived':
      return 'info';
    default:
      return 'draft';
  }
}

/** Read through `Date.now()`, never a bare `new Date()` — see
 *  `ParamsTab.tsx`'s identical `todayIso()` for why (a test pins "today"
 *  without faking timers). */
function todayIso(): string {
  const now = new Date(Date.now());
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

/** Identical asymmetry to `ParamsTab.tsx::canArchiveRow` — the SAME service
 *  function (`archive_versioned`) backs both entities. */
function canArchiveRow(row: TariffOut, me: { permissions: string[]; is_superuser: boolean } | null): boolean {
  if (!me) return false;
  if (row.status === 'draft') return satisfies(MANAGE_PERMISSION, me);
  if (row.status === 'published') return satisfies(PUBLISH_PERMISSION, me);
  return false;
}

function publishErrorText(error: unknown, t: (key: string) => string, lang: UiLanguage): string {
  switch (publishRefusalReason(error)) {
    case 'not_draft':
      return t('norms.tariffs.publish.error.notDraft');
    case 'not_maker_checker':
      return t('norms.tariffs.publish.error.notMakerChecker');
    case 'forbidden':
      return t('norms.tariffs.publish.error.forbidden');
    case 'period_overlap':
      return t('norms.tariffs.publish.error.periodOverlap');
    default:
      return apiErrorMessage(error, lang);
  }
}

interface FilterState {
  activityTypeId: string;
  status: string;
  onDate: string;
}

const EMPTY_FILTERS: FilterState = { activityTypeId: '', status: '', onDate: '' };

/**
 * F6 — the tariffs register. `active` is threaded from `NormsPage.tsx` the
 * same way `ParamsTab` takes it (task 3's report has the full reasoning):
 * every tab body mounts up front and only toggles `hidden`, so a query with
 * no gate of its own would fire on page load even while a different tab is
 * showing.
 */
export function TariffsTab({ active }: { active: boolean }) {
  const t = useT();
  const { lang } = useLanguage();
  const errorText = useApiErrorText();
  const { me } = useAuth();
  const activityTypes = useActivityTypes(active);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<FilterState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  // Ruling R3's "I edited this row in this session" bookkeeping — identical
  // mechanism to `ParamsTab.tsx`'s own `editedRowIds`.
  const [editedRowIds, setEditedRowIds] = useState<Set<string>>(new Set());
  const [formTarget, setFormTarget] = useState<TariffOut | 'new' | null>(null);
  const [publishTarget, setPublishTarget] = useState<TariffOut | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<TariffOut | null>(null);

  const publish = usePublishTariff();
  const archive = useArchiveTariff();

  const canManage = me != null && satisfies(MANAGE_PERMISSION, me);
  const canPublishRoute = me != null && satisfies([MANAGE_PERMISSION, PUBLISH_PERMISSION], me);

  function markEdited(row: TariffOut) {
    setEditedRowIds((prev) => new Set(prev).add(row.id));
  }

  function openPublish(row: TariffOut) {
    publish.reset();
    setPublishTarget(row);
  }

  function closePublish() {
    setPublishTarget(null);
    publish.reset();
  }

  function openArchive(row: TariffOut) {
    archive.reset();
    setArchiveTarget(row);
  }

  function closeArchive() {
    setArchiveTarget(null);
    archive.reset();
  }

  const queryFilters = {
    activity_type_id: applied.activityTypeId || undefined,
    status: applied.status || undefined,
    on_date: applied.onDate || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };
  const list = useTariffsList(queryFilters, active);

  function applyFilters() {
    setApplied(filters);
    setPage(1);
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
  }

  const rows = list.data?.items ?? [];
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;

  function activityName(id: string): string {
    const found = activityTypes.data?.find((a) => a.id === id);
    return found ? pickLocalizedName(found.name, lang) || found.code : id;
  }

  const canEditRow = (row: TariffOut) => row.status === 'draft' && canManage;

  const columns: Column<TariffOut>[] = [
    {
      key: 'activity_type_id',
      header: t('norms.tariffs.col.activity'),
      accessor: (row) => <span className="text-xs font-semibold text-[#1A1F24]">{activityName(row.activity_type_id)}</span>,
    },
    {
      key: 'livestock_group',
      header: t('norms.tariffs.col.livestockGroup'),
      accessor: (row) => (row.livestock_group ? t(livestockGroupLabelKey(row.livestock_group)) : '—'),
    },
    {
      key: 'coefficient',
      header: t('norms.tariffs.col.coefficient'),
      // The wire's own STRING, never `Number(...)`/`parseFloat(...)` — see
      // this file's own header note.
      accessor: (row) => <span className="font-mono text-xs font-semibold">{row.coefficient}</span>,
    },
    {
      key: 'quantity_unit',
      header: t('norms.tariffs.col.quantityUnit'),
      accessor: (row) => t(quantityUnitLabelKey(row.quantity_unit)),
    },
    {
      key: 'benefit_modifiers',
      header: t('norms.tariffs.col.benefitModifiers'),
      accessor: (row) =>
        row.benefit_modifiers && Object.keys(row.benefit_modifiers).length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {Object.entries(row.benefit_modifiers).map(([code, modifier]) => (
              <span
                key={code}
                className="rounded-full bg-[#F0F7F1] px-2 py-0.5 font-mono text-[11px] text-[#123522]"
              >
                {code}: {modifier}
              </span>
            ))}
          </div>
        ) : (
          '—'
        ),
    },
    {
      key: 'status',
      header: t('norms.tariffs.col.status'),
      accessor: (row) => <StatusBadge status={statusTone(row.status)} label={t(statusLabelKey(row.status))} size="sm" />,
    },
    {
      key: 'effective_from',
      header: t('norms.tariffs.col.effectiveFrom'),
      accessor: (row) => <span className="whitespace-nowrap">{formatDate(row.effective_from)}</span>,
    },
    {
      key: 'effective_to',
      header: t('norms.tariffs.col.effectiveTo'),
      accessor: (row) => <span className="whitespace-nowrap">{formatDate(row.effective_to)}</span>,
    },
    {
      key: 'basis',
      header: t('norms.tariffs.col.basis'),
      accessor: (row) => <span className="block max-w-[240px] text-xs text-[#5A646D]">{row.basis}</span>,
    },
  ];

  return (
    <div data-testid="norms-tab-tariffs" className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-[#E4E7EA] bg-white p-6 shadow-xs">
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3">
          <FormField label={t('norms.tariffs.filter.activityType')}>
            <Select
              data-testid="tariffs-filter-activity-type"
              value={filters.activityTypeId}
              onChange={(event) => setFilters((f) => ({ ...f, activityTypeId: event.target.value }))}
              options={[
                { value: '', label: t('norms.tariffs.filter.activityTypeAll') },
                ...(activityTypes.data ?? []).map((a) => ({
                  value: a.id,
                  label: pickLocalizedName(a.name, lang) || a.code,
                })),
              ]}
            />
          </FormField>
          <FormField label={t('norms.tariffs.filter.status')}>
            <Select
              data-testid="tariffs-filter-status"
              value={filters.status}
              onChange={(event) => setFilters((f) => ({ ...f, status: event.target.value }))}
              options={[
                { value: '', label: t('norms.tariffs.filter.statusAll') },
                ...TARIFF_STATUSES.map((status) => ({ value: status, label: t(statusLabelKey(status)) })),
              ]}
            />
          </FormField>
          <FormField
            label={t('norms.tariffs.filter.onDate')}
            helperText={t('norms.tariffs.filter.onDateHint')}
          >
            <Input
              data-testid="tariffs-filter-on-date"
              type="date"
              value={filters.onDate}
              onChange={(event) => setFilters((f) => ({ ...f, onDate: event.target.value }))}
            />
          </FormField>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" leftIcon={<RotateCcw className="h-3.5 w-3.5" />} onClick={resetFilters}>
            {t('norms.tariffs.filter.reset')}
          </Button>
          <Button variant="primary" size="sm" onClick={applyFilters}>
            {t('norms.tariffs.filter.apply')}
          </Button>
          <ExportXlsxButton className="ml-auto" path="/api/v1/tariffs" query={queryFilters} />
        </div>
      </div>

      {list.error && (
        <Alert variant="danger">
          <span data-testid="tariffs-error">{errorText(list.error, t('norms.tariffs.loadError'))}</span>
        </Alert>
      )}

      {/* "An action the backend would refuse is not offered" — same house
          rule `ParamsTab.tsx` follows. */}
      {canManage && (
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            data-testid="tariffs-add"
            leftIcon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => setFormTarget('new')}
          >
            {t('norms.tariffs.actions.add')}
          </Button>
        </div>
      )}

      <div data-testid="tariffs-table">
        <DataTable<TariffOut>
          columns={columns}
          data={rows}
          isLoading={list.isLoading}
          emptyTitle={t('norms.tariffs.emptyTitle')}
          emptyDescription={t('norms.tariffs.emptyDescription')}
          pagination={{
            currentPage: page,
            totalPages,
            onPageChange: setPage,
            totalRecords: list.data?.total,
          }}
          onRowClick={(row) => setFormTarget(row)}
          rowClickable={canEditRow}
          actions={(row) => {
            const canEdit = canEditRow(row);
            const canPublishRow = row.status === 'draft' && canPublishRoute;
            const canArchiveThis = canArchiveRow(row, me);
            if (!canEdit && !canPublishRow && !canArchiveThis) return null;
            return (
              <div className="flex items-center justify-end gap-1.5">
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    data-testid={`tariff-row-edit-${row.id}`}
                    leftIcon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => setFormTarget(row)}
                  >
                    {t('norms.tariffs.actions.edit')}
                  </Button>
                )}
                {canPublishRow && (
                  <Button
                    size="sm"
                    variant="secondary"
                    data-testid={`tariff-row-publish-${row.id}`}
                    onClick={() => openPublish(row)}
                  >
                    {t('norms.tariffs.actions.publish')}
                  </Button>
                )}
                {canArchiveThis && (
                  <Button
                    size="sm"
                    variant="danger"
                    data-testid={`tariff-row-archive-${row.id}`}
                    onClick={() => openArchive(row)}
                  >
                    {t('norms.tariffs.actions.archive')}
                  </Button>
                )}
              </div>
            );
          }}
        />
      </div>

      {formTarget !== null && (
        <TariffFormModal
          mode={formTarget === 'new' ? 'create' : 'edit'}
          row={formTarget === 'new' ? undefined : formTarget}
          onClose={() => setFormTarget(null)}
          onSaved={(saved) => {
            markEdited(saved);
            setFormTarget(null);
          }}
        />
      )}

      {publishTarget && (
        <PublishConfirmDialog
          itemLabel={activityName(publishTarget.activity_type_id)}
          effectiveFrom={publishTarget.effective_from}
          today={todayIso()}
          formatDate={formatDate}
          editedByCallerThisSession={editedRowIds.has(publishTarget.id)}
          labels={{
            title: t('norms.tariffs.publish.title'),
            question: t('norms.tariffs.publish.question'),
            effectiveFromLabel: t('norms.tariffs.publish.effectiveFromLabel'),
            retroactiveWarning: t('norms.tariffs.publish.retroactiveWarning'),
            selfPublishWarning: t('norms.tariffs.publish.selfWarning'),
            confirm: t('norms.tariffs.publish.confirm'),
            cancel: t('norms.tariffs.publish.cancel'),
            resultTitle: t('norms.tariffs.publish.resultTitle'),
            resultEmpty: t('norms.tariffs.publish.resultEmpty'),
            close: t('norms.tariffs.publish.close'),
          }}
          isPending={publish.isPending}
          errorMessage={publish.error ? publishErrorText(publish.error, t, lang) : null}
          result={publish.data ?? null}
          onConfirm={() => publish.mutate(publishTarget.id)}
          onClose={closePublish}
        />
      )}

      {archiveTarget && (
        <ArchiveConfirmDialog
          itemLabel={activityName(archiveTarget.activity_type_id)}
          labels={{
            title: t('norms.tariffs.archive.title'),
            question: t('norms.tariffs.archive.question'),
            confirm: t('norms.tariffs.archive.confirm'),
            cancel: t('norms.tariffs.archive.cancel'),
          }}
          isPending={archive.isPending}
          errorMessage={archive.error ? errorText(archive.error, t('norms.tariffs.archive.error.generic')) : null}
          onConfirm={() => archive.mutate(archiveTarget.id, { onSuccess: closeArchive })}
          onClose={closeArchive}
        />
      )}
    </div>
  );
}
