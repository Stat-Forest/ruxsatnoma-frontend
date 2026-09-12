/**
 * F5 — the norms register and its six-transition lifecycle. The one thing
 * the task-6 brief pins down as ONE test each: every status offers exactly
 * the transitions leaving it and no others — proven here at the SCREEN
 * level (button presence), complementing `norm/transitions.test.ts`'s own
 * proof at the pure-table level.
 */
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { NormsTab } from './NormsTab';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';
import { I18nContext } from '../../i18n/context';
import type { NormOut } from './norm/api';

const MANAGE = 'norms.manage';
const APPROVE = 'norms.approve';
const PUBLISH = 'norms.publish';
const ACTIVITY_TYPE_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const CONTOUR_ID = 'cccccccc-0000-4000-8000-000000000001';

let idCounter = 0;
function norm(over: Partial<NormOut> = {}): NormOut {
  idCounter += 1;
  return {
    id: `bbbbbbbb-0000-4000-8000-${String(idCounter).padStart(12, '0')}`,
    contour_id: CONTOUR_ID,
    activity_type_id: ACTIVITY_TYPE_ID,
    yield_c_per_ha: '12.5000',
    // Ruling #176 (stage 9): capacity for every activity but grazing.
    capacity: null,
    season: null,
    rotation: null,
    max_sb: null,
    geobotanic_doc_id: 'doc-1',
    approval_doc_id: null,
    effective_from: '2026-01-01',
    effective_to: null,
    status: 'draft',
    created_by: 'u-1',
    approved_by: null,
    published_at: null,
    created_at: '2026-01-01T00:00:00+05:00',
    ...over,
  };
}

const server = setupServer(
  http.get('*/api/v1/refs/activity-types', () =>
    HttpResponse.json([{ id: ACTIVITY_TYPE_ID, code: 'grazing', name: { ru: 'Выпас' }, quantity_unit: 'head', status: 'active' }]),
  ),
  http.get('*/api/v1/gis/contours/:id', () =>
    HttpResponse.json({ id: CONTOUR_ID, number: '001-042', organization_id: 'o-1', kind: 'contour', version_id: 'v-1' }),
  ),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  idCounter = 0;
});
afterAll(() => server.close());

function mockList(store: NormOut[]) {
  server.use(
    http.get('*/api/v1/norms', ({ request }) => {
      const params = new URL(request.url).searchParams;
      const status = params.get('status');
      const filtered = status ? store.filter((r) => r.status === status) : store;
      return HttpResponse.json({ items: filtered, total: filtered.length, page: 1, page_size: 50 });
    }),
  );
}

/** Registered per-action, before any catch-all — mirrors
 *  `ParamsTab.test.tsx`'s own MSW-ordering precedent. */
function mockTransition(store: NormOut[], action: string, respond: (row: NormOut) => Response) {
  server.use(
    http.post(`*/api/v1/norms/:id/${action}`, ({ params }) => {
      const row = store.find((r) => r.id === params.id);
      if (!row) return HttpResponse.json({ error: { code: 'ERR-SYS-000', message: 'not found' } }, { status: 404 });
      return respond(row);
    }),
  );
}

function transitionSuccess(store: NormOut[], row: NormOut, toStatus: string) {
  const index = store.findIndex((r) => r.id === row.id);
  if (index >= 0) store[index] = { ...row, status: toStatus };
  return HttpResponse.json(store[index] ?? row);
}

function refusal(code: string, message: string, details?: unknown, status = 422) {
  return HttpResponse.json({ error: { code, message, details } }, { status });
}

function renderTab(permissions: string[] = [MANAGE, APPROVE, PUBLISH]) {
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
        <NormsTab active />
      </I18nContext.Provider>
    </QueryClientProvider>,
    { wrapper },
  );
}

async function findTableLoaded() {
  await waitFor(() => expect(screen.queryByText('Yuklanmoqda...')).not.toBeInTheDocument());
}

test('the contour number resolves and renders instead of a bare id', async () => {
  mockList([norm()]);
  renderTab();
  expect(await screen.findByText('№ 001-042')).toBeInTheDocument();
});

test.each([
  ['draft', ['submit-review', 'archive']],
  ['review', ['return-to-draft', 'approve']],
  ['approved', ['return-to-review', 'publish']],
  ['published', ['archive']],
  ['archived', []],
])('a %s row offers exactly %j and no other transition, to a caller holding every permission', async (status, expected) => {
  const row = norm({ status });
  mockList([row]);
  renderTab();
  await findTableLoaded();

  for (const action of ['submit-review', 'return-to-draft', 'approve', 'return-to-review', 'publish', 'archive']) {
    const testId = `norm-row-${action}-${row.id}`;
    if (expected.includes(action)) {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    } else {
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    }
  }
});

test('edit is offered in draft/review only, never approved/published/archived', async () => {
  const rows = [
    norm({ status: 'draft' }),
    norm({ status: 'review' }),
    norm({ status: 'approved' }),
    norm({ status: 'published' }),
    norm({ status: 'archived' }),
  ];
  mockList(rows);
  renderTab();
  await findTableLoaded();

  expect(screen.getByTestId(`norm-row-edit-${rows[0].id}`)).toBeInTheDocument();
  expect(screen.getByTestId(`norm-row-edit-${rows[1].id}`)).toBeInTheDocument();
  expect(screen.queryByTestId(`norm-row-edit-${rows[2].id}`)).not.toBeInTheDocument();
  expect(screen.queryByTestId(`norm-row-edit-${rows[3].id}`)).not.toBeInTheDocument();
  expect(screen.queryByTestId(`norm-row-edit-${rows[4].id}`)).not.toBeInTheDocument();
});

