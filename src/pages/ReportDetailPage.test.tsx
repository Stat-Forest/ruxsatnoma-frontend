/**
 * `ReportDetailPage` — the track's own cross-status integration surface:
 * header requisites + `ReportDataPanel` + `ReportLifecyclePanel` +
 * `ReportExportPanel`, composed the way `PermitDocumentPage.tsx` composes
 * its own panels. Four things this page must not get wrong:
 *   1. a `created` report shows the data panel's own "not generated yet"
 *      note alongside a working Submit button;
 *   2. a `submitted` report, viewed by its own `executor_head`, offers
 *      Sign AND Return (the identity gate `ReportLifecyclePanel` owns);
 *   3. `parent_report_id` renders a link to the PARENT report, with the
 *      right href;
 *   4. Revise's 201 is a DIFFERENT report — this page is the caller that
 *      actually navigates (`onRevised`), and the URL ends up on the NEW
 *      id, not the old one re-rendered in place.
 *
 * No `useNavigate`/`react-router` mock exists anywhere else in this
 * codebase's test suite (checked `pages/applicant/`, `pages/staff/`,
 * `pages/reports/`) — the one real router test double this app already
 * has is `shell/AppShell.test.tsx`'s own `router.navigate(...)` against the
 * app's real `createBrowserRouter`. This file follows that same idea at
 * page scope: a real `createMemoryRouter` (react-router's own documented
 * data-router test pattern) so `router.state.location.pathname` answers
 * "did it actually navigate", never a hand-rolled callback stand-in for
 * routing.
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

const REPORT_ID = 'r1000000-0000-4000-8000-000000000001';
const PARENT_ID = 'r0000000-0000-4000-8000-000000000000';
const FORM_ID = 'f1000000-0000-4000-8000-000000000001';
const ORG_ID = 'org00000-0000-4000-8000-000000000001';

const FORM: ReportFormOut = {
  id: FORM_ID,
  code: 'form-1',
  version: 3,
  name: { ru: 'Форма 1', uz_latn: '1-forma' },
  activity_type_id: null,
  period_type: 'month',
  columns: [],
  rules: [],
  schedule: {},
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
} as unknown as ReportFormOut;

const ORGANIZATIONS = { items: [{ id: ORG_ID, code: 'lh-1', name: { ru: 'Лесхоз №1', uz_latn: '1-Oʻrmon xoʻjaligi' } }], total: 1 };

function report(over: Partial<ReportOut> = {}): ReportOut {
  return {
    id: REPORT_ID,
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
    created_by: 'u0000000-0000-4000-8000-000000000001',
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    ...over,
  };
}

const server = setupServer(
  http.get(`*/api/v1/reports/forms/${FORM_ID}`, () => HttpResponse.json(FORM)),
  http.get('*/api/v1/refs/organizations', () => HttpResponse.json(ORGANIZATIONS)),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function authValue(roleCode: string, permissions: string[], organizationId: string | null): AuthContextValue {
  return {
    me: {
      user: { id: 'u1', full_name: 'Test User', login: 'test', phone: null, email: null, must_change_password: false, pinfl: null, language: 'uz_latn' },
      role: { code: roleCode, name: {} },
      permissions,
      zone: { region_id: null, district_id: null, organization_id: organizationId },
      csrf_token: 'tok-1',
      is_superuser: false,
      applicant: null,
      representations: [],
      registration_complete: true,
    },
    loading: false,
    authError: null,
    ...stubAuthActions(),
  };
}

function renderDetail(initialId: string, auth: AuthContextValue) {
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
        <AuthContext.Provider value={auth}>
          <RouterProvider router={router} />
        </AuthContext.Provider>
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
  return { router, ...utils };
}

test('a created report shows notGeneratedYet and a working Submit button', async () => {
  server.use(http.get(`*/api/v1/reports/${REPORT_ID}`, () => HttpResponse.json(report({ status: 'created' }))));

  renderDetail(REPORT_ID, authValue('executor_staff', ['reports.manage'], ORG_ID));

  expect(await screen.findByTestId('report-data-empty')).toBeInTheDocument();
  expect(await screen.findByTestId('report-action-submit')).toBeInTheDocument();
});

test('a submitted report, viewed by its own executor_head, offers Sign and Return', async () => {
  server.use(http.get(`*/api/v1/reports/${REPORT_ID}`, () => HttpResponse.json(report({ status: 'submitted' }))));

  renderDetail(REPORT_ID, authValue('executor_head', ['reports.sign'], ORG_ID));

  expect(await screen.findByTestId('report-action-sign')).toBeInTheDocument();
  expect(screen.getByTestId('report-action-return')).toBeInTheDocument();
});

test('an approved report with a parent_report_id links to the parent', async () => {
  server.use(
    http.get(`*/api/v1/reports/${REPORT_ID}`, () =>
      HttpResponse.json(report({ status: 'approved', parent_report_id: PARENT_ID, version_no: 2 })),
    ),
  );

  renderDetail(REPORT_ID, authValue('executor_staff', [], ORG_ID));

  const link = await screen.findByTestId('report-parent-link');
  expect(link).toHaveAttribute('href', `/reports/${PARENT_ID}`);
});

test('confirming Revise navigates the URL to the NEW report id, the old one never re-rendered in place', async () => {
  const NEW_ID = 'r2000000-0000-4000-8000-000000000002';
  server.use(
    http.get(`*/api/v1/reports/:id`, ({ params }) => {
      if (params.id === REPORT_ID) return HttpResponse.json(report({ status: 'approved' }));
      if (params.id === NEW_ID) {
        return HttpResponse.json(report({ id: NEW_ID, status: 'created', version_no: 2, parent_report_id: REPORT_ID }));
      }
      return new HttpResponse(null, { status: 404 });
    }),
    http.post(`*/api/v1/reports/${REPORT_ID}/revise`, () =>
      HttpResponse.json(report({ id: NEW_ID, status: 'created', version_no: 2, parent_report_id: REPORT_ID }), { status: 201 }),
    ),
  );

  const user = userEvent.setup();
  const { router } = renderDetail(REPORT_ID, authValue('executor_staff', ['reports.manage'], ORG_ID));

  await user.click(await screen.findByTestId('report-action-revise'));
  await user.click(await screen.findByTestId('confirm-dialog-confirm'));

  await waitFor(() => expect(router.state.location.pathname).toBe(`/reports/${NEW_ID}`));
  expect(await screen.findByTestId('report-parent-link')).toHaveAttribute('href', `/reports/${REPORT_ID}`);
});

test('renders report history and audit log', async () => {
  server.use(
    http.get(`*/api/v1/reports/${REPORT_ID}`, () =>
      HttpResponse.json(report({ status: 'submitted', submitted_at: '2026-02-05T10:00:00Z' })),
    ),
  );

  renderDetail(REPORT_ID, authValue('executor_staff', [], ORG_ID));

  expect(await screen.findByTestId('report-history')).toBeInTheDocument();
  expect(screen.getByText('Tarix va audit')).toBeInTheDocument();
});

