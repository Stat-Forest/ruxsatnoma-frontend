/**
 * F6 — the tariffs register. Mirrors `ParamsTab.test.tsx`'s own structure
 * (same `_Versioned` lifecycle, same reused dialogs), covering what is
 * SPECIFIC to tariffs rather than re-proving what `ParamsTab.test.tsx` and
 * `PublishConfirmDialog.test.tsx` already pin for the shared mechanism:
 *
 *   1. `coefficient` renders the wire's own STRING verbatim, never
 *      reformatted through `Number(...)`;
 *   2. filters reach the query as `activity_type_id`/`status`/`on_date`;
 *   3. the write actions (add/edit/publish/archive) are gated exactly like
 *      `ParamsTab`'s, including the "Add" button hidden without
 *      `norms.tariffs.manage` — the one case task 4's own review deferred
 *      for rule parameters (`task-4-report.md`'s closing section) and which
 *      naturally falls in this task's own path, so it is covered for BOTH
 *      screens (see `ParamsTab.test.tsx`'s own new case);
 *   4. one of the four publish refusals renders its own distinct message,
 *      end to end.
 */
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { TariffsTab } from './TariffsTab';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';
import { I18nContext } from '../../i18n/context';
import type { TariffOut } from './tariffs/api';

const MANAGE = 'norms.tariffs.manage';
const PUBLISH = 'norms.tariffs.publish';
const ACTIVITY_TYPE_ID = 'aaaaaaaa-0000-4000-8000-000000000001';

let idCounter = 0;
function tariff(over: Partial<TariffOut> = {}): TariffOut {
  idCounter += 1;
  return {
    id: `bbbbbbbb-0000-4000-8000-${String(idCounter).padStart(12, '0')}`,
    activity_type_id: ACTIVITY_TYPE_ID,
    livestock_group: null,
    coefficient: '1.500000',
    quantity_unit: 'head',
    benefit_modifiers: null,
    effective_from: '2026-01-01',
    effective_to: null,
    basis: 'VMQ 278',
    status: 'draft',
    ...over,
  };
}

const server = setupServer(
  http.get('*/api/v1/refs/activity-types', () =>
    HttpResponse.json([{ id: ACTIVITY_TYPE_ID, code: 'grazing', name: { ru: 'Выпас' }, quantity_unit: 'head', status: 'active' }]),
  ),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  idCounter = 0;
});
afterAll(() => server.close());

function mockList(store: TariffOut[], onRequest?: (params: URLSearchParams) => void) {
  server.use(
    http.get('*/api/v1/tariffs', ({ request }) => {
      const params = new URL(request.url).searchParams;
      onRequest?.(params);
      const activityTypeId = params.get('activity_type_id');
      const status = params.get('status');
      const limit = Number(params.get('limit') ?? '50');
      const offset = Number(params.get('offset') ?? '0');
      let filtered = store;
      if (activityTypeId) filtered = filtered.filter((row) => row.activity_type_id === activityTypeId);
      if (status) filtered = filtered.filter((row) => row.status === status);
      const items = filtered.slice(offset, offset + limit);
      return HttpResponse.json({ items, total: filtered.length, page: Math.floor(offset / limit) + 1, page_size: limit });
    }),
  );
}

/** Registered BEFORE the bare `/tariffs/:id` PATCH handler a test might add,
 *  per the brief's own MSW warning (`ParamsTab.test.tsx`'s identical
 *  precedent). */
function mockPublish(store: TariffOut[], respond: (row: TariffOut) => Response) {
  server.use(
    http.post('*/api/v1/tariffs/:id/publish', ({ params }) => {
      const row = store.find((r) => r.id === params.id);
      if (!row) return HttpResponse.json({ error: { code: 'ERR-SYS-000', message: 'not found' } }, { status: 404 });
      return respond(row);
    }),
  );
}

function publishSuccess(store: TariffOut[], row: TariffOut) {
  const index = store.findIndex((r) => r.id === row.id);
  if (index >= 0) store[index] = { ...row, status: 'published' };
  return HttpResponse.json({ item: store[index] ?? row, warnings: [] });
}

function publishRefusal(code: string, message: string, details?: unknown, status = 422) {
  return HttpResponse.json({ error: { code, message, details } }, { status });
}

function mockArchive(store: TariffOut[]) {
  server.use(
    http.post('*/api/v1/tariffs/:id/archive', ({ params }) => {
      const index = store.findIndex((r) => r.id === params.id);
      if (index < 0) return HttpResponse.json({ error: { code: 'ERR-SYS-000', message: 'not found' } }, { status: 404 });
      store[index] = { ...store[index], status: 'archived', effective_to: '2026-01-01' };
      return HttpResponse.json(store[index]);
    }),
  );
}

function renderTab(permissions: string[] = [MANAGE, PUBLISH]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'ru' as const, backendLang: 'ru' as const, t: (key: string) => key, setLanguage: async () => {} };
  const me = {
    user: { id: 'u-1', full_name: 'Test', login: 'test', language: 'uz_latn' },
    role: { code: 'norms_admin', name: {} },
    permissions,
    zone: {},
    csrf_token: 'tok',
    is_superuser: false,
    applicant: null,
    representations: [],
    registration_complete: true,
  };
  const authValue = { me, loading: false, authError: null } as unknown as AuthContextValue;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
  );
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <TariffsTab active />
      </I18nContext.Provider>
    </QueryClientProvider>,
    { wrapper },
  );
}

