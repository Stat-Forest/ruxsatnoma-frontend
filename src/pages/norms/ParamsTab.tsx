/**
 * F7 — the rule-parameters register. Every grazing fee in the system
 * multiplies through ten `coef_sb:<livestock_code>` rows that migration
 * 0012 seeds as DRAFTS with `basis='provisional — awaiting VMQ 689 annex
 * 5'`: the calculation engine reads published rows only, so while any of
 * the ten stays a draft, `POST /calculations` for grazing raises
 * `ERR-NORM-004` for every application in the country. Nothing on the old
 * system said so — that is the banner below. Task 4 is what closes the gap:
 * an operator can now put the Agency's real numbers into these rows and
 * publish them, from either the banner or the table.
 *
 * `RuleParameterOut.value` is `unknown` on the wire (no per-code type in the
 * contract), so it is rendered by its RUNTIME type via `toDisplayText`,
 * exactly the reasoning `SettingsPage.tsx` already worked out for
 * `SettingOut.value`. The migration seeds numbers as JSON STRINGS
 * (`to_jsonb(CAST(:value AS text))`), so `"0.8"` prints as `"0.8"` (quoted)
 * rather than `0.8` — the point of this column is to tell those two apart,
 * not to hide the difference.
 *
 * Write actions are gated the way every other screen gates them
 * (`src/auth/`, `DecisionPanel.tsx`'s own `canReview`/`canDecide` pair): a
 * plain `me.is_superuser || me.permissions.includes(CODE)` check per
 * permission, read fresh from `useAuth()` on every render, never cached
 * into local state. `sys_admin` passes both checks through `is_superuser`
 * without this file special-casing the role name anywhere.
 */
import { useState } from 'react';
import { Pencil, Plus, RotateCcw } from 'lucide-react';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { FormField, Input, Select } from '../../components/ui/FormControls';
import { Alert } from '../../components/ui/Feedback';
import { StatusBadge, type StatusType } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/button';
import { ApiError } from '../../api/errors';
import { useAuth } from '../../auth/useAuth';
import { useT } from '../../i18n/useT';
import { satisfies } from '../../shell/navigation';
import { ArchiveConfirmDialog } from './components/ArchiveConfirmDialog';
import { PublishConfirmDialog } from './components/PublishConfirmDialog';
import { publishRefusalReason } from './components/publishRefusalReason';
import { COEF_SB_PREFIX, MANAGE_PERMISSION, PUBLISH_PERMISSION, RULE_PARAMETER_STATUSES, statusLabelKey } from './params/labels';
import type { RuleParameterOut } from './params/api';
import {
  useArchiveRuleParameter,
  useDraftCoefficients,
  usePublishRuleParameter,
  useRuleParametersList,
} from './params/queries';
import { RuleParameterFormModal } from './params/RuleParameterFormModal';

/** The contract's own default (`limit` 1..200, default 50) — sent
 *  explicitly rather than omitted, so a page of results and a page number
 *  never disagree about how big a page is. */
const PAGE_SIZE = 50;

/** Mirrors `SettingsPage.tsx`'s `toDisplayText`: always JSON, so `10` and
 *  `"10"` cannot look alike on a screen whose whole subject is types. */
function toDisplayText(value: unknown): string {
  const json = JSON.stringify(value);
  return json === undefined ? 'null' : json;
}

/** `date` (`YYYY-MM-DD`) as `DD.MM.YYYY`, never re-parsed through `Date` —
 *  that would apply the browser's own timezone to a plain calendar date.
 *  Folder-local by the same convention `applicant/format.ts` documents:
 *  each track duplicates this rather than importing across tracks. */
function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-');
  if (!y || !m || !d) return value;
  return `${d}.${m}.${y}`;
}

/** `datetime` (ISO, tz-aware) as `DD.MM.YYYY HH:MM` in the viewer's own
 *  local time. */
function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? `${error.code}: ${error.message}` : fallback;
}

/** Read through `Date.now()` rather than constructing a bare `new Date()`,
 *  so a test can pin "today" without faking timers — the same reason
 *  `ClassifiersPage.tsx`'s own `todayIso()` does it this way. Ruling R4's
 *  retroactive warning is computed from this, client-side, before the
 *  operator ever presses publish. */
