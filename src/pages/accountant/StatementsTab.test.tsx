import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { StatementsTab } from './StatementsTab';
import { DICTIONARIES, I18nContext } from '../../i18n/context';
import * as accountantApi from './api';

const STATEMENT_ID = 's0000000-0000-4000-8000-000000000001';

// Same jsdom/undici multipart interop gap as `InvoicesTab.test.tsx` — see
// that file's own comment. `createBankStatement` is the one function that
// posts a real `FormData`; everything else in this suite goes through real
// MSW handlers.
vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, createBankStatement: vi.fn() };
});

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = {
    lang: 'uz_latn' as const,
    backendLang: 'uz_latn' as const,
    t: (key: string) => (DICTIONARIES.uz_latn as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>{children}</I18nContext.Provider>
    </QueryClientProvider>
  );
  return render(<StatementsTab />, { wrapper });
}

function statement(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: STATEMENT_ID,
    source: 'file',
    format: 'csv',
    file_id: 'f-1',
    statement_date: '2026-08-01',
    period_from: '2026-07-25',
    period_to: '2026-08-01',
    column_map: { amount: 'Sum', operation_date: 'Date', purpose: 'Purpose' },
    status: 'parsed',
    stats: { imported: 2, matched: 1, discrepancy: 1 },
    error_report: null,
    created_at: '2026-08-02T09:00:00Z',
    lines: [
      {
        id: 'line-1',
        line_no: 1,
        doc_number: 'D-1',
        amount: '2060000.00',
        operation_date: '2026-07-30',
        payer_name: 'Ivanov I.',
        payer_account: null,
        purpose: 'INV-2026-000123',
        match_status: 'matched',
        matched_invoice_id: 'in-1',
      },
    ],
    lines_total: 1,
    ...overrides,
  };
}

test('uploading a statement fills the required column-map fields, calls the upload function, and opens the accepted statement', async () => {
  vi.mocked(accountantApi.createBankStatement).mockResolvedValue({ id: STATEMENT_ID, status: 'pending' });
  server.use(http.get('*/api/v1/payments/bank-statements/:id', ({ params }) => HttpResponse.json(statement({ id: params.id }))));

  const user = userEvent.setup();
  renderTab();

  const file = new File(['a,b'], 'statement.csv', { type: 'text/csv' });
  await user.upload(screen.getByLabelText('Fayl (CSV)'), file);
  await user.type(screen.getByLabelText('Hisobot sanasi'), '2026-08-01');
  await user.click(screen.getByRole('button', { name: 'Yuklash' }));

  expect(accountantApi.createBankStatement).toHaveBeenCalledWith(
    expect.objectContaining({
      statementDate: '2026-08-01',
      columnMap: { amount: 'amount', operation_date: 'operation_date', purpose: 'purpose' },
    }),
  );
  const detail = await screen.findByTestId('statement-detail');
  expect(within(detail).getByText(STATEMENT_ID)).toBeInTheDocument();
});

test('opening a statement by id shows its lines, stats and match status', async () => {
  server.use(http.get('*/api/v1/payments/bank-statements/:id', ({ params }) => HttpResponse.json(statement({ id: params.id }))));

  const user = userEvent.setup();
  renderTab();

  await user.type(screen.getByLabelText('ID boʻyicha ochish'), STATEMENT_ID);
  await user.click(screen.getByRole('button', { name: 'Ochish' }));

  const detail = await screen.findByTestId('statement-detail');
  expect(within(detail).getByText('2 060 000')).toBeInTheDocument();
  expect(within(detail).getByText('Mos keldi')).toBeInTheDocument();
  expect(
    within(detail).getByText((_, node) => node?.textContent?.replace(/\s+/g, ' ').trim() === 'imported: 2'),
  ).toBeInTheDocument();
});

test('an error report is shown with its capped rows, never silently dropped', async () => {
  server.use(
    http.get('*/api/v1/payments/bank-statements/:id', ({ params }) =>
      HttpResponse.json(
        statement({
          id: params.id,
          error_report: { errors: [{ line_no: 4, field: 'amount', message: 'not a number' }], omitted: 3 },
        }),
      ),
    ),
  );

  const user = userEvent.setup();
  renderTab();

  await user.type(screen.getByLabelText('ID boʻyicha ochish'), STATEMENT_ID);
  await user.click(screen.getByRole('button', { name: 'Ochish' }));

  expect(await screen.findByText(/not a number/)).toBeInTheDocument();
  expect(screen.getByText(/3 yana koʻrsatilmagan/)).toBeInTheDocument();
});

test('a 404 on open reads as "not found", never a raw error code', async () => {
  server.use(
    http.get('*/api/v1/payments/bank-statements/:id', () =>
      HttpResponse.json({ error: { code: 'ERR-SYS-003', message: 'not found' } }, { status: 404 }),
    ),
  );

  const user = userEvent.setup();
  renderTab();

  await user.type(screen.getByLabelText('ID boʻyicha ochish'), 'missing');
  await user.click(screen.getByRole('button', { name: 'Ochish' }));

  expect(await screen.findByText('Bunday hisobot topilmadi.')).toBeInTheDocument();
});
