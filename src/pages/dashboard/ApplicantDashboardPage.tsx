import { useMemo } from 'react';
import { Award, CalendarClock, CheckCircle2, Clock, CreditCard, Layers } from 'lucide-react';
import { Alert } from '../../components/ui/Feedback';
import { useLanguage, useT } from '../../i18n/useT';
import { pickName } from '../applicant/format';
import { AreaDonutCard } from './components/AreaDonutCard';
import { ContoursCard } from './components/ContoursCard';
import { DynamicsCard } from './components/DynamicsCard';
import { KpiTile, TileCount } from './components/KpiTile';
import { LegalStatusCard } from './components/LegalStatusCard';
import { formatCompactMoney, formatHectares } from './format';
import {
  activePermitsSummary,
  applicationsInProgress,
  areaByActivity,
  contourRows,
  monthlySeries,
  nearestExpiry,
  reviewStats,
  seasonalPayments,
} from './metrics';
import {
  billedApplicationIds,
  useActivityTypes,
  useContourNumbers,
  useInvoicesFor,
  useMyApplications,
  useMyPermits,
} from './queries';

/** The window the dynamics chart draws — six months is what fits an axis on a
 *  phone without the labels colliding, and it is the span a seasonal permit
 *  actually lives in. */
const MONTHS = 6;

/** Today as a plain `YYYY-MM-DD` in the viewer's own zone, which is the
 *  calendar a citizen counts remaining days against. */
function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * The applicant's home screen (B1) — what the citizen sees the moment they
 * log in: what they hold, what is still moving, what it cost, and what runs
 * out first.
 *
 * It adds no endpoint. Every figure is arithmetic over three lists the
 * backend already narrows to the caller, because a citizen holds tens of
 * documents rather than thousands and an aggregate route would be a second
 * place for the same numbers to be computed — and to disagree.
 */
export function ApplicantDashboardPage() {
  const t = useT();
  const { lang } = useLanguage();
  const today = todayIso();

  const applications = useMyApplications();
  const permits = useMyPermits();
  const activityTypes = useActivityTypes();

  const applicationItems = useMemo(() => applications.data?.items ?? [], [applications.data]);
  const permitItems = useMemo(() => permits.data?.items ?? [], [permits.data]);

  const invoices = useInvoicesFor(billedApplicationIds(applicationItems));

  const contourIds = useMemo(
    () => [...new Set(permitItems.filter((item) => item.status === 'active').map((item) => item.contour_id))],
    [permitItems],
  );
  const contourNumbers = useContourNumbers(contourIds);

  const metrics = useMemo(
    () => ({
      active: activePermitsSummary(permitItems),
      inProgress: applicationsInProgress(applicationItems),
      money: seasonalPayments(permitItems, invoices),
      expiry: nearestExpiry(permitItems, today),
      series: monthlySeries(
        { applications: applicationItems, permits: permitItems, invoices },
        { today, months: MONTHS },
      ),
      review: reviewStats(applicationItems),
      slices: areaByActivity(permitItems),
      contours: contourRows(permitItems, today),
    }),
    [applicationItems, permitItems, invoices, today],
  );

  // The two lists the whole screen rests on. A reference that has not arrived
  // degrades a label to an id, which is survivable; a missing application or
  // permit list would turn every figure into a confident zero, which is not.
  if (applications.isPending || permits.isPending) {
    return (
      <div data-testid="dashboard-loading" className="p-6 text-sm text-[#5A646D]">
        {t('dash.loading')}
      </div>
    );
  }

  if (applications.isError || permits.isError) {
    return (
      <div data-testid="dashboard-error" className="p-1">
        <Alert variant="danger">{t('dash.error')}</Alert>
      </div>
    );
  }

  const nameOf = (activityTypeId: string) => {
    const found = activityTypes.data?.find((item) => item.id === activityTypeId);
    return found ? pickName(found.name, lang) : '—';
  };
  const numberOf = (contourId: string) => contourNumbers.get(contourId) ?? '—';

  const expiringPermit = metrics.expiry?.permit ?? null;
  const newestSignedPermit =
    permitItems.filter((item) => item.status === 'active' && item.doc_hash !== null)[0] ?? null;

  return (
    <div className="space-y-5 pb-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiTile
          testId="tile-active-permits"
          label={t('dash.activePermits.label')}
          value={`${metrics.active.count} ${t('dash.activePermits.unit')}`}
          hint={`${formatHectares(metrics.active.totalAreaHa)} ${t('dash.activePermits.area')}`}
          hintIcon={Layers}
          badge={<TileCount>{metrics.active.count}</TileCount>}
          tone="neutral"
        />
        <KpiTile
          testId="tile-applications"
          label={t('dash.applications.label')}
          value={`${metrics.inProgress.count} ${t('dash.applications.unit')}`}
          hint={
            metrics.inProgress.awaitingPayment > 0
              ? `${metrics.inProgress.awaitingPayment} ${t('dash.applications.awaitingPayment')}`
              : t('dash.applications.noPayment')
          }
          hintIcon={Clock}
          badge={<TileCount tone="info">{metrics.inProgress.count}</TileCount>}
          tone="info"
        />
        <KpiTile
          testId="tile-payments"
          label={t('dash.payments.label')}
          value={formatCompactMoney(metrics.money.totalAmount)}
          hint={
            metrics.money.receiptsConfirmedPct === null
              ? t('dash.payments.noReceipts')
              : `${metrics.money.receiptsConfirmedPct}% ${t('dash.payments.receipts')}`
          }
          hintIcon={metrics.money.receiptsConfirmedPct === null ? CreditCard : CheckCircle2}
          badge={<CreditCard className="w-5 h-5 text-[#767F87]" />}
          tone="neutral"
        />
        {/* Replaces the reference's "usage discipline / GPS geofencing" tile,
            which has no source in this system — field inspections are stage
            4.1. This says something true from data that exists. */}
        <KpiTile
          testId="tile-expiry"
          label={t('dash.expiry.label')}
          value={
            metrics.expiry === null ? '—' : `${metrics.expiry.daysLeft} ${t('dash.expiry.unit')}`
          }
          hint={
            expiringPermit === null
              ? t('dash.expiry.none')
              : `${expiringPermit.series} № ${expiringPermit.number} · ${numberOf(expiringPermit.contour_id)}`
          }
          hintIcon={CalendarClock}
          badge={<Award className="w-5 h-5 text-[#767F87]" />}
          tone={metrics.expiry !== null && metrics.expiry.daysLeft <= 30 ? 'brand' : 'neutral'}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2">
          <DynamicsCard points={metrics.series} stats={metrics.review} t={t} />
        </div>
        <AreaDonutCard slices={metrics.slices} nameOf={nameOf} t={t} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2">
          <ContoursCard rows={metrics.contours} numberOf={numberOf} t={t} />
        </div>
        <LegalStatusCard permit={newestSignedPermit} t={t} />
      </div>
    </div>
  );
}
