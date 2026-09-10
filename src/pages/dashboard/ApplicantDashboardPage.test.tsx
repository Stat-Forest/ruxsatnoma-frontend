import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ApplicantDashboardPage } from './ApplicantDashboardPage';
import { DICTIONARIES, I18nContext } from '../../i18n/context';
import { application, invoice, permit } from './fixtures';

// recharts draws into a `ResponsiveContainer`, which measures a real DOM box —
// in jsdom every box is 0x0, so the SVG would render empty and the container
// would warn about it on every test. The charts themselves are recharts'
// behaviour, not this screen's: what this screen is responsible for is the
// numbers, and every number under test below is rendered as ordinary text
// (a tile, a legend row, a card) outside the chart's SVG.
vi.mock('recharts', () => {
  const passthrough = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const empty = () => null;
  return {
    ResponsiveContainer: passthrough,
    AreaChart: passthrough,
    BarChart: passthrough,
    PieChart: passthrough,
    Area: empty,
    Bar: empty,
    Pie: empty,
    Cell: empty,
    XAxis: empty,
    YAxis: empty,
    CartesianGrid: empty,
    Tooltip: empty,
    Legend: empty,
  };
});

const ACTIVITY_GRAZING = 'a0000000-0000-4000-8000-000000000001';
const ACTIVITY_HAYMAKING = 'a0000000-0000-4000-8000-000000000002';
const CONTOUR_ONE = 'c0000000-0000-4000-8000-000000000001';
const CONTOUR_TWO = 'c0000000-0000-4000-8000-000000000002';

const ACTIVITY_TYPES = [
  { id: ACTIVITY_GRAZING, code: 'grazing', name: { uz_latn: 'Chorva molini boqish' } },
  { id: ACTIVITY_HAYMAKING, code: 'haymaking', name: { uz_latn: "Pichan o'rish" } },
];

const CONTOUR_NUMBERS: Record<string, string> = {
  [CONTOUR_ONE]: 'Zangiota 14-kv',
  [CONTOUR_TWO]: 'Ohangaron 22-kv',
};

function page<T>(items: T[]) {
  return { items, total: items.length, page: 1, page_size: 100 };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-05T12:00:00Z') });
});
afterEach(() => vi.useRealTimers());

function mockBackend(options: {
  applications?: unknown[];
  permits?: unknown[];
  invoices?: unknown[];
}) {
  server.use(
    http.get('*/api/v1/applications', () => HttpResponse.json(page(options.applications ?? []))),
    http.get('*/api/v1/permits', () => HttpResponse.json(page(options.permits ?? []))),
    http.get('*/api/v1/invoices', () => HttpResponse.json(page(options.invoices ?? []))),
    http.get('*/api/v1/refs/activity-types', () => HttpResponse.json(ACTIVITY_TYPES)),
    http.get('*/api/v1/gis/contours/:contourId', ({ params }) =>
      HttpResponse.json({ id: params.contourId, number: CONTOUR_NUMBERS[params.contourId as string] ?? '—' }),
    ),
  );
}

