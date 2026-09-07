import { useState } from 'react';
import { Award, ClipboardCheck, Clock, CreditCard, Layers } from 'lucide-react';
import { Alert } from '../../components/ui/Feedback';
import { ApiError } from '../../api/errors';
import { useAuth } from '../../auth/useAuth';
import { useT, useLanguage } from '../../i18n/useT';
import { pickName } from '../applicant/format';
import { DashboardCard } from './components/DashboardCard';
import { KpiFilters } from './components/KpiFilters';
import { KpiTile, TileCount } from './components/KpiTile';
import { OmittedNotice } from './components/OmittedNotice';
import { RejectionsCard, type RejectionRow } from './components/RejectionsCard';
import { RiskIndicatorsCard } from './components/RiskIndicatorsCard';
import { TerritoryDrilldown } from './components/TerritoryDrilldown';
import { formatCompactMoney, formatDelta, formatPercent } from './format';
import { useKpi, useRejectionReasonItems, useTerritorySlice, type KpiParams } from './queries';

/** Today as a plain `YYYY-MM-DD` in the viewer's own zone — the same
 *  computation `ApplicantDashboardPage.tsx::todayIso()` uses, kept as its own
 *  copy here rather than shared (this folder's own convention). */
function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** The first day of the viewer's own current month, same local-`Date`-getters
 *  approach as `todayIso()` above — correct under the suite's fixed
 *  `TZ=Asia/Tashkent`, never a UTC-shifted date. */
function firstOfMonthIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function defaultFilters(): KpiParams {
  return { period_from: firstOfMonthIso(), period_to: todayIso(), compare_previous: false };
}

/**
 * The leadership role's home screen (J3) — what the Agency's leadership sees
 * the moment they log in: how many permits and applications moved this
 * period, what was paid, which SLAs slipped, where occupancy and grazing
 * load stand, why applications were rejected, what risk indicators fired,
 * and a territorial drill-down down to the contour. Built on the two routes
 * this stage adds (`GET /dashboard/kpi`, `GET /dashboard/territory-slice`) —
 * no other endpoint, no invented tile beyond what `KpiOut`/`TerritorySliceOut`
 * actually carry, and `KpiOut.omitted` renders as an honest notice rather
 * than a filled-in gap.
 */
