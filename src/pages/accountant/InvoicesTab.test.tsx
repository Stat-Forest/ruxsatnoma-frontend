import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { InvoicesTab } from './InvoicesTab';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';
import { DICTIONARIES, I18nContext } from '../../i18n/context';
import * as accountantApi from './api';

// `uploadFile` posts real multipart `FormData` — MSW's node-side interception
// (undici) rejects a jsdom `File` instance appended to a jsdom `FormData` with
// an internal webidl assertion, an environment-only interop gap between
// jsdom's DOM classes and undici's, never seen in a real browser. Mocking
// this one boundary function keeps the test on the component's own logic
// (the file input, the disabled/enabled button, what gets sent to
// `fileManualConfirmation` — a plain JSON route, unaffected) rather than on
// working around a jsdom/undici incompatibility that has nothing to do with
// this screen.
vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, uploadFile: vi.fn() };
});

const APPLICATION_ID = 'a0000000-0000-4000-8000-000000000001';
const INVOICE_PENDING = 'in000000-0000-4000-8000-000000000001';
const INVOICE_PAID = 'in000000-0000-4000-8000-000000000002';

function invoice(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: INVOICE_PENDING,
    number: 'INV-2026-000123',
    application_id: APPLICATION_ID,
    calculation_id: null,
    amount: '2060000.00',
    status: 'pending',
    issued_at: '2026-08-01T08:00:00Z',
    due_at: '2026-08-11T08:00:00Z',
    paid_at: null,
    ...overrides,
  };
}

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
    zone: { region_id: null, district_id: null, organization_id: 'org-1' },
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
  return render(<InvoicesTab />, { wrapper });
}

test('searching by application id lists its invoices', async () => {
  server.use(
    http.get('*/api/v1/invoices', ({ request }) => {
      const url = new URL(request.url);
      expect(url.searchParams.get('application_id')).toBe(APPLICATION_ID);
      return HttpResponse.json({ items: [invoice()], total: 1, page: 1, page_size: 200 });
    }),
  );
  const user = userEvent.setup();
  renderTab();

  await user.type(screen.getByLabelText('Ariza ID'), APPLICATION_ID);
  await user.click(screen.getByRole('button', { name: 'Qidirish' }));

  expect(await screen.findByText('INV-2026-000123')).toBeInTheDocument();
  expect(screen.getByText('2 060 000')).toBeInTheDocument();
});

test('an application with no invoices says so instead of showing an empty table', async () => {
  server.use(
    http.get('*/api/v1/invoices', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 200 })),
  );
  const user = userEvent.setup();
  renderTab();

  await user.type(screen.getByLabelText('Ariza ID'), APPLICATION_ID);
  await user.click(screen.getByRole('button', { name: 'Qidirish' }));

  expect(await screen.findByText('Bu ariza boʻyicha hisob-fakturalar topilmadi.')).toBeInTheDocument();
});

