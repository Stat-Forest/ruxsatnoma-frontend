/**
 * `ReportFormsTab` — list rendering, write-action gating on
 * `reports.forms.manage`, and the `not_draft` refusal path for `activate`.
 * MSW registers the `.../forms/:id/activate` and `.../forms/:id/archive`
 * paths as separate handlers alongside the list/create handlers, per this
 * track's own first-match-wins convention (Global Constraint 7) even though
 * this route family has no bare `:id` handler today.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../../auth/AuthContext';
import { stubAuthActions } from '../../auth/testAuthActions';
import { DICTIONARIES, I18nContext } from '../../i18n/context';
import { ReportFormsTab } from './ReportFormsTab';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function page<T>(items: T[]) {
  return { items, total: items.length, page: 1, page_size: 50 };
}

const DRAFT_FORM = {
  id: 'f0000000-0000-4000-8000-000000000001',
  code: 'RPT-1',
  version: 1,
  name: { uz_latn: 'Ovchilik hisoboti', ru: 'Отчёт по охоте' },
  activity_type_id: null,
  period_type: 'month',
  columns: [{ code: 'total', label: { uz_latn: 'Jami' }, source: 'manual', type: 'number' }],
  rules: [],
  schedule: {},
  status: 'draft',
  valid_from: null,
  created_at: '2026-01-01T00:00:00Z',
};

function mockBackend(options: { forms?: unknown[] }) {
  server.use(
    http.get('*/api/v1/reports/forms', () => HttpResponse.json(page(options.forms ?? []))),
    http.post('*/api/v1/reports/forms/:id/activate', () =>
      HttpResponse.json(
        { error: { code: 'ERR-REP-001', message: 'Only a draft may be activated', details: { reason: 'not_draft' } } },
        { status: 409 },
      ),
    ),
    http.post('*/api/v1/reports/forms/:id/archive', () => HttpResponse.json({ ...DRAFT_FORM, status: 'archived' })),
    http.post('*/api/v1/reports/forms', () => HttpResponse.json(DRAFT_FORM, { status: 201 })),
    http.get('*/api/v1/refs/activity-types', () => HttpResponse.json([])),
  );
}

function meWith(permissions: string[]): AuthContextValue {
  return {
    me: {
      user: { id: 'u1', full_name: 'Test', login: 'test', phone: null, email: null, must_change_password: false, pinfl: null, language: 'uz_latn' },
      role: { code: 'central_admin', name: { uz_latn: 'Markaziy apparat' } },
      permissions,
      zone: { region_id: null, district_id: null, organization_id: null },
      csrf_token: 'x',
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

function renderTab(permissions: string[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const lang = 'uz_latn' as const;
  const i18n = {
    lang,
    backendLang: lang,
    t: (key: string) => (DICTIONARIES[lang] as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <AuthContext.Provider value={meWith(permissions)}>
          <ReportFormsTab active />
        </AuthContext.Provider>
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

test('the forms list renders rows', async () => {
  mockBackend({ forms: [DRAFT_FORM] });
  renderTab(['reports.view']);

  expect(await screen.findByText('RPT-1')).toBeInTheDocument();
  expect(screen.getByText('Ovchilik hisoboti')).toBeInTheDocument();
});

test('"Add" is hidden without reports.forms.manage', async () => {
  mockBackend({ forms: [DRAFT_FORM] });
  renderTab(['reports.view']);

  await screen.findByText('RPT-1');
  expect(screen.queryByTestId('report-forms-add')).not.toBeInTheDocument();
});

test('"Add" is shown with reports.forms.manage', async () => {
  mockBackend({ forms: [DRAFT_FORM] });
  renderTab(['reports.view', 'reports.forms.manage']);

  await screen.findByText('RPT-1');
  expect(screen.getByTestId('report-forms-add')).toBeInTheDocument();
});

test('"Activate" is hidden on a non-draft row', async () => {
  mockBackend({ forms: [{ ...DRAFT_FORM, status: 'active' }] });
  renderTab(['reports.view', 'reports.forms.manage']);

  await screen.findByText('RPT-1');
  expect(screen.queryByTestId(`report-form-activate-${DRAFT_FORM.id}`)).not.toBeInTheDocument();
});

test('activating a form shows the not_draft refusal from a 409', async () => {
  mockBackend({ forms: [DRAFT_FORM] });
  renderTab(['reports.view', 'reports.forms.manage']);

  const user = userEvent.setup();
  await screen.findByText('RPT-1');
  await user.click(screen.getByTestId(`report-form-activate-${DRAFT_FORM.id}`));
  await user.click(screen.getByTestId('confirm-dialog-confirm'));

  await waitFor(() => expect(screen.getByTestId('confirm-dialog-error')).toBeInTheDocument());
  expect(screen.getByTestId('confirm-dialog-error')).toHaveTextContent('Faqat qoralamani faollashtirish mumkin');
});

test('the Excel button asks the server for the export with the applied filter, never paging the list itself', async () => {
  mockBackend({ forms: [DRAFT_FORM] });
  const listCalls: string[] = [];
  let exportUrl: URL | null = null;
  server.use(
    http.get('*/api/v1/reports/forms', ({ request }) => {
      listCalls.push(request.url);
      return HttpResponse.json(page([DRAFT_FORM]));
    }),
    http.get('*/api/v1/reports/forms/export.xlsx', ({ request }) => {
      exportUrl = new URL(request.url);
      return HttpResponse.text('xlsx-bytes', {
        headers: {
          'Content-Disposition': 'attachment; filename="hisobot-shakllari-2026-09-11.xlsx"',
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

  const user = userEvent.setup();
  renderTab(['reports.view']);
  await screen.findByText('RPT-1');
  const listCallsBefore = listCalls.length;

  await user.click(screen.getByTestId('export-xlsx'));

  await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  expect(clickSpy).toHaveBeenCalled();
  expect(listCalls.length).toBe(listCallsBefore); // the export never re-fetches the list
  expect(exportUrl!.searchParams.get('lang')).toBe('uz_latn');
  expect(exportUrl!.searchParams.has('page')).toBe(false);
  expect(exportUrl!.searchParams.has('page_size')).toBe(false);
});
