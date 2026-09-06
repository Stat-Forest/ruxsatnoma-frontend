/**
 * Whole-flow integration test — this track's own equivalent of PR #31's
 * cross-module journey test (see `docs/status.md`): a seam invisible to any
 * single component's unit test is exactly where a defect hides. Drives the
 * full С20 lifecycle end to end through `ReportDetailPage` against a small
 * STATEFUL MSW mock (an in-memory report store the handlers below actually
 * mutate, so a GET after a POST reflects it — a static fixture-per-request
 * cannot exercise a multi-step lifecycle at all).
 *
 * One actor throughout, `is_superuser: true` with `role.code: 'executor_head'`
 * matching the report's own `organization_id`: the per-actor permission/
 * identity matrix (who may sign, who may not) is already
 * `ReportLifecyclePanel.test.tsx`'s job — this file's only job is proving
 * the SEAM between `ReportDataPanel`/`ReportLifecyclePanel`/routing survives
 * a real sequence of state changes, react-query invalidations, and (for
 * revise) an actual navigation.
 *
 * Branch A's final assertion pins `revise_report`'s own docstring
 * (`app/modules/reports/service.py`, read directly for this test): "Seeds
 * the new row's `data` from the parent's own, as a starting point for the
 * hodim to edit rather than an empty report" — the edited `note` value from
 * BEFORE approval must still be there on the new revision.
 *
 * Branch B's two "back to X-equivalent" phrases in the task brief both cash
 * out to the SAME backend fact, confirmed against the same source file:
 * `return_report` always sets `status = "returned"` regardless of source
 * (`submitted` or `head_approved`) — only `returned_by` differs
 * (`"head"`/`"center"`). Getting back to `submitted` after EITHER return
 * needs the same `submit` action, exercised twice in this branch.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { AuthContext, type AuthContextValue } from '../auth/AuthContext';
import { stubAuthActions } from '../auth/testAuthActions';
import { DICTIONARIES, I18nContext } from '../i18n/context';
import { ReportDetailPage } from './ReportDetailPage';
import type { ReportFormOut, ReportOut } from './reports/api';

const FORM_ID = 'f1000000-0000-4000-8000-000000000001';
const ORG_ID = 'org00000-0000-4000-8000-000000000001';
const ACTOR_ID = 'u0000000-0000-4000-8000-000000000009';
const PINFL = '31708860250017';

const FORM: ReportFormOut = {
  id: FORM_ID,
  code: 'form-1',
  version: 1,
  name: { ru: 'Форма 1', uz_latn: '1-forma' },
  activity_type_id: null,
  period_type: 'month',
  columns: [
    { code: 'head_count', label: { ru: 'Поголовье', uz_latn: 'Bosh soni' }, source: 'auto', type: 'number' },
    { code: 'note', label: { ru: 'Примечание', uz_latn: 'Izoh' }, source: 'manual', type: 'text' },
  ],
  rules: [],
  schedule: {},
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
} as unknown as ReportFormOut;

const ORGANIZATIONS = {
  items: [{ id: ORG_ID, code: 'lh-1', name: { ru: 'Лесхоз №1', uz_latn: '1-Oʻrmon xoʻjaligi' } }],
  total: 1,
};

function seedReport(id: string, over: Partial<ReportOut> = {}): ReportOut {
  return {
    id,
    form_id: FORM_ID,
    organization_id: ORG_ID,
    period_start: '2026-01-01',
    period_end: '2026-01-31',
    version_no: 1,
    parent_report_id: null,
    status: 'created',
    returned_by: null,
    data: { rows: [] },
    filled_by: null,
    submitted_at: null,
    returned_comment: null,
    approved_by: null,
    approved_at: null,
    due_at: null,
    created_by: ACTOR_ID,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    ...over,
  };
}

/** An in-memory report store the handlers below mutate on every write, so a
 *  GET right after a POST/PATCH reflects it — `revise` additionally accepts
 *  a pre-agreed `revisionId` so the test can assert the router lands on a
 *  KNOWN id rather than guessing one back out of a response body. */