test('opening an invoice from the results shows its detail and ledger, with a null account read as settled outside the system', async () => {
  server.use(
    http.get('*/api/v1/invoices', () => HttpResponse.json({ items: [invoice()], total: 1, page: 1, page_size: 200 })),
    http.get('*/api/v1/invoices/:id', ({ params }) => HttpResponse.json(invoice({ id: params.id }))),
    http.get('*/api/v1/payments/allocations', () =>
      HttpResponse.json({
        items: [
          {
            id: 'al-1',
            invoice_id: INVOICE_PENDING,
            transaction_id: 'tx-1',
            refund_id: null,
            entry_type: 'payment',
            target: 'budget',
            account: null,
            amount: '1030000.00',
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
  const user = userEvent.setup();
  renderTab();

  await user.type(screen.getByLabelText('Ariza ID'), APPLICATION_ID);
  await user.click(screen.getByRole('button', { name: 'Qidirish' }));
  await user.click(await screen.findByTestId(`invoice-row-${INVOICE_PENDING}`));

  expect(await screen.findByText('1 030 000')).toBeInTheDocument();
  expect(screen.getByText('tizimdan tashqarida hisoblanadi')).toBeInTheDocument();
});

test('opening an invoice directly by id works without a prior search', async () => {
  server.use(
    http.get('*/api/v1/invoices/:id', ({ params }) => HttpResponse.json(invoice({ id: params.id, status: 'paid', paid_at: '2026-08-05T10:00:00Z' }))),
    http.get('*/api/v1/payments/allocations', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 200 })),
  );
  const user = userEvent.setup();
  renderTab();

  await user.type(screen.getByLabelText('Hisob-faktura ID'), INVOICE_PAID);
  await user.click(screen.getByRole('button', { name: 'Ochish' }));

  expect(await screen.findByText('INV-2026-000123')).toBeInTheDocument();
  expect(screen.getByText('Toʻlangan')).toBeInTheDocument();
});

test('a 404 on direct open reads as "not found or not yours", never as a raw error code', async () => {
  server.use(
    http.get('*/api/v1/invoices/:id', () =>
      HttpResponse.json({ error: { code: 'ERR-SYS-003', message: 'not found' } }, { status: 404 }),
    ),
  );
  const user = userEvent.setup();
  renderTab();

  await user.type(screen.getByLabelText('Hisob-faktura ID'), 'does-not-exist');
  await user.click(screen.getByRole('button', { name: 'Ochish' }));

  expect(await screen.findByText('Bunday hisob-faktura mavjud emas yoki sizga tegishli emas.')).toBeInTheDocument();
});

test('the manual-PAID filing form is offered only for a pending invoice, and only to a payments.manage holder', async () => {
  server.use(
    http.get('*/api/v1/invoices/:id', ({ params }) => HttpResponse.json(invoice({ id: params.id }))),
    http.get('*/api/v1/payments/allocations', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 200 })),
  );
  const user = userEvent.setup();
  renderTab(['payments.view']); // no payments.manage

  await user.type(screen.getByLabelText('Hisob-faktura ID'), INVOICE_PENDING);
  await user.click(screen.getByRole('button', { name: 'Ochish' }));

  await screen.findByText('INV-2026-000123');
  expect(screen.queryByText('Qoʻlda toʻlovni qayd etish')).not.toBeInTheDocument();
});

test('filing a manual confirmation uploads the document first, then files it, and surfaces the id to hand to the checker', async () => {
  let filedBody: unknown;
  vi.mocked(accountantApi.uploadFile).mockResolvedValue({
    id: 'file-1',
    filename: 'payment-order.pdf',
    content_type: 'application/pdf',
    size_bytes: 10,
    sha256: 'abc',
    created_at: '2026-08-01T00:00:00Z',
  });
  server.use(
    http.get('*/api/v1/invoices/:id', ({ params }) => HttpResponse.json(invoice({ id: params.id }))),
    http.get('*/api/v1/payments/allocations', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 200 })),
    http.post('*/api/v1/payments/manual-confirmations', async ({ request }) => {
      filedBody = await request.json();
      return HttpResponse.json(
        {
          id: 'conf-1',
          invoice_id: INVOICE_PENDING,
          amount: '2060000.00',
          paid_at: '2026-08-05T10:00:00',
          bank_doc_file_id: 'file-1',
          maker_id: 'u-1',
          checker_id: null,
          status: 'pending_check',
          reason: null,
          checked_at: null,
          created_at: '2026-08-05T10:05:00Z',
          amount_matches_invoice: true,
        },
        { status: 201 },
      );
    }),
  );
  const user = userEvent.setup();
  renderTab();

  await user.type(screen.getByLabelText('Hisob-faktura ID'), INVOICE_PENDING);
  await user.click(screen.getByRole('button', { name: 'Ochish' }));
  await screen.findByText('INV-2026-000123');

  const section = screen.getByText('Qoʻlda toʻlovni qayd etish').closest('section')!;
  await user.type(within(section).getByLabelText('Summa'), '2060000.00');
  // `type()` sends real keystrokes through the input's own sanitization
  // algorithm, which a `datetime-local` field frequently rejects mid-way —
  // `fireEvent.change` sets the value directly, the same way a native
  // date/time picker widget would.
  const datetime = within(section).getByLabelText('Toʻlangan sana va vaqti');
  fireEvent.change(datetime, { target: { value: '2026-08-05T10:00' } });
  const file = new File(['x'], 'payment-order.pdf', { type: 'application/pdf' });
  const fileInput = within(section).getByLabelText('Bank hujjati');
  await user.upload(fileInput, file);
  await user.click(within(section).getByRole('button', { name: 'Qayd etish' }));

  expect(await screen.findByText('Qayd etildi. Tasdiqlash rahbarni kutmoqda.')).toBeInTheDocument();
  expect(screen.getByText('conf-1')).toBeInTheDocument();
  expect(accountantApi.uploadFile).toHaveBeenCalledWith(expect.objectContaining({ name: 'payment-order.pdf' }));
  expect(filedBody).toMatchObject({ invoice_id: INVOICE_PENDING, amount: '2060000.00', bank_doc_file_id: 'file-1' });
  expect(typeof (filedBody as { amount: unknown }).amount).toBe('string');
});
