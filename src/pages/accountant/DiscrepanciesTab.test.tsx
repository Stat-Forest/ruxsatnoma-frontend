import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { DiscrepanciesTab } from './DiscrepanciesTab';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';
import { DICTIONARIES, I18nContext } from '../../i18n/context';

const RECONCILIATION_ID = 'r0000000-0000-4000-8000-000000000001';
const INVOICE_ID = 'in000000-0000-4000-8000-000000000001';
const CONFIRMATION_ID = 'c0000000-0000-4000-8000-000000000001';

function reconciliation(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: RECONCILIATION_ID,
    statement_line_id: 'line-1',
    transaction_id: null,
    invoice_id: INVOICE_ID,
    result: 'discrepancy',
    difference: '-100000.00',
    status: 'open',
    assigned_to: null,
    comment: null,
    resolution_doc_id: null,
    resolved_by: null,
    resolved_at: null,
    occurred_at: '2026-08-05T09:00:00Z',
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
  return render(<DiscrepanciesTab />, { wrapper });
}

test('the open register lists a discrepancy with its signed difference', async () => {
  server.use(
    http.get('*/api/v1/payments/reconciliations', ({ request }) => {
      const url = new URL(request.url);
      expect(url.searchParams.get('status')).toBe('open');
      return HttpResponse.json({ items: [reconciliation()], total: 1, page: 1, page_size: 100 });
    }),
  );
  renderTab(['payments.view', 'payments.manage']);

  expect(await screen.findByTestId(`reconciliation-row-${RECONCILIATION_ID}`)).toBeInTheDocument();
  expect(screen.getByText('Nomuvofiqlik')).toBeInTheDocument();
  expect(screen.getByText('-100 000')).toBeInTheDocument();
});

test('switching to the resolved filter re-queries with status=resolved', async () => {
  server.use(
    http.get('*/api/v1/payments/reconciliations', ({ request }) => {
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      return HttpResponse.json({
        items: status === 'resolved' ? [reconciliation({ status: 'resolved', comment: 'done' })] : [reconciliation()],
        total: 1,
        page: 1,
        page_size: 100,
      });
    }),
  );
  const user = userEvent.setup();
  renderTab(['payments.view']);

  await screen.findByTestId(`reconciliation-row-${RECONCILIATION_ID}`);
  await user.click(screen.getByRole('button', { name: 'Yopilgan' }));

  expect(await screen.findByText('done')).toBeInTheDocument();
});

test('resolving is offered only to a payments.manage holder, on an open row', async () => {
  server.use(
    http.get('*/api/v1/payments/reconciliations', () => HttpResponse.json({ items: [reconciliation()], total: 1, page: 1, page_size: 100 })),
  );
  renderTab(['payments.view']); // no payments.manage

  await screen.findByTestId(`reconciliation-row-${RECONCILIATION_ID}`);
  expect(screen.queryByRole('button', { name: 'Yopish' })).not.toBeInTheDocument();
});

test('resolving requires a non-blank comment and posts it, optionally with an uploaded document', async () => {
  let resolvedBody: unknown;
  server.use(
    http.get('*/api/v1/payments/reconciliations', () => HttpResponse.json({ items: [reconciliation()], total: 1, page: 1, page_size: 100 })),
    http.post('*/api/v1/payments/reconciliations/:id/resolve', async ({ request }) => {
      resolvedBody = await request.json();
      return HttpResponse.json(reconciliation({ status: 'resolved', comment: (resolvedBody as { comment: string }).comment }));
    }),
  );
  const user = userEvent.setup();
  renderTab(['payments.view', 'payments.manage']);

  await screen.findByTestId(`reconciliation-row-${RECONCILIATION_ID}`);
  await user.click(screen.getByRole('button', { name: 'Yopish' }));

  const dialog = screen.getByRole('dialog');
  const submitButton = within(dialog).getByRole('button', { name: 'Yozuvni yopish' });
  expect(submitButton).toBeDisabled();

  await user.type(within(dialog).getByLabelText('Izoh'), 'Bank bilan telefon orqali kelishildi');
  expect(submitButton).toBeEnabled();
  await user.click(submitButton);

  expect(resolvedBody).toMatchObject({ comment: 'Bank bilan telefon orqali kelishildi', resolution_doc_id: null });
});

test('the manual-confirmation checker panel is offered only to a payments.confirm holder', async () => {
  server.use(
    http.get('*/api/v1/payments/reconciliations', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 100 })),
  );
  renderTab(['payments.view', 'payments.manage']); // no payments.confirm
  await screen.findByText('Yozuvlar topilmadi.');
  expect(screen.queryByTestId('manual-check-panel')).not.toBeInTheDocument();
});