export function LeadershipDashboardPage() {
  const t = useT();
  const { lang } = useLanguage();
  const { me } = useAuth();
  const [appliedFilters, setAppliedFilters] = useState<KpiParams>(defaultFilters);
  const canOpenOversightRegister = !!me && (me.is_superuser || me.permissions.includes('oversight.view'));

  const kpi = useKpi(appliedFilters);
  // Region-level (no filter) slice — independent of whatever region/district/
  // organization `KpiFilters` currently has selected. Fetched here purely to
  // gate this screen's own initial loading/error state the way `useKpi` does;
  // `TerritoryDrilldown` fetches the identical query key for its own initial
  // render, so this is one network request, not two.
  const territoryRoot = useTerritorySlice({
    period_from: appliedFilters.period_from,
    period_to: appliedFilters.period_to,
  });
  const rejectionReasons = useRejectionReasonItems();

  if (kpi.isPending || territoryRoot.isPending) {
    return (
      <div data-testid="dashboard-loading" className="p-6 text-sm text-[#5A646D]">
        {t('leadership.dash.loading')}
      </div>
    );
  }

  if (kpi.isError || territoryRoot.isError) {
    const firstError = [kpi.error, territoryRoot.error].find((error) => error instanceof ApiError) as
      | ApiError
      | undefined;
    return (
      <div data-testid="dashboard-error" className="p-1">
        <Alert variant="danger">{firstError ? firstError.message : t('leadership.dash.error')}</Alert>
      </div>
    );
  }

  const data = kpi.data;

  const issuedDelta = formatDelta(data.permits.issued_count, data.permits.previous_issued_count ?? null);
  const applicationsDelta = formatDelta(
    data.applications.total_count,
    data.applications.previous_total_count ?? null,
  );

  const paidAmount = Number(data.payments.paid_amount);
  const invoicedAmount = Number(data.payments.invoiced_amount);
  const paidOfInvoicedPct = invoicedAmount > 0 ? Math.round((paidAmount / invoicedAmount) * 1000) / 10 : null;
  const paymentsHint =
    paidOfInvoicedPct === null
      ? t('leadership.dash.tile.payments.noInvoices')
      : `${formatCompactMoney(invoicedAmount)} · ${paidOfInvoicedPct}% ${t('leadership.dash.tile.payments.paidOfInvoiced')}`;

  const rejectionRows: RejectionRow[] = data.rejections.map((row) => {
    const item = rejectionReasons.data?.find((candidate) => candidate.id === row.reason_item_id);
    return {
      id: row.reason_item_id,
      label: item ? pickName(item.name, lang) : row.reason_item_id,
      count: row.count,
    };
  });

  return (
    <div className="space-y-5 pb-8">
      <KpiFilters initial={appliedFilters} onApply={setAppliedFilters} t={t} lang={lang} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiTile
          testId="tile-permits"
          label={t('leadership.dash.tile.permits.label')}
          value={String(data.permits.issued_count)}
          hint={`${t('leadership.dash.tile.permits.hint')}: ${data.permits.active_count}`}
          hintIcon={Award}
          badge={issuedDelta !== null ? <TileCount tone="brand">{issuedDelta}</TileCount> : undefined}
          tone="neutral"
        />
        <KpiTile
          testId="tile-applications"
          label={t('leadership.dash.tile.applications.label')}
          value={String(data.applications.total_count)}
          hint={t('leadership.dash.tile.applications.hint')}
          hintIcon={Layers}
          badge={applicationsDelta !== null ? <TileCount tone="info">{applicationsDelta}</TileCount> : undefined}
          tone="info"
        />
        <KpiTile
          testId="tile-payments"
          label={t('leadership.dash.tile.payments.label')}
          value={formatCompactMoney(paidAmount)}
          hint={paymentsHint}
          hintIcon={CreditCard}
          tone="neutral"
        />
        <KpiTile
          testId="tile-sla"
          label={t('leadership.dash.tile.sla.label')}
          value={String(data.sla.active_count)}
          hint={`${t('leadership.dash.tile.sla.hint')}: ${data.sla.overdue_count}`}
          hintIcon={Clock}
          tone={data.sla.overdue_count > 0 ? 'brand' : 'neutral'}
        />
        <KpiTile
          testId="tile-inspections"
          label={t('dashboard.inspections.tileLabel')}
          value={String(data.inspections.inspections_count)}
          hint={`${t('dashboard.inspections.violationsHint')}: ${data.inspections.violations_count}`}
          hintIcon={ClipboardCheck}
          tone={data.inspections.violations_count > 0 ? 'brand' : 'neutral'}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <DashboardCard
          title={t('leadership.dash.occupancy.title')}
          subtitle={`${t('leadership.dash.occupancy.subtitle')} ${data.occupancy.contour_count}`}
        >
          <p data-testid="occupancy-value" className="text-3xl font-bold font-mono tabular-nums text-[#1A1F24]">
            {formatPercent(data.occupancy.avg_occupied_pct)}
          </p>
        </DashboardCard>
        <DashboardCard title={t('leadership.dash.sbLoad.title')}>
          <p className="text-3xl font-bold font-mono tabular-nums text-[#1A1F24]">{data.sb_load_total}</p>
        </DashboardCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <RejectionsCard rows={rejectionRows} t={t} />
        <RiskIndicatorsCard
          byCode={data.risk_indicators.by_code}
          byLevel={data.risk_indicators.by_level}
          t={t}
          canOpenRegister={canOpenOversightRegister}
        />
      </div>

      <TerritoryDrilldown periodFrom={appliedFilters.period_from} periodTo={appliedFilters.period_to} t={t} />

      <OmittedNotice omitted={data.omitted} t={t} />
    </div>
  );
}
