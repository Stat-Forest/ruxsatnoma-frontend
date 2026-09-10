import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, RotateCcw } from 'lucide-react';
import { api } from '../../api/client';
import { ApiError, apiError } from '../../api/errors';
import { Button } from '../../components/ui/button';
import { FormField, Input, Select } from '../../components/ui/FormControls';
import { Pagination, Tabs } from '../../components/ui/Navigation';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { useT } from '../../i18n/useT';
import { downloadCsv, fetchAllPages, toCsv } from '../../lib/csvExport';
import {
  formatDateTime,
  formatEventType,
  formatObject,
  RISK_LEVEL_LABEL_KEYS,
  RISK_STATUS_LABEL_KEYS,
  RN_STATUS_LABEL_KEYS,
  riskLevelBadgeClass,
} from './format';
import {
  useEvents,
  useRiskIndicators,
  type EventFilters,
  type OversightEventOut,
  type RiskIndicatorCode,
  type RiskIndicatorFilters,
  type RiskIndicatorLevel,
  type RiskIndicatorOut,
  type RiskIndicatorStatus,
} from './queries';

const PAGE_SIZE = 20;

const RISK_CODES: RiskIndicatorCode[] = [
  'RI-01',
  'RI-02',
  'RI-03',
  'RI-04',
  'RI-05',
  'RI-06',
  'RI-07',
  'RI-08',
  'RI-09',
  'RI-10',
  'RI-11',
  'RI-12',
  'RI-13',
  'RI-14',
  'RI-15',
];
const RISK_LEVELS: RiskIndicatorLevel[] = ['low', 'medium', 'high', 'critical'];
const RISK_STATUSES: RiskIndicatorStatus[] = ['new', 'in_review', 'closed'];

type TabId = 'risk' | 'events';

export interface RiskDraft {
  code: RiskIndicatorCode | '';
  level: RiskIndicatorLevel | '';
  status: RiskIndicatorStatus | '';
  object_type: string;
  period_from: string;
  period_to: string;
}

const EMPTY_RISK_DRAFT: RiskDraft = {
  code: '',
  level: '',
  status: '',
  object_type: '',
  period_from: '',
  period_to: '',
};

function filterRiskIndicators(
  items: RiskIndicatorOut[],
  applied: RiskDraft,
): RiskIndicatorOut[] {
  return items.filter((row) => {
    if (applied.code && row.code !== applied.code) return false;
    if (applied.level && row.level !== applied.level) return false;
    if (applied.status && row.status !== applied.status) return false;
    if (
      applied.object_type &&
      !row.object_type?.toLowerCase().includes(applied.object_type.trim().toLowerCase())
    ) {
      return false;
    }
    if (
      applied.period_from &&
      !(row.occurred_at && row.occurred_at.slice(0, 10) >= applied.period_from)
    ) {
      return false;
    }
    if (
      applied.period_to &&
      !(row.occurred_at && row.occurred_at.slice(0, 10) <= applied.period_to)
    ) {
      return false;
    }
    return true;
  });
}

function toRiskFilters(draft: RiskDraft, page: number): RiskIndicatorFilters {
  return {
    code: draft.code || undefined,
    level: draft.level || undefined,
    status: draft.status || undefined,
    object_type: draft.object_type.trim() || undefined,
    period_from: draft.period_from || undefined,
    period_to: draft.period_to || undefined,
    page,
    page_size: PAGE_SIZE,
  };
}

interface EventDraft {
  event_type: string;
  object_type: string;
  period_from: string;
  period_to: string;
}

const EMPTY_EVENT_DRAFT: EventDraft = {
  event_type: '',
  object_type: '',
  period_from: '',
  period_to: '',
};

function filterOversightEvents(
  items: OversightEventOut[],
  applied: EventDraft,
): OversightEventOut[] {
  return items.filter((row) => {
    if (
      applied.event_type &&
      !row.event_type?.toLowerCase().includes(applied.event_type.trim().toLowerCase())
    ) {
      return false;
    }
    if (
      applied.object_type &&
      !row.object_type?.toLowerCase().includes(applied.object_type.trim().toLowerCase())
    ) {
      return false;
    }
    if (
      applied.period_from &&
      !(row.occurred_at && row.occurred_at.slice(0, 10) >= applied.period_from)
    ) {
      return false;
    }
    if (
      applied.period_to &&
      !(row.occurred_at && row.occurred_at.slice(0, 10) <= applied.period_to)
    ) {
      return false;
    }
    return true;
  });
}

