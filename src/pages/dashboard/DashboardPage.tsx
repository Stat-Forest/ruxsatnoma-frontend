import { useAuth } from '../../auth/useAuth';
import { ApplicantDashboardPage } from './ApplicantDashboardPage';
import { ChiefForesterDashboardPage } from './ChiefForesterDashboardPage';
import { LeadershipDashboardPage } from './LeadershipDashboardPage';
import { StaffDashboardPage } from './StaffDashboardPage';

/**
 * What `/` renders, per role.
 *
 * The applicant (B1), leadership (J3), and chief forester each have a bespoke
 * home screen — the applicant's own applications/permits/invoices, leadership's
 * territory drill-down on top of the same KPI feed, and the chief forester's
 * forestry oversight dashboard (pending GIS version/import approvals, permits
 * to sign, contour occupancy, and grazing load monitoring).
 *
 * `StaffDashboardPage` is the real screen shared by the remaining staff roles
 * (leshoz officer, GIS specialist, accountant, inspector, prosecutor, central_admin,
 * sys_admin, etc.) holding `dashboard.view`.
 */
export function DashboardPage() {
  const { me } = useAuth();

  if (me?.role.code === 'applicant') return <ApplicantDashboardPage />;
  if (me?.role.code === 'leadership') return <LeadershipDashboardPage />;
  if (me?.role.code === 'chief_forester') return <ChiefForesterDashboardPage />;
  if (me?.is_superuser || me?.permissions.includes('dashboard.view')) return <StaffDashboardPage />;

  return <div data-testid="dashboard-page">Bosh sahifa</div>;
}
