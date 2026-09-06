import { useAuth } from '../../auth/useAuth';
import { ApplicantDashboardPage } from './ApplicantDashboardPage';
import { LeadershipDashboardPage } from './LeadershipDashboardPage';

/**
 * What `/` renders, per role.
 *
 * Two roles have a real home screen so far: the applicant (B1) and the
 * Agency's leadership (J3). The remaining staff roles each want a different
 * one — the leshoz officer's queue, the GIS specialist's layers — and two of
 * the design reference's six dashboards (inspector, prosecutor) have no data
 * behind them at all until stages 4.1 `inspections` and 4.2 `oversight`
 * exist. Until each is built on something real, a staff member keeps the
 * placeholder rather than being shown figures that mean nothing in their job.
 *
 * The branch is on the role code, not on a permission: a dashboard is not a
 * right that can be granted, it is whose screen this is. `applicant` and
 * `leadership` are codes `0003_auth.py` seeds.
 */
export function DashboardPage() {
  const { me } = useAuth();

  if (me?.role.code === 'applicant') return <ApplicantDashboardPage />;
  if (me?.role.code === 'leadership') return <LeadershipDashboardPage />;

  return <div data-testid="dashboard-page">Bosh sahifa</div>;
}