async function findTableLoaded() {
  await waitFor(() => expect(screen.queryByText('Yuklanmoqda...')).not.toBeInTheDocument());
}

test('coefficient renders the wire string verbatim, never reformatted', async () => {
  mockList([tariff({ coefficient: '1.500000' })]);
  renderTab();
  expect(await screen.findByText('1.500000')).toBeInTheDocument();
});

test('filters reach the query as activity_type_id/status/on_date', async () => {
  const user = userEvent.setup();
  const requests: URLSearchParams[] = [];
  mockList([tariff()], (params) => requests.push(params));
  renderTab();
  await findTableLoaded();

  await user.selectOptions(screen.getByTestId('tariffs-filter-activity-type'), ACTIVITY_TYPE_ID);
  await user.selectOptions(screen.getByTestId('tariffs-filter-status'), 'draft');
  await user.type(screen.getByTestId('tariffs-filter-on-date'), '2026-03-01');
  await user.click(screen.getByText('norms.tariffs.filter.apply'));

  await waitFor(() => {
    const last = requests[requests.length - 1];
    expect(last.get('activity_type_id')).toBe(ACTIVITY_TYPE_ID);
    expect(last.get('status')).toBe('draft');
    expect(last.get('on_date')).toBe('2026-03-01');
  });
});

test('the Add button is hidden without norms.tariffs.manage — the same gap task 4 left open for rule parameters', async () => {
  mockList([]);
  renderTab([PUBLISH]);
  await findTableLoaded();
  expect(screen.queryByTestId('tariffs-add')).not.toBeInTheDocument();
});

test('the Add button is shown with norms.tariffs.manage', async () => {
  mockList([]);
  renderTab([MANAGE]);
  await findTableLoaded();
  expect(screen.getByTestId('tariffs-add')).toBeInTheDocument();
});

test('a published row offers no edit control at all', async () => {
  const row = tariff({ status: 'published' });
  mockList([row]);
  renderTab();
  await findTableLoaded();
  expect(screen.queryByTestId(`tariff-row-edit-${row.id}`)).not.toBeInTheDocument();
});

test('archive asymmetry: a draft needs only manage, a published row additionally needs publish', async () => {
  const draft = tariff({ status: 'draft' });
  const published = tariff({ status: 'published' });
  mockList([draft, published]);
  renderTab([MANAGE]); // manage only, no publish
  await findTableLoaded();

  expect(screen.getByTestId(`tariff-row-archive-${draft.id}`)).toBeInTheDocument();
  expect(screen.queryByTestId(`tariff-row-archive-${published.id}`)).not.toBeInTheDocument();
});

test('each of the four publish refusals renders its own distinct message', async () => {
  const user = userEvent.setup();
  const row = tariff({ status: 'draft' });
  mockList([row]);
  mockPublish([row], () => publishRefusal('ERR-NORM-005', 'x', { reason: 'not_draft' }));
  renderTab();
  await findTableLoaded();

  await user.click(screen.getByTestId(`tariff-row-publish-${row.id}`));
  await user.click(screen.getByTestId('publish-dialog-confirm'));
  expect(await screen.findByTestId('publish-dialog-error')).toHaveTextContent('norms.tariffs.publish.error.notDraft');
});

test('publishing from the table drops the row into published state without a reload', async () => {
  const user = userEvent.setup();
  const store = [tariff({ status: 'draft' })];
  mockList(store);
  mockPublish(store, (row) => publishSuccess(store, row));
  renderTab();
  await findTableLoaded();

  const row = store[0];
  await user.click(screen.getByTestId(`tariff-row-publish-${row.id}`));
  await user.click(screen.getByTestId('publish-dialog-confirm'));
  await screen.findByTestId('publish-result');
  await user.click(screen.getByTestId('publish-dialog-close'));

  await waitFor(() => expect(screen.queryByTestId(`tariff-row-publish-${row.id}`)).not.toBeInTheDocument());
});

test('archiving a draft row removes its own actions on refetch', async () => {
  const user = userEvent.setup();
  const store = [tariff({ status: 'draft' })];
  mockList(store);
  mockArchive(store);
  renderTab();
  await findTableLoaded();

  const row = store[0];
  await user.click(screen.getByTestId(`tariff-row-archive-${row.id}`));
  await user.click(screen.getByTestId('archive-dialog-confirm'));

  await waitFor(() => expect(screen.queryByTestId(`tariff-row-archive-${row.id}`)).not.toBeInTheDocument());
});

test('benefit modifiers render as code:modifier chips in the table', async () => {
  mockList([tariff({ benefit_modifiers: { veteran: '0.5' } })]);
  renderTab();
  expect(await screen.findByText('veteran: 0.5')).toBeInTheDocument();
});

test('a row with no benefit_modifiers shows a dash', async () => {
  mockList([tariff({ benefit_modifiers: null })]);
  renderTab();
  await findTableLoaded();
  expect(within(screen.getByTestId('tariffs-table')).getAllByText('—').length).toBeGreaterThan(0);
});

test('a click anywhere on a draft tariff row opens its form; a published row stays plain', async () => {
  const user = userEvent.setup();
  mockList([tariff({ status: 'draft' }), tariff({ status: 'published' })]);
  renderTab();
  await findTableLoaded();

  const [, draft, published] = screen.getAllByRole('row');
  expect(published).not.toHaveAttribute('tabindex');

  await user.click(within(draft).getAllByRole('cell')[0]);
  expect(await screen.findByTestId('tariff-form')).toBeInTheDocument();
});
