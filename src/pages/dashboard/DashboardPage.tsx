import { useAuth } from '../../auth/useAuth';
import { ApplicantDashboardPage } from './ApplicantDashboardPage';

/**
 * What `/` renders, per role.
 *
 * Only the applicant has a home screen so far (B1). The staff roles each want
 * a different one — the leshoz officer's queue, the head's decisions, the GIS
 * specialist's layers — and two of the design reference's six dashboards
 * (inspector, prosecutor) have no data behind them at all until stages 4.1
 * `inspections` and 4.2 `oversight` exist. Until each is built on something
 * real, a staff member keeps the placeholder rather than being shown a
 * citizen's figures that mean nothing in their job.
 *
 * The branch is on the role code, not on a permission: a dashboard is not a
 * right that can be granted, it is whose screen this is. `applicant` is the
 * code `0003_auth.py` seeds.
 */
export function DashboardPage() {
  const { me } = useAuth();

  if (me?.role.code === 'applicant') return <ApplicantDashboardPage />;

  return <div data-testid="dashboard-page">Bosh sahifa</div>;
}
