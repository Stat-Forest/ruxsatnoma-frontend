/**
 * CasesTab (task 6) — the status filter must reach the server as a query
 * param, the empty state must render, and a due-date line shows only while
 * that date still lies ahead (a past one is simply dropped, no red/overdue
 * styling this pass — plan's own call).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';
import { stubAuthActions } from '../../auth/testAuthActions';
import { I18nContext } from '../../i18n/context';
import { CasesTab } from './CasesTab';
import type { CaseOut } from './queries';

const ME_ID = 'u1000000-0000-4000-8000-000000000001';
const CASE_ID = 'ca000000-0000-4000-8000-000000000001';

function caseOut(over: Partial<CaseOut> = {}): CaseOut {
  return {
    id: CASE_ID,
    number: 'CASE-2026-0001',
    act_id: 'ac000000-0000-4000-8000-000000000001',
    permit_id: null,
    applicant_id: null,
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
        language: 'uz_latn',
      },
      role: { code: 'inspector', name: {} },
      permissions: ['inspections.acts.write'],
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

function LandedProbe() {
  const location = useLocation();
  return <div data-testid="landed">{location.pathname}</div>;
}

function renderCasesTab(cases: CaseOut[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  server.use(http.get('*/api/v1/inspections/cases', () => HttpResponse.json({ items: cases, total: cases.length, page: 1, page_size: 20 })));
  return render(
    <MemoryRouter initialEntries={['/inspections']}>
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>
          <AuthContext.Provider value={authValue()}>
            <Routes>
              <Route path="/inspections" element={<CasesTab active />} />
              <Route path="/inspections/cases/:id" element={<LandedProbe />} />
            </Routes>
          </AuthContext.Provider>
        </I18nContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

test('the empty state renders when there are no cases', async () => {
  renderCasesTab([]);
  expect(await screen.findByText('inspector.cases.empty')).toBeInTheDocument();
});

test('a populated page renders each case by its own number, with an Open button', async () => {
  renderCasesTab([caseOut(), caseOut({ id: 'ca000000-0000-4000-8000-000000000002', number: 'CASE-2026-0002', status: 'decided' })]);
  expect(await screen.findByText('CASE-2026-0001')).toBeInTheDocument();
  expect(screen.getByText('CASE-2026-0002')).toBeInTheDocument();
  expect(screen.getAllByText('inspector.cases.openButton')).toHaveLength(2);
});

test('changing the status filter sends it as a query param', async () => {
  const seenFilters: (string | null)[] = [];
  const user = userEvent.setup();
  // `renderCasesTab` installs its own default handler via `server.use()` —
  // registered AFTER this tracking one, `use()`'s own last-registered-wins
  // order would bury it. Install the tracking handler only once the initial
  // load (against the default handler) has already settled.
  renderCasesTab([]);
  await screen.findByText('inspector.cases.empty');

  server.use(
    http.get('*/api/v1/inspections/cases', ({ request }) => {
      seenFilters.push(new URL(request.url).searchParams.get('status'));
      return HttpResponse.json({ items: [], total: 0, page: 1, page_size: 20 });
    }),
  );

  await user.selectOptions(screen.getByDisplayValue('inspector.cases.status.all'), 'inspector.cases.status.appealed');

  await waitFor(() => expect(seenFilters).toContain('appealed'));
});

test('a future explanation due date shows the due label', async () => {
  const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  renderCasesTab([caseOut({ status: 'explanation_requested', explanation_due_at: future })]);
  expect(await screen.findByText('inspector.cases.explanationDueLabel', { exact: false })).toBeInTheDocument();
});

test('a past explanation due date shows no due label (no overdue styling this pass)', async () => {
  const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  renderCasesTab([caseOut({ status: 'explanation_requested', explanation_due_at: past })]);
  await screen.findByText('CASE-2026-0001');
  expect(screen.queryByText('inspector.cases.explanationDueLabel', { exact: false })).not.toBeInTheDocument();
});

test('opening a case navigates to /inspections/cases/{id}', async () => {
  const user = userEvent.setup();
  renderCasesTab([caseOut()]);
  await user.click(await screen.findByText('inspector.cases.openButton'));

  const landed = await screen.findByTestId('landed');
  expect(landed.textContent).toBe(`/inspections/cases/${CASE_ID}`);
});
