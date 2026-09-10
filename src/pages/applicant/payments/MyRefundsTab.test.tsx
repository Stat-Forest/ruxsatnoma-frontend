import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { DICTIONARIES, I18nContext, type UiLanguage } from '../../../i18n/context';
import { REFUND_STATUS_LABEL_I18N } from '../../accountant/statusMeta';
import { MyRefundsTab } from './MyRefundsTab';

const APP_ONE = 'a0000000-0000-4000-8000-000000000001';
const APP_TWO = 'a0000000-0000-4000-8000-000000000002';
const RF01 = 'c0000000-0000-4000-8000-000000000001';
const RF02 = 'c0000000-0000-4000-8000-000000000002';

const REASONS = [
  { id: RF01, code: 'RF-01', name: { uz_cyrl: 'Рухсатнома бекор қилинди', en: 'Permit revoked' }, status: 'active' },
  { id: RF02, code: 'RF-02', name: { uz_cyrl: 'Фойдаланилмаган давр қолди', en: 'Unused period remains' }, status: 'active' },
];

function page<T>(items: T[]) {
  return { items, total: items.length, page: 1, page_size: 50 };
}

function refund(overrides: Record<string, unknown>) {
  return {
    id: 'r-1',
    application_id: APP_ONE,
    invoice_id: 'i-1',
    basis_item_id: RF02,
    suggested_amount: null,
    suggestion_reason: null,
    final_amount: null,
    status: 'requested',
    requested_by: 'u-1',
    requested_at: '2026-09-01T09:00:00Z',
    due_at: '2026-09-29',
    decided_by: null,
    decided_at: null,
    comment: null,
    components: [],
    available_sources: [],
    ...overrides,
  };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function mockBackend(options: { refunds?: unknown[]; invoices?: unknown[] }) {
  server.use(
    http.get('*/api/v1/refunds', () => HttpResponse.json(page(options.refunds ?? []))),
    http.get('*/api/v1/invoices', () => HttpResponse.json(page(options.invoices ?? []))),
    http.get('*/api/v1/applications', () =>
      HttpResponse.json({ items: [{ id: APP_ONE, number: 'RX-2026-000010', status: 'PAID' }, { id: APP_TWO, number: 'RX-2026-000011', status: 'INVOICED' }], total: 2, page: 1, page_size: 100 }),
    ),
    http.get('*/api/v1/refs/classifiers/refund_reasons/items', () => HttpResponse.json(REASONS)),
  );
}

function renderTab(lang: UiLanguage = 'uz_latn') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
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
  return render(<MyRefundsTab />, { wrapper });
}

test('lists the citizen own refunds with the basis name, the status, the deadline, the decision date and the comment', async () => {
  mockBackend({
    refunds: [
      refund({ comment: 'Mol kasal boʻldi' }),
      refund({ id: 'r-2', status: 'returned', final_amount: '300000.00', decided_at: '2026-09-10T10:00:00Z' }),
    ],
  });
  renderTab();

  // Both refunds in this fixture share `application_id: APP_ONE` (the second
  // override only changes status/final_amount/decided_at), so the number
  // renders twice — one link per row — never a single match.
  expect(await screen.findAllByText('RX-2026-000010')).toHaveLength(2);
  expect(screen.getAllByText('Фойдаланилмаган давр қолди')).toHaveLength(2);
  expect(screen.getByText(REFUND_STATUS_LABEL_I18N.uz_latn.requested)).toBeInTheDocument();
  expect(screen.getByText('Qaror kutilmoqda')).toBeInTheDocument();
  expect(screen.getByText(REFUND_STATUS_LABEL_I18N.uz_latn.returned)).toBeInTheDocument();
  expect(screen.getByText(/300 000/)).toBeInTheDocument();
  // r-1 (`requested`, `decided_at: null`) shows its own comment.
  expect(screen.getByText('Mol kasal boʻldi')).toBeInTheDocument();
  // r-2 (`returned`, `decided_at` set) shows the formatted decision date.
  expect(screen.getByText(/10\.09\.2026/)).toBeInTheDocument();
});

