/**
 * F19 — the shared staff KPI dashboard, reached by any role holding
 * `dashboard.view` other than `applicant`/`leadership` (`DashboardPage.tsx`'s
 * own branch). Rendered here directly, the way `LeadershipDashboardPage
 * .test.tsx` renders its own page, rather than through `DashboardPage` —
 * that routing decision is `DashboardPage.test.tsx`'s job.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { StaffDashboardPage } from './StaffDashboardPage';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';
import { stubAuthActions } from '../../auth/testAuthActions';
import { DICTIONARIES, I18nContext } from '../../i18n/context';
import type { KpiOut } from './queries';

function authValue(permissions: string[] = ['dashboard.view'], isSuperuser = false): AuthContextValue {
  return {
    me: {
      user: {
        id: 'u0000000-0000-4000-8000-000000000002',
        full_name: 'Karimova Nodira',
        login: 'karimova',
        phone: null,
        email: null,
        must_change_password: false,
        language: 'uz_latn',
      },
      role: { code: 'executor_staff', name: {} },
      permissions,
      zone: { region_id: null, district_id: null, organization_id: 'org-1' },
      csrf_token: 'tok-2',
      is_superuser: isSuperuser,
      applicant: null,
      representations: [],
      registration_complete: true,
    },
    loading: false,
    authError: null,
    ...stubAuthActions(),
  };
}

function kpiFixture(overrides: Partial<KpiOut> = {}): KpiOut {
  return {
    period: { period_from: '2026-09-01', period_to: '2026-09-05' },
    permits: { issued_count: 3, active_count: 2, previous_issued_count: null },
    applications: { total_count: 7, by_status: {}, previous_total_count: null },
    occupancy: { contour_count: 4, avg_occupied_pct: '18.00' },
    sb_load_total: '40.00',
    payments: {
      invoiced_amount: '660000.00',
      paid_amount: '330000.00',
      budget_share_amount: '165000.00',
      recipient_share_amount: '165000.00',
    },
    sla: { active_count: 3, overdue_count: 0 },
    rejections: [],
    risk_indicators: { by_code: {}, by_level: {} },
    inspections: { inspections_count: 0, violations_count: 0 },
    satisfaction: { avg_score: null, count: 0 },
    omitted: [],
    ...overrides,
  };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function mockBackend(kpi: Partial<KpiOut> = {}) {
  server.use(
    http.get('*/api/v1/dashboard/kpi', () => HttpResponse.json(kpiFixture(kpi))),
    http.get('*/api/v1/refs/regions', () => HttpResponse.json([])),
    http.get('*/api/v1/refs/activity-types', () => HttpResponse.json([])),
    http.get('*/api/v1/refs/classifiers/:code/items', () => HttpResponse.json([])),
  );
}

