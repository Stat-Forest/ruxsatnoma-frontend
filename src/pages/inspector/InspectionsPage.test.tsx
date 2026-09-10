/**
 * InspectionsPage — the tab shell defaults to `tasks` (what the inspector
 * opens this screen FOR, day to day), but stage 7.6 (ruling R8/#138) adds an
 * OPTIONAL `?tab=&applicant_id=` entry point for `CaseDetailPage`'s
 * `prior_cases_count` link, so the whole path from that count to a REAL
 * filtered list is covered here, not just `CasesTab`'s own handling of the
 * prop in isolation.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';
import { stubAuthActions } from '../../auth/testAuthActions';
import { I18nContext } from '../../i18n/context';
import { InspectionsPage } from './InspectionsPage';
import type { CaseOut } from './queries';

const ME_ID = 'u1000000-0000-4000-8000-000000000001';
const APPLICANT_ID = 'ap000000-0000-4000-8000-000000000001';

function caseOut(over: Partial<CaseOut> = {}): CaseOut {
  return {
    id: 'ca000000-0000-4000-8000-000000000001',
    number: 'CASE-2026-0001',
    act_id: 'ac000000-0000-4000-8000-000000000001',
    permit_id: null,
    applicant_id: APPLICANT_ID,
    organization_id: 'org00000-0000-4000-8000-000000000001',
    violation_type_item_id: 'vt000000-0000-4000-8000-000000000001',
    status: 'opened',
    explanation_due_at: null,
    explanation_text: null,
    explanation_file_id: null,
    damage_amount: null,
    decision: null,
    decision_due_at: null,
    decided_by: null,
    decided_at: null,
    created_at: '2026-09-01T10:05:00+05:00',
    ...over,
  };
}

function authValue(): AuthContextValue {
  return {
    me: {
      user: {
        id: ME_ID,
        full_name: 'Inspektor Aliyev',
        login: 'aliyev',
        phone: null,
        email: null,
        must_change_password: false,
        pinfl: null,
        language: 'uz_latn',
      },
      role: { code: 'executor_head', name: {} },
      permissions: ['inspections.cases.manage', 'inspections.tasks.manage'],
      zone: { region_id: null, district_id: null, organization_id: 'org00000-0000-4000-8000-000000000001' },
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

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderAt(path: string) {
  server.use(
    http.get('*/api/v1/inspections/cases', ({ request }) => {
      const url = new URL(request.url);
      return HttpResponse.json({
        items: url.searchParams.get('applicant_id') === APPLICANT_ID ? [caseOut()] : [],
        total: url.searchParams.get('applicant_id') === APPLICANT_ID ? 1 : 0,
        page: 1,
        page_size: 20,
      });
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>
          <AuthContext.Provider value={authValue()}>
            <InspectionsPage />
          </AuthContext.Provider>
        </I18nContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

test('with no query string, the tasks tab is the default and cases stays hidden', async () => {
  renderAt('/inspections');
  const tasksTab = await screen.findByTestId('inspector-tasks-tab');
  expect(tasksTab.closest('[hidden]')).toBeNull();
  expect(screen.getByTestId('inspector-cases-tab').closest('[hidden]')).not.toBeNull();
});

test('?tab=cases&applicant_id= opens the cases tab already filtered, showing the REAL matching case', async () => {
  renderAt(`/inspections?tab=cases&applicant_id=${APPLICANT_ID}`);

  const casesTab = await screen.findByTestId('inspector-cases-tab');
  expect(casesTab.closest('[hidden]')).toBeNull();
  expect(await screen.findByTestId('cases-applicant-filter-banner')).toBeInTheDocument();
  expect(await screen.findByText('CASE-2026-0001')).toBeInTheDocument();
});

test('an unrecognised ?tab= value falls back to the tasks tab rather than showing nothing', async () => {
  renderAt('/inspections?tab=bogus');
  const tasksTab = await screen.findByTestId('inspector-tasks-tab');
  expect(tasksTab.closest('[hidden]')).toBeNull();
});