test('the Add button is hidden without norms.manage', async () => {
  mockList([]);
  renderTab([APPROVE, PUBLISH]);
  await findTableLoaded();
  expect(screen.queryByTestId('norms-add')).not.toBeInTheDocument();
});

test('a transition button is hidden for a caller who does not hold its own permission', async () => {
  const row = norm({ status: 'approved' });
  mockList([row]);
  renderTab([MANAGE]); // neither approve nor publish
  await findTableLoaded();

  expect(screen.queryByTestId(`norm-row-publish-${row.id}`)).not.toBeInTheDocument();
  expect(screen.queryByTestId(`norm-row-return-to-review-${row.id}`)).not.toBeInTheDocument();
});

test('submit-review succeeds and the row loses its submit-review button on refetch', async () => {
  const user = userEvent.setup();
  const store = [norm({ status: 'draft' })];
  mockList(store);
  mockTransition(store, 'submit-review', (row) => transitionSuccess(store, row, 'review'));
  renderTab();
  await findTableLoaded();

  const row = store[0];
  await user.click(screen.getByTestId(`norm-row-submit-review-${row.id}`));
  await user.click(screen.getByTestId('norm-transition-confirm'));

  await waitFor(() => expect(screen.queryByTestId(`norm-row-submit-review-${row.id}`)).not.toBeInTheDocument());
});

test('a bad_transition refusal renders its own sentence, not a generic one', async () => {
  const user = userEvent.setup();
  const row = norm({ status: 'draft' });
  mockList([row]);
  mockTransition([row], 'submit-review', () => refusal('ERR-NORM-005', 'x', { reason: 'bad_transition' }));
  renderTab();
  await findTableLoaded();

  await user.click(screen.getByTestId(`norm-row-submit-review-${row.id}`));
  await user.click(screen.getByTestId('norm-transition-confirm'));

  expect(await screen.findByTestId('norm-transition-error')).toHaveTextContent('norms.norms.action.error.badTransition');
});

test('approve stays disabled until a document is uploaded, then submits it as approval_doc_id', async () => {
  const user = userEvent.setup();
  server.use(
    http.post('*/api/v1/files', () =>
      HttpResponse.json({ id: 'doc-approval-1', filename: 'protocol.pdf', content_type: 'application/pdf', size_bytes: 1, sha256: 'x', created_at: '2026-01-01T00:00:00+05:00' }, { status: 201 }),
    ),
  );
  let sentBody: Record<string, unknown> | null = null;
  const row = norm({ status: 'review' });
  mockList([row]);
  server.use(
    http.post('*/api/v1/norms/:id/approve', async ({ request }) => {
      sentBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ ...row, status: 'approved' });
    }),
  );
  renderTab();
  await findTableLoaded();

  await user.click(screen.getByTestId(`norm-row-approve-${row.id}`));
  expect(screen.getByTestId('norm-approve-confirm')).toBeDisabled();

  const file = new File(['data'], 'protocol.pdf', { type: 'application/pdf' });
  await user.upload(screen.getByTestId('norm-approve-doc-upload'), file);

  await waitFor(() => expect(screen.getByTestId('norm-approve-confirm')).not.toBeDisabled());
  await user.click(screen.getByTestId('norm-approve-confirm'));

  await waitFor(() => expect(sentBody).toEqual({ approval_doc_id: 'doc-approval-1' }));
});

test('archiving a published row removes its own archive action on refetch', async () => {
  const user = userEvent.setup();
  const store = [norm({ status: 'published' })];
  mockList(store);
  mockTransition(store, 'archive', (row) => transitionSuccess(store, row, 'archived'));
  renderTab();
  await findTableLoaded();

  const row = store[0];
  await user.click(screen.getByTestId(`norm-row-archive-${row.id}`));
  await user.click(screen.getByTestId('norm-transition-confirm'));

  await waitFor(() => expect(screen.queryByTestId(`norm-row-archive-${row.id}`)).not.toBeInTheDocument());
});

test('a click anywhere on an editable norm row opens the form; a published row stays plain', async () => {
  const user = userEvent.setup();
  const rows = [norm({ status: 'draft' }), norm({ status: 'published' })];
  mockList(rows);
  renderTab();
  await findTableLoaded();

  // Row 0 is the header; the data rows keep the fixture order.
  const [, draft, published] = screen.getAllByRole('row');
  expect(published).not.toHaveAttribute('tabindex');

  await user.click(within(draft).getAllByRole('cell')[0]);
  expect(await screen.findByTestId('norm-form')).toBeInTheDocument();
});

test('the Excel button asks the server for the export with the applied filters, never paging the list itself', async () => {
  const user = userEvent.setup();
  mockList([norm()]);
  let exportUrl: URL | null = null;
  let exportCalls = 0;
  server.use(
    http.get('*/api/v1/norms/export.xlsx', ({ request }) => {
      exportCalls += 1;
      exportUrl = new URL(request.url);
      return HttpResponse.text('xlsx-bytes', {
        headers: {
          'Content-Disposition': 'attachment; filename="normalar-2026-09-11.xlsx"',
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