test('a failed refunds list keeps the "file a request" button visible above the error', async () => {
  server.use(
    http.get('*/api/v1/refunds', () => HttpResponse.json({ error: { code: 'ERR-SYS-001', message: 'boom' } }, { status: 500 })),
    http.get('*/api/v1/invoices', () => HttpResponse.json(page([]))),
    http.get('*/api/v1/applications', () => HttpResponse.json(page([]))),
    http.get('*/api/v1/refs/classifiers/refund_reasons/items', () => HttpResponse.json(REASONS)),
  );
  renderTab();

  expect(await screen.findByText('Qaytarishlarni yuklab boʻlmadi.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Qaytarish soʻrash' })).toBeInTheDocument();
});

test('the status badge follows the UI language, not a fixed uz_latn label', async () => {
  mockBackend({ refunds: [refund({})] });
  renderTab('ru');

  await screen.findByText('RX-2026-000010');
  const table = screen.getByRole('table');
  expect(within(table).getByText(REFUND_STATUS_LABEL_I18N.ru.requested)).toBeInTheDocument();
});

test('filing a request sends the chosen application, the classifier item ID (never its code) and the comment', async () => {
  let requestBody: unknown;
  const urls: string[] = [];
  mockBackend({
    invoices: [
      { id: 'i-1', number: 'INV-1', application_id: APP_ONE, status: 'paid', amount: '150000.00', issued_at: '2026-09-01T09:00:00Z', due_at: '2026-09-11T09:00:00Z', paid_at: '2026-09-02T09:00:00Z', calculation_id: null, recipients: null, settled_by_benefit: false },
    ],
  });
  server.use(
    http.get('*/api/v1/refunds', ({ request }) => {
      urls.push(request.url);
      return HttpResponse.json(page([]));
    }),
    http.post('*/api/v1/refunds', async ({ request }) => {
      requestBody = await request.json();
      return HttpResponse.json(refund({ comment: 'Mol kasal boʻldi' }), { status: 201 });
    }),
  );
  const user = userEvent.setup();
  renderTab();

  await screen.findByText('Qaytarish soʻrovlari yoʻq.');
  await user.click(screen.getByRole('button', { name: 'Qaytarish soʻrash' }));

  const dialog = screen.getByRole('dialog');
  await user.selectOptions(within(dialog).getByLabelText('Ariza'), APP_ONE);
  await user.selectOptions(within(dialog).getByLabelText('Asos'), RF01);
  await user.type(within(dialog).getByLabelText('Izoh'), 'Mol kasal boʻldi');
  await user.click(within(dialog).getByRole('button', { name: 'Yuborish' }));

  expect(requestBody).toEqual({ application_id: APP_ONE, basis_item_id: RF01, comment: 'Mol kasal boʻldi' });
  expect(await screen.findByText(/Soʻrov yuborildi/)).toBeInTheDocument();
  expect(new URL(urls[0]).searchParams.get('application_id')).toBeNull();
});

test('the application select offers only applications that carry an invoice', async () => {
  mockBackend({
    invoices: [
      { id: 'i-2', number: 'INV-2', application_id: APP_TWO, status: 'pending', amount: '1.00', issued_at: '2026-09-01T09:00:00Z', due_at: '2026-09-11T09:00:00Z', paid_at: null, calculation_id: null, recipients: null, settled_by_benefit: false },
    ],
  });
  const user = userEvent.setup();
  renderTab();

  await screen.findByText('Qaytarish soʻrovlari yoʻq.');
  await user.click(screen.getByRole('button', { name: 'Qaytarish soʻrash' }));

  const select = within(screen.getByRole('dialog')).getByLabelText('Ariza') as HTMLSelectElement;
  expect(Array.from(select.options).map((option) => option.value)).toEqual([APP_TWO]);
});

