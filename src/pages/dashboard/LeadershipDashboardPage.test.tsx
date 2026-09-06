import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { LeadershipDashboardPage } from './LeadershipDashboardPage';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';
import { stubAuthActions } from '../../auth/testAuthActions';
import { DICTIONARIES, I18nContext } from '../../i18n/context';
import type { KpiOut, TerritorySliceOut } from './queries';

function authValue(permissions: string[] = ['dashboard.view']): AuthContextValue {
  return {
    me: {
      user: {
        id: 'u0000000-0000-4000-8000-000000000001',
        full_name: 'Rahimov Sardor',
        login: 'rahimov',
        phone: null,
        email: null,
        must_change_password: false,
        language: 'uz_latn',
      },
      role: { code: 'leadership', name: {} },
      permissions,
      zone: { region_id: null, district_id: null, organization_id: null },
      csrf_token: 'tok-1',
      is_superuser: false,
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
    permits: { issued_count: 12, active_count: 9, previous_issued_count: null },
    applications: { total_count: 30, by_status: {}, previous_total_count: null },
    occupancy: { contour_count: 5, avg_occupied_pct: '42.50' },
    sb_load_total: '120.00',
    payments: {
      invoiced_amount: '5000000.00',
      paid_amount: '2000000.00',
      budget_share_amount: '1000000.00',
      recipient_share_amount: '1000000.00',
    },
    sla: { active_count: 8, overdue_count: 2 },
    rejections: [],
    risk_indicators: { by_code: {}, by_level: {} },
    omitted: [],
    ...overrides,
  };
}

function territoryFixture(overrides: Partial<TerritorySliceOut> = {}): TerritorySliceOut {
  return {
    level: 'region',
    k_anonymity_threshold: 5,
    cells: [
      {
        level: 'region',
        key: 'r0000000-0000-4000-8000-000000000001',
        label: 'Toshkent viloyati',
        applications_count: 10,
        permits_count: 8,
        applicant_count: 6,
        suppressed: false,
      },
    ],
    ...overrides,
  };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function mockBackend(options: { kpi?: Partial<KpiOut>; territory?: Partial<TerritorySliceOut> } = {}) {
  server.use(
    http.get('*/api/v1/dashboard/kpi', () => HttpResponse.json(kpiFixture(options.kpi))),
    http.get('*/api/v1/dashboard/territory-slice', () => HttpResponse.json(territoryFixture(options.territory))),
    http.get('*/api/v1/refs/regions', () => HttpResponse.json([])),
    http.get('*/api/v1/refs/activity-types', () => HttpResponse.json([])),
    http.get('*/api/v1/refs/classifiers/:code/items', () => HttpResponse.json([])),
  );
}

function renderDashboard(lang: 'uz_latn' | 'ru' = 'uz_latn', permissions: string[] = ['dashboard.view']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const i18n = {
    lang,
    backendLang: lang,
    // The real dictionary, and the real fallback — a key missing from either
    // map renders as the key itself, which the last-resort check below would
    // catch (mirrors `ApplicantDashboardPage.test.tsx`'s own convention).
    t: (key: string) => (DICTIONARIES[lang] as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>
          <AuthContext.Provider value={authValue(permissions)}>
            <LeadershipDashboardPage />
          </AuthContext.Provider>
        </I18nContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

test('the tiles carry the figures the backend actually computed', async () => {
  mockBackend();
  renderDashboard();

  expect(await screen.findByTestId('tile-permits')).toHaveTextContent('12');
  expect(screen.getByTestId('tile-permits')).toHaveTextContent('9');
  expect(screen.getByTestId('tile-applications')).toHaveTextContent('30');
  expect(screen.getByTestId('occupancy-value')).toHaveTextContent('42.5%');
  expect(screen.getByTestId('tile-sla')).toHaveTextContent('8');
  expect(screen.getByTestId('tile-sla')).toHaveTextContent('2');
});

test('a recognized omitted entry renders its localized sentence, never the raw backend string', async () => {
  mockBackend({
    kpi: { omitted: ['inspections_count: the 4.1 inspections module is not merged into dev yet'] },
  });
  renderDashboard();

  const notice = await screen.findByTestId('omitted-notice');
  expect(notice).toHaveTextContent('Tekshiruvlar koʻrsatkichi mavjud emas');
  expect(notice).not.toHaveTextContent('inspections_count');
});

test('an empty omitted list renders no notice card at all', async () => {
  mockBackend({ kpi: { omitted: [] } });
  renderDashboard();

  await screen.findByTestId('tile-permits');
  expect(screen.queryByTestId('omitted-notice')).not.toBeInTheDocument();
});

test('zero contours in scope reads as "—", never as a measured 0%', async () => {
  mockBackend({ kpi: { occupancy: { contour_count: 0, avg_occupied_pct: null } } });
  renderDashboard();

  const occupancy = await screen.findByTestId('occupancy-value');
  expect(occupancy).toHaveTextContent('—');
  expect(occupancy).not.toHaveTextContent('0%');
});

test('a suppressed territory cell hides its counts behind the threshold text, never a bare 0', async () => {
  mockBackend({
    territory: {
      cells: [
        {
          level: 'region',
          key: 'r2000000-0000-4000-8000-000000000002',
          label: 'Kichik viloyat',
          applications_count: null,
          permits_count: null,
          applicant_count: null,
          suppressed: true,
        },
      ],
    },
  });
  renderDashboard();

  const cell = await screen.findByTestId('territory-cell-r2000000-0000-4000-8000-000000000002');
  expect(cell).toHaveTextContent('yashirin');
  expect(cell).toHaveTextContent('< 5');
  expect(cell.querySelector('button')).toBeNull();
});

test('a caller with oversight.view sees the "open the full register" link on the risk indicators card', async () => {
  mockBackend({ kpi: { risk_indicators: { by_code: { 'RI-01': 2 }, by_level: { low: 1 } } } });
  renderDashboard('uz_latn', ['dashboard.view', 'oversight.view']);

  const link = await screen.findByRole('link', { name: /Toʻliq reyestrni ochish/ });
  expect(link).toHaveAttribute('href', '/oversight');
});

test('a caller without oversight.view never sees the register link — the backend would refuse the page', async () => {
  mockBackend({ kpi: { risk_indicators: { by_code: { 'RI-01': 2 }, by_level: { low: 1 } } } });
  renderDashboard('uz_latn', ['dashboard.view']);

  await screen.findByTestId('tile-permits');
  expect(screen.queryByRole('link', { name: /Toʻliq reyestrni ochish/ })).not.toBeInTheDocument();
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

  renderDashboard();
  await screen.findByTestId('tile-permits');

  const filters = screen.getByTestId('kpi-filters');
  const dateInputs = filters.querySelectorAll('input[type="date"]');
  expect(dateInputs).toHaveLength(2);
  const periodToInput = dateInputs[1];

  fireEvent.change(periodToInput, { target: { value: '2026-09-20' } });
  const user = userEvent.setup();
  await user.click(screen.getByText('Qoʻllash'));

  await waitFor(() => expect(requestedPeriods.some((p) => p.endsWith('..2026-09-20'))).toBe(true));
});

// Compile-time parity (`Record<TranslationKey, string>` in `i18n/context.ts`)
// guarantees the two dictionaries hold the SAME keys — it cannot know whether
// this screen asks for a key that exists in neither, which `t` renders as the
// bare key and a reader sees in the middle of the page.
test.each(['uz_latn', 'ru'] as const)('no untranslated leadership.* key reaches the screen in %s', async (lang) => {
  mockBackend({
    kpi: {
      omitted: ['inspections_count: not merged yet'],
      rejections: [{ reason_item_id: 'x0000000-0000-4000-8000-000000000009', count: 3 }],
      risk_indicators: { by_code: { 'RI-01': 2 }, by_level: { low: 1, critical: 1 } },
    },
    territory: {
      cells: [
        {
          level: 'region',
          key: 'r3',
          label: 'Region',
          applications_count: null,
          permits_count: null,
          applicant_count: null,
          suppressed: true,
        },
      ],
    },
  });

  renderDashboard(lang);
  await screen.findByTestId('tile-permits');

  expect(document.body.textContent).not.toMatch(/leadership\.[a-zA-Z.]+/);
});
