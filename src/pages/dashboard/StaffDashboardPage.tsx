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
import { formatCompactMoney, formatDelta, formatPercent } from './format';
import { useKpi, useRejectionReasonItems, type KpiParams } from './queries';

/** Same local-`Date`-getters computation `LeadershipDashboardPage.tsx`'s own
 *  `todayIso()`/`firstOfMonthIso()` use — kept as its own copy per this
 *  folder's stated convention rather than imported across dashboard pages. */
function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function firstOfMonthIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function defaultFilters(): KpiParams {
  return { period_from: firstOfMonthIso(), period_to: todayIso(), compare_previous: false };
}

const DASHBOARD_VIEW = 'dashboard.view';

/**
 * F19 — the home screen for every staff role that is neither the applicant
 * (its own screen, B1) nor leadership (its own screen plus the territory
 * drill-down, J3): the leshoz officer, the GIS specialist, the accountant,
 * the inspector, the prosecutor, `central_admin`, `sys_admin`, and any role
 * an admin creates later — role codes are an open, admin-editable set
 * (`RoleCreateIn`), not a fixed enum, so this branches on the PERMISSION
 * every one of them holds (`dashboard.view`, granted to every staff role
 * but the applicant, per `tz/03`'s matrix) rather than on a closed list of
 * role-code strings `DashboardPage.tsx` would have to keep in step with the
 * admin's own role editor.
 *
 * Built on the same `GET /dashboard/kpi` `LeadershipDashboardPage.tsx` reads
 * — the backend ANDs the actor's own zone into every figure without being
 * asked (`dashboard/repo.py::_combined`), so a leshoz officer simply sees
 * their own leshoz's numbers through the identical route and the identical
 * screen a republic-wide reader sees the whole country through. No
 * territory drill-down here: `GET /dashboard/territory-slice` is a
 * republic→region→district→organization→contour walk that has nothing to
 * add for a caller whose own zone is already the narrowest node in it.
 * Every component below is reused verbatim from the leadership dashboard
 * (`KpiFilters`, `KpiTile`, `DashboardCard`, `RejectionsCard`,
 * `RiskIndicatorsCard`, `OmittedNotice`) — none of them is leadership-
 * specific in what it does, only in which page happened to build them
 * first.
 */
export function StaffDashboardPage() {
  const t = useT();
  const { lang } = useLanguage();
  const { me } = useAuth();
  const [appliedFilters, setAppliedFilters] = useState<KpiParams>(defaultFilters);

  const canViewDashboard = Boolean(me?.is_superuser || me?.permissions.includes(DASHBOARD_VIEW));
  const canOpenOversightRegister = Boolean(me?.is_superuser || me?.permissions.includes('oversight.view'));

  const kpi = useKpi(appliedFilters, { enabled: canViewDashboard });
  const rejectionReasons = useRejectionReasonItems();

  if (!canViewDashboard) {
    // No `dashboard.view` holder should exist among the staff roles this
    // page is reached for (`DashboardPage.tsx` only renders it when the
    // permission is present) — kept as an honest fallback rather than
    // firing a query the backend would refuse, the same house rule every
    // gated panel in this app follows.
    return (
      <div data-testid="dashboard-no-access" className="p-6 text-sm text-[#5A646D]">
        {t('dashboard.staff.noAccess')}
      </div>
    );
  }

  if (kpi.isPending) {
    return (
      <div data-testid="dashboard-loading" className="p-6 text-sm text-[#5A646D]">
        {t('leadership.dash.loading')}
      </div>
    );
  }

  if (kpi.isError) {
    return (
      <div data-testid="dashboard-error" className="p-1">
        <Alert variant="danger">
          {kpi.error instanceof ApiError ? kpi.error.message : t('leadership.dash.error')}
        </Alert>
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

      <OmittedNotice omitted={data.omitted} t={t} />
    </div>
  );
}
