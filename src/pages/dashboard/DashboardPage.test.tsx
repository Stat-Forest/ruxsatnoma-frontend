import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { DashboardPage } from './DashboardPage';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';

// The applicant and leadership branches each mount a real dashboard, which
// fetches. This suite is about which branch is chosen, so each dashboard
// stands in as a marker — `ApplicantDashboardPage.test.tsx` and
// `LeadershipDashboardPage.test.tsx` are what exercise their contents.
vi.mock('./ApplicantDashboardPage', () => ({
  ApplicantDashboardPage: () => <div data-testid="applicant-dashboard" />,
}));
vi.mock('./LeadershipDashboardPage', () => ({
  LeadershipDashboardPage: () => <div data-testid="leadership-dashboard" />,
}));

function renderAs(roleCode: string) {
  const me = {
    user: { id: 'u-1', full_name: 'Test', login: 'test', language: 'uz_latn' },
    role: { code: roleCode, name: {} },
    permissions: [],
    zone: {},
    csrf_token: 'tok',
    is_superuser: false,
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

test('a staff role still gets the placeholder — their dashboards are a later stage', () => {
  renderAs('executor_staff');

  expect(screen.queryByTestId('applicant-dashboard')).not.toBeInTheDocument();
  expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
});

test('a leadership user lands on the KPI dashboard', () => {
  renderAs('leadership');

  expect(screen.getByTestId('leadership-dashboard')).toBeInTheDocument();
});
