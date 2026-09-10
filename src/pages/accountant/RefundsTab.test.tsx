import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { RefundsTab } from './RefundsTab';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';
import { DICTIONARIES, I18nContext } from '../../i18n/context';

const APPLICATION_ID = 'a0000000-0000-4000-8000-000000000001';
const INVOICE_ID = 'in000000-0000-4000-8000-000000000001';
const REFUND_ID = 'r0000000-0000-4000-8000-000000000009';
const RF03 = 'c0000000-0000-4000-8000-000000000003';
const REASONS = [
  { id: 'c0000000-0000-4000-8000-000000000001', code: 'RF-01', name: { en: 'Permit revoked' }, status: 'active' },
  { id: RF03, code: 'RF-03', name: { en: 'Overpayment' }, status: 'active' },
];

/** Stage 7.9 task 7's shape: `components`/`available_sources` replace the
 *  old fixed `budget_amount`/`recipient_amount`/`other_amount` trio and the
 *  `allocations`/`recipient_account`/`budget_account` fields this fixture
 *  used to carry. `available_sources` stays `[]` on every route but the
 *  single-item `GET /refunds/{id}` — see `RefundOut`'s own docstring in
 *  `src/api/schema.d.ts`. */
function refund(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: REFUND_ID,
    application_id: APPLICATION_ID,
    invoice_id: INVOICE_ID,
    basis_item_id: 'basis-1',
    suggested_amount: '360000.00',
    suggestion_reason: null,
    final_amount: null,
    status: 'requested',
    requested_by: 'u-1',
    requested_at: '2026-08-01T09:00:00Z',
    due_at: '2026-08-31',
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

function renderTab(permissions: string[]) {
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
  return render(<RefundsTab />, { wrapper });
}

test('the register lists a refund with its suggested amount and status', async () => {
  server.use(http.get('*/api/v1/refunds', () => HttpResponse.json({ items: [refund()], total: 1, page: 1, page_size: 100 })));
  renderTab(['payments.view']);

  const row = await screen.findByTestId(`refund-row-${REFUND_ID}`);
  expect(within(row).getByText('360 000')).toBeInTheDocument();
  expect(within(row).getByText(/ralgan$/)).toBeInTheDocument();
});

test('a refund with no suggestion says so instead of showing a blank cell', async () => {
  server.use(
    http.get('*/api/v1/refunds', () =>
      HttpResponse.json({ items: [refund({ suggested_amount: null })], total: 1, page: 1, page_size: 100 }),
    ),
  );
  renderTab(['payments.view']);

  const row = await screen.findByTestId(`refund-row-${REFUND_ID}`);
  expect(within(row).getByText(/Tavsiya/)).toBeInTheDocument();
});

test('filing a new request is offered only to a payments.manage holder', async () => {
  server.use(http.get('*/api/v1/refunds', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 100 })));
  renderTab(['payments.view']);

  await screen.findByText('Arizalar topilmadi.');
  expect(screen.queryByRole('button', { name: 'Yangi ariza' })).not.toBeInTheDocument();
});

test('filing a new refund request sends the application id, chosen basis and comment', async () => {
  let requestBody: unknown;
  server.use(
    http.get('*/api/v1/refunds', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 100 })),
    http.get('*/api/v1/refs/classifiers/refund_reasons/items', () => HttpResponse.json(REASONS)),
    http.post('*/api/v1/refunds', async ({ request }) => {
      requestBody = await request.json();
      return HttpResponse.json(refund({ comment: (requestBody as { comment: string }).comment }), { status: 201 });
    }),
  );
  const user = userEvent.setup();
  renderTab(['payments.view', 'payments.manage']);

  await screen.findByText('Arizalar topilmadi.');
  await user.click(screen.getByRole('button', { name: 'Yangi ariza' }));

  const dialog = screen.getByRole('dialog');
  await user.type(within(dialog).getByLabelText('Ariza ID'), APPLICATION_ID);
  await user.selectOptions(within(dialog).getByLabelText('Asos'), RF03);
  await user.type(within(dialog).getByLabelText('Izoh'), 'Mijoz talabi');
  await user.click(within(dialog).getByRole('button', { name: 'Yuborish' }));

  expect(requestBody).toEqual({ application_id: APPLICATION_ID, basis_item_id: RF03, comment: 'Mijoz talabi' });
});

