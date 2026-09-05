/**
 * F7 — the rule-parameters register, read-only (create/edit/publish/archive
 * are task 4). Every grazing fee in the system multiplies through ten
 * `coef_sb:<livestock_code>` rows that migration 0012 seeds as DRAFTS with
 * `basis='provisional — awaiting VMQ 689 annex 5'`: the calculation engine
 * reads published rows only, so while any of the ten stays a draft,
 * `POST /calculations` for grazing raises `ERR-NORM-004` for every
 * application in the country. Nothing on the old system said so — that is
 * the banner below.
 *
 * `RuleParameterOut.value` is `unknown` on the wire (no per-code type in the
 * contract), so it is rendered by its RUNTIME type via `toDisplayText`,
 * exactly the reasoning `SettingsPage.tsx` already worked out for
 * `SettingOut.value`. The migration seeds numbers as JSON STRINGS
 * (`to_jsonb(CAST(:value AS text))`), so `"0.8"` prints as `"0.8"` (quoted)
 * rather than `0.8` — the point of this column is to tell those two apart,
 * not to hide the difference.
 */
import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { FormField, Input, Select } from '../../components/ui/FormControls';
import { Alert } from '../../components/ui/Feedback';
import { StatusBadge, type StatusType } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/button';
import { ApiError } from '../../api/errors';
import { useT } from '../../i18n/useT';
import { COEF_SB_PREFIX, RULE_PARAMETER_STATUSES, statusLabelKey } from './params/labels';
import type { RuleParameterOut } from './params/api';
import { useDraftCoefficients, useRuleParametersList } from './params/queries';

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
 */
function ProvisionalCoefficientBanner({
  active,
  t,
}: {
  active: boolean;
  t: (key: string) => string;
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
        {/* One row per unpublished coefficient — `flex justify-between` so
            task 4 can append a per-row publish button as one more flex
            child, on the right, without reshaping this row or the list
            around it. */}
        <ul className="mt-3 space-y-1.5">
          {rows.map((row) => (
            <li
              key={row.id}
              data-testid={`coef-sb-draft-row-${row.code}`}
              className="flex items-center justify-between gap-3 rounded-md border border-[#FDE68A] bg-white/60 px-3 py-1.5"
            >
              <span className="font-mono text-xs font-semibold text-[#92400E]">{row.code}</span>
              <span className="font-mono text-xs text-[#92400E]">{toDisplayText(row.value)}</span>
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
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<FilterState>(EMPTY_FILTERS);
  // 1-indexed, to match `DataTable`'s `pagination` prop — converted to the
  // contract's own `offset` just below.
  const [page, setPage] = useState(1);

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
      <ProvisionalCoefficientBanner active={active} t={t} />

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
        />
      </div>
    </div>
  );
}
