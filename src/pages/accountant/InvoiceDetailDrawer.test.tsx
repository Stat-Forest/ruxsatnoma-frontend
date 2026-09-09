import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { InvoiceDetailDrawer } from './InvoiceDetailDrawer';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';
import { DICTIONARIES, I18nContext } from '../../i18n/context';

const INVOICE_ID = 'in000000-0000-4000-8000-000000000001';
const APPLICATION_ID = 'a0000000-0000-4000-8000-000000000001';
const BUDGET_RECIPIENT_ID = 'b0000000-0000-4000-8000-000000000001';
const AGENCY_RECIPIENT_ID = 'b0000000-0000-4000-8000-000000000002';

function invoice(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: INVOICE_ID,
    number: 'F-000123',
    application_id: APPLICATION_ID,
    calculation_id: null,
    amount: '500000.00',
    status: 'pending',
    issued_at: '2026-08-01T09:00:00Z',
    due_at: '2026-08-15T00:00:00Z',
    paid_at: null,
    recipients: null,
    ...overrides,
  };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderDrawer(permissions: string[] = ['payments.view']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const me = {
    user: { id: 'u-1', full_name: 'User', login: 'u', language: 'uz_latn' },
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
  return render(<InvoiceDetailDrawer invoiceId={INVOICE_ID} onClose={() => {}} />, { wrapper });
}

test('shows how the invoice divides, one row per InvoiceOut.recipients entry', async () => {
  server.use(
    http.get('*/api/v1/invoices/:id', () =>
      HttpResponse.json(
        invoice({
          recipients: [
            {
              recipient_id: BUDGET_RECIPIENT_ID,
              name: { uz_latn: 'Davlat byudjeti' },
              payme_account_id: '99999',
              kind: 'percent',
              percent: '50.00',
              fixed_amount: null,
              amount: '250000.00',
            },
            {
              recipient_id: null,
              name: { uz_latn: 'Burchmulla oʻrmon xoʻjaligi' },
              payme_account_id: null,
              kind: 'remainder',
              percent: null,
              fixed_amount: null,
              amount: '250000.00',
            },
          ],
        }),
      ),
    ),
    http.get('*/api/v1/payments/allocations', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 200 })),
  );
  renderDrawer();

  const section = await screen.findByTestId('invoice-recipients-section');
  expect(section).toHaveTextContent('Davlat byudjeti');
  expect(section).toHaveTextContent('50%');
  expect(section).toHaveTextContent('99999');
  expect(section).toHaveTextContent('Burchmulla oʻrmon xoʻjaligi');
  expect(section).toHaveTextContent('250 000');
});

test('the ledger names each configured receiver by its own recipient_name, not a shared "receiver" label', async () => {
  server.use(
    http.get('*/api/v1/invoices/:id', () => HttpResponse.json(invoice())),
    http.get('*/api/v1/payments/allocations', () =>
      HttpResponse.json({
        items: [
          {
            id: 'al-1',
            invoice_id: INVOICE_ID,
            transaction_id: 'tx-1',
            refund_id: null,
            recipient_id: BUDGET_RECIPIENT_ID,
            recipient_name: { uz_latn: 'Davlat byudjeti' },
            entry_type: 'payment',
            target: 'receiver',
            account: null,
            amount: '250000.00',
            occurred_at: '2026-08-05T10:00:00Z',
            note: null,
          },
          {
            id: 'al-2',
            invoice_id: INVOICE_ID,
            transaction_id: 'tx-1',
            refund_id: null,
            recipient_id: AGENCY_RECIPIENT_ID,
            recipient_name: { uz_latn: 'Agentlik' },
            entry_type: 'payment',
            target: 'receiver',
            account: null,
            amount: '50000.00',
            occurred_at: '2026-08-05T10:00:00Z',
            note: null,
          },
          {
            id: 'al-3',
            invoice_id: INVOICE_ID,
            transaction_id: 'tx-1',
            refund_id: null,
            recipient_id: null,
            recipient_name: null,
            entry_type: 'payment',
            target: 'recipient',
            account: '12345',
            amount: '200000.00',
            occurred_at: '2026-08-05T10:00:00Z',
            note: null,
          },
        ],
        total: 3,
        page: 1,
        page_size: 200,
      }),
    ),
  );
  renderDrawer();

  await screen.findByText('F-000123');
  // three receivers, three distinguishable rows — never three identical
  // "receiver" rows (the bug this test would have caught)
  expect(screen.getByText('Davlat byudjeti')).toBeInTheDocument();
  expect(screen.getByText('Agentlik')).toBeInTheDocument();
  expect(screen.getByText('Ijrochi (leshoz)')).toBeInTheDocument();
  expect(screen.queryByText('receiver')).not.toBeInTheDocument();
});

test('a receiver row with no recipient_name falls back to the generic label instead of an empty cell', async () => {
  server.use(
    http.get('*/api/v1/invoices/:id', () => HttpResponse.json(invoice())),
    http.get('*/api/v1/payments/allocations', () =>
      HttpResponse.json({
        items: [
          {
            id: 'al-1',
            invoice_id: INVOICE_ID,
            transaction_id: 'tx-1',
            refund_id: null,
            recipient_id: BUDGET_RECIPIENT_ID,
            recipient_name: null,
            entry_type: 'payment',
            target: 'receiver',
            account: null,
            amount: '250000.00',
            occurred_at: '2026-08-05T10:00:00Z',
            note: null,
          },
        ],
        total: 1,
        page: 1,
        page_size: 200,
      }),
    ),
  );
  renderDrawer();

  await screen.findByText('F-000123');
  expect(screen.getByText('Qabul qiluvchi')).toBeInTheDocument();
});

test('renders nothing for the split when the invoice carries no recipients (an applicant-scoped response)', async () => {
  server.use(
    http.get('*/api/v1/invoices/:id', () => HttpResponse.json(invoice({ recipients: null }))),
    http.get('*/api/v1/payments/allocations', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 200 })),
  );
  renderDrawer();

  await screen.findByText('F-000123');
  expect(screen.queryByTestId('invoice-recipients-section')).not.toBeInTheDocument();
});
