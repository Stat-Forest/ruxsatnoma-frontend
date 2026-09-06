import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { OversightPage } from './OversightPage';
import { DICTIONARIES, I18nContext } from '../../i18n/context';
import type { OversightEventOut, RiskIndicatorOut } from './queries';

const RISK_ROW_ID = 'ri000000-0000-4000-8000-000000000001';
const EVENT_ROW_ID = 'ev000000-0000-4000-8000-000000000001';

function page<T>(items: T[]) {
  return { items, total: items.length, page: 1, page_size: 20 };
}

function riskIndicatorFixture(overrides: Partial<RiskIndicatorOut> = {}): RiskIndicatorOut {
  return {
    id: RISK_ROW_ID,
    code: 'RI-07',
    level: 'medium',
    object_type: 'application',
    object_id: 'a1000000-0000-4000-8000-000000000001',
    responsible_user_id: null,
    description: 'SLA muddati buzilgan',
    details: null,
    occurred_at: '2026-09-01T10:00:00+05:00',
    status: 'new',
    rn_status: 'internal',
    ...overrides,
  };
}

function eventFixture(overrides: Partial<OversightEventOut> = {}): OversightEventOut {
  return {
    id: EVENT_ROW_ID,
    event_type: 'permit.issued',
    object_type: 'permit',
    object_id: 'p1000000-0000-4000-8000-000000000001',
    payload: { series: 'AA', number: '000123' },
    correlation_id: 'corr-1',
    occurred_at: '2026-09-01T11:00:00+05:00',
    rn_status: 'internal',
    ...overrides,
  };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function Providers({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const lang = 'uz_latn' as const;
  const i18n = {
    lang,
    backendLang: lang,
    t: (key: string) => (DICTIONARIES[lang] as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
  return (
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>{children}</I18nContext.Provider>
    </QueryClientProvider>
  );
}

test('the risk indicators tab renders rows from the backend, including a critical badge', async () => {
  server.use(
    http.get('*/api/v1/oversight/risk-indicators', () =>
      HttpResponse.json(page([riskIndicatorFixture({ code: 'RI-07', level: 'critical' })])),
    ),
  );

  render(
    <Providers>
      <OversightPage />
    </Providers>,
  );

  // `RI-07` is also an <option> in the code filter select, present before the
  // list ever loads — scope to the actual table row (its own testid) rather
  // than a raw `findByText`, which would resolve against the filter instead
  // of waiting for the backend response.
  const row = await screen.findByTestId(`risk-row-${RISK_ROW_ID}`);
  const badge = within(row).getByText('kritik');
  expect(badge.className).toContain('991B1B');
});

test('switching to the Events tab requests /oversight/events and renders its own rows, without re-requesting risk indicators', async () => {
  let riskCalls = 0;
  server.use(
    http.get('*/api/v1/oversight/risk-indicators', () => {
      riskCalls += 1;
      return HttpResponse.json(page([riskIndicatorFixture()]));
    }),
    http.get('*/api/v1/oversight/events', () =>
      HttpResponse.json(page([eventFixture({ event_type: 'permit.issued' })])),
    ),
  );

  render(
    <Providers>
      <OversightPage />
    </Providers>,
  );

  await screen.findByTestId(`risk-row-${RISK_ROW_ID}`);
  await waitFor(() => expect(riskCalls).toBe(1));

  const user = userEvent.setup();
  await user.click(screen.getByText('Voqealar'));

  const eventRow = await screen.findByTestId(`event-row-${EVENT_ROW_ID}`);
  expect(within(eventRow).getByText('permit.issued')).toBeInTheDocument();
  expect(riskCalls).toBe(1);
});

test('CSV export on the risk indicators tab downloads a real file', async () => {
  server.use(
    http.get('*/api/v1/oversight/risk-indicators', () => HttpResponse.json(page([riskIndicatorFixture()]))),
  );

  const createObjectURL = vi.fn().mockReturnValue('blob:mock');
  const revokeObjectURL = vi.fn();
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  render(
    <Providers>
      <OversightPage />
    </Providers>,
  );
  await screen.findByTestId(`risk-row-${RISK_ROW_ID}`);

  const user = userEvent.setup();
  await user.click(screen.getByText('CSV eksport'));

  await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  expect(clickSpy).toHaveBeenCalled();
});

// Compile-time parity (`Record<TranslationKey, string>` in `i18n/context.ts`)
// guarantees the two dictionaries hold the SAME keys — it cannot know whether
// this screen asks for a key that exists in neither, which `t` renders as the
// bare key and a reader sees in the middle of the page.
test.each(['uz_latn', 'ru'] as const)('no untranslated leadership.oversight.* key reaches the screen in %s', async (lang) => {
  server.use(
    http.get('*/api/v1/oversight/risk-indicators', () => HttpResponse.json(page([riskIndicatorFixture()]))),
    http.get('*/api/v1/oversight/events', () => HttpResponse.json(page([eventFixture()]))),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const i18n = {
    lang,
    backendLang: lang,
    t: (key: string) => (DICTIONARIES[lang] as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
  render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <OversightPage />
      </I18nContext.Provider>
    </QueryClientProvider>,
  );

  await screen.findByTestId(`risk-row-${RISK_ROW_ID}`);
  const user = userEvent.setup();
  await user.click(screen.getByText(i18n.t('leadership.oversight.tabs.events')));
  await screen.findByTestId(`event-row-${EVENT_ROW_ID}`);

  expect(document.body.textContent).not.toMatch(/leadership\.oversight\.[a-zA-Z.]+/);
});
