import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { StatementsTab } from './StatementsTab';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';
import { DICTIONARIES, I18nContext } from '../../i18n/context';
import * as accountantApi from './api';

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

function renderTab(permissions: string[] = ['payments.view', 'payments.manage']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const me = {
    user: { id: 'u-1', full_name: 'Accountant', login: 'acc', language: 'uz_latn' },
    role: { code: 'accountant', name: {} },
    permissions,
    zone: { region_id: null, district_id: null, organization_id: null },
    csrf_token: 'tok',
    is_superuser: false,
    applicant: null,
    representations: [],
    registration_complete: true,
  };
  const authValue = { me, loading: false, authError: null } as unknown as AuthContextValue;
  const i18n = {
    lang: 'uz_latn' as const,
    backendLang: 'uz_latn' as const,
    t: (key: string) => (DICTIONARIES.uz_latn as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={authValue}>
        <I18nContext.Provider value={i18n}>{children}</I18nContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
  return render(<StatementsTab />, { wrapper });
}

/** One row of `GET /payments/bank-statements` (`StatementListItem`). */
function statementRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'st-1',
    source: 'file',
    format: 'csv',
    file_id: 'f-1',
    statement_date: '2026-08-01',
    period_from: '2026-07-25',
    period_to: '2026-08-01',
    status: 'parsed',
    stats: { imported: 2, matched: 1, discrepancy: 1 },
    error_report: null,
    created_at: '2026-08-02T09:00:00Z',
    ...overrides,
  };
}

function statementsPage(items: ReturnType<typeof statementRow>[]) {
  return { items, total: items.length, page: 1, page_size: 20 };
}

/** `GET /payments/bank-statements/{id}` (`StatementOut`) — the header plus
 *  a page of lines, only fetched once a register row is opened. */