function renderDashboard(lang: 'uz_latn' | 'ru' = 'uz_latn') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const i18n = {
    lang,
    backendLang: lang,
    // The real dictionary, and the real fallback: `I18nProvider` renders a key
    // it cannot find as the key itself, which is what the last test looks for.
    t: (key: string) => (DICTIONARIES[lang] as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>
          <ApplicantDashboardPage />
        </I18nContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

test('the tiles carry the figures computed from the citizen own documents', async () => {
  mockBackend({
    permits: [
      permit({ status: 'active', area_ha: '42.6000', amount: '2680000.00', period_to: '2026-11-26' }),
      permit({ status: 'active', area_ha: '18.4000', amount: '1000000.00', period_to: '2026-09-26' }),
    ],
    applications: [
      application({ status: 'SUBMITTED' }),
      application({ status: 'IN_REVIEW' }),
      application({ status: 'INVOICED' }),
    ],
    invoices: [invoice({ paid_at: '2026-04-12T10:00:00+05:00' })],
  });

  renderDashboard();

  expect(await screen.findByTestId('tile-active-permits')).toHaveTextContent('2 ta ruxsatnoma');
  expect(screen.getByTestId('tile-active-permits')).toHaveTextContent('61.0 ga');
  expect(screen.getByTestId('tile-applications')).toHaveTextContent('3 ta ariza');
  expect(screen.getByTestId('tile-applications')).toHaveTextContent("1 ta to'lov kutilmoqda");
  expect(screen.getByTestId('tile-payments')).toHaveTextContent('3.68 mln UZS');
});

test('the invoices come from ONE own-list call, not one call per application', async () => {
  const urls: string[] = [];
  mockBackend({
    applications: [application({ status: 'INVOICED' }), application({ status: 'EXPIRED_UNPAID' }), application({ status: 'PAID' })],
    invoices: [invoice({ paid_at: null })],
  });
  server.use(
    http.get('*/api/v1/invoices', ({ request }) => {
      urls.push(request.url);
      return HttpResponse.json(page([invoice({ paid_at: null })]));
    }),
  );
  renderDashboard();

  await screen.findByTestId('tile-active-permits');
  expect(urls).toHaveLength(1);
  expect(new URL(urls[0]).searchParams.get('application_id')).toBeNull();
});

test('the fourth tile counts down to the soonest expiry, not to a field inspection', async () => {
  mockBackend({
    permits: [
      permit({ status: 'active', period_to: '2026-11-26' }),
      permit({ status: 'active', period_to: '2026-09-26' }),
    ],
  });

  renderDashboard();

  expect(await screen.findByTestId('tile-expiry')).toHaveTextContent('21 kun');
});

test('the donut legend names each activity rather than showing its id', async () => {
  mockBackend({
    permits: [
      permit({ status: 'active', activity_type_id: ACTIVITY_GRAZING, area_ha: '42.6000' }),
      permit({ status: 'active', activity_type_id: ACTIVITY_HAYMAKING, area_ha: '18.4000' }),
    ],
  });

  renderDashboard();

  const legend = await screen.findByTestId('area-legend');
  expect(legend).toHaveTextContent('Chorva molini boqish');
  expect(legend).toHaveTextContent('42.6 ga');
  expect(legend).toHaveTextContent('70%');
  expect(legend).not.toHaveTextContent(ACTIVITY_GRAZING);
});

test('each contour bar is labelled with the contour number the permit points at', async () => {
  mockBackend({
    permits: [
      permit({ status: 'active', contour_id: CONTOUR_ONE, area_ha: '42.6000', period_to: '2026-11-26' }),
      permit({ status: 'active', contour_id: CONTOUR_TWO, area_ha: '18.4000', period_to: '2026-09-26' }),
    ],
  });

  renderDashboard();

  const cards = await screen.findByTestId('contour-cards');
  expect(cards).toHaveTextContent('Zangiota 14-kv');
  expect(cards).toHaveTextContent('42.6 ga');
  expect(cards).toHaveTextContent('82 kun qoldi');
});

test('a citizen with nothing yet is told so, not shown a wall of zeroes', async () => {
  mockBackend({});

  renderDashboard();

  expect(await screen.findByTestId('area-empty')).toBeInTheDocument();
  expect(screen.getByTestId('contours-empty')).toBeInTheDocument();
});

test('a failed load says so instead of reporting zeroes as facts', async () => {
  server.use(
    http.get('*/api/v1/applications', () => HttpResponse.json({ detail: 'boom' }, { status: 500 })),
    http.get('*/api/v1/permits', () => HttpResponse.json({ detail: 'boom' }, { status: 500 })),
    http.get('*/api/v1/invoices', () => HttpResponse.json(page([]))),
    http.get('*/api/v1/refs/activity-types', () => HttpResponse.json(ACTIVITY_TYPES)),
    http.get('*/api/v1/gis/contours/:contourId', ({ params }) =>
      HttpResponse.json({ id: params.contourId, number: CONTOUR_NUMBERS[params.contourId as string] ?? '—' }),
    ),
  );

  renderDashboard();

  expect(await screen.findByTestId('dashboard-error')).toBeInTheDocument();
  expect(screen.queryByTestId('tile-active-permits')).not.toBeInTheDocument();
});

// Compile-time parity (`Record<TranslationKey, string>` in `i18n/context.ts`)
// guarantees the two dictionaries hold the SAME keys — it cannot know whether
// this screen asks for a key that exists in neither, which `t` renders as the
// bare key and a reader sees as "dash.area.title" in the middle of the page.
test.each(['uz_latn', 'ru'] as const)('no untranslated key reaches the screen in %s', async (lang) => {
  mockBackend({
    permits: [permit({ status: 'active', activity_type_id: ACTIVITY_GRAZING, contour_id: CONTOUR_ONE })],
    applications: [application({ status: 'INVOICED' })],
    invoices: [invoice({ paid_at: null })],
  });

  renderDashboard(lang);
  await screen.findByTestId('tile-active-permits');

  expect(document.body.textContent).not.toMatch(/dash\.[a-z]/i);
});