function todayIso(): string {
  const now = new Date(Date.now());
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

/** Task-4 brief's archive asymmetry: a DRAFT row is a maker's own work
 *  (`norms.tariffs.manage` alone), a PUBLISHED row is a number already in
 *  force (`norms.tariffs.publish` specifically — the checker right, because
 *  taking a number out of force is the one-person change maker-checker
 *  exists to prevent). An ARCHIVED row offers no action: archiving it again
 *  is a documented no-op server-side, but there is no operator scenario
 *  this screen needs to support for it, so no button is offered at all. */
function canArchiveRow(
  row: RuleParameterOut,
  me: { permissions: string[]; is_superuser: boolean } | null,
): boolean {
  if (!me) return false;
  if (row.status === 'draft') return satisfies(MANAGE_PERMISSION, me);
  if (row.status === 'published') return satisfies(PUBLISH_PERMISSION, me);
  return false;
}

/** One of the four distinct refusals (task-4 brief) turned into the
 *  sentence an operator reads — the DECISION (`publishRefusalReason`) is
 *  shared with task 5's tariffs dialog; the sentence stays local, under
 *  this track's own `norms.params.*` namespace. */
function publishErrorText(error: unknown, t: (key: string) => string): string {
  switch (publishRefusalReason(error)) {
    case 'not_draft':
      return t('norms.params.publish.error.notDraft');
    case 'not_maker_checker':
      return t('norms.params.publish.error.notMakerChecker');
    case 'forbidden':
      return t('norms.params.publish.error.forbidden');
    case 'period_overlap':
      return t('norms.params.publish.error.periodOverlap');
    default:
      return errorText(error, t('norms.params.publish.error.generic'));
  }
}

/**
 * The provisional-coefficient banner (ruling R2, option а). Appears only
 * when at least one row's `code` starts with `coef_sb:` AND `status ===
 * 'draft'` — the exact condition `app/seed/demo.py::_publish_draft_coef_sb`
 * uses server-side to decide which rows are left for the demo to publish.
 * Deliberately NOT keyed on `basis`: that column is free text an operator
 * can retype, and a warning that silently stops firing because someone
 * edited a sentence is worse than no warning.
 *
 * Fed by its own query (`useDraftCoefficients`), independent of the table's
 * own filters and paging below — see `queries.ts` for why. `active` is
 * threaded through rather than read from a shared query cache key, so this
 * component's own gating matches the table's exactly.
 *
 * Task 4 adds `onPublish`/`canPublish`: the per-row publish button task 3
 * deliberately left this component ready for (see its own file-header
 * comment on the `<ul>` below). `ParamsTab` owns the actual publish dialog
 * and mutation — every draft in the country only needs ONE dialog instance,
 * whichever row (banner or table) opened it.
 */
function ProvisionalCoefficientBanner({
  active,
  t,
  canPublish,
  onPublish,
}: {
  active: boolean;
  t: (key: string) => string;
  canPublish: boolean;
  onPublish: (row: RuleParameterOut) => void;
}) {
  const draftCoefficients = useDraftCoefficients(active);
  const rows = (draftCoefficients.data?.items ?? []).filter(
    (row) => row.code.startsWith(COEF_SB_PREFIX) && row.status === 'draft',
  );
  if (rows.length === 0) return null;

  return (
    <div data-testid="coef-sb-draft-banner">
      <Alert variant="warning" title={t('norms.params.banner.title')}>
        <div className="space-y-1">
          <p>
            <span className="font-semibold" data-testid="coef-sb-draft-count">
              {rows.length}
            </span>{' '}
            {t('norms.params.banner.countSuffix')}
          </p>
          <p>{t('norms.params.banner.consequence')}</p>
          <p>{t('norms.params.banner.source')}</p>
        </div>
        {/* The third flex child task 3 left room for — `justify-between`
            already spaces code/value/button across the row without any
            change to the `<li>`/`<ul>` structure or className. */}
        <ul className="mt-3 space-y-1.5">
          {rows.map((row) => (
            <li
              key={row.id}
              data-testid={`coef-sb-draft-row-${row.code}`}
              className="flex items-center justify-between gap-3 rounded-md border border-[#FDE68A] bg-white/60 px-3 py-1.5"
            >
              <span className="font-mono text-xs font-semibold text-[#92400E]">{row.code}</span>
              <span className="font-mono text-xs text-[#92400E]">{toDisplayText(row.value)}</span>
              {canPublish && (
                <Button
                  size="sm"
                  variant="secondary"
                  data-testid={`coef-sb-publish-${row.code}`}
                  onClick={() => onPublish(row)}
                >
                  {t('norms.params.actions.publish')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Alert>
    </div>
  );
}

interface FilterState {
  code: string;
  status: string;
}

const EMPTY_FILTERS: FilterState = { code: '', status: '' };

/**
 * Rule parameters — a bare, no-props component per task 2's contract, EXCEPT
 * for `active`, added this task: `NormsPage` mounts every tab body up front
 * and only toggles `hidden` on the wrapper `<div>`, so nothing tells a tab
 * body when it stops being the visible one short of a signal from the
 * parent. `active` is that signal — see `NormsPage.tsx` and the task-3
 * report for the full reasoning.
 */
export function ParamsTab({ active }: { active: boolean }) {
  const t = useT();
  const { me } = useAuth();
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<FilterState>(EMPTY_FILTERS);
  // 1-indexed, to match `DataTable`'s `pagination` prop — converted to the
  // contract's own `offset` just below.
  const [page, setPage] = useState(1);

  // "I created or PATCHed this row in THIS session" (ruling R3) — a plain
  // `Set` of ids, not persisted anywhere: it does not survive a reload, and
  // per the brief it does not need to. Read by the publish dialog only; the
  // backend enforces nothing from this, it is an honest heads-up.
  const [editedRowIds, setEditedRowIds] = useState<Set<string>>(new Set());
  const [formTarget, setFormTarget] = useState<RuleParameterOut | 'new' | null>(null);
  const [publishTarget, setPublishTarget] = useState<RuleParameterOut | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<RuleParameterOut | null>(null);

  const publish = usePublishRuleParameter();
  const archive = useArchiveRuleParameter();

  // Route-level permission table (task-4 brief): PATCH is `manage` only;
  // publish/archive-of-a-draft accept EITHER `manage` or `publish`. Neither
  // constant hard-codes `sys_admin` — `satisfies` already passes every
  // check for `is_superuser` on its own.
  const canManage = me != null && satisfies(MANAGE_PERMISSION, me);
  const canPublishRoute = me != null && satisfies([MANAGE_PERMISSION, PUBLISH_PERMISSION], me);

  function markEdited(row: RuleParameterOut) {
    setEditedRowIds((prev) => new Set(prev).add(row.id));
  }

  function openPublish(row: RuleParameterOut) {
    publish.reset();
    setPublishTarget(row);
  }

  function closePublish() {
    setPublishTarget(null);
    publish.reset();
  }

  function openArchive(row: RuleParameterOut) {
    archive.reset();
    setArchiveTarget(row);
  }

  function closeArchive() {
    setArchiveTarget(null);
    archive.reset();
  }

  const list = useRuleParametersList(
    {
      code: applied.code || undefined,
      status: applied.status || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    },
    active,
  );

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

  const columns: Column<RuleParameterOut>[] = [
    {
      key: 'code',
      header: t('norms.params.col.code'),
      accessor: (row) => <span className="font-mono text-xs font-semibold text-[#1A1F24]">{row.code}</span>,
    },
    {
      key: 'value',
      header: t('norms.params.col.value'),
      accessor: (row) => <span className="font-mono text-xs break-all">{toDisplayText(row.value)}</span>,
    },
    {
      key: 'unit',
      header: t('norms.params.col.unit'),
      accessor: (row) => row.unit ?? '—',
    },
    {
      key: 'status',
      header: t('norms.params.col.status'),
      accessor: (row) => (
        <StatusBadge status={statusTone(row.status)} label={t(statusLabelKey(row.status))} size="sm" />
      ),
    },
    {
      key: 'effective_from',
      header: t('norms.params.col.effectiveFrom'),
      accessor: (row) => <span className="whitespace-nowrap">{formatDate(row.effective_from)}</span>,
    },
    {
      key: 'effective_to',
      header: t('norms.params.col.effectiveTo'),
      accessor: (row) => <span className="whitespace-nowrap">{formatDate(row.effective_to)}</span>,
    },
    {
      key: 'basis',
      header: t('norms.params.col.basis'),
      accessor: (row) => <span className="block max-w-[280px] text-xs text-[#5A646D]">{row.basis}</span>,
    },
    {
      key: 'created_by',
      header: t('norms.params.col.createdBy'),
      // `null` on a migration-seeded row (task-3 brief, contract table) —
      // said outright rather than left as a bare dash a reader could take
      // for missing data.
      accessor: (row) => (
        <span className="text-xs text-[#5A646D]">
          {row.created_by ?? t('norms.params.seededByMigration')}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: t('norms.params.col.createdAt'),
      accessor: (row) => <span className="whitespace-nowrap text-xs text-[#5A646D]">{formatDateTime(row.created_at)}</span>,
    },
  ];

  return (
    <div data-testid="norms-tab-params" className="space-y-4">
      <ProvisionalCoefficientBanner active={active} t={t} canPublish={canPublishRoute} onPublish={openPublish} />

      <div className="space-y-3 rounded-2xl border border-[#E4E7EA] bg-white p-6 shadow-xs">
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
          <FormField label={t('norms.params.filter.code')}>
            <Input
              data-testid="params-filter-code"
              value={filters.code}
              onChange={(event) => setFilters((f) => ({ ...f, code: event.target.value }))}
              placeholder="coef_sb:qoramol"
              className="font-mono"
            />
          </FormField>
          <FormField label={t('norms.params.filter.status')}>
            <Select
              data-testid="params-filter-status"
              value={filters.status}
              onChange={(event) => setFilters((f) => ({ ...f, status: event.target.value }))}
              options={[
                { value: '', label: t('norms.params.filter.statusAll') },
                ...RULE_PARAMETER_STATUSES.map((status) => ({
                  value: status,
                  label: t(statusLabelKey(status)),
                })),
              ]}
            />
          </FormField>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" leftIcon={<RotateCcw className="h-3.5 w-3.5" />} onClick={resetFilters}>
            {t('norms.params.filter.reset')}
          </Button>
          <Button variant="primary" size="sm" onClick={applyFilters}>
            {t('norms.params.filter.apply')}
          </Button>
        </div>
      </div>

      {list.error && (
        <Alert variant="danger">
          <span data-testid="params-error">{errorText(list.error, t('norms.params.loadError'))}</span>
        </Alert>
      )}

      {/* "An action the backend would refuse is not offered" — a caller with
          neither write permission never sees this row at all, not a
          disabled button. */}
      {canManage && (
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            data-testid="params-add"
            leftIcon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => setFormTarget('new')}
          >
            {t('norms.params.actions.add')}
          </Button>
        </div>
      )}

      <div data-testid="params-table">
        <DataTable<RuleParameterOut>
          columns={columns}
          data={rows}
          isLoading={list.isLoading}
          emptyTitle={t('norms.params.emptyTitle')}
          emptyDescription={t('norms.params.emptyDescription')}
          pagination={{
            currentPage: page,
            totalPages,
            onPageChange: setPage,
            totalRecords: list.data?.total,
          }}
          actions={(row) => {
            // Editing is draft-only (brief: PATCH on a published row answers
            // `not_draft`) — a published row shows no edit control at all,
            // never one that fails when pressed.
            const canEdit = row.status === 'draft' && canManage;
            const canPublishRow = row.status === 'draft' && canPublishRoute;
            const canArchiveThis = canArchiveRow(row, me);
            if (!canEdit && !canPublishRow && !canArchiveThis) return null;
            return (
              <div className="flex items-center justify-end gap-1.5">
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    data-testid={`row-edit-${row.code}`}
                    leftIcon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => setFormTarget(row)}
                  >
                    {t('norms.params.actions.edit')}
                  </Button>
                )}
                {canPublishRow && (
                  <Button
                    size="sm"
                    variant="secondary"
                    data-testid={`row-publish-${row.code}`}
                    onClick={() => openPublish(row)}
                  >
                    {t('norms.params.actions.publish')}
                  </Button>
                )}
                {canArchiveThis && (
                  <Button
                    size="sm"
                    variant="danger"
                    data-testid={`row-archive-${row.code}`}
                    onClick={() => openArchive(row)}
                  >
                    {t('norms.params.actions.archive')}
                  </Button>
                )}
              </div>
            );
          }}
        />
      </div>

      {formTarget !== null && (
        <RuleParameterFormModal
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
          itemLabel={publishTarget.code}
          effectiveFrom={publishTarget.effective_from}
          today={todayIso()}
          formatDate={formatDate}
          editedByCallerThisSession={editedRowIds.has(publishTarget.id)}
          labels={{
            title: t('norms.params.publish.title'),
            question: t('norms.params.publish.question'),
            effectiveFromLabel: t('norms.params.publish.effectiveFromLabel'),
            retroactiveWarning: t('norms.params.publish.retroactiveWarning'),
            selfPublishWarning: t('norms.params.publish.selfWarning'),
            confirm: t('norms.params.publish.confirm'),
            cancel: t('norms.params.publish.cancel'),
            resultTitle: t('norms.params.publish.resultTitle'),
            resultEmpty: t('norms.params.publish.resultEmpty'),
            close: t('norms.params.publish.close'),
          }}
          isPending={publish.isPending}
          errorMessage={publish.error ? publishErrorText(publish.error, t) : null}
          result={publish.data ?? null}
          onConfirm={() => publish.mutate(publishTarget.id)}
          onClose={closePublish}
        />
      )}

      {archiveTarget && (
        <ArchiveConfirmDialog
          itemLabel={archiveTarget.code}
          labels={{
            title: t('norms.params.archive.title'),
            question: t('norms.params.archive.question'),
            confirm: t('norms.params.archive.confirm'),
            cancel: t('norms.params.archive.cancel'),
          }}
          isPending={archive.isPending}
          errorMessage={archive.error ? errorText(archive.error, t('norms.params.archive.error.generic')) : null}
          onConfirm={() => archive.mutate(archiveTarget.id, { onSuccess: closeArchive })}
          onClose={closeArchive}
        />
      )}
    </div>
  );
}
