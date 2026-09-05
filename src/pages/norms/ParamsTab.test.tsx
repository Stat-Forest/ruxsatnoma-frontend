/**
 * F7 — the rule-parameters register.
 *
 * The five things task-3's brief pins down, one test each:
 *   1. the banner fires and names the right count when a `coef_sb:*` draft
 *      exists;
 *   2. it stops firing once every `coef_sb:*` row is published, even with an
 *      UNRELATED draft still in the register — proving the condition is
 *      "coef_sb AND draft", not "any draft";
 *   3. it is not keyed on `basis` — an edited `basis` still raises it;
 *   4. `value` (`unknown` on the wire) renders by its runtime type: a JSON
 *      string, a number, a boolean;
 *   5. filters/paging reach the query as `status`/`code`/`limit`/`offset`,
 *      and the table reads `total` off the envelope.
 *
 * `t` returns the key itself — same precedent as `NormsPage.test.tsx` and
 * `IntegrationsPage.test.tsx` for a page rendered outside `I18nProvider`;
 * assertions below key off `data-testid`s and the runtime-typed VALUES
 * (`"0.8"`, `10`, `true`), never off translated copy.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ParamsTab } from './ParamsTab';
import { I18nContext } from '../../i18n/context';
import type { RuleParameterOut } from './params/api';

let idCounter = 0;
function param(over: Partial<RuleParameterOut> = {}): RuleParameterOut {
  idCounter += 1;
  return {
    id: `aaaaaaaa-0000-4000-8000-${String(idCounter).padStart(12, '0')}`,
    code: 'coef_sb:qoramol',
    value: '0.8',
    unit: null,
    effective_from: '2026-01-01',
    effective_to: null,
    basis: 'provisional — awaiting VMQ 689 annex 5',
    status: 'draft',
    created_by: null,
    approved_by: null,
    created_at: '2026-01-01T00:00:00+05:00',
    ...over,
  };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  idCounter = 0;
});
afterAll(() => server.close());

/**
 * One handler serves BOTH queries this screen makes (the table's own
 * filtered/paged list and the banner's fixed `status=draft&limit=200`
 * request) — exactly like the real route, it filters `store` by an EXACT
 * `code`/`status` match and then pages by `offset`/`limit`, deriving `total`
 * from the filtered set before paging (never from `store` as a whole).
 */
function mockList(store: RuleParameterOut[], onRequest?: (params: URLSearchParams) => void) {
  server.use(
    http.get('*/api/v1/rule-parameters', ({ request }) => {
      const params = new URL(request.url).searchParams;
      onRequest?.(params);
      const code = params.get('code');
      const status = params.get('status');
      const limit = Number(params.get('limit') ?? '50');
      const offset = Number(params.get('offset') ?? '0');
      let filtered = store;
      if (code) filtered = filtered.filter((row) => row.code === code);
      if (status) filtered = filtered.filter((row) => row.status === status);
      const items = filtered.slice(offset, offset + limit);
      return HttpResponse.json({
        items,
        total: filtered.length,
        page: Math.floor(offset / limit) + 1,
        page_size: limit,
      });
    }),
  );
}

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'ru' as const, backendLang: 'ru' as const, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <ParamsTab active />
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

async function findTableLoaded() {
  // The table has finished its first render once its own loading row is
  // gone — waiting on this (rather than on the banner, which may
  // legitimately never appear) keeps every test past the initial fetch.
  await waitFor(() => expect(screen.queryByText('Yuklanmoqda...')).not.toBeInTheDocument());
}

