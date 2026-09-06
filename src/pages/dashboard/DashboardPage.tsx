import { useAuth } from '../../auth/useAuth';
import { ApplicantDashboardPage } from './ApplicantDashboardPage';
import { LeadershipDashboardPage } from './LeadershipDashboardPage';
import { StaffDashboardPage } from './StaffDashboardPage';

/**
 * What `/` renders, per role.
 *
 * The applicant (B1) and the Agency's leadership (J3) each have a bespoke
 * home screen — the applicant's own applications/permits/invoices, and
 * leadership's territory drill-down on top of the same KPI feed. F19: every
 * OTHER staff role used to keep the placeholder below, on the reasoning that
 * two of the design reference's six dashboards (inspector, prosecutor) had
 * "no data behind them at all until stages 4.1 `inspections` and 4.2
 * `oversight` exist" — both shipped 2026-09-06, and `GET /dashboard/kpi`
 * answers for every one of them today (verified against a regenerated
 * `schema.d.ts`). `StaffDashboardPage` is now that real screen, shared by
 * the leshoz officer, the GIS specialist, the accountant, the inspector,
 * the prosecutor, `central_admin`, `sys_admin` and any role an admin
 * creates later.
 *
 * The applicant/leadership branch is still on the role CODE, not a
 * permission — a bespoke screen is not a right that can be granted, it is
 * whose screen this is. `StaffDashboardPage`'s own branch is the opposite
 * on purpose: role codes are an open, admin-editable set (`RoleCreateIn`),
 * so "everyone else" is expressed as the permission every one of them
 * holds (`dashboard.view`, `tz/03`'s matrix) rather than a closed list of
 * code strings this file would have to keep in step with the role editor.
 */
export function DashboardPage() {
  const { me } = useAuth();

  if (me?.role.code === 'applicant') return <ApplicantDashboardPage />;
  if (me?.role.code === 'leadership') return <LeadershipDashboardPage />;
  if (me?.is_superuser || me?.permissions.includes('dashboard.view')) return <StaffDashboardPage />;

  return <div data-testid="dashboard-page">Bosh sahifa</div>;
}
