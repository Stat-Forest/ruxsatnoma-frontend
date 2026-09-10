/**
 * F7 — the rule-parameters register.
 *
 * The five things task-3's brief pinned down (still one test each, read-only):
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
 * Task 4 adds the write flows, integration-level (dialog-only behaviour —
 * the R3/R4 warnings, the `warnings` display — is covered in
 * `components/PublishConfirmDialog.test.tsx` instead, with plain props and
 * no network):
 *   6. each of the four publish refusals renders its own distinct message;
 *   7. a published row offers no edit control at all;
 *   8. archive is offered per the draft/published permission asymmetry;
 *   9. publishing a `coef_sb:*` draft from the BANNER drops its own count —
 *      end to end against MSW, the track's whole reason to exist.
 *
 * `t` returns the key itself — same precedent as `NormsPage.test.tsx` and
 * `IntegrationsPage.test.tsx` for a page rendered outside `I18nProvider`;
 * assertions below key off `data-testid`s and the runtime-typed VALUES
 * (`"0.8"`, `10`, `true`), never off translated copy.
 */
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ParamsTab } from './ParamsTab';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';
import { I18nContext } from '../../i18n/context';
import type { RuleParameterOut } from './params/api';

const MANAGE = 'norms.tariffs.manage';
const PUBLISH = 'norms.tariffs.publish';

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
 *
 * `store` is a mutable array reference: write-route mocks below (`mockPublish`
 * etc.) mutate the SAME array in place on success, so a re-fetch after a
 * mutation's `invalidateQueries` sees the new state — the same thing the real
 * backend would do, without a second layer of fake persistence.
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

/**
 * `publish` is registered BEFORE the bare `/rule-parameters/:id` handlers a
 * test might add later, per the brief's own MSW warning — kept as separate,
 * narrowly-pathed handlers (`/publish`, `/archive`) rather than one handler
 * inspecting the URL, so registration order cannot silently matter here.
 */
function mockPublish(store: RuleParameterOut[], respond: (row: RuleParameterOut) => Response) {
  server.use(
    http.post('*/api/v1/rule-parameters/:id/publish', ({ params }) => {
      const row = store.find((r) => r.id === params.id);
      if (!row) return HttpResponse.json({ error: { code: 'ERR-SYS-000', message: 'not found' } }, { status: 404 });
      return respond(row);
    }),
  );
}

function publishSuccess(store: RuleParameterOut[], row: RuleParameterOut, warnings: { code: string; message: string }[] = []) {
  const index = store.findIndex((r) => r.id === row.id);
  if (index >= 0) store[index] = { ...row, status: 'published' };
  return HttpResponse.json({ item: store[index] ?? row, warnings });
}

function publishRefusal(code: string, message: string, details?: unknown, status = 422) {
  return HttpResponse.json({ error: { code, message, details } }, { status });
}

function mockArchive(store: RuleParameterOut[]) {
  server.use(
    http.post('*/api/v1/rule-parameters/:id/archive', ({ params }) => {
      const index = store.findIndex((r) => r.id === params.id);
      if (index < 0) return HttpResponse.json({ error: { code: 'ERR-SYS-000', message: 'not found' } }, { status: 404 });
      store[index] = { ...store[index], status: 'archived', effective_to: '2026-01-01' };
      return HttpResponse.json(store[index]);
    }),
  );
}

/** A real PATCH round trip, mutating `store` in place like the others —
 *  needed by the R3 integration test below, which edits a row through the
 *  actual `RuleParameterFormModal` rather than asserting on props directly. */
