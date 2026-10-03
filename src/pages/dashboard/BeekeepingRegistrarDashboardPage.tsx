import { useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  Ban,
  CalendarClock,
  CheckCircle2,
  FileText,
  Hourglass,
  IdCard,
  UserMinus,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { Alert } from '../../components/ui/Feedback';
import { Select } from '../../components/ui/FormControls';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { useT } from '../../i18n/useT';
import { useBeekeepersSummary, useBeekeepingClaimsSummary } from '../beekeepers/queries';
import { DashboardCard } from './components/DashboardCard';
import { KpiTile } from './components/KpiTile';

function OpenLink({ to, testId, children }: { to: string; testId: string; children: string }) {
  return (
    <Link
      to={to}
      data-testid={testId}
      className="inline-flex items-center gap-1.5 shrink-0 text-sm font-semibold text-[#2E7D4F] hover:text-[#23653F]"
    >
      {children}
      <ArrowRight className="w-4 h-4" aria-hidden="true" />
    </Link>
  );
}

/**
 * The Beekeeping Union registrar's home screen (`beekeeping_registrar`,
 * ruling #182: central, `beekeepers.manage` and nothing else). Two cards:
 * the register as of today, and the year's applications claiming the
 * members' benefit — each claim counted in exactly one line, so the lines
 * add up to the total. Both figures come from the backend
 * (`GET /beekeepers/summary`, `GET /applications/beekeeping/summary`); the
 * year defaults to the backend's own current year, never the browser's.
 * Refusals of a certificate number at filing are not here on purpose: the
 * system does not record them (Oybek, 2026-10-04, option «а»).
 */
export function BeekeepingRegistrarDashboardPage() {
  const t = useT();
  const errorText = useApiErrorText();
  const [year, setYear] = useState<number | undefined>(undefined);

  const register = useBeekeepersSummary();
  const claims = useBeekeepingClaimsSummary(year);

  const count = (n: number) => String(n);

  return (
    <div className="space-y-4 sm:space-y-6 pb-8 w-full max-w-full min-w-0" data-testid="registrar-dashboard">
      <header>
        <h1 className="text-xl sm:text-2xl font-bold text-[#1A1F24] tracking-tight">{t('registrarDash.title')}</h1>
        <p className="text-xs sm:text-sm text-[#5A646D] mt-1 max-w-3xl leading-relaxed">
          {t('registrarDash.subtitle')}
        </p>
      </header>

      <DashboardCard
        title={t('registrarDash.register.title')}
        subtitle={t('registrarDash.register.subtitle')}
        icon={IdCard}
        badge={
          <OpenLink to="/beekeepers" testId="registrar-open-register">
            {t('registrarDash.register.open')}
          </OpenLink>
        }
      >
        {register.isError ? (
          <Alert variant="danger">
            <span data-testid="registrar-register-error">{errorText(register.error)}</span>
          </Alert>
        ) : !register.data ? (
          <p className="text-sm text-[#5A646D]">{t('dash.loading')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            <KpiTile
              testId="registrar-tile-active"
              label={t('registrarDash.register.active')}
              value={count(register.data.active)}
              hint={t('registrarDash.register.activeHint')}
              hintIcon={Users}
              tone="brand"
            />
            <KpiTile
              testId="registrar-tile-removed"
              label={t('registrarDash.register.removed')}
              value={count(register.data.removed)}
              hint={t('registrarDash.register.removedHint')}
              hintIcon={UserMinus}
            />
            <KpiTile
              testId="registrar-tile-expired"
              label={t('registrarDash.register.expired')}
              value={count(register.data.expired)}
              hint={t('registrarDash.register.expiredHint')}
              hintIcon={XCircle}
            />
            <KpiTile
              testId="registrar-tile-expiring-soon"
              label={t('registrarDash.register.expiringSoon')}
              value={count(register.data.expiring_soon)}
              hint={t('registrarDash.register.expiringSoonHint').replace(
                '{days}',
                String(register.data.expiring_within_days),
              )}
              hintIcon={CalendarClock}
              tone="info"
            />
          </div>
        )}
      </DashboardCard>

      <DashboardCard
        title={t('registrarDash.claims.title')}
        subtitle={t('registrarDash.claims.subtitle')}
        icon={FileText}
        badge={
          <OpenLink to="/beekeepers?tab=claims" testId="registrar-open-claims">
            {t('registrarDash.claims.open')}
          </OpenLink>
        }
      >
        {claims.isError ? (
          <Alert variant="danger">
            <span data-testid="registrar-claims-error">{errorText(claims.error)}</span>
          </Alert>
        ) : !claims.data ? (
          <p className="text-sm text-[#5A646D]">{t('dash.loading')}</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label htmlFor="registrar-claims-year" className="text-xs font-semibold text-[#5A646D]">
                {t('registrarDash.claims.year')}
              </label>
              <div className="w-32">
                <Select
                  id="registrar-claims-year"
                  data-testid="registrar-claims-year"
                  value={String(claims.data.year)}
                  onChange={(e) => setYear(Number(e.target.value))}
                  options={claims.data.years.map((y) => ({ value: String(y), label: String(y) }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              <KpiTile
                testId="registrar-tile-claims-total"
                label={t('registrarDash.claims.total')}
                value={count(claims.data.total)}
                hint={t('registrarDash.claims.totalHint').replace('{year}', String(claims.data.year))}
                hintIcon={FileText}
                tone="brand"
              />
              <KpiTile
                testId="registrar-tile-claims-in-review"
                label={t('registrarDash.claims.inReview')}
                value={count(claims.data.in_review)}
                hint={t('registrarDash.claims.inReviewHint')}
                hintIcon={Hourglass}
                tone="info"
              />
              <KpiTile
                testId="registrar-tile-claims-awaiting-payment"
                label={t('registrarDash.claims.awaitingPayment')}
                value={count(claims.data.awaiting_payment)}
                hint={t('registrarDash.claims.awaitingPaymentHint')}
                hintIcon={Wallet}
              />
              <KpiTile
                testId="registrar-tile-claims-permit-issued"
                label={t('registrarDash.claims.permitIssued')}
                value={count(claims.data.permit_issued)}
                hint={t('registrarDash.claims.permitIssuedHint')}
                hintIcon={CheckCircle2}
                tone="brand"
              />
              <KpiTile
                testId="registrar-tile-claims-rejected"
                label={t('registrarDash.claims.rejected')}
                value={count(claims.data.rejected)}
                hint={t('registrarDash.claims.rejectedHint')}
                hintIcon={XCircle}
              />
              <KpiTile
                testId="registrar-tile-claims-cancelled"
                label={t('registrarDash.claims.cancelled')}
                value={count(claims.data.cancelled_or_unpaid)}
                hint={t('registrarDash.claims.cancelledHint')}
                hintIcon={Ban}
              />
            </div>
          </div>
        )}
      </DashboardCard>
    </div>
  );
}