test('the banner appears for a coef_sb draft and names the exact count', async () => {
  mockList([
    param({ code: 'coef_sb:qoramol', status: 'draft' }),
    param({ code: 'coef_sb:qoy', status: 'draft' }),
    param({ code: 'coef_sb:ot', status: 'draft' }),
    param({ code: 'bhm', status: 'published', value: 1 }),
  ]);
  renderTab();

  const banner = await screen.findByTestId('coef-sb-draft-banner');
  expect(within(banner).getByTestId('coef-sb-draft-count')).toHaveTextContent('3');
  expect(within(banner).getByTestId('coef-sb-draft-row-coef_sb:qoramol')).toBeInTheDocument();
  expect(within(banner).getByTestId('coef-sb-draft-row-coef_sb:qoy')).toBeInTheDocument();
  expect(within(banner).getByTestId('coef-sb-draft-row-coef_sb:ot')).toBeInTheDocument();
});

test('the banner disappears once every coef_sb row is published, even with another draft present', async () => {
  mockList([
    param({ code: 'coef_sb:qoramol', status: 'published' }),
    param({ code: 'coef_sb:qoy', status: 'published' }),
    // An unrelated draft — if the banner fired on "any draft" this would
    // wrongly raise it.
    param({ code: 'bhm', status: 'draft', value: 1 }),
  ]);
  renderTab();
  await findTableLoaded();

  expect(screen.queryByTestId('coef-sb-draft-banner')).not.toBeInTheDocument();
});

test('the banner is not keyed on `basis` — an edited basis still raises it', async () => {
  mockList([
    param({
      code: 'coef_sb:tuya',
      status: 'draft',
      basis: 'Confirmed by protocol #42 dated 2026-08-01',
    }),
  ]);
  renderTab();

  const banner = await screen.findByTestId('coef-sb-draft-banner');
  expect(within(banner).getByTestId('coef-sb-draft-row-coef_sb:tuya')).toBeInTheDocument();
});

test('value renders by its runtime type: a JSON string, a number, a boolean', async () => {
  mockList([
    param({ code: 'coef_sb:qoramol', status: 'published', value: '0.8' }),
    param({ code: 'season_share', status: 'published', value: 10 }),
    param({ code: 'auto_publish_enabled', status: 'published', value: true }),
  ]);
  renderTab();

  await screen.findByText('coef_sb:qoramol');
  // The seed stores numbers as JSON STRINGS — `"0.8"` (quoted) must render
  // distinctly from a real number, never coerced to `0.8`.
  expect(screen.getByText('"0.8"')).toBeInTheDocument();
  expect(screen.getByText('10')).toBeInTheDocument();
  expect(screen.getByText('true')).toBeInTheDocument();
});

test('filters and paging reach the query as status/code/limit/offset, and total comes off the envelope', async () => {
  const user = userEvent.setup();
  const requests: URLSearchParams[] = [];
  // 51 rows so the second page is reachable and `total` (read from the
  // envelope, never computed from `store.length` after paging) is provable.
  const store = Array.from({ length: 51 }, (_, i) =>
    param({ code: `param:${i}`, status: 'published', value: i }),
  );
  mockList(store, (params) => requests.push(params));
  renderTab();
  await findTableLoaded();

  await user.type(screen.getByTestId('params-filter-code'), 'coef_sb:qoramol');
  await user.selectOptions(screen.getByTestId('params-filter-status'), 'draft');
  await user.click(screen.getByText('norms.params.filter.apply'));

  await waitFor(() => {
    const filterRequest = requests.find((p) => p.get('code') === 'coef_sb:qoramol');
    expect(filterRequest).toBeTruthy();
    expect(filterRequest!.get('status')).toBe('draft');
    expect(filterRequest!.get('limit')).toBe('50');
    expect(filterRequest!.get('offset')).toBe('0');
  });

  // Reset clears the filter back to the unfiltered first page, so `total`
  // (51) is what the envelope reported, not `store.length` re-derived
  // client-side.
  await user.click(screen.getByText('norms.params.filter.reset'));
  await screen.findByText(/51/);

  requests.length = 0;
  await user.click(screen.getByText('Keyingi'));

  await waitFor(() => {
    const pageRequest = requests.find((p) => p.get('limit') === '50' && !p.get('status'));
    expect(pageRequest).toBeTruthy();
    expect(pageRequest!.get('offset')).toBe('50');
  });
});