function statementOut(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    ...statementRow(),
    column_map: { amount: 'Sum', operation_date: 'Date', purpose: 'Purpose' },
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

test('the register lists statements newest first and a row opens the statement', async () => {
  server.use(
    http.get('*/api/v1/payments/bank-statements', () =>
      HttpResponse.json(statementsPage([statementRow({ id: 'st-1', statement_date: '2026-09-10', status: 'parsed' })])),
    ),
    http.get('*/api/v1/payments/bank-statements/st-1', () => HttpResponse.json(statementOut({ id: 'st-1' }))),
  );
  renderTab(['payments.view']);

  const row = await screen.findByTestId('statement-row-st-1');
  expect(within(row).getByText('10.09.2026')).toBeInTheDocument();

  await userEvent.click(within(row).getByRole('button', { name: /Ochish/i }));

  expect(await screen.findByTestId('statement-detail')).toBeInTheDocument();
  expect(screen.queryByLabelText(/ID/)).toBeNull();
});

test('an accepted upload lands in the register and opens', async () => {
  let listCalls = 0;
  server.use(
    http.get('*/api/v1/payments/bank-statements', () => {
      listCalls += 1;
      return HttpResponse.json(statementsPage(listCalls > 1 ? [statementRow({ id: 'st-9' })] : []));
    }),
    http.get('*/api/v1/payments/bank-statements/st-9', () => HttpResponse.json(statementOut({ id: 'st-9' }))),
  );
  vi.mocked(accountantApi.createBankStatement).mockResolvedValue({ id: 'st-9', status: 'pending' });

  const user = userEvent.setup();
  renderTab();

  await screen.findByText('Koʻchirmalar yoʻq.');
  expect(listCalls).toBe(1);

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

  expect(await screen.findByTestId('statement-detail')).toBeInTheDocument();
  await screen.findByTestId('statement-row-st-9');
  expect(listCalls).toBeGreaterThanOrEqual(2);
});

test('opening a statement from the register shows its lines, stats and match status', async () => {
  server.use(
    http.get('*/api/v1/payments/bank-statements', () => HttpResponse.json(statementsPage([statementRow({ id: 'st-2' })]))),
    http.get('*/api/v1/payments/bank-statements/st-2', () => HttpResponse.json(statementOut({ id: 'st-2' }))),
  );
  const user = userEvent.setup();
  renderTab();

  const row = await screen.findByTestId('statement-row-st-2');
  await user.click(within(row).getByRole('button', { name: 'Ochish' }));

  const detail = await screen.findByTestId('statement-detail');
  expect(within(detail).getByText('2 060 000')).toBeInTheDocument();
  expect(within(detail).getByText('Mos keldi')).toBeInTheDocument();
});

test('an error report is shown with its capped rows, never silently dropped', async () => {
  server.use(
    http.get('*/api/v1/payments/bank-statements', () => HttpResponse.json(statementsPage([statementRow({ id: 'st-3' })]))),
    http.get('*/api/v1/payments/bank-statements/st-3', () =>
      HttpResponse.json(
        statementOut({
          id: 'st-3',
          error_report: { errors: [{ line_no: 4, field: 'amount', message: 'not a number' }], omitted: 3 },
        }),
      ),
    ),
  );
  const user = userEvent.setup();
  renderTab();

  const row = await screen.findByTestId('statement-row-st-3');
  await user.click(within(row).getByRole('button', { name: 'Ochish' }));

  expect(await screen.findByText(/not a number/)).toBeInTheDocument();
  expect(screen.getByText(/3 yana koʻrsatilmagan/)).toBeInTheDocument();
});

test('a 404 on open reads as "not found", never a raw error code', async () => {
  server.use(
    http.get('*/api/v1/payments/bank-statements', () => HttpResponse.json(statementsPage([statementRow({ id: 'st-4' })]))),
    http.get('*/api/v1/payments/bank-statements/st-4', () =>
      HttpResponse.json({ error: { code: 'ERR-SYS-003', message: 'not found' } }, { status: 404 }),
    ),
  );
  const user = userEvent.setup();
  renderTab();

  const row = await screen.findByTestId('statement-row-st-4');
  await user.click(within(row).getByRole('button', { name: 'Ochish' }));

  expect(await screen.findByText('Bunday hisobot topilmadi.')).toBeInTheDocument();
});

test('the status filter reaches the wire: choosing a status sends it, "all" omits it', async () => {
  const seen: URLSearchParams[] = [];
  server.use(
    http.get('*/api/v1/payments/bank-statements', ({ request }) => {
      seen.push(new URL(request.url).searchParams);
      return HttpResponse.json(statementsPage([]));
    }),
  );
  const user = userEvent.setup();
  renderTab(['payments.view']);

  await screen.findByText('Koʻchirmalar yoʻq.');
  expect(seen).toHaveLength(1);
  expect(seen[0].has('status')).toBe(false);

  await user.selectOptions(screen.getByLabelText('Holati'), 'parsed');
  await waitFor(() => expect(seen.at(-1)!.get('status')).toBe('parsed'));
  expect(seen.at(-1)!.get('offset')).toBe('0');

  await user.selectOptions(screen.getByLabelText('Holati'), '');
  await waitFor(() => expect(seen.at(-1)!.has('status')).toBe(false));
});

test('the register list is invalidated once the polling detail settles, not left showing a stale pill (final review A4)', async () => {
  let listCalls = 0;
  let detailCalls = 0;
  server.use(
    http.get('*/api/v1/payments/bank-statements', () => {
      listCalls += 1;
      return HttpResponse.json(statementsPage([statementRow({ id: 'st-5', status: 'parsing' })]));
    }),
    http.get('*/api/v1/payments/bank-statements/st-5', () => {
      detailCalls += 1;
      return HttpResponse.json(statementOut({ id: 'st-5', status: detailCalls > 1 ? 'parsed' : 'parsing' }));
    }),
  );
  const user = userEvent.setup();
  renderTab(['payments.view']);

  const row = await screen.findByTestId('statement-row-st-5');
  await user.click(within(row).getByRole('button', { name: 'Ochish' }));
  await screen.findByTestId('statement-detail');
  const listCallsWhilePolling = listCalls;

  // `useBankStatement`'s own `refetchInterval` (2s) drives the detail from
  // `parsing` to `parsed` — real timers, the same way every other polling
  // assertion in this suite (`InvoicesTab.test.tsx` et al.) waits on MSW
  // rather than faking the clock.
  await waitFor(() => expect(detailCalls).toBeGreaterThan(1), { timeout: 5000 });
  await waitFor(() => expect(listCalls).toBeGreaterThan(listCallsWhilePolling), { timeout: 5000 });
});

test('a caller with neither payments.manage nor payments.view (e.g. the manual-PAID checker) sees neither the upload form nor the register, never a button the backend would 403 on', () => {
  renderTab(['payments.confirm']);

  expect(screen.queryByLabelText('Fayl (CSV)')).not.toBeInTheDocument();
  expect(screen.queryByText('Yuklangan koʻchirmalar')).not.toBeInTheDocument();
  expect(screen.getByText(/Bank hisobotlariga kirish huquqi/)).toBeInTheDocument();
});