function reportStoreHandlers(seed: ReportOut, revisionId: string) {
  const store = new Map<string, ReportOut>([[seed.id, seed]]);

  function get(id: string): ReportOut {
    const found = store.get(id);
    if (!found) throw new Error(`test store: no report seeded for id ${id}`);
    return found;
  }

  return [
    http.get('*/api/v1/reports/:id', ({ params }) => {
      const found = store.get(params.id as string);
      return found ? HttpResponse.json(found) : new HttpResponse(null, { status: 404 });
    }),
    http.post('*/api/v1/reports/:id/generate', ({ params }) => {
      const current = get(params.id as string);
      const updated: ReportOut = { ...current, data: { rows: [{ head_count: '10', note: '' }] } };
      store.set(current.id, updated);
      return HttpResponse.json(updated);
    }),
    http.patch('*/api/v1/reports/:id/data', async ({ params, request }) => {
      const current = get(params.id as string);
      const body = (await request.json()) as { rows: Record<string, unknown>[] };
      const updated: ReportOut = { ...current, data: { rows: body.rows } };
      store.set(current.id, updated);
      return HttpResponse.json(updated);
    }),
    http.post('*/api/v1/reports/:id/submit', ({ params }) => {
      const current = get(params.id as string);
      const updated: ReportOut = { ...current, status: 'submitted', returned_by: null, returned_comment: null };
      store.set(current.id, updated);
      return HttpResponse.json(updated);
    }),
    http.post('*/api/v1/reports/:id/sign', ({ params }) => {
      const current = get(params.id as string);
      const updated: ReportOut = { ...current, status: 'head_approved' };
      store.set(current.id, updated);
      return HttpResponse.json(updated);
    }),
    // `service.return_report`: `submitted` -> returned_by "head",
    // `head_approved` -> returned_by "center" — both land on `status:
    // "returned"`, which is exactly branch B's own point.
    http.post('*/api/v1/reports/:id/return', async ({ params, request }) => {
      const current = get(params.id as string);
      const body = (await request.json()) as { comment: string };
      const returnedBy = current.status === 'submitted' ? 'head' : 'center';
      const updated: ReportOut = { ...current, status: 'returned', returned_by: returnedBy, returned_comment: body.comment };
      store.set(current.id, updated);
      return HttpResponse.json(updated);
    }),
    http.post('*/api/v1/reports/:id/approve', ({ params }) => {
      const current = get(params.id as string);
      const updated: ReportOut = { ...current, status: 'approved', approved_by: ACTOR_ID, approved_at: '2026-03-01T00:00:00Z' };
      store.set(current.id, updated);
      return HttpResponse.json(updated);
    }),
    // `service.revise_report`: a NEW row, `data` seeded from the parent's
    // own (verbatim), `status: "created"`, `parent_report_id` set.
    http.post('*/api/v1/reports/:id/revise', ({ params }) => {
      const current = get(params.id as string);
      const revision: ReportOut = {
        ...current,
        id: revisionId,
        status: 'created',
        version_no: current.version_no + 1,
        parent_report_id: current.id,
        data: current.data,
        submitted_at: null,
        returned_by: null,
        returned_comment: null,
        approved_by: null,
        approved_at: null,
      };
      store.set(revisionId, revision);
      return HttpResponse.json(revision, { status: 201 });
    }),
  ];
}

