import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { DICTIONARIES, I18nContext } from '../../../i18n/context';
import { INVOICE_STATUS_LABEL_I18N } from '../../permits/statusMeta';
import { MyInvoicesTab } from './MyInvoicesTab';

const APP_ONE = 'a0000000-0000-4000-8000-000000000001';
const APP_TWO = 'a0000000-0000-4000-8000-000000000002';

function invoice(overrides: Record<string, unknown>) {
  return {
    id: 'i-1',
    number: 'INV-2026-000001',
    application_id: APP_ONE,
    calculation_id: null,
    amount: '150000.00',
    status: 'pending',
    issued_at: '2026-09-01T09:00:00Z',
    due_at: '2026-09-11T09:00:00Z',
    paid_at: null,
    recipients: null,
    settled_by_benefit: false,
    ...overrides,
  };
}

function page<T>(items: T[]) {
  return { items, total: items.length, page: 1, page_size: 50 };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderTab(lang: 'uz_latn' | 'ru' = 'uz_latn') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const i18n = {
    lang,
    backendLang: lang,
    t: (key: string) => (DICTIONARIES[lang] as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>{children}</I18nContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>
  );
  return render(<MyInvoicesTab />, { wrapper });
}

test('asks the backend for the whole own list and shows each invoice against its application number', async () => {
  const urls: string[] = [];
  server.use(
    http.get('*/api/v1/invoices', ({ request }) => {
      urls.push(request.url);
      return HttpResponse.json(
        page([invoice({}), invoice({ id: 'i-2', number: 'INV-2026-000002', application_id: APP_TWO, status: 'paid', paid_at: '2026-09-03T10:00:00Z' })]),
      );
    }),
    http.get('*/api/v1/applications', () =>
      HttpResponse.json({ items: [{ id: APP_ONE, number: 'RX-2026-000010', status: 'INVOICED' }, { id: APP_TWO, number: 'RX-2026-000011', status: 'PAID' }], total: 2, page: 1, page_size: 100 }),
    ),
  );
  renderTab();

  expect(await screen.findByText('INV-2026-000001')).toBeInTheDocument();
  expect(screen.getByText('RX-2026-000010')).toBeInTheDocument();
  expect(screen.getByText('RX-2026-000011')).toBeInTheDocument();
  // Scoped to the table: the status filter's own (visually hidden but
  // DOM-present) <option> list repeats every status label, so an unscoped
  // `getByText` on a label that is also a filter option matches twice.
  const table = screen.getByRole('table');
  expect(within(table).getByText('Toʻlov kutilmoqda')).toBeInTheDocument();
  expect(within(table).getByText('Toʻlangan')).toBeInTheDocument();
  // The assertion that pins the contract: ONE call, and no `application_id`
  // — with it the route is the per-application read, not the own list.
  expect(urls).toHaveLength(1);
  expect(new URL(urls[0]).searchParams.get('application_id')).toBeNull();
});

test('a pending invoice offers Pay, a paid one offers Open, both leading to the invoice page', async () => {
  server.use(
    http.get('*/api/v1/invoices', () => HttpResponse.json(page([invoice({}), invoice({ id: 'i-2', number: 'INV-2', status: 'paid' })]))),
    http.get('*/api/v1/applications', () => HttpResponse.json(page([]))),
  );
  renderTab();

  const pay = await screen.findByRole('link', { name: 'Toʻlash' });
  expect(pay).toHaveAttribute('href', '/my/invoices/i-1');
  expect(screen.getByRole('link', { name: 'Koʻrish' })).toHaveAttribute('href', '/my/invoices/i-2');
});

test('an empty list says so in words, not as an empty table', async () => {
  server.use(
    http.get('*/api/v1/invoices', () => HttpResponse.json(page([]))),
    http.get('*/api/v1/applications', () => HttpResponse.json(page([]))),
  );
  renderTab();

  expect(await screen.findByText('Hali hisob-faktura yoʻq.')).toBeInTheDocument();
});

test('a failed load says so instead of showing nothing', async () => {
  server.use(
    http.get('*/api/v1/invoices', () => HttpResponse.json({ error: { code: 'ERR-SYS-001', message: 'boom' } }, { status: 500 })),
    http.get('*/api/v1/applications', () => HttpResponse.json(page([]))),
  );
  renderTab();

  expect(await screen.findByText('Hisob-fakturalarni yuklab boʻlmadi.')).toBeInTheDocument();
});

test('the status badge follows the UI language, not a fixed uz_latn label', async () => {
  server.use(
    http.get('*/api/v1/invoices', () => HttpResponse.json(page([invoice({})]))),
    http.get('*/api/v1/applications', () => HttpResponse.json(page([]))),
  );
  renderTab('ru');

  await screen.findByText('INV-2026-000001');
  const table = screen.getByRole('table');
  expect(within(table).getByText(INVOICE_STATUS_LABEL_I18N.ru.pending)).toBeInTheDocument();
});