test('with no invoiced application the modal says why it cannot file', async () => {
  mockBackend({});
  const user = userEvent.setup();
  renderTab();

  await screen.findByText('Qaytarish soʻrovlari yoʻq.');
  await user.click(screen.getByRole('button', { name: 'Qaytarish soʻrash' }));

  expect(within(screen.getByRole('dialog')).getByText(/Hisob-fakturasi bor ariza topilmadi/)).toBeInTheDocument();
  expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Yuborish' })).toBeDisabled();
});

test('a modal opened before the applications and reasons resolve still files the first of each once they arrive', async () => {
  let requestBody: unknown;
  mockBackend({});
  server.use(
    // The two lists the modal derives its default selection from answer late
    // — opening the modal right after the refunds list renders must not
    // freeze `applicationId`/`basisItemId` at '' once these resolve.
    http.get('*/api/v1/invoices', async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return HttpResponse.json(
        page([
          {
            id: 'i-1',
            number: 'INV-1',
            application_id: APP_ONE,
            status: 'paid',
            amount: '150000.00',
            issued_at: '2026-09-01T09:00:00Z',
            due_at: '2026-09-11T09:00:00Z',
            paid_at: '2026-09-02T09:00:00Z',
            calculation_id: null,
            recipients: null,
            settled_by_benefit: false,
          },
        ]),
      );
    }),
    http.get('*/api/v1/refs/classifiers/refund_reasons/items', async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return HttpResponse.json(REASONS);
    }),
    http.post('*/api/v1/refunds', async ({ request }) => {
      requestBody = await request.json();
      return HttpResponse.json(refund({}), { status: 201 });
    }),
  );
  const user = userEvent.setup();
  renderTab();

  await screen.findByText('Qaytarish soʻrovlari yoʻq.');
  await user.click(screen.getByRole('button', { name: 'Qaytarish soʻrash' }));

  const dialog = screen.getByRole('dialog');
  const option = await within(dialog).findByRole('option', { name: /RX-2026-000010/ });
  // Invoice status 'paid' shows the translated label, never the raw code.
  expect(option).toHaveTextContent('Toʻlangan');
  const submit = within(dialog).getByRole('button', { name: 'Yuborish' });
  await waitFor(() => expect(submit).not.toBeDisabled());
  await user.click(submit);

  expect(requestBody).toEqual({ application_id: APP_ONE, basis_item_id: RF01, comment: null });
});

test('a failed invoices load says so in the modal, never "no billable applications"', async () => {
  mockBackend({});
  server.use(http.get('*/api/v1/invoices', () => HttpResponse.json({ error: { code: 'ERR-SYS-001', message: 'boom' } }, { status: 500 })));
  const user = userEvent.setup();
  renderTab();

  await screen.findByText('Qaytarish soʻrovlari yoʻq.');
  await user.click(screen.getByRole('button', { name: 'Qaytarish soʻrash' }));

  const dialog = screen.getByRole('dialog');
  expect(await within(dialog).findByText('Hisob-fakturalarni yuklab boʻlmadi.')).toBeInTheDocument();
  expect(within(dialog).queryByText(/Hisob-fakturasi bor ariza topilmadi/)).not.toBeInTheDocument();
});

test('a failed refund_reasons load says so in the modal', async () => {
  mockBackend({});
  server.use(http.get('*/api/v1/refs/classifiers/refund_reasons/items', () => HttpResponse.json({ error: { code: 'ERR-SYS-001', message: 'boom' } }, { status: 500 })));
  const user = userEvent.setup();
  renderTab();

  await screen.findByText('Qaytarish soʻrovlari yoʻq.');
  await user.click(screen.getByRole('button', { name: 'Qaytarish soʻrash' }));

  const dialog = screen.getByRole('dialog');
  expect(await within(dialog).findByText('Qaytarish asoslarini yuklab boʻlmadi.')).toBeInTheDocument();
});