const server = setupServer(
  http.get(`*/api/v1/reports/forms/${FORM_ID}`, () => HttpResponse.json(FORM)),
  http.get('*/api/v1/refs/organizations', () => HttpResponse.json(ORGANIZATIONS)),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function actor(): AuthContextValue {
  return {
    me: {
      user: { id: ACTOR_ID, full_name: 'Test Actor', login: 'test', phone: null, email: null, must_change_password: false, language: 'uz_latn' },
      // `role.code`/`zone.organization_id` matching the report's own org so
      // `isHeadOfReportOrg` (the sign/return-by-head identity gate) passes;
      // `is_superuser` covers every permission code so the per-status
      // action gate never blocks a step this test needs to take.
      role: { code: 'executor_head', name: {} },
      permissions: [],
      zone: { region_id: null, district_id: null, organization_id: ORG_ID },
      csrf_token: 'tok-1',
      is_superuser: true,
      applicant: null,
      representations: [],
      registration_complete: true,
    },
    loading: false,
    authError: null,
    ...stubAuthActions(),
  };
}

function renderDetail(initialId: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const lang = 'uz_latn' as const;
  const i18n = {
    lang,
    backendLang: lang,
    t: (key: string) => (DICTIONARIES[lang] as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
  const router = createMemoryRouter([{ path: '/reports/:id', element: <ReportDetailPage /> }], {
    initialEntries: [`/reports/${initialId}`],
  });
  const utils = render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <AuthContext.Provider value={actor()}>
          <RouterProvider router={router} />
        </AuthContext.Provider>
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
  return { router, ...utils };
}

async function confirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByTestId('confirm-dialog-confirm'));
}

test('create -> generate -> edit data -> submit -> sign -> approve -> revise seeds the new revision from the parent', async () => {
  const REPORT_ID = 'r1000000-0000-4000-8000-000000000001';
  const REVISION_ID = 'r1000000-0000-4000-8000-000000000002';
  server.use(...reportStoreHandlers(seedReport(REPORT_ID), REVISION_ID));

  const user = userEvent.setup();
  const { router } = renderDetail(REPORT_ID);

  // created, no data yet.
  expect(await screen.findByTestId('report-data-empty')).toBeInTheDocument();

  // generate.
  await user.click(await screen.findByTestId('report-data-generate'));
  const table = await screen.findByTestId('report-data-table');
  expect(table).toHaveTextContent('10');

  // edit data — the manual `note` column.
  await user.click(screen.getByTestId('report-data-edit'));
  const noteInput = await screen.findByTestId('report-data-cell-note-0');
  await user.clear(noteInput);
  await user.type(noteInput, 'iyul oyi uchun');
  await user.click(screen.getByTestId('report-data-save'));
  await screen.findByTestId('report-data-saved');
  expect(screen.getByTestId('report-data-table')).toHaveTextContent('iyul oyi uchun');

  // submit.
  await user.click(await screen.findByTestId('report-action-submit'));
  await confirm(user);
  expect(await screen.findByTestId('report-action-sign')).toBeInTheDocument();

  // sign.
  await user.click(screen.getByTestId('report-action-sign'));
  await user.type(await screen.findByPlaceholderText(PINFL), PINFL);
  await confirm(user);
  expect(await screen.findByTestId('report-action-approve')).toBeInTheDocument();

  // approve.
  await user.click(screen.getByTestId('report-action-approve'));
  await confirm(user);
  expect(await screen.findByTestId('report-action-revise')).toBeInTheDocument();

  // revise — the 201 is a DIFFERENT report; this page navigates to it.
  await user.click(screen.getByTestId('report-action-revise'));
  await confirm(user);

  await waitFor(() => expect(router.state.location.pathname).toBe(`/reports/${REVISION_ID}`));

  // The new revision starts `created` (submit offered again) and its data
  // carries the edited note forward — `revise_report`'s own docstring.
  expect(await screen.findByTestId('report-action-submit')).toBeInTheDocument();
  expect(await screen.findByTestId('report-data-table')).toHaveTextContent('iyul oyi uchun');
  expect(screen.getByTestId('report-parent-link')).toHaveAttribute('href', `/reports/${REPORT_ID}`);
});

test('submit -> return (head) -> resubmit -> sign -> return (center) -> resubmit -> sign -> approve', async () => {
  const REPORT_ID = 'r3000000-0000-4000-8000-000000000001';
  server.use(
    ...reportStoreHandlers(
      seedReport(REPORT_ID, { status: 'submitted', data: { rows: [{ head_count: '5', note: 'boshlangʻich' }] } }),
      'unused-in-this-branch',
    ),
  );

  const user = userEvent.setup();
  renderDetail(REPORT_ID);

  // return, by the head (submitted -> returned, returned_by "head").
  await user.click(await screen.findByTestId('report-action-return'));
  await user.type(await screen.findByPlaceholderText('Qaytarish sababini koʻrsating'), 'raqamlar notoʻgʻri');
  await confirm(user);
  const note1 = await screen.findByTestId('report-returned-note');
  expect(note1).toHaveTextContent('Oʻrmon xoʻjaligi rahbari qaytardi');

  // `returned` is editable — the SAME `submit` action as `created`.
  await user.click(await screen.findByTestId('report-action-submit'));
  await confirm(user);
  expect(await screen.findByTestId('report-action-sign')).toBeInTheDocument();

  // sign.
  await user.click(screen.getByTestId('report-action-sign'));
  await user.type(await screen.findByPlaceholderText(PINFL), PINFL);
  await confirm(user);
  expect(await screen.findByTestId('report-action-approve')).toBeInTheDocument();

  // return again, this time by the center (head_approved -> returned,
  // returned_by "center") — the SAME target status as the head's own
  // return above, only `returned_by` differs.
  await user.click(screen.getByTestId('report-action-return'));
  await user.type(await screen.findByPlaceholderText('Qaytarish sababini koʻrsating'), 'markaziy apparat izohi');
  await confirm(user);
  const note2 = await screen.findByTestId('report-returned-note');
  expect(note2).toHaveTextContent('Markaziy apparat qaytardi');

  // resubmit, sign again.
  await user.click(await screen.findByTestId('report-action-submit'));
  await confirm(user);
  await user.click(await screen.findByTestId('report-action-sign'));
  await user.type(await screen.findByPlaceholderText(PINFL), PINFL);
  await confirm(user);

  // approve — the terminal state this branch ends on.
  await user.click(await screen.findByTestId('report-action-approve'));
  await confirm(user);
  expect(await screen.findByTestId('report-action-revise')).toBeInTheDocument();
});
