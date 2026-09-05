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

function refund(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: REFUND_ID,
    application_id: APPLICATION_ID,
    invoice_id: INVOICE_ID,
    basis_item_id: 'basis-1',
    suggested_amount: '360000.00',
    suggestion_reason: null,
    final_amount: null,
    budget_amount: null,
    recipient_amount: null,
    other_amount: null,
    status: 'requested',
    requested_by: 'u-1',
    requested_at: '2026-08-01T09:00:00Z',
    due_at: '2026-08-31',
    decided_by: null,
    decided_at: null,
    comment: null,
    recipient_account: null,
    budget_account: null,
    allocations: [],
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
  await user.selectOptions(within(dialog).getByLabelText('Asos'), 'RF-03');
  await user.type(within(dialog).getByLabelText('Izoh'), 'Mijoz talabi');
  await user.click(within(dialog).getByRole('button', { name: 'Yuborish' }));

  expect(requestBody).toEqual({ application_id: APPLICATION_ID, basis_item_id: 'RF-03', comment: 'Mijoz talabi' });
});

test('submitting a decision is offered only on a requested refund, to a payments.manage holder, and posts string amounts', async () => {
  let decisionBody: unknown;
  server.use(
    http.get('*/api/v1/refunds', () => HttpResponse.json({ items: [refund()], total: 1, page: 1, page_size: 100 })),
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
  const recipientInput = within(dialog).getByLabelText('Ijrochi ulushi');
  await user.clear(recipientInput);
  await user.type(recipientInput, '360000.00');
  await user.click(within(dialog).getByRole('button', { name: 'Yuborish' }));

  expect(decisionBody).toEqual({
    final_amount: '360000.00',
    budget_amount: '0.00',
    recipient_amount: '360000.00',
    other_amount: '0.00',
    comment: null,
  });
  expect(typeof (decisionBody as { final_amount: unknown }).final_amount).toBe('string');
});

test('approving an in-review refund shows the allocations a "returned" resolution just wrote, with a null account read as settled outside the system', async () => {
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
          allocations: body.resolution === 'returned' ? [{ target: 'budget', account: null, amount: '-360000.00' }] : [],
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
  expect(within(dialog).getByText('tizimdan tashqarida hisoblanadi')).toBeInTheDocument();
});
