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
    application_number: null,
    calculation_id: null,
    amount: '2060000.00',
    status: 'pending',
    issued_at: '2026-08-01T08:00:00Z',
    due_at: '2026-08-11T08:00:00Z',
    paid_at: null,
    ...overrides,
  };
}

/** An empty page for `GET /invoices` — the component fires this unfiltered
 *  register query on mount (F12a: it is a real always-on register now, not
 *  a search gated behind a first submit), so every test that only cares
 *  about a LATER, more specific call needs a harmless default in place
 *  before that later call replaces it via `server.use`. */
function emptyInvoicesPage() {
  return HttpResponse.json({ items: [], total: 0, page: 1, page_size: 20 });
}

const server = setupServer(http.get('*/api/v1/invoices', emptyInvoicesPage));
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderTab(permissions: string[] = ['payments.view', 'payments.manage'], lang: keyof typeof DICTIONARIES = 'uz_latn') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const me = {
    user: { id: 'u-1', full_name: 'Accountant', login: 'acc', language: lang },
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
    lang,
    backendLang: lang,
    t: (key: string) => (DICTIONARIES[lang] as Record<string, string>)[key] ?? key,
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

/** The two search cards both submit a button labelled "Qidirish" (F1's own
 *  `searchButton` key, shared) — scoping by the card's own heading rather
 *  than `getAllByRole(...)[N]` so a test never depends on which card
 *  happens to render first. */
function applicationSearchSection() {
  return screen.getByText('Ariza boʻyicha qidirish').closest('section')!;
}
function invoiceSearchSection() {
  return screen.getByText('Hisob boʻyicha qidirish').closest('section')!;
}

/** The shared `Drawer` component (`../../components/ui/Overlay.tsx`) sets no
 *  `role="dialog"` of its own (unlike its sibling `Modal`) and no testid —
 *  scope by its title heading instead, since the register row behind it
 *  renders the same invoice number the drawer's own header does. */
async function findDrawer() {
  const heading = await screen.findByText('Hisob-faktura');
  return heading.closest('div')!.parentElement!;
}

test('F12a — the zone register renders on its own, with no search needed and no "route does not exist" message', async () => {
  server.use(
    http.get('*/api/v1/invoices', () =>
      HttpResponse.json({ items: [invoice(), invoice({ id: INVOICE_PAID, number: 'INV-2026-000124', status: 'paid' })], total: 2, page: 1, page_size: 20 }),
    ),
  );
  renderTab();

  expect(await screen.findByText('INV-2026-000123')).toBeInTheDocument();
  expect(screen.getByText('INV-2026-000124')).toBeInTheDocument();
  expect(screen.queryByText(/tizimda bunday marshrut mavjud emas/)).not.toBeInTheDocument();
});

test('F12a — an empty zone register says so, distinctly from the per-application empty message', async () => {
  renderTab(); // default handler answers an empty page

  expect(await screen.findByText('Bu filtr boʻyicha hisob-fakturalar topilmadi.')).toBeInTheDocument();
  expect(screen.queryByText('Bu ariza boʻyicha hisob-fakturalar topilmadi.')).not.toBeInTheDocument();
});

test('F12a — the status filter re-queries with the chosen status', async () => {
  let capturedStatus: string | null = null;
  server.use(
    http.get('*/api/v1/invoices', ({ request }) => {
      capturedStatus = new URL(request.url).searchParams.get('status');
      return emptyInvoicesPage();
    }),
  );
  const user = userEvent.setup();
  renderTab();
  await screen.findByText('Bu filtr boʻyicha hisob-fakturalar topilmadi.');

  await user.selectOptions(screen.getByLabelText('Holati'), 'paid');

  await vi.waitFor(() => expect(capturedStatus).toBe('paid'));
});

test('F12a — pagination turns the page as offset, not as a second page param the route does not take', async () => {
  let capturedOffset: string | null = null;
  server.use(
    http.get('*/api/v1/invoices', ({ request }) => {
      const url = new URL(request.url);
      capturedOffset = url.searchParams.get('offset');
      const page = Number(url.searchParams.get('offset')) === 0 ? 1 : 2;
      return HttpResponse.json({
        items: [invoice({ number: `INV-page-${page}` })],
        total: 25,
        page,
        page_size: 20,
      });
    }),
  );
  const user = userEvent.setup();
  renderTab();
  await screen.findByText('INV-page-1');

  await user.click(screen.getByRole('button', { name: '2' }));

  await vi.waitFor(() => expect(capturedOffset).toBe('20'));
  expect(await screen.findByText('INV-page-2')).toBeInTheDocument();
});

test('searching by application number filters the register to that application', async () => {
  server.use(
    http.get('*/api/v1/invoices', ({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.get('application_number') !== 'RX-2026-00001') return emptyInvoicesPage();
      return HttpResponse.json({ items: [invoice({ application_number: 'RX-2026-00001' })], total: 1, page: 1, page_size: 20 });
    }),
  );
  const user = userEvent.setup();
  renderTab();
  await screen.findByText('Bu filtr boʻyicha hisob-fakturalar topilmadi.');

  await user.type(screen.getByLabelText('Ariza raqami'), 'RX-2026-00001');
  await user.click(within(applicationSearchSection()).getByRole('button', { name: 'Qidirish' }));

  expect(await screen.findByText('INV-2026-000123')).toBeInTheDocument();
  expect(screen.getByText('2 060 000')).toBeInTheDocument();
});

test('an application with no invoices says so instead of showing an empty table', async () => {
  const user = userEvent.setup();
  renderTab();
  await screen.findByText('Bu filtr boʻyicha hisob-fakturalar topilmadi.');

  await user.type(screen.getByLabelText('Ariza raqami'), 'RX-2026-00001');
  await user.click(within(applicationSearchSection()).getByRole('button', { name: 'Qidirish' }));

  expect(await screen.findByText('Bu ariza boʻyicha hisob-fakturalar topilmadi.')).toBeInTheDocument();
});

test('clearing the application filter returns to the unfiltered register', async () => {
  server.use(
    http.get('*/api/v1/invoices', ({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.get('application_number') === 'RX-2026-00001') {
        return HttpResponse.json({ items: [invoice({ application_number: 'RX-2026-00001' })], total: 1, page: 1, page_size: 20 });
      }
      return emptyInvoicesPage();
    }),
  );
  const user = userEvent.setup();
  renderTab();
  await screen.findByText('Bu filtr boʻyicha hisob-fakturalar topilmadi.');

  await user.type(screen.getByLabelText('Ariza raqami'), 'RX-2026-00001');
  await user.click(within(applicationSearchSection()).getByRole('button', { name: 'Qidirish' }));
  expect(await screen.findByText('INV-2026-000123')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Filtrni tozalash' }));

  expect(await screen.findByText('Bu filtr boʻyicha hisob-fakturalar topilmadi.')).toBeInTheDocument();
});

test('searching by application number sends application_number, never application_id', async () => {
  const seen: URLSearchParams[] = [];
  server.use(
    http.get('*/api/v1/invoices', ({ request }) => {
      const url = new URL(request.url);
      seen.push(url.searchParams);
      if (url.searchParams.get('application_number') === 'RX-2026-00001') {
        return HttpResponse.json({ items: [invoice({ application_number: 'RX-2026-00001' })], total: 1, page: 1, page_size: 20 });
      }
      return emptyInvoicesPage();
    }),
  );
  renderTab();
  await userEvent.type(screen.getByLabelText(/Ariza raqami/i), ' RX-2026-00001 ');
  await userEvent.click(within(applicationSearchSection()).getByRole('button', { name: /Qidirish/i }));
  expect(await screen.findByText('INV-2026-000123')).toBeInTheDocument();
  expect(screen.getByText('RX-2026-00001')).toBeInTheDocument(); // the "filtered by application" banner shows the number
  const last = seen.at(-1)!;
  expect(last.get('application_number')).toBe('RX-2026-00001');
  expect(last.has('application_id')).toBe(false);
});

test('searching by invoice number filters the register by number', async () => {
  const seen: URLSearchParams[] = [];
  server.use(
    http.get('*/api/v1/invoices', ({ request }) => {
      seen.push(new URL(request.url).searchParams);
      return emptyInvoicesPage();
    }),
  );
  renderTab();
  await userEvent.type(screen.getByLabelText(/Hisob raqami/i), 'INV-2026-000123');
  await userEvent.click(within(invoiceSearchSection()).getByRole('button', { name: /Qidirish/i }));
  await screen.findByText(/topilmadi/i);
  expect(seen.at(-1)!.get('number')).toBe('INV-2026-000123');
});

test('an unknown application number shows the not-found message, not a raw 422', async () => {
  server.use(
    http.get('*/api/v1/invoices', ({ request }) =>
      new URL(request.url).searchParams.has('application_number')
        ? HttpResponse.json({ error: { code: 'ERR-SYS-003', message: 'x', details: {}, correlation_id: 'c' } }, { status: 404 })
        : emptyInvoicesPage(),
    ),
  );
  renderTab();
  await userEvent.type(screen.getByLabelText(/Ariza raqami/i), 'RX-2026-99999');
  await userEvent.click(within(applicationSearchSection()).getByRole('button', { name: /Qidirish/i }));
  expect(await screen.findByText(/Bunday ariza topilmadi/i)).toBeInTheDocument();
});

test('there is no "open by id" form any more', () => {
  renderTab();
  expect(screen.queryByLabelText(/ID/)).toBeNull();
});

test('opening an invoice from the register shows its detail and ledger, with a null account read as settled outside the system', async () => {
  server.use(
    http.get('*/api/v1/invoices', () => HttpResponse.json({ items: [invoice()], total: 1, page: 1, page_size: 20 })),
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

  await user.click(await screen.findByTestId(`invoice-row-${INVOICE_PENDING}`));

  expect(await screen.findByText('1 030 000')).toBeInTheDocument();
  expect(screen.getByText('tizimdan tashqarida hisoblanadi')).toBeInTheDocument();
});

test('opening a paid invoice from the register shows its status in the drawer', async () => {
  server.use(
    http.get('*/api/v1/invoices', () =>
      HttpResponse.json({ items: [invoice({ id: INVOICE_PAID, status: 'paid', paid_at: '2026-08-05T10:00:00Z' })], total: 1, page: 1, page_size: 20 }),
    ),
    http.get('*/api/v1/invoices/:id', ({ params }) => HttpResponse.json(invoice({ id: params.id, status: 'paid', paid_at: '2026-08-05T10:00:00Z' }))),
    http.get('*/api/v1/payments/allocations', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 200 })),
  );
  const user = userEvent.setup();
  renderTab();

  await user.click(await screen.findByTestId(`invoice-row-${INVOICE_PAID}`));

  // The register row behind the drawer shows the same number — scope to the
  // dialog first, then to its own requisites list, not the whole document
  // (the status filter's own `<option>Toʻlangan</option>` renders the same
  // status text too).
  const dialog = await findDrawer();
  const detail = (await within(dialog).findByText('INV-2026-000123')).closest('dl')!;
  expect(within(detail).getByText('Toʻlangan')).toBeInTheDocument();
});

test('a 404 opening a row reads as "not found or not yours", never as a raw error code', async () => {
  server.use(
    http.get('*/api/v1/invoices', () => HttpResponse.json({ items: [invoice()], total: 1, page: 1, page_size: 20 })),
    http.get('*/api/v1/invoices/:id', () =>
      HttpResponse.json({ error: { code: 'ERR-SYS-003', message: 'not found' } }, { status: 404 }),
    ),
  );
  const user = userEvent.setup();
  renderTab();

  await user.click(await screen.findByTestId(`invoice-row-${INVOICE_PENDING}`));

  expect(await screen.findByText('Bunday hisob-faktura mavjud emas yoki sizga tegishli emas.')).toBeInTheDocument();
});

test('the manual-PAID filing form is offered only for a pending invoice, and only to a payments.manage holder', async () => {
  server.use(
    http.get('*/api/v1/invoices', () => HttpResponse.json({ items: [invoice()], total: 1, page: 1, page_size: 20 })),
    http.get('*/api/v1/invoices/:id', ({ params }) => HttpResponse.json(invoice({ id: params.id }))),
    http.get('*/api/v1/payments/allocations', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 200 })),
  );
  const user = userEvent.setup();
  renderTab(['payments.view']); // no payments.manage

  await user.click(await screen.findByTestId(`invoice-row-${INVOICE_PENDING}`));

  const dialog = await findDrawer();
  await within(dialog).findByText('INV-2026-000123');
  expect(within(dialog).queryByText('Qoʻlda toʻlovni qayd etish')).not.toBeInTheDocument();
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
    http.get('*/api/v1/invoices', () => HttpResponse.json({ items: [invoice()], total: 1, page: 1, page_size: 20 })),
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

  await user.click(await screen.findByTestId(`invoice-row-${INVOICE_PENDING}`));
  const dialog = await findDrawer();
  await within(dialog).findByText('INV-2026-000123');

  const section = within(dialog).getByText('Qoʻlda toʻlovni qayd etish').closest('section')!;
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

test('status translates properly in all 5 languages (uz_latn, uz_cyrl, ru, en, kaa)', async () => {
  server.use(
    http.get('*/api/v1/invoices', () =>
      HttpResponse.json({
        items: [invoice({ id: INVOICE_PAID, status: 'paid' })],
        total: 1,
        page: 1,
        page_size: 20,
      }),
    ),
  );

  const expectations: Record<keyof typeof DICTIONARIES, string> = {
    uz_latn: 'Toʻlangan',
    uz_cyrl: 'Тўланган',
    ru: 'Оплачено',
    en: 'Paid',
    kaa: 'Tólengen',
  };

  for (const [lang, expectedLabel] of Object.entries(expectations)) {
    const { unmount } = renderTab(['payments.view'], lang as keyof typeof DICTIONARIES);
    expect(await screen.findByText(expectedLabel)).toBeInTheDocument();
    unmount();
  }
});