function toEventFilters(draft: EventDraft, page: number): EventFilters {
  return {
    event_type: draft.event_type.trim() || undefined,
    object_type: draft.object_type.trim() || undefined,
    period_from: draft.period_from || undefined,
    period_to: draft.period_to || undefined,
    page,
    page_size: PAGE_SIZE,
  };
}

/**
 * The oversight register (С22) — the prosecutor's (and central office's, and
 * leadership's) read-only surface over `GET /oversight/risk-indicators` and
 * `GET /oversight/events`, gated on `oversight.view` alone (`shell/
 * navigation.ts`, `routes.tsx`). Same "read-only register with CSV export"
 * shape `ApplicationsListPage.tsx`/`PermitsListPage.tsx` already give I1 —
 * a new page reusing that established pattern, not a new one.
 *
 * Both tabs are pure readers: there is no write route in this module at all,
 * and no HTTP entry point for the oversight sweep itself (a 5-minute
 * scheduled job with no route and no permission code) — so this page offers
 * no "run sweep now" control of any kind.
 */
export function OversightPage() {
  const t = useT();
  const [tab, setTab] = useState<TabId>('risk');

  return (
    <div className="space-y-5 pb-16" data-testid="oversight-page">
      <header>
        <h1 className="text-lg font-bold text-[#1A1F24] md:text-xl">{t('leadership.oversight.title')}</h1>
      </header>

      <Tabs
        tabs={[
          { id: 'risk', label: t('leadership.oversight.tabs.riskIndicators') },
          { id: 'events', label: t('leadership.oversight.tabs.events') },
        ]}
        activeTabId={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      <div>
        {tab === 'risk' && <RiskIndicatorsTab t={t} />}
        {tab === 'events' && <EventsTab t={t} />}
      </div>
    </div>
  );
}

function RiskIndicatorsTab({ t }: { t: (key: string) => string }) {
  const errorText = useApiErrorText();
  const [draft, setDraft] = useState<RiskDraft>(EMPTY_RISK_DRAFT);
  const [applied, setApplied] = useState<RiskDraft>(EMPTY_RISK_DRAFT);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportTruncated, setExportTruncated] = useState(false);

  const queryFilters = toRiskFilters(applied, page);
  const list = useRiskIndicators(queryFilters);

  const filteredItems = useMemo(
    () => filterRiskIndicators(list.data?.items ?? [], applied),
    [list.data?.items, applied],
  );

  const rawItems = list.data?.items ?? [];
  const isReduced = filteredItems.length < rawItems.length;
  const totalRecords = isReduced ? filteredItems.length : (list.data?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));

  // Auto-apply text/date filters with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setApplied((prev) => {
        if (
          prev.object_type === draft.object_type &&
          prev.period_from === draft.period_from &&
          prev.period_to === draft.period_to
        ) {
          return prev;
        }
        return {
          ...prev,
          object_type: draft.object_type,
          period_from: draft.period_from,
          period_to: draft.period_to,
        };
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [draft.object_type, draft.period_from, draft.period_to]);

  function applyFilters() {
    setApplied(draft);
    setPage(1);
  }

  function resetFilters() {
    setDraft(EMPTY_RISK_DRAFT);
    setApplied(EMPTY_RISK_DRAFT);
    setPage(1);
  }

  async function exportCsv() {
    setExporting(true);
    setExportTruncated(false);
    try {
      const { rows, truncated } = await fetchAllPages<RiskIndicatorOut>(async (p, pageSize) => {
        const { data, error } = await api.GET('/api/v1/oversight/risk-indicators', {
          params: { query: { ...toRiskFilters(applied, p), page_size: pageSize } },
        });
        if (error) throw apiError(error);
        return data;
      });
      const filteredRows = filterRiskIndicators(rows, applied);
      const csv = toCsv(filteredRows, [
        { header: 'code', value: (r) => r.code },
        { header: 'level', value: (r) => r.level },
        { header: 'status', value: (r) => r.status },
        { header: 'object_type', value: (r) => r.object_type ?? '' },
        { header: 'object_id', value: (r) => r.object_id ?? '' },
        { header: 'description', value: (r) => r.description },
        { header: 'occurred_at', value: (r) => r.occurred_at },
        { header: 'rn_status', value: (r) => r.rn_status },
      ]);
      downloadCsv(`risk-indicators-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      setExportTruncated(truncated);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="risk-indicators-tab">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters();
        }}
        className="bg-white border border-[#E4E7EA] rounded-2xl p-5 shadow-xs space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <FormField label={t('leadership.oversight.filters.code')} htmlFor="risk-filter-code">
            <Select
              id="risk-filter-code"
              value={draft.code}
              onChange={(e) => {
                const newCode = e.target.value as RiskDraft['code'];
                setDraft((d) => ({ ...d, code: newCode }));
                setApplied((a) => ({ ...a, code: newCode }));
                setPage(1);
              }}
              options={[
                { value: '', label: t('leadership.oversight.filters.allCodes') },
                ...RISK_CODES.map((code) => ({ value: code, label: code })),
              ]}
            />
          </FormField>
          <FormField label={t('leadership.oversight.filters.level')} htmlFor="risk-filter-level">
            <Select
              id="risk-filter-level"
              value={draft.level}
              onChange={(e) => {
                const newLevel = e.target.value as RiskDraft['level'];
                setDraft((d) => ({ ...d, level: newLevel }));
                setApplied((a) => ({ ...a, level: newLevel }));
                setPage(1);
              }}
              options={[
                { value: '', label: t('leadership.oversight.filters.allLevels') },
                ...RISK_LEVELS.map((level) => ({ value: level, label: t(RISK_LEVEL_LABEL_KEYS[level]) })),
              ]}
            />
          </FormField>
          <FormField label={t('leadership.oversight.filters.status')} htmlFor="risk-filter-status">
            <Select
              id="risk-filter-status"
              value={draft.status}
              onChange={(e) => {
                const newStatus = e.target.value as RiskDraft['status'];
                setDraft((d) => ({ ...d, status: newStatus }));
                setApplied((a) => ({ ...a, status: newStatus }));
                setPage(1);
              }}
              options={[
                { value: '', label: t('leadership.oversight.filters.allStatuses') },
                ...RISK_STATUSES.map((status) => ({ value: status, label: t(RISK_STATUS_LABEL_KEYS[status]) })),
              ]}
            />
          </FormField>
          <FormField label={t('leadership.oversight.filters.objectType')} htmlFor="risk-filter-object-type">
            <Input
              id="risk-filter-object-type"
              value={draft.object_type}
              onChange={(e) => setDraft((d) => ({ ...d, object_type: e.target.value }))}
            />
          </FormField>
          <FormField label={t('leadership.dash.filters.periodFrom')} htmlFor="risk-filter-period-from">
            <Input
              id="risk-filter-period-from"
              type="date"
              value={draft.period_from}
              onChange={(e) => setDraft((d) => ({ ...d, period_from: e.target.value }))}
            />
          </FormField>
          <FormField label={t('leadership.dash.filters.periodTo')} htmlFor="risk-filter-period-to">
            <Input
              id="risk-filter-period-to"
              type="date"
              value={draft.period_to}
              onChange={(e) => setDraft((d) => ({ ...d, period_to: e.target.value }))}
            />
          </FormField>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<Download className="w-3.5 h-3.5" />}
            isLoading={exporting}
            onClick={() => void exportCsv()}
          >
            {t('prosecutor.exportCsv')}
          </Button>
          <Button type="button" variant="outline" size="sm" leftIcon={<RotateCcw className="w-3.5 h-3.5" />} onClick={resetFilters}>
            {t('leadership.dash.filters.reset')}
          </Button>
          <Button type="submit" variant="primary" size="sm" onClick={applyFilters}>
            {t('leadership.dash.filters.apply')}
          </Button>
        </div>
      </form>

      {exportTruncated && (
        <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-xs text-[#92400E]" role="alert">
          {t('prosecutor.exportTruncated')}
        </div>
      )}

      {list.error && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-2xl text-sm text-[#991B1B]" role="alert">
          {list.error instanceof ApiError ? errorText(list.error) : t('leadership.dash.error')}
        </div>
      )}

      <div className="bg-white border border-[#E4E7EA] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-[#F8F9FA] border-b border-[#E4E7EA] text-[#5A646D] uppercase font-bold text-[11px]">
                <th className="p-3">{t('leadership.oversight.col.code')}</th>
                <th className="p-3">{t('leadership.oversight.col.level')}</th>
                <th className="p-3">{t('leadership.oversight.col.status')}</th>
                <th className="p-3">{t('leadership.oversight.col.object')}</th>
                <th className="p-3">{t('leadership.oversight.col.description')}</th>
                <th className="p-3">{t('leadership.oversight.col.occurredAt')}</th>
                <th className="p-3">{t('leadership.oversight.col.rnStatus')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EA]">
              {list.isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#5A646D]">
                    <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> {t('leadership.dash.loading')}
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#5A646D]">
                    {t('leadership.oversight.empty')}
                  </td>
                </tr>
              ) : (
                filteredItems.map((row) => (
                  <tr key={row.id} data-testid={`risk-row-${row.id}`}>
                    <td className="p-3 font-mono">{row.code}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${riskLevelBadgeClass(row.level)}`}
                      >
                        {RISK_LEVEL_LABEL_KEYS[row.level] ? t(RISK_LEVEL_LABEL_KEYS[row.level]) : row.level}
                      </span>
                    </td>
                    <td className="p-3">{RISK_STATUS_LABEL_KEYS[row.status] ? t(RISK_STATUS_LABEL_KEYS[row.status]) : row.status}</td>
                    <td className="p-3">{formatObject(row.object_type, row.object_id, t)}</td>
                    <td className="p-3 max-w-xs truncate" title={row.description}>
                      {row.description}
                    </td>
                    <td className="p-3">{formatDateTime(row.occurred_at)}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full border border-[#E4E7EA] bg-[#F8F9FA] text-[#5A646D] text-xs font-semibold">
                        {RN_STATUS_LABEL_KEYS[row.rn_status] ? t(RN_STATUS_LABEL_KEYS[row.rn_status]) : row.rn_status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {list.data && totalRecords > 0 && (
          <div className="px-4 border-t border-[#E4E7EA]">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalRecords={totalRecords} />
          </div>
        )}
      </div>
    </div>
  );
}

function EventsTab({ t }: { t: (key: string) => string }) {
  const errorText = useApiErrorText();
  const [draft, setDraft] = useState<EventDraft>(EMPTY_EVENT_DRAFT);
  const [applied, setApplied] = useState<EventDraft>(EMPTY_EVENT_DRAFT);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportTruncated, setExportTruncated] = useState(false);

  const queryFilters = toEventFilters(applied, page);
  const list = useEvents(queryFilters);

  const filteredItems = useMemo(
    () => filterOversightEvents(list.data?.items ?? [], applied),
    [list.data?.items, applied],
  );

  const rawItems = list.data?.items ?? [];
  const isReduced = filteredItems.length < rawItems.length;
  const totalRecords = isReduced ? filteredItems.length : (list.data?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));

  // Auto-apply text/date filters with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setApplied((prev) => {
        if (
          prev.event_type === draft.event_type &&
          prev.object_type === draft.object_type &&
          prev.period_from === draft.period_from &&
          prev.period_to === draft.period_to
        ) {
          return prev;
        }
        return {
          ...prev,
          event_type: draft.event_type,
          object_type: draft.object_type,
          period_from: draft.period_from,
          period_to: draft.period_to,
        };
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [draft.event_type, draft.object_type, draft.period_from, draft.period_to]);

  function applyFilters() {
    setApplied(draft);
    setPage(1);
  }

  function resetFilters() {
    setDraft(EMPTY_EVENT_DRAFT);
    setApplied(EMPTY_EVENT_DRAFT);
    setPage(1);
  }

  async function exportCsv() {
    setExporting(true);
    setExportTruncated(false);
    try {
      const { rows, truncated } = await fetchAllPages<OversightEventOut>(async (p, pageSize) => {
        const { data, error } = await api.GET('/api/v1/oversight/events', {
          params: { query: { ...toEventFilters(applied, p), page_size: pageSize } },
        });
        if (error) throw apiError(error);
        return data;
      });
      const filteredRows = filterOversightEvents(rows, applied);
      const csv = toCsv(filteredRows, [
        { header: 'event_type', value: (r) => r.event_type },
        { header: 'object_type', value: (r) => r.object_type ?? '' },
        { header: 'object_id', value: (r) => r.object_id ?? '' },
        { header: 'correlation_id', value: (r) => r.correlation_id ?? '' },
        { header: 'occurred_at', value: (r) => r.occurred_at },
        { header: 'rn_status', value: (r) => r.rn_status },
        { header: 'payload', value: (r) => JSON.stringify(r.payload ?? {}) },
      ]);
      downloadCsv(`oversight-events-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      setExportTruncated(truncated);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="events-tab">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters();
        }}
        className="bg-white border border-[#E4E7EA] rounded-2xl p-5 shadow-xs space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <FormField label={t('leadership.oversight.filters.eventType')} htmlFor="event-filter-event-type">
            <Input
              id="event-filter-event-type"
              value={draft.event_type}
              onChange={(e) => setDraft((d) => ({ ...d, event_type: e.target.value }))}
            />
          </FormField>
          <FormField label={t('leadership.oversight.filters.objectType')} htmlFor="event-filter-object-type">
            <Input
              id="event-filter-object-type"
              value={draft.object_type}
              onChange={(e) => setDraft((d) => ({ ...d, object_type: e.target.value }))}
            />
          </FormField>
          <FormField label={t('leadership.dash.filters.periodFrom')} htmlFor="event-filter-period-from">
            <Input
              id="event-filter-period-from"
              type="date"
              value={draft.period_from}
              onChange={(e) => setDraft((d) => ({ ...d, period_from: e.target.value }))}
            />
          </FormField>
          <FormField label={t('leadership.dash.filters.periodTo')} htmlFor="event-filter-period-to">
            <Input
              id="event-filter-period-to"
              type="date"
              value={draft.period_to}
              onChange={(e) => setDraft((d) => ({ ...d, period_to: e.target.value }))}
            />
          </FormField>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<Download className="w-3.5 h-3.5" />}
            isLoading={exporting}
            onClick={() => void exportCsv()}
          >
            {t('prosecutor.exportCsv')}
          </Button>
          <Button type="button" variant="outline" size="sm" leftIcon={<RotateCcw className="w-3.5 h-3.5" />} onClick={resetFilters}>
            {t('leadership.dash.filters.reset')}
          </Button>
          <Button type="submit" variant="primary" size="sm" onClick={applyFilters}>
            {t('leadership.dash.filters.apply')}
          </Button>
        </div>
      </form>

      {exportTruncated && (
        <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-xs text-[#92400E]" role="alert">
          {t('prosecutor.exportTruncated')}
        </div>
      )}

      {list.error && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-2xl text-sm text-[#991B1B]" role="alert">
          {list.error instanceof ApiError ? errorText(list.error) : t('leadership.dash.error')}
        </div>
      )}

      <div className="bg-white border border-[#E4E7EA] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-[#F8F9FA] border-b border-[#E4E7EA] text-[#5A646D] uppercase font-bold text-[11px]">
                <th className="p-3">{t('leadership.oversight.col.eventType')}</th>
                <th className="p-3">{t('leadership.oversight.col.object')}</th>
                <th className="p-3">{t('leadership.oversight.col.occurredAt')}</th>
                <th className="p-3">{t('leadership.oversight.col.correlationId')}</th>
                <th className="p-3">{t('leadership.oversight.col.rnStatus')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EA]">
              {list.isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#5A646D]">
                    <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> {t('leadership.dash.loading')}
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#5A646D]">
                    {t('leadership.oversight.empty')}
                  </td>
                </tr>
              ) : (
                filteredItems.map((row) => (
                  <tr key={row.id} data-testid={`event-row-${row.id}`}>
                    <td className="p-3 font-medium text-[#111827]">{formatEventType(row.event_type, t)}</td>
                    <td className="p-3">{formatObject(row.object_type, row.object_id, t)}</td>
                    <td className="p-3">{formatDateTime(row.occurred_at)}</td>
                    <td className="p-3">{row.correlation_id ?? '—'}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full border border-[#E4E7EA] bg-[#F8F9FA] text-[#5A646D] text-xs font-semibold">
                        {RN_STATUS_LABEL_KEYS[row.rn_status] ? t(RN_STATUS_LABEL_KEYS[row.rn_status]) : row.rn_status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {list.data && totalRecords > 0 && (
          <div className="px-4 border-t border-[#E4E7EA]">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalRecords={totalRecords} />
          </div>
        )}
      </div>
    </div>
  );
}