function renderDashboard(
  lang: 'uz_latn' | 'uz_cyrl' | 'ru' | 'en' | 'kaa' = 'uz_latn',
  permissions: string[] = ['dashboard.view'],
  isSuperuser = false,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const i18n = {
    lang,
    backendLang: lang,
    t: (key: string) => (DICTIONARIES[lang] as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>
          <AuthContext.Provider value={authValue(permissions, isSuperuser)}>
            <StaffDashboardPage />
          </AuthContext.Provider>
        </I18nContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

test('a role without dashboard.view (and not a superuser) sees an honest notice, never a query the backend would refuse', () => {
  renderDashboard('uz_latn', []);

  expect(screen.getByTestId('dashboard-no-access')).toBeInTheDocument();
  expect(screen.queryByTestId('tile-permits')).not.toBeInTheDocument();
});

test('a superuser with no dashboard.view literally listed still reaches the dashboard', async () => {
  mockBackend();
  renderDashboard('uz_latn', [], true);

  expect(await screen.findByTestId('tile-permits')).toBeInTheDocument();
});

test('the tiles carry this role\'s own zone-scoped figures, including the inspections tile', async () => {
  mockBackend({
    permits: { issued_count: 3, active_count: 2, previous_issued_count: null },
    sla: { active_count: 3, overdue_count: 1 },
    inspections: { inspections_count: 5, violations_count: 2 },
  });
  renderDashboard();

  expect(await screen.findByTestId('tile-permits')).toHaveTextContent('3');
  expect(screen.getByTestId('tile-sla')).toHaveTextContent('1');
  const inspectionsTile = screen.getByTestId('tile-inspections');
  expect(inspectionsTile).toHaveTextContent('5');
  expect(inspectionsTile).toHaveTextContent('2');
});

test('occupancy with zero contours in scope reads as "—", never a measured 0%', async () => {
  mockBackend({ occupancy: { contour_count: 0, avg_occupied_pct: null } });
  renderDashboard();

  expect(await screen.findByTestId('occupancy-value')).toHaveTextContent('—');
});

test('this screen has no territory drill-down — that stays leadership-only', async () => {
  mockBackend();
  renderDashboard();

  await screen.findByTestId('tile-permits');
  expect(screen.queryByTestId(/territory-cell-/)).not.toBeInTheDocument();
  expect(screen.queryByText('leadership.dash.territory.title')).not.toBeInTheDocument();
});

test('a caller with oversight.view sees the "open the full register" link on the risk indicators card', async () => {
  mockBackend({ risk_indicators: { by_code: { 'RI-04': 10 }, by_level: { medium: 10 } } });
  renderDashboard('uz_latn', ['dashboard.view', 'oversight.view']);

  const link = await screen.findByRole('link', { name: /Toʻliq reyestrni ochish/ });
  expect(link).toHaveAttribute('href', '/oversight');
});

test('a caller without oversight.view never sees the register link — the backend would refuse the page', async () => {
  mockBackend({ risk_indicators: { by_code: { 'RI-04': 10 }, by_level: { medium: 10 } } });
  renderDashboard('uz_latn', ['dashboard.view']);

  await screen.findByTestId('tile-permits');
  expect(screen.queryByRole('link', { name: /Toʻliq reyestrni ochish/ })).not.toBeInTheDocument();
});

test('a recognized omitted entry renders its localized sentence, never the raw backend string', async () => {
  mockBackend({ omitted: ['inspections_count: the 4.1 inspections module is not merged into dev yet'] });
  renderDashboard();

  expect(await screen.findByTestId('omitted-notice')).toBeInTheDocument();
  expect(screen.queryByText(/4\.1 inspections module/)).not.toBeInTheDocument();
});

test('changing the period via the UI and clicking Apply asks the backend for the new dates', async () => {
  const requestedPeriods: string[] = [];
  mockBackend();
  server.use(
    http.get('*/api/v1/dashboard/kpi', ({ request }) => {
      const url = new URL(request.url);
      requestedPeriods.push(`${url.searchParams.get('period_from')}..${url.searchParams.get('period_to')}`);
      return HttpResponse.json(kpiFixture());
    }),
  );
  const user = userEvent.setup();
  renderDashboard();
  await screen.findByTestId('tile-permits');

  const filters = screen.getByTestId('kpi-filters');
  const fromInput = filters.querySelector('input[type="date"]')!;
  fireEvent.change(fromInput, { target: { value: '2026-01-01' } });
  await user.click(screen.getByText('Qoʻllash'));

  await waitFor(() => expect(requestedPeriods.some((p) => p.startsWith('2026-01-01'))).toBe(true));
});

// Test all five languages (uz_latn, uz_cyrl, ru, en, kaa) to ensure no untranslated keys leak.
test.each(['uz_latn', 'uz_cyrl', 'ru', 'en', 'kaa'] as const)(
  'no untranslated leadership.*/dashboard.* key reaches the screen in %s',
  async (lang) => {
    mockBackend({
      omitted: ['inspections_count: not merged yet', 'violations_count: not merged yet'],
      rejections: [{ reason_item_id: 'x0000000-0000-4000-8000-000000000009', count: 3 }],
      risk_indicators: { by_code: { 'RI-01': 2 }, by_level: { low: 1, medium: 2, high: 3, critical: 1 } },
      inspections: { inspections_count: 5, violations_count: 2 },
    });

    renderDashboard(lang, ['dashboard.view', 'oversight.view']);
    await screen.findByTestId('tile-permits');

    expect(document.body.textContent).not.toMatch(/leadership\.[a-zA-Z.]+/);
    expect(document.body.textContent).not.toMatch(/dashboard\.[a-zA-Z.]+/);
  },
);

test('the filter bar and action buttons have mobile-friendly responsive layout classes', async () => {
  mockBackend();
  renderDashboard();
  await screen.findByTestId('tile-permits');

  const filters = screen.getByTestId('kpi-filters');
  // Filter grid has mobile-friendly responsive breakpoints
  const filterGrid = filters.querySelector('.grid');
  expect(filterGrid).toHaveClass('grid-cols-1');
  expect(filterGrid).toHaveClass('sm:grid-cols-2');
  expect(filterGrid).toHaveClass('lg:grid-cols-4');
  expect(filterGrid).toHaveClass('xl:grid-cols-7');

  // Action buttons container has responsive flex direction and full width touch targets on mobile
  const applyBtn = screen.getByRole('button', { name: /Qoʻllash/ });
  const buttonsContainer = applyBtn.parentElement;
  expect(buttonsContainer).toHaveClass('flex-col');
  expect(buttonsContainer).toHaveClass('sm:flex-row');
  expect(buttonsContainer).toHaveClass('justify-end');
  expect(applyBtn).toHaveClass('w-full');
  expect(applyBtn).toHaveClass('sm:w-auto');
});

test('tiles grid has mobile-friendly gap-3 sm:gap-4 responsive classes', async () => {
  mockBackend();
  renderDashboard();
  const permitsTile = await screen.findByTestId('tile-permits');
  const tilesGrid = permitsTile.parentElement;
  expect(tilesGrid).toHaveClass('grid-cols-1');
  expect(tilesGrid).toHaveClass('sm:grid-cols-2');
  expect(tilesGrid).toHaveClass('xl:grid-cols-4');
  expect(tilesGrid).toHaveClass('gap-3');
  expect(tilesGrid).toHaveClass('sm:gap-4');
});
