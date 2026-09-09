import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ChiefForesterDashboardPage } from './ChiefForesterDashboardPage';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';
import { stubAuthActions } from '../../auth/testAuthActions';
import { DICTIONARIES, I18nContext, type UiLanguage } from '../../i18n/context';
import type { KpiOut } from './queries';

function authValue(options: {
  permissions?: string[];
  isSuperuser?: boolean;
  fullName?: string;
  orgId?: string | null;
} = {}): AuthContextValue {
  return {
    me: {
      user: {
        id: 'u0000000-0000-4000-8000-000000000099',
        full_name: options.fullName ?? 'Demo Chief Forester (Burchmulla DOX)',
        login: 'chief_forester_burchmulla',
        phone: '+998901234567',
        email: 'chief@burchmulla.uz',
        must_change_password: false,
        language: 'uz_latn',
      },
      role: {
        code: 'chief_forester',
        name: {
          uz_latn: "Bosh o'rmonbegi",
          uz_cyrl: 'Бош ўрмонбеги',
          ru: 'Главный лесничий',
          en: 'Chief Forester',
          kaa: 'Bas tokaýshı',
        },
      },
      permissions: options.permissions ?? ['gis.contours.approve', 'permits.sign'],
      zone: {
        region_id: 'reg-tashkent',
        district_id: 'dist-bostanlyk',
        organization_id: options.orgId ?? 'org-burchmulla',
      },
      csrf_token: 'tok-cf',
      is_superuser: options.isSuperuser ?? false,
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
    period: { period_from: '2026-09-01', period_to: '2026-09-30' },
    permits: { issued_count: 14, active_count: 8, previous_issued_count: 10 },
    applications: { total_count: 22, by_status: { SUBMITTED: 5, APPROVED: 12 }, previous_total_count: 18 },
    occupancy: { contour_count: 42, avg_occupied_pct: '64.50' },
    sb_load_total: '120.50',
    payments: {
      invoiced_amount: '15000000.00',
      paid_amount: '12000000.00',
      budget_share_amount: '6000000.00',
      recipient_share_amount: '6000000.00',
    },
    sla: { active_count: 6, overdue_count: 1 },
    rejections: [],
    risk_indicators: { by_code: {}, by_level: {} },
    inspections: { inspections_count: 5, violations_count: 2 },
    omitted: [],
    ...overrides,
  };
}

const ORG_FIXTURE = [
  {
    id: 'org-burchmulla',
    code: 'burchmulla_ox',
    name: {
      uz_latn: 'Burchmulla davlat oʻrmon xoʻjaligi',
      uz_cyrl: 'Бурчмулла давлат ўрмон хўжалиги',
      ru: 'Бурчмуллинское государственное лесное хозяйство',
      en: 'Burchmulla state forestry enterprise',
      kaa: 'Burchmulla mámleketlik tokaý xojalıǵı',
    },
    parent_id: null,
  },
];

const LAYERS_FIXTURE = [
  { id: 'layer-contours', code: 'contours', name: { uz_latn: 'Konturlar', ru: 'Контуры' } },
  { id: 'layer-fire', code: 'fire_risk', name: { uz_latn: 'Yongʻin xavfi', ru: 'Пожароопасность' } },
];

const CONTOURS_FIXTURE = {
  items: [
    {
      id: 'contour-101',
      number: 'B-101',
      organization_id: 'org-burchmulla',
      area_ha: '150.0000',
      s_available_ha: '45.0000',
    },
    {
      id: 'contour-102',
      number: 'B-102',
      organization_id: 'org-burchmulla',
      area_ha: '80.0000',
      s_available_ha: '0.0000',
    },
    {
      id: 'contour-103',
      number: 'B-103',
      organization_id: 'org-burchmulla',
      area_ha: '200.0000',
      s_available_ha: '200.0000',
    },
  ],
  total: 3,
};

const IMPORTS_FIXTURE = {
  items: [
    {
      id: 'imp-01',
      layer_id: 'layer-contours',
      organization_id: 'org-burchmulla',
      file_id: 'f-1',
      approval_doc_id: 'd-1',
      format: 'geojson',
      status: 'review',
      attribute_map: {},
      stats: null,
      error_report: null,
      created_at: '2026-09-08T14:30:00+05:00',
      finished_at: null,
    },
    {
      id: 'imp-02',
      layer_id: 'layer-fire',
      organization_id: 'org-burchmulla',
      file_id: 'f-2',
      approval_doc_id: 'd-2',
      format: 'shp',
      status: 'review',
      attribute_map: {},
      stats: null,
      error_report: null,
      created_at: '2026-09-07T11:20:00+05:00',
      finished_at: null,
    },
  ],
  total: 2,
};

const PERMITS_FIXTURE = {
  items: [
    {
      id: 'permit-p1',
      series: 'A',
      number: 1045,
      status: 'pending_signatures' as const,
      area_ha: '25.5000',
      period_from: '2026-04-01',
      period_to: '2026-11-01',
      organization_id: 'org-burchmulla',
      created_at: '2026-09-05T09:00:00+05:00',
    },
    {
      id: 'permit-p2',
      series: 'A',
      number: 1046,
      status: 'pending_signatures' as const,
      area_ha: '12.0000',
      period_from: '2026-05-01',
      period_to: '2026-10-15',
      organization_id: 'org-burchmulla',
      created_at: '2026-09-06T10:00:00+05:00',
    },
  ],
  total: 2,
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());

function mockBackend(options: {
  kpi?: Partial<KpiOut>;
  imports?: typeof IMPORTS_FIXTURE;
  permits?: typeof PERMITS_FIXTURE;
  contours?: typeof CONTOURS_FIXTURE;
} = {}) {
  server.use(
    http.get('*/api/v1/dashboard/kpi', () => HttpResponse.json(kpiFixture(options.kpi))),
    http.get('*/api/v1/refs/organizations', () => HttpResponse.json({ items: ORG_FIXTURE, total: 1 })),
    http.get('*/api/v1/gis/layers', () => HttpResponse.json({ items: LAYERS_FIXTURE, total: 2 })),
    http.get('*/api/v1/gis/contours', () => HttpResponse.json(options.contours ?? CONTOURS_FIXTURE)),
    http.get('*/api/v1/gis/imports', () => HttpResponse.json(options.imports ?? IMPORTS_FIXTURE)),
    http.get('*/api/v1/permits', () => HttpResponse.json(options.permits ?? PERMITS_FIXTURE)),
  );
}

function renderDashboard(
  lang: UiLanguage = 'uz_latn',
  authOpts: Parameters<typeof authValue>[0] = { permissions: ['dashboard.view', 'gis.contours.approve', 'permits.sign'] },
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
          <AuthContext.Provider value={authValue(authOpts)}>
            <ChiefForesterDashboardPage />
          </AuthContext.Provider>
        </I18nContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

test('renders Chief Forester dashboard with header, organization pill, and role badge', async () => {
  mockBackend();
  renderDashboard('uz_latn');

  expect(await screen.findByTestId('chief-forester-dashboard')).toBeInTheDocument();
  expect(screen.getByText("Bosh oʻrmonbegi boshqaruv paneli")).toBeInTheDocument();
  expect((await screen.findAllByText(/Burchmulla/)).length).toBeGreaterThan(0);
});

test('renders all 6 headline KPI tiles with values and hints', async () => {
  mockBackend();
  renderDashboard('uz_latn');

  await waitFor(() => {
    expect(screen.getByTestId('tile-contours')).toHaveTextContent('42');
    expect(screen.getByTestId('tile-occupancy')).toHaveTextContent('64.5%');
    expect(screen.getByTestId('tile-sb-load')).toHaveTextContent('120.50');
    expect(screen.getByTestId('tile-permits')).toHaveTextContent('8');
    expect(screen.getByTestId('tile-applications')).toHaveTextContent('22');
    expect(screen.getByTestId('tile-inspections')).toHaveTextContent('5');
  });
});

test('renders pending GIS imports awaiting approval with review link and localized status', async () => {
  mockBackend();
  renderDashboard('uz_latn');

  const card = await screen.findByTestId('gis-imports-card');
  expect(card).toBeInTheDocument();
  expect(await screen.findByText('Konturlar')).toBeInTheDocument();
  expect(screen.getAllByText('Koʻrib chiqish').length).toBeGreaterThan(0);
});

test('renders permits awaiting Chief Forester signature with sign action and localized status', async () => {
  mockBackend();
  renderDashboard('uz_latn');

  const card = await screen.findByTestId('permits-to-sign-card');
  expect(card).toBeInTheDocument();
  expect(await screen.findByText('A-001045')).toBeInTheDocument();
  expect(screen.getByText('A-001046')).toBeInTheDocument();
  expect(screen.getAllByText('Imzolash').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Imzolar kutilmoqda').length).toBeGreaterThan(0);
});

test('renders empty states when there are no pending versions, imports or permits', async () => {
  mockBackend({
    imports: { items: [], total: 0 },
    permits: { items: [], total: 0 },
  });
  renderDashboard('uz_latn');

  expect(await screen.findByText('Tasdiqlash uchun navbatda turgan kontur versiyalari mavjud emas.')).toBeInTheDocument();
  expect(await screen.findByText('Tasdiqlash uchun navbatda turgan GIS import paketlari yoʻq.')).toBeInTheDocument();
  expect(await screen.findByText('Imzolanishi kutilayotgan ruxsatnomalar mavjud emas.')).toBeInTheDocument();
});

test('renders recalled GIS contour versions in review status from localVersions', async () => {
  localStorage.setItem(
    'gis.contour-versions.v1.contour-101',
    JSON.stringify({
      'v-101': {
        version: {
          id: 'v-101',
          contour_id: 'contour-101',
          version_no: 3,
          status: 'review',
          source: 'draw',
          area_ha: '45.5000',
          declared_area_ha: null,
          accuracy_m: null,
          survey_date: '2026-09-02',
          effective_from: null,
          approval_doc_id: null,
          approved_by: null,
          published_at: null,
        },
        geometry: { type: 'Polygon', coordinates: [] },
      },
    }),
  );
  mockBackend();
  renderDashboard('uz_latn');

  const card = await screen.findByTestId('gis-versions-card');
  expect(card).toBeInTheDocument();
  expect(screen.getByText(/№ 3/)).toBeInTheDocument();
  expect(screen.getByText(/45.5 ga/)).toBeInTheDocument();
});

test('renders territory & zone overview card with computed hectares and breakdown chips', async () => {
  mockBackend();
  renderDashboard('uz_latn');

  const card = await screen.findByTestId('zone-overview-card');
  expect(card).toBeInTheDocument();
  expect(screen.getByText('Oʻrmon xoʻjaligi hududi va resurslar monitoringi')).toBeInTheDocument();
  // 150 + 80 + 200 = 430.0 ga
  expect(await screen.findByText('430.0 ga')).toBeInTheDocument();
});

test('renders forestry contours monitoring table with rows and statuses', async () => {
  mockBackend();
  renderDashboard('uz_latn');

  const card = await screen.findByTestId('contours-monitoring-card');
  expect(card).toBeInTheDocument();
  expect(await screen.findByText('B-101')).toBeInTheDocument();
  expect(screen.getByText('B-102')).toBeInTheDocument();
  expect(screen.getByText('B-103')).toBeInTheDocument();
  expect(screen.getByText('150.0 ga')).toBeInTheDocument();
  expect(screen.getByText('Band')).toBeInTheDocument();
  expect(screen.getByText('Qisman band')).toBeInTheDocument();
  expect(screen.getByText('Boʻsh')).toBeInTheDocument();
});

test('renders properly localized contour status badges in Russian', async () => {
  mockBackend();
  renderDashboard('ru');

  const card = await screen.findByTestId('contours-monitoring-card');
  expect(card).toBeInTheDocument();
  expect(await screen.findByText('B-101')).toBeInTheDocument();
  expect(screen.getByText('Занят')).toBeInTheDocument();
  expect(screen.getByText('Частично')).toBeInTheDocument();
  expect(screen.getByText('Свободен')).toBeInTheDocument();
});

test('renders quick navigation links to GIS, permits, and applications', async () => {
  mockBackend();
  renderDashboard('uz_latn');

  const card = await screen.findByTestId('quick-links-card');
  expect(card).toBeInTheDocument();
  expect(screen.getByText('GIS xaritasi va qatlamlar')).toBeInTheDocument();
  expect(screen.getByText('Oʻrmon ruxsatnomalari')).toBeInTheDocument();
  expect(screen.getByText('Foydalanish arizalari')).toBeInTheDocument();
  expect(screen.getByText('Geomaʼlumotlar importi')).toBeInTheDocument();
});

test('submitting period filter form applies updated date range', async () => {
  mockBackend();
  renderDashboard('uz_latn');

  const fromInput = await screen.findByTestId('filter-period-from');
  const toInput = screen.getByTestId('filter-period-to');
  const applyBtn = screen.getByTestId('filter-apply-btn');

  fireEvent.change(fromInput, { target: { value: '2026-08-01' } });
  fireEvent.change(toInput, { target: { value: '2026-08-31' } });
  fireEvent.click(applyBtn);

  expect(fromInput).toHaveValue('2026-08-01');
  expect(toInput).toHaveValue('2026-08-31');
});

test('works smoothly without dashboard.view permission by falling back gracefully', async () => {
  // Only gis.contours.approve and permits.sign (no dashboard.view)
  mockBackend();
  renderDashboard('uz_latn', {
    permissions: ['gis.contours.approve', 'permits.sign'],
    isSuperuser: false,
  });

  expect(await screen.findByTestId('chief-forester-dashboard')).toBeInTheDocument();
  // Contours tile will show count from contoursQuery (3)
  expect(await screen.findByTestId('tile-contours')).toHaveTextContent('3');
  // Permits tile will show count from permitsQuery (2)
  expect(screen.getByTestId('tile-permits')).toHaveTextContent('2');
  // Contours table is rendered
  expect(screen.getByText('B-101')).toBeInTheDocument();
});

test.each(['uz_latn', 'uz_cyrl', 'ru', 'en', 'kaa'] as const)(
  'renders without translation gaps in language %s',
  async (lang) => {
    mockBackend();
    renderDashboard(lang);

    expect(await screen.findByTestId('chief-forester-dashboard')).toBeInTheDocument();
    // Verify title translation matches dictionary key
    const expectedTitle = DICTIONARIES[lang]['chiefForester.dash.title'];
    expect(screen.getByText(expectedTitle)).toBeInTheDocument();
  },
);