function mockPatch(store: RuleParameterOut[]) {
  server.use(
    http.patch('*/api/v1/rule-parameters/:id', async ({ params, request }) => {
      const index = store.findIndex((r) => r.id === params.id);
      if (index < 0) return HttpResponse.json({ error: { code: 'ERR-SYS-000', message: 'not found' } }, { status: 404 });
      const body = (await request.json()) as Record<string, unknown>;
      store[index] = { ...store[index], ...body };
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
        <ParamsTab active />
      </I18nContext.Provider>
    </QueryClientProvider>,
    { wrapper },
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

// ── Task 4 — write flows ────────────────────────────────────────────────────

describe('the four publish refusals, each its own message (task-4 brief)', () => {
  async function openPublishDialog(user: ReturnType<typeof userEvent.setup>, code: string) {
    const banner = await screen.findByTestId('coef-sb-draft-banner');
    await user.click(within(banner).getByTestId(`coef-sb-publish-${code}`));
    await user.click(await screen.findByTestId('publish-dialog-confirm'));
  }

  test('not_draft', async () => {
    const user = userEvent.setup();
    mockList([param({ code: 'coef_sb:qoramol', status: 'draft' })]);
    server.use(
      http.post('*/api/v1/rule-parameters/:id/publish', () =>
        publishRefusal('ERR-NORM-005', 'not a draft', { reason: 'not_draft' }),
      ),
    );
    renderTab();

    await openPublishDialog(user, 'coef_sb:qoramol');
    expect(await screen.findByText('norms.params.publish.error.notDraft')).toBeInTheDocument();
  });

  test('not_maker_checker', async () => {
    const user = userEvent.setup();
    mockList([param({ code: 'coef_sb:qoramol', status: 'draft' })]);
    server.use(
      http.post('*/api/v1/rule-parameters/:id/publish', () =>
        publishRefusal('ERR-NORM-005', 'maker cannot check own draft', { reason: 'not_maker_checker' }),
      ),
    );
    renderTab();

    await openPublishDialog(user, 'coef_sb:qoramol');
    expect(await screen.findByText('norms.params.publish.error.notMakerChecker')).toBeInTheDocument();
  });

  test('forbidden (ERR-ACL-001, no details.reason)', async () => {
    const user = userEvent.setup();
    mockList([param({ code: 'coef_sb:qoramol', status: 'draft' })]);
    server.use(
      http.post('*/api/v1/rule-parameters/:id/publish', () =>
        publishRefusal('ERR-ACL-001', 'forbidden', undefined, 403),
      ),
    );
    renderTab();

    await openPublishDialog(user, 'coef_sb:qoramol');
    expect(await screen.findByText('norms.params.publish.error.forbidden')).toBeInTheDocument();
  });

  test('period_overlap', async () => {
    const user = userEvent.setup();
    mockList([param({ code: 'coef_sb:qoramol', status: 'draft' })]);
    server.use(
      http.post('*/api/v1/rule-parameters/:id/publish', () =>
        publishRefusal('ERR-NORM-005', 'period already covered', { reason: 'period_overlap' }),
      ),
    );
    renderTab();

    await openPublishDialog(user, 'coef_sb:qoramol');
    expect(await screen.findByText('norms.params.publish.error.periodOverlap')).toBeInTheDocument();
  });
});

test('a published row offers no edit control at all, but a draft row does', async () => {
  mockList([
    param({ code: 'coef_sb:qoy', status: 'draft' }),
    param({ code: 'bhm', status: 'published', value: 1 }),
  ]);
  renderTab();
  await findTableLoaded();

  expect(screen.getByTestId('row-edit-coef_sb:qoy')).toBeInTheDocument();
  expect(screen.queryByTestId('row-edit-bhm')).not.toBeInTheDocument();
});

describe('the Add-parameter button is gated on norms.tariffs.manage alone', () => {
  // Deferred by task 4's own review ("no test that the 'Add parameter'
  // button hides without norms.tariffs.manage" — task-4-report.md's closing
  // section) and closed here, alongside the identical case for tariffs
  // (`TariffsTab.test.tsx`), since it fell naturally in this task's own
  // path: both screens share the exact same `canManage` gate.
  test('hidden for a caller holding only publish', async () => {
    mockList([]);
    renderTab([PUBLISH]);
    await findTableLoaded();
    expect(screen.queryByTestId('params-add')).not.toBeInTheDocument();
  });

  test('shown for a caller holding manage', async () => {
    mockList([]);
    renderTab([MANAGE]);
    await findTableLoaded();
    expect(screen.getByTestId('params-add')).toBeInTheDocument();
  });
});

describe('archive is offered per the draft/published permission asymmetry', () => {
  test('a draft row offers archive to a caller holding manage alone', async () => {
    mockList([param({ code: 'coef_sb:tuya', status: 'draft' })]);
    renderTab([MANAGE]);
    await findTableLoaded();

    expect(screen.getByTestId('row-archive-coef_sb:tuya')).toBeInTheDocument();
  });

  test('a draft row does NOT offer archive to a caller holding only publish', async () => {
    mockList([param({ code: 'coef_sb:tuya', status: 'draft' })]);
    renderTab([PUBLISH]);
    await findTableLoaded();

    expect(screen.queryByTestId('row-archive-coef_sb:tuya')).not.toBeInTheDocument();
  });

  test('a published row does NOT offer archive to a caller holding only manage', async () => {
    mockList([param({ code: 'bhm', status: 'published', value: 1 })]);
    renderTab([MANAGE]);
    await findTableLoaded();

    expect(screen.queryByTestId('row-archive-bhm')).not.toBeInTheDocument();
  });

  test('a published row offers archive to a caller holding publish', async () => {
    mockList([param({ code: 'bhm', status: 'published', value: 1 })]);
    renderTab([PUBLISH]);
    await findTableLoaded();

    expect(screen.getByTestId('row-archive-bhm')).toBeInTheDocument();
  });
});

test('publishing a coef_sb draft from the banner drops its own count end to end — the track\'s whole purpose', async () => {
  const user = userEvent.setup();
  const store = [
    param({ code: 'coef_sb:qoramol', status: 'draft' }),
    param({ code: 'coef_sb:qoy', status: 'draft' }),
  ];
  mockList(store);
  mockPublish(store, (row) => publishSuccess(store, row));
  renderTab();

  const banner = await screen.findByTestId('coef-sb-draft-banner');
  expect(within(banner).getByTestId('coef-sb-draft-count')).toHaveTextContent('2');

  await user.click(within(banner).getByTestId('coef-sb-publish-coef_sb:qoramol'));
  await user.click(await screen.findByTestId('publish-dialog-confirm'));
  await screen.findByTestId('publish-result');
  await user.click(screen.getByTestId('publish-dialog-close'));

  await waitFor(() => {
    expect(within(screen.getByTestId('coef-sb-draft-banner')).getByTestId('coef-sb-draft-count')).toHaveTextContent(
      '1',
    );
  });
});

test('archiving a draft row, end to end, removes it from the register on refetch', async () => {
  const user = userEvent.setup();
  const store = [param({ code: 'coef_sb:tuya', status: 'draft' })];
  mockList(store);
  mockArchive(store);
  renderTab([MANAGE]);
  await findTableLoaded();

  await user.click(screen.getByTestId('row-archive-coef_sb:tuya'));
  await user.click(await screen.findByTestId('archive-dialog-confirm'));

  await waitFor(() => expect(screen.queryByTestId('row-archive-coef_sb:tuya')).not.toBeInTheDocument());
  expect(store[0].status).toBe('archived');
});

// Review round 1, IMPORTANT finding: R3's only production wiring
// (`RuleParameterFormModal.onSaved` -> `markEdited` -> `editedRowIds.has(id)`
// -> `PublishConfirmDialog`'s `editedByCallerThisSession` prop) had no test
// exercising the real chain — `PublishConfirmDialog.test.tsx` only proves the
// dialog renders correctly GIVEN the boolean, never that editing a row here
// actually SETS it. This test edits a draft through the row's own Edit
// button, then opens Publish on that SAME row and asserts the warning — and,
// as a sibling, that a row never touched this session does not raise it. It
// fails if `markEdited(saved)` is removed from `ParamsTab.tsx`.
test('ruling R3: publishing a row edited THIS session warns; a row never touched does not', async () => {
  const user = userEvent.setup();
  const store = [
    param({ code: 'coef_sb:qoramol', status: 'draft', value: '0.8' }),
    param({ code: 'coef_sb:qoy', status: 'draft', value: '0.5' }),
  ];
  mockList(store);
  mockPatch(store);
  renderTab();
  await findTableLoaded();

  // Edit coef_sb:qoramol through the real form, exactly as an operator
  // would — not a prop passed directly to the dialog.
  await user.click(screen.getByTestId('row-edit-coef_sb:qoramol'));
  const valueInput = await screen.findByTestId('rp-value');
  expect(valueInput).toHaveValue('0.8');
  fireEvent.change(valueInput, { target: { value: '0.83' } });
  await user.click(screen.getByText('norms.params.form.save'));
  await waitFor(() => expect(screen.queryByTestId('rule-parameter-form')).not.toBeInTheDocument());

  // Publishing the row just edited warns.
  await user.click(screen.getByTestId('row-publish-coef_sb:qoramol'));
  expect(await screen.findByTestId('publish-self-warning')).toBeInTheDocument();
  await user.click(screen.getByTestId('publish-dialog-cancel'));
  await waitFor(() => expect(screen.queryByTestId('publish-confirm-dialog')).not.toBeInTheDocument());

  // The OTHER row, never touched this session, does not.
  await user.click(screen.getByTestId('row-publish-coef_sb:qoy'));
  await screen.findByTestId('publish-confirm-dialog');
  expect(screen.queryByTestId('publish-self-warning')).not.toBeInTheDocument();
});

test('a click anywhere on a draft parameter row opens its form', async () => {
  const user = userEvent.setup();
  mockList([param({ code: 'coef_sb:qoramol', status: 'draft' })]);
  renderTab();
  await findTableLoaded();

  // The code also names the row's edit control; the plain cell is the <td>.
  await user.click(screen.getAllByText('coef_sb:qoramol').find((el) => el.tagName === 'TD' || el.closest('td') && !el.closest('button'))!);
  expect(await screen.findByTestId('rp-value')).toBeInTheDocument();
});

test('the Excel button asks the server for the export with the applied filters, never paging the list itself', async () => {
  const user = userEvent.setup();
  mockList([param({ code: 'coef_sb:qoramol' })]);
  let exportUrl: URL | null = null;
  let exportCalls = 0;
  server.use(
    http.get('*/api/v1/rule-parameters/export.xlsx', ({ request }) => {
      exportCalls += 1;
      exportUrl = new URL(request.url);
      return HttpResponse.text('xlsx-bytes', {
        headers: {
          'Content-Disposition': 'attachment; filename="meyor-parametrlari-2026-09-11.xlsx"',
          'X-Export-Total': '1',
          'X-Export-Rows': '1',
          'X-Export-Truncated': 'false',
        },
      });
    }),
  );

  const createObjectURL = vi.fn().mockReturnValue('blob:mock');
  const revokeObjectURL = vi.fn();
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  renderTab();
  await findTableLoaded();

  await user.click(screen.getByTestId('export-xlsx'));

  await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  expect(clickSpy).toHaveBeenCalled();
  expect(exportCalls).toBe(1);
  expect(exportUrl!.searchParams.get('lang')).toBe('ru');
  expect(exportUrl!.searchParams.has('page')).toBe(false);
  expect(exportUrl!.searchParams.has('page_size')).toBe(false);
  expect(exportUrl!.searchParams.has('limit')).toBe(false);
  expect(exportUrl!.searchParams.has('offset')).toBe(false);
});