test('confirming a manual confirmation by id calls the confirm route and shows the result', async () => {
  server.use(
    http.get('*/api/v1/payments/reconciliations', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 100 })),
    http.post('*/api/v1/payments/manual-confirmations/:id/confirm', ({ params }) =>
      HttpResponse.json({
        id: params.id,
        invoice_id: INVOICE_ID,
        amount: '2060000.00',
        paid_at: '2026-08-05T10:00:00',
        bank_doc_file_id: 'file-1',
        maker_id: 'u-2',
        checker_id: 'u-1',
        status: 'confirmed',
        reason: null,
        checked_at: '2026-08-05T11:00:00Z',
        created_at: '2026-08-05T10:05:00Z',
      }),
    ),
  );
  const user = userEvent.setup();
  renderTab(['payments.view', 'payments.confirm']);

  const panel = await screen.findByTestId('manual-check-panel');
  await user.type(within(panel).getByLabelText('Qayd ID'), CONFIRMATION_ID);
  await user.click(within(panel).getByRole('button', { name: 'Tasdiqlash' }));

  expect(await screen.findByText('Tasdiqlandi. Hisob-faktura toʻlangan deb belgilandi.')).toBeInTheDocument();
});

test('the maker-is-checker refusal (ERR-ACL-001) reads as a plain explanation, not a raw code', async () => {
  server.use(
    http.get('*/api/v1/payments/reconciliations', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 100 })),
    http.post('*/api/v1/payments/manual-confirmations/:id/confirm', () =>
      HttpResponse.json({ error: { code: 'ERR-ACL-001', message: 'maker cannot check' } }, { status: 403 }),
    ),
  );
  const user = userEvent.setup();
  renderTab(['payments.view', 'payments.confirm']);

  const panel = await screen.findByTestId('manual-check-panel');
  await user.type(within(panel).getByLabelText('Qayd ID'), CONFIRMATION_ID);
  await user.click(within(panel).getByRole('button', { name: 'Tasdiqlash' }));

  expect(
    await screen.findByText('Siz bu qaydni qilgan shaxssiz — uni tasdiqlay olmaysiz, boshqa shaxs tasdiqlashi kerak.'),
  ).toBeInTheDocument();
});

test('rejecting requires a reason before it can be submitted', async () => {
  let rejectBody: unknown;
  server.use(
    http.get('*/api/v1/payments/reconciliations', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 100 })),
    http.post('*/api/v1/payments/manual-confirmations/:id/reject', async ({ request, params }) => {
      rejectBody = await request.json();
      return HttpResponse.json({
        id: params.id,
        invoice_id: INVOICE_ID,
        amount: '2060000.00',
        paid_at: '2026-08-05T10:00:00',
        bank_doc_file_id: 'file-1',
        maker_id: 'u-2',
        checker_id: 'u-1',
        status: 'rejected',
        reason: (rejectBody as { reason: string }).reason,
        checked_at: '2026-08-05T11:00:00Z',
        created_at: '2026-08-05T10:05:00Z',
      });
    }),
  );
  const user = userEvent.setup();
  renderTab(['payments.view', 'payments.confirm']);

  const panel = await screen.findByTestId('manual-check-panel');
  await user.type(within(panel).getByLabelText('Qayd ID'), CONFIRMATION_ID);
  await user.click(within(panel).getByRole('button', { name: 'Rad etish' }));

  const submitReject = within(panel).getByRole('button', { name: 'Rad etishni tasdiqlash' });
  expect(submitReject).toBeDisabled();

  await user.type(within(panel).getByLabelText('Rad etish sababi'), 'Hujjat notoʻgʻri');
  await user.click(submitReject);

  expect(rejectBody).toEqual({ reason: 'Hujjat notoʻgʻri' });
  expect(await screen.findByText('Rad etildi. Hisob-faktura toʻlanmagan holicha qoladi.')).toBeInTheDocument();
});

test('a caller with only payments.confirm (the checker, no payments.view) never fires GET /payments/reconciliations, which would 403', async () => {
  let listCalled = false;
  server.use(
    http.get('*/api/v1/payments/reconciliations', () => {
      listCalled = true;
      return HttpResponse.json({ items: [], total: 0, page: 1, page_size: 100 });
    }),
  );
  renderTab(['payments.confirm']);

  expect(await screen.findByTestId('manual-check-panel')).toBeInTheDocument();
  expect(screen.queryByText('Nomuvofiqliklar reestri')).not.toBeInTheDocument();
  expect(listCalled).toBe(false);
});
