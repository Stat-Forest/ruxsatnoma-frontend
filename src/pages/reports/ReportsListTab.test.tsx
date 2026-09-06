/**
 * `ReportsListTab` — list rendering with its three filters, "Create report"
 * gating on `reports.manage`, and the create modal's form picker offering
 * only ACTIVE forms (an inactive one would be refused server-side with
 * `ERR-REP-003` anyway — house rule).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { AuthContext, type AuthContextValue } from '../../auth/AuthContext';
import { stubAuthActions } from '../../auth/testAuthActions';
import { DICTIONARIES, I18nContext } from '../../i18n/context';
import { ReportsListTab } from './ReportsListTab';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function page<T>(items: T[]) {
  return { items, total: items.length, page: 1, page_size: 100 };
}

const ORG = { id: 'org00000-0000-4000-8000-000000000001', parent_id: null, kind: 'leshoz', code: 'LX-1', name: { uz_latn: 'Zangiota LX' }, stir: null, region_id: null, district_id: null, status: 'active' };

const ACTIVE_FORM = {
  id: 'f0000000-0000-4000-8000-000000000001',
  code: 'RPT-ACTIVE',
  version: 1,
  name: { uz_latn: 'Faol shakl' },
  activity_type_id: null,
  period_type: 'month',
  columns: [{ code: 'total', label: { uz_latn: 'Jami' }, source: 'manual', type: 'number' }],
  rules: [],
  schedule: {},
  status: 'active',
  valid_from: null,
  created_at: '2026-01-01T00:00:00Z',
};

const DRAFT_FORM = { ...ACTIVE_FORM, id: 'f0000000-0000-4000-8000-000000000002', code: 'RPT-DRAFT', name: { uz_latn: 'Qoralama shakl' }, status: 'draft' };

const REPORT = {
  id: 'r0000000-0000-4000-8000-000000000001',
  form_id: ACTIVE_FORM.id,
  organization_id: ORG.id,
  period_start: '2026-01-01',
  period_end: '2026-01-31',
  version_no: 1,
  parent_report_id: null,
  status: 'created',
  returned_by: null,
  data: {},
  filled_by: null,
  submitted_at: null,
  returned_comment: null,
  approved_by: null,
  approved_at: null,
  due_at: null,
  created_by: 'u1',
  created_at: '2026-02-01T00:00:00Z',
  updated_at: '2026-02-01T00:00:00Z',
};

function mockBackend(options: { reports?: unknown[]; forms?: unknown[] }) {
  server.use(
    http.get('*/api/v1/reports', () => HttpResponse.json(page(options.reports ?? []))),
    http.get('*/api/v1/reports/forms/:id', ({ params }) => {
      const found = [ACTIVE_FORM, DRAFT_FORM].find((f) => f.id === params.id);
      return found ? HttpResponse.json(found) : HttpResponse.json({ error: { code: 'ERR-SYS-003', message: 'not found' } }, { status: 404 });
    }),
    http.get('*/api/v1/reports/forms', ({ request }) => {
      const status = new URL(request.url).searchParams.get('status');
      const all = options.forms ?? [ACTIVE_FORM, DRAFT_FORM];
      const filtered = status ? all.filter((f) => (f as { status: string }).status === status) : all;
      return HttpResponse.json(page(filtered));
    }),
    http.get('*/api/v1/refs/organizations', () => HttpResponse.json(page([ORG]))),
  );
}

function meWith(permissions: string[]): AuthContextValue {
  return {
    me: {
      user: { id: 'u1', full_name: 'Test', login: 'test', phone: null, email: null, must_change_password: false, language: 'uz_latn' },
      role: { code: 'central_admin', name: {} },
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
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>
          <AuthContext.Provider value={meWith(permissions)}>
            <ReportsListTab active />
          </AuthContext.Provider>
        </I18nContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

test('the list renders with its organization/status/form filters', async () => {
  mockBackend({ reports: [REPORT] });
  renderTab(['reports.view']);

  expect(await screen.findByTestId('reports-filter-organization')).toBeInTheDocument();
  expect(screen.getByTestId('reports-filter-status')).toBeInTheDocument();
  expect(screen.getByTestId('reports-filter-form')).toBeInTheDocument();
  const table = await screen.findByTestId('reports-table');
  expect(await within(table).findByText('Zangiota LX')).toBeInTheDocument();
});

test('"Create report" is hidden without reports.manage', async () => {
  mockBackend({ reports: [REPORT] });
  renderTab(['reports.view']);

  await screen.findByTestId('reports-table');
  expect(screen.queryByTestId('reports-create')).not.toBeInTheDocument();
});

test('the create modal offers only active forms, never a draft one', async () => {
  mockBackend({ reports: [] });
  renderTab(['reports.view', 'reports.manage']);

  const user = userEvent.setup();
  await user.click(await screen.findByTestId('reports-create'));

  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByDisplayValue('Shaklni tanlang')).toBeInTheDocument();
  expect(within(dialog).getByText(/Faol shakl/)).toBeInTheDocument();
  expect(within(dialog).queryByText(/Qoralama shakl/)).not.toBeInTheDocument();
});