test('a failed refund_reasons load says so in the new-request modal, not a silently disabled Submit', async () => {
  server.use(
    http.get('*/api/v1/refunds', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 100 })),
    http.get('*/api/v1/refs/classifiers/refund_reasons/items', () =>
      HttpResponse.json({ error: { code: 'ERR-SYS-001', message: 'boom' } }, { status: 500 }),
    ),
  );
  const user = userEvent.setup();
  renderTab(['payments.view', 'payments.manage']);

  await screen.findByText('Arizalar topilmadi.');
  await user.click(screen.getByRole('button', { name: 'Yangi ariza' }));

  const dialog = screen.getByRole('dialog');
  expect(await within(dialog).findByText('Yuklashda xatolik yuz berdi.')).toBeInTheDocument();
});

/** `AvailableSourceOut[]` — the invoice's own frozen split (stage 7.9 task
 *  7), `GET /refunds/{id}`'s own addition. The register's list rows never
 *  carry this (`available_sources` stays `[]` everywhere but the single-item
 *  read), so the decision modal fetches it by id — this fixture is what that
 *  second request answers. */
const AVAILABLE_SOURCES = [
  { recipient_id: 'recipient-1', name: { uz_latn: 'Davlat byudjeti' }, kind: 'percent' },
  { recipient_id: null, name: { uz_latn: 'Burchmulla oʻrmon xoʻjaligi' }, kind: 'remainder' },
];

test('submitting a decision is offered only on a requested refund, to a payments.manage holder, one row per available source, and posts string amounts', async () => {
  let decisionBody: unknown;
  server.use(
    http.get('*/api/v1/refunds', () => HttpResponse.json({ items: [refund()], total: 1, page: 1, page_size: 100 })),
    http.get('*/api/v1/refunds/:id', () => HttpResponse.json(refund({ available_sources: AVAILABLE_SOURCES }))),
    http.post('*/api/v1/refunds/:id/submit-decision', async ({ request }) => {
      decisionBody = await request.json();
      return HttpResponse.json(refund({ status: 'in_review', final_amount: '360000.00' }));
    }),
  );
  const user = userEvent.setup();
  renderTab(['payments.view', 'payments.manage']);

  const row = await screen.findByTestId(`refund-row-${REFUND_ID}`);
  await user.click(within(row).getByRole('button', { name: 'Qaror qabul qilish' }));

  const dialog = screen.getByRole('dialog');
  const finalAmountInput = within(dialog).getByLabelText('Yakuniy summa');
  expect(finalAmountInput).toHaveValue('360000.00'); // pre-filled from the suggestion

  const budgetInput = await within(dialog).findByTestId('refund-component-recipient-1');
  const leshozInput = within(dialog).getByTestId('refund-component-__leshoz__');
  const submit = within(dialog).getByRole('button', { name: 'Yuborish' });

  // Nothing typed yet: the two rows default to 0.00, which does not match
  // the pre-filled final amount, so the submit stays disabled.
  expect(submit).toBeDisabled();

  await user.clear(budgetInput);
  await user.type(budgetInput, '110000.00');
  await user.clear(leshozInput);
  await user.type(leshozInput, '250000.00');
  expect(submit).toBeEnabled();
  await user.click(submit);

  expect(decisionBody).toEqual({
    final_amount: '360000.00',
    components: [
      { recipient_id: 'recipient-1', amount: '110000.00' },
      { recipient_id: null, amount: '250000.00' },
    ],
    comment: null,
  });
  expect(typeof (decisionBody as { final_amount: unknown }).final_amount).toBe('string');
});

