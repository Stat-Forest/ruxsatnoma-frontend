/**
 * Stage 10, F2 (rulings #181/#182) — the registrar's workplace. Four things
 * this screen must not get wrong, one test group each:
 *   1. the list renders and paginates, search/status filter the query;
 *   2. the create form's PINFL-first lookup autofills on a 200 and changes
 *      nothing on a 404 — both silently, never an error banner for either;
 *   3. create posts the typed body;
 *   4. remove is a `POST .../remove` with a mandatory reason, never a
 *      DELETE.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { I18nContext } from '../../i18n/context';
import { BeekeepersPage } from './BeekeepersPage';
import type { BeekeeperOut } from './api';

function beekeeper(over: Partial<BeekeeperOut> = {}): BeekeeperOut {
  return {
    id: 'bk000000-0000-4000-8000-000000000001',
    certificate_no: 'BEE-001',
    pinfl: '30260904000003',
    passport_series: 'AD',
    passport_number: '1234567',
    stir: null,
    full_name: 'Asalov Nodir',
    farm_name: 'Nodir asalarichilik xoʻjaligi',
    status: 'active',
    removed_reason: null,
    created_by: 'u0000000-0000-4000-8000-000000000001',
    updated_by: null,
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-01T10:00:00Z',
    ...over,
  };
}

function page(items: BeekeeperOut[], total = items.length) {
  return { items, total, page: 1, page_size: 20 };
}

const server = setupServer(
  http.get('*/api/v1/beekeepers', () => HttpResponse.json(page([beekeeper()]))),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <BeekeepersPage />
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

test('renders the register and its rows', async () => {
  renderPage();
  expect(await screen.findByText('BEE-001')).toBeInTheDocument();
  expect(screen.getByText('Asalov Nodir')).toBeInTheDocument();
});

test('search and status filter reach the query as q/status', async () => {
  let seenQuery: URLSearchParams | null = null;
  server.use(
    http.get('*/api/v1/beekeepers', ({ request }) => {
      seenQuery = new URL(request.url).searchParams;
      return HttpResponse.json(page([]));
    }),
  );
  const user = userEvent.setup();
  renderPage();

  await user.type(screen.getByTestId('beekeepers-filter-q'), 'BEE-001');
  await user.click(screen.getByText('beekeepers.apply'));

  await waitFor(() => expect(seenQuery?.get('q')).toBe('BEE-001'));

  await user.selectOptions(screen.getByTestId('beekeepers-filter-status'), 'beekeepers.filters.removed');
  await waitFor(() => expect(seenQuery?.get('status')).toBe('removed'));
});

test('the PINFL lookup autofills the name and passport on a 200 and stays silent on a 404', async () => {
  server.use(
    http.get('*/api/v1/beekeepers/lookup', ({ request }) => {
      const pinfl = new URL(request.url).searchParams.get('pinfl');
      if (pinfl === '30260904000003') {
        return HttpResponse.json({ full_name: 'Topilgan Shaxs', passport_series: 'AD', passport_number: '7654321' });
      }
      return HttpResponse.json({ error: { code: 'ERR-SYS-003', message: 'not found' } }, { status: 404 });
    }),
  );
  const user = userEvent.setup();
  renderPage();

  await user.click(await screen.findByTestId('beekeeper-create-button'));
  const pinflInput = screen.getByTestId('beekeeper-form-pinfl');

  // 200: fills the name and passport, and shows the honest "auto-filled" note.
  await user.type(pinflInput, '30260904000003');
  await user.tab();
  await waitFor(() => expect(screen.getByTestId('beekeeper-form-full-name')).toHaveValue('Topilgan Shaxs'));
  expect(screen.getByTestId('beekeeper-form-passport-number')).toHaveValue('7654321');
  expect(screen.getByTestId('beekeeper-lookup-applied')).toBeInTheDocument();

  // 404 for a different PINFL: the fields already filled stay exactly as
  // they are — no error, no reset.
  await user.clear(pinflInput);
  await user.type(pinflInput, '99999999999999');
  await user.tab();
  await waitFor(() => expect(screen.queryByTestId('beekeeper-lookup-applied')).not.toBeInTheDocument());
  expect(screen.getByTestId('beekeeper-form-full-name')).toHaveValue('Topilgan Shaxs');
  expect(screen.queryByTestId('beekeeper-form-error')).not.toBeInTheDocument();
});

test('create posts the typed body', async () => {
  let receivedBody: unknown = null;
  server.use(
    http.get('*/api/v1/beekeepers/lookup', () =>
      HttpResponse.json({ error: { code: 'ERR-SYS-003', message: 'not found' } }, { status: 404 }),
    ),
    http.post('*/api/v1/beekeepers', async ({ request }) => {
      receivedBody = await request.json();
      return HttpResponse.json(beekeeper(), { status: 201 });
    }),
  );
  const user = userEvent.setup();
  renderPage();

  await user.click(await screen.findByTestId('beekeeper-create-button'));
  await user.type(screen.getByTestId('beekeeper-form-pinfl'), '30260904000003');
  await user.tab();
  await user.type(screen.getByTestId('beekeeper-form-certificate-no'), 'BEE-002');
  await user.type(screen.getByTestId('beekeeper-form-full-name'), 'Yangi Aʼzo');
  await user.type(screen.getByTestId('beekeeper-form-passport-series'), 'AD');
  await user.type(screen.getByTestId('beekeeper-form-passport-number'), '1112223');

  const submit = screen.getByTestId('beekeeper-form-submit');
  await waitFor(() => expect(submit).toBeEnabled());
  await user.click(submit);

  await waitFor(() => expect(receivedBody).not.toBeNull());
  expect(receivedBody).toEqual({
    certificate_no: 'BEE-002',
    pinfl: '30260904000003',
    passport_series: 'AD',
    passport_number: '1112223',
    stir: null,
    full_name: 'Yangi Aʼzo',
    farm_name: null,
  });
});

test('removal posts a mandatory reason to the remove route, never a DELETE', async () => {
  let removeCalled = false;
  let receivedBody: unknown = null;
  server.use(
    http.post('*/api/v1/beekeepers/:id/remove', async ({ request }) => {
      removeCalled = true;
      receivedBody = await request.json();
      return HttpResponse.json(beekeeper({ status: 'removed', removed_reason: 'Aʼzolik toʻxtatilgan' }));
    }),
  );
  const user = userEvent.setup();
  renderPage();

  await user.click(await screen.findByTestId(`beekeeper-remove-${beekeeper().id}`));
  const submit = screen.getByTestId('remove-beekeeper-submit');
  expect(submit).toBeDisabled();

  await user.type(screen.getByTestId('remove-beekeeper-reason'), 'Aʼzolik toʻxtatilgan');
  expect(submit).not.toBeDisabled();
  await user.click(submit);

  await waitFor(() => expect(removeCalled).toBe(true));
  expect(receivedBody).toEqual({ reason: 'Aʼzolik toʻxtatilgan' });
});

test('a removed row offers no remove action', async () => {
  server.use(http.get('*/api/v1/beekeepers', () => HttpResponse.json(page([beekeeper({ status: 'removed' })]))));
  renderPage();

  await screen.findByText('BEE-001');
  expect(screen.queryByTestId(`beekeeper-remove-${beekeeper().id}`)).not.toBeInTheDocument();
  expect(screen.getByTestId(`beekeeper-edit-${beekeeper().id}`)).toBeInTheDocument();
});
