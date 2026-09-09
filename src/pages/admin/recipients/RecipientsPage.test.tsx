import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { RecipientsPage } from './RecipientsPage';
import { I18nContext, DICTIONARIES } from '../../../i18n/context';
import type { PaymentRecipientOut } from './api';

const BUDGET = 'b0000000-0000-4000-8000-000000000001';
const AGENCY = 'b0000000-0000-4000-8000-000000000002';

function recipient(overrides: Partial<PaymentRecipientOut> & Pick<PaymentRecipientOut, 'id'>): PaymentRecipientOut {
  return {
    name: { uz_latn: 'Qabul qiluvchi' },
    payme_account_id: null,
    kind: 'percent',
    percent: '10.00',
    fixed_amount: null,
    active: true,
    sort_order: 0,
    note: null,
    created_by: null,
    created_at: '2026-09-01T09:00:00+05:00',
    updated_at: '2026-09-01T09:00:00+05:00',
    ...overrides,
  };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function page(items: PaymentRecipientOut[]) {
  return { items, total: items.length, page: 1, page_size: 100 };
}

function mockList(items: PaymentRecipientOut[]) {
  server.use(http.get('*/api/v1/payments/recipients', () => HttpResponse.json(page(items))));
}

function renderPage(lang: 'uz_latn' | 'ru' = 'uz_latn') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const i18n = {
    lang,
    backendLang: lang,
    t: (key: string) => (DICTIONARIES[lang] as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>
          <RecipientsPage />
        </I18nContext.Provider>
      </QueryClientProvider>,
    ),
  };
}

const TWO_ROWS = [
  recipient({ id: BUDGET, name: { uz_latn: 'Davlat byudjeti' }, kind: 'percent', percent: '50.00', payme_account_id: '99999', sort_order: 10 }),
  recipient({ id: AGENCY, name: { uz_latn: 'Agentlik' }, kind: 'percent', percent: '10.00', payme_account_id: null, sort_order: 20 }),
];

test('lists receivers with their rule and shows what the leshoz gets', async () => {
  mockList(TWO_ROWS);
  renderPage();

  expect(await screen.findByText('Davlat byudjeti')).toBeInTheDocument();
  expect(screen.getByText('50%')).toBeInTheDocument();
  expect(screen.getByText('10%')).toBeInTheDocument();
  expect(screen.getByTestId('leshoz-remainder')).toHaveTextContent('40%');
});

test('warns about a receiver with no Payme id, naming it', async () => {
  mockList(TWO_ROWS);
  renderPage();

  const warning = await screen.findByTestId('missing-payme-id-warning');
  expect(warning).toHaveTextContent('Agentlik');
  expect(warning).not.toHaveTextContent('Davlat byudjeti');
});

test('an inactive receiver missing a Payme id does not trigger the warning', async () => {
  mockList([
    recipient({ id: BUDGET, name: { uz_latn: 'Davlat byudjeti' }, percent: '50.00', payme_account_id: '99999' }),
    recipient({ id: AGENCY, name: { uz_latn: 'Toʻxtatilgan' }, percent: '10.00', payme_account_id: null, active: false }),
  ]);
  renderPage();

  await screen.findByText('Davlat byudjeti');
  expect(screen.queryByTestId('missing-payme-id-warning')).not.toBeInTheDocument();
});

test('the empty directory says so instead of an empty table', async () => {
  mockList([]);
  renderPage();

  expect(await screen.findByTestId('payment-recipients-empty')).toBeInTheDocument();
  expect(screen.getByTestId('leshoz-remainder')).toHaveTextContent('100%');
});

test('creating a receiver posts exactly what the form collected', async () => {
  mockList(TWO_ROWS);
  let body: unknown = null;
  server.use(
    http.post('*/api/v1/payments/recipients', async ({ request }) => {
      body = await request.json();
      return HttpResponse.json(recipient({ id: 'new-1', name: { uz_latn: 'Yangi' }, percent: '5.00' }), { status: 201 });
    }),
  );
  const { user } = renderPage();

  await screen.findByText('Davlat byudjeti');
  await user.click(screen.getByRole('button', { name: 'Qabul qiluvchi qoʻshish' }));
  await user.type(screen.getByTestId('recipient-name-uz_latn'), 'Yangi');
  await user.type(screen.getByTestId('recipient-percent'), '5');
  await user.type(screen.getByTestId('recipient-payme-id'), '12345');
  await user.click(screen.getByRole('button', { name: 'Saqlash' }));

  await vi.waitFor(() => expect(body).not.toBeNull());
  expect(body).toMatchObject({
    name: { uz_latn: 'Yangi' },
    kind: 'percent',
    percent: '5',
    payme_account_id: '12345',
  });
});

test('refuses to save a percent total above 100%, before any request', async () => {
  mockList(TWO_ROWS); // 50 + 10 already active
  let posted = false;
  server.use(
    http.post('*/api/v1/payments/recipients', () => {
      posted = true;
      return HttpResponse.json(recipient({ id: 'new-2' }), { status: 201 });
    }),
  );
  const { user } = renderPage();

  await screen.findByText('Davlat byudjeti');
  await user.click(screen.getByRole('button', { name: 'Qabul qiluvchi qoʻshish' }));
  await user.type(screen.getByTestId('recipient-name-uz_latn'), 'Ortiqcha');
  await user.type(screen.getByTestId('recipient-percent'), '45'); // 50 + 10 + 45 = 105
  await user.click(screen.getByRole('button', { name: 'Saqlash' }));

  expect(await screen.findByTestId('recipient-form-error')).toHaveTextContent('100%');
  expect(posted).toBe(false);
});

test('editing a receiver locks its kind and patches the row', async () => {
  mockList(TWO_ROWS);
  let patchedBody: unknown = null;
  server.use(
    http.patch('*/api/v1/payments/recipients/:id', async ({ request }) => {
      patchedBody = await request.json();
      return HttpResponse.json(recipient({ id: AGENCY, name: { uz_latn: 'Agentlik' }, percent: '15.00' }));
    }),
  );
  const { user } = renderPage();

  const row = await screen.findByTestId(`recipient-row-${AGENCY}`);
  await user.click(within(row).getByRole('button', { name: 'Tahrirlash' }));

  expect(screen.getByTestId('recipient-kind')).toBeDisabled();
  const percentInput = screen.getByTestId('recipient-percent') as HTMLInputElement;
  await user.clear(percentInput);
  await user.type(percentInput, '15');
  await user.click(screen.getByRole('button', { name: 'Saqlash' }));

  await vi.waitFor(() => expect(patchedBody).not.toBeNull());
  expect(patchedBody).toMatchObject({ percent: '15', active: true });
});

test('deactivating a receiver sends active: false', async () => {
  mockList(TWO_ROWS);
  let patchedBody: unknown = null;
  server.use(
    http.patch('*/api/v1/payments/recipients/:id', async ({ request }) => {
      patchedBody = await request.json();
      return HttpResponse.json(recipient({ id: AGENCY, active: false }));
    }),
  );
  const { user } = renderPage();

  const row = await screen.findByTestId(`recipient-row-${AGENCY}`);
  await user.click(within(row).getByRole('button', { name: 'Tahrirlash' }));
  await user.click(screen.getByTestId('recipient-active'));
  await user.click(screen.getByRole('button', { name: 'Saqlash' }));

  await vi.waitFor(() => expect(patchedBody).not.toBeNull());
  expect(patchedBody).toMatchObject({ active: false });
});