test('the decision submit stays disabled while the sources do not add up to the final amount', async () => {
  server.use(
    http.get('*/api/v1/refunds', () => HttpResponse.json({ items: [refund()], total: 1, page: 1, page_size: 100 })),
    http.get('*/api/v1/refunds/:id', () => HttpResponse.json(refund({ available_sources: AVAILABLE_SOURCES }))),
  );
  const user = userEvent.setup();
  renderTab(['payments.view', 'payments.manage']);

  const row = await screen.findByTestId(`refund-row-${REFUND_ID}`);
  await user.click(within(row).getByRole('button', { name: 'Qaror qabul qilish' }));

  const dialog = screen.getByRole('dialog');
  const budgetInput = await within(dialog).findByTestId('refund-component-recipient-1');
  await user.clear(budgetInput);
  await user.type(budgetInput, '100000.00'); // short of 360000.00

  expect(within(dialog).getByRole('button', { name: 'Yuborish' })).toBeDisabled();
  expect(within(dialog).getByText(/Manbalar boʻyicha summalar/)).toBeInTheDocument();
});

test('approving an in-review refund shows the components a "returned" resolution just wrote, with a null account read as settled outside the system', async () => {
  server.use(
    http.get('*/api/v1/refunds', () =>
      HttpResponse.json({ items: [refund({ status: 'in_review', final_amount: '360000.00' })], total: 1, page: 1, page_size: 100 }),
    ),
    http.post('*/api/v1/refunds/:id/approve', async ({ request }) => {
      const body = (await request.json()) as { resolution: string };
      return HttpResponse.json(
        refund({
          status: body.resolution === 'returned' ? 'returned' : 'rejected',
          final_amount: '360000.00',
          components:
            body.resolution === 'returned'
              ? [{ recipient_id: null, name: { uz_latn: 'Burchmulla oʻrmon xoʻjaligi' }, account: null, amount: '360000.00' }]
              : [],
        }),
      );
    }),
  );
  const user = userEvent.setup();
  renderTab(['payments.view', 'payments.confirm']);

  const row = await screen.findByTestId(`refund-row-${REFUND_ID}`);
  await user.click(within(row).getByRole('button', { name: 'Tasdiqlash (rahbar)' }));

  const dialog = screen.getByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: 'Qaytarish' }));

  expect(await within(dialog).findByText(/qaytarildi\.$/)).toBeInTheDocument();
  expect(within(dialog).getByText('Burchmulla oʻrmon xoʻjaligi')).toBeInTheDocument();
  expect(within(dialog).getByText('tizimdan tashqarida hisoblanadi')).toBeInTheDocument();
});

test('a caller with only payments.confirm (no payments.view) never fires GET /refunds, which would 403, and sees the approve-by-id panel instead', async () => {
  let listCalled = false;
  server.use(
    http.get('*/api/v1/refunds', () => {
      listCalled = true;
      return HttpResponse.json({ items: [], total: 0, page: 1, page_size: 100 });
    }),
  );
  renderTab(['payments.confirm']);

  expect(await screen.findByTestId('refund-approve-by-id-panel')).toBeInTheDocument();
  expect(screen.queryByTestId(`refund-row-${REFUND_ID}`)).not.toBeInTheDocument();
  expect(listCalled).toBe(false);
});

test('the approve-by-id panel approves a refund purely by its id, with no row ever loaded', async () => {
  let approveBody: unknown;
  server.use(
    http.post('*/api/v1/refunds/:id/approve', async ({ request, params }) => {
      approveBody = await request.json();
      expect(params.id).toBe(REFUND_ID);
      return HttpResponse.json(
        refund({ status: 'returned', components: [{ recipient_id: null, name: { uz_latn: 'Leshoz' }, account: '2020...', amount: '360000.00' }] }),
      );
    }),
  );
  const user = userEvent.setup();
  renderTab(['payments.confirm']);

  const panel = await screen.findByTestId('refund-approve-by-id-panel');
  await user.type(within(panel).getByLabelText('Ariza (qaytarish) ID'), REFUND_ID);
  await user.click(within(panel).getByRole('button', { name: 'Qaytarish' }));

  expect(approveBody).toEqual({ resolution: 'returned', comment: null });
  expect(await within(panel).findByText(/qaytarildi\.$/)).toBeInTheDocument();
});
