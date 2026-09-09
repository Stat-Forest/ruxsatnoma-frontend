import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { DashboardPage } from './DashboardPage';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';

// The applicant, leadership and staff branches each mount a real dashboard,
// which fetches. This suite is about which branch is chosen, so each
// dashboard stands in as a marker — `ApplicantDashboardPage.test.tsx`,
// `LeadershipDashboardPage.test.tsx` and `StaffDashboardPage.test.tsx` are
// what exercise their contents.
vi.mock('./ApplicantDashboardPage', () => ({
  ApplicantDashboardPage: () => <div data-testid="applicant-dashboard" />,
}));
vi.mock('./ChiefForesterDashboardPage', () => ({
  ChiefForesterDashboardPage: () => <div data-testid="chief-forester-dashboard" />,
}));
vi.mock('./LeadershipDashboardPage', () => ({
  LeadershipDashboardPage: () => <div data-testid="leadership-dashboard" />,
}));
vi.mock('./StaffDashboardPage', () => ({
  StaffDashboardPage: () => <div data-testid="staff-dashboard" />,
}));

function renderAs(roleCode: string, options: { permissions?: string[]; isSuperuser?: boolean } = {}) {
  const me = {
    user: { id: 'u-1', full_name: 'Test', login: 'test', language: 'uz_latn' },
    role: { code: roleCode, name: {} },
    permissions: options.permissions ?? [],
    zone: {},
    csrf_token: 'tok',
    is_superuser: options.isSuperuser ?? false,
    applicant: roleCode === 'applicant' ? { id: 'a-1' } : null,
    representations: [],
    registration_complete: true,
  };
  const value = { me, loading: false, authError: null } as unknown as AuthContextValue;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
  return render(<DashboardPage />, { wrapper });
}

test('an applicant lands on their own dashboard', () => {
  renderAs('applicant');

  expect(screen.getByTestId('applicant-dashboard')).toBeInTheDocument();
});

test('a role with no dashboard.view keeps the placeholder — nothing to show them', () => {
  renderAs('executor_staff', { permissions: [] });

  expect(screen.queryByTestId('applicant-dashboard')).not.toBeInTheDocument();
  expect(screen.queryByTestId('staff-dashboard')).not.toBeInTheDocument();
  expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
});

test('a leadership user lands on the KPI dashboard', () => {
  renderAs('leadership');

  expect(screen.getByTestId('leadership-dashboard')).toBeInTheDocument();
});

test('a chief forester lands on the chief forester dashboard', () => {
  renderAs('chief_forester');

  expect(screen.getByTestId('chief-forester-dashboard')).toBeInTheDocument();
});

test('F19 — any staff role holding dashboard.view lands on the real staff dashboard, not the placeholder', () => {
  renderAs('executor_staff', { permissions: ['dashboard.view'] });

  expect(screen.getByTestId('staff-dashboard')).toBeInTheDocument();
  expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
});

test('F19 — a role code this file has never heard of still reaches the staff dashboard, as long as it holds dashboard.view', () => {
  // Role codes are an open, admin-editable set (`RoleCreateIn`) — the branch
  // must not be a closed list of strings that drifts from the admin's own
  // role editor.
  renderAs('a_brand_new_role_created_tomorrow', { permissions: ['dashboard.view'] });

  expect(screen.getByTestId('staff-dashboard')).toBeInTheDocument();
});

test('F19 — a superuser lands on the staff dashboard even without the permission literally listed', () => {
  renderAs('sys_admin', { permissions: [], isSuperuser: true });

  expect(screen.getByTestId('staff-dashboard')).toBeInTheDocument();
});
