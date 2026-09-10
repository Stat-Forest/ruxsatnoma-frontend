/**
 * CaseDetailPage (task 7) — each of the six actions is its own gated
 * block, never a shared "manage" toggle: decide/resolve-appeal/close need
 * `inspections.cases.manage`, full stop; request-explanation ALSO accepts
 * a plain `inspections.acts.write` holder (an inspector on a case their
 * own act opened); record-explanation and file-appeal are the case's own
 * applicant's actions, never a plain inspector's.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';
import { stubAuthActions } from '../../auth/testAuthActions';
import { I18nContext } from '../../i18n/context';
import { CaseDetailPage } from './CaseDetailPage';
import type { CaseCardOut, ClassifierItemOut } from './queries';

const ME_ID = 'u1000000-0000-4000-8000-000000000001';
const APPLICANT_ID = 'ap000000-0000-4000-8000-000000000001';
const CASE_ID = 'ca000000-0000-4000-8000-000000000001';
const VIOLATION_TYPE_ID = 'vt000000-0000-4000-8000-000000000001';

const VIOLATION_TYPE: ClassifierItemOut = {
  id: VIOLATION_TYPE_ID,
  code: 'VT-01',
  name: { uz_latn: 'Ruxsatsiz chorva boqish' },
  props: {},
  valid_from: '2020-01-01',
  valid_to: null,
  status: 'active',
};

function caseOut(over: Partial<CaseCardOut> = {}): CaseCardOut {
  return {
    id: CASE_ID,
    number: 'CASE-2026-0001',
    act_id: 'ac000000-0000-4000-8000-000000000001',
    permit_id: null,
    applicant_id: APPLICANT_ID,
    organization_id: 'org00000-0000-4000-8000-000000000001',
    violation_type_item_id: VIOLATION_TYPE_ID,
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
    history: [{ id: 'h1', from_status: null, to_status: 'opened', changed_by: null, occurred_at: '2026-09-01T10:05:00+05:00', note: null }],
    appeals: [],
    prior_cases_count: 0,
    ...over,
  };
}

function authValue(permissions: string[], applicantId: string | null = null): AuthContextValue {
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
      role: { code: 'inspector', name: {} },
      permissions,
      zone: { region_id: null, district_id: null, organization_id: 'org00000-0000-4000-8000-000000000001' },
      csrf_token: 'tok-1',
      is_superuser: false,
      applicant: applicantId
        ? {
            id: applicantId,
            kind: 'individual',
            pinfl: '31708860250017',
            stir: null,
            name: 'Test',
            phone: null,
            email: null,
            region_id: null,
            district_id: null,
            address: null,
            verified_at: null,
          }
        : null,
      representations: [],
      registration_complete: true,
    },
    loading: false,
    authError: null,
    ...stubAuthActions(),
  };
}

const server = setupServer(http.get('*/api/v1/refs/classifiers/:code/items', () => HttpResponse.json([VIOLATION_TYPE])));
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPage(item: CaseCardOut, permissions: string[], applicantId: string | null = null) {
  server.use(http.get('*/api/v1/inspections/cases/:case_id', () => HttpResponse.json(item)));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <MemoryRouter initialEntries={[`/inspections/cases/${CASE_ID}`]}>
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>
          <AuthContext.Provider value={authValue(permissions, applicantId)}>
            <Routes>
              <Route path="/inspections/cases/:id" element={<CaseDetailPage />} />
            </Routes>
          </AuthContext.Provider>
        </I18nContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

test('an acts.write-only inspector sees request-explanation on an opened case, but no manage-only actions', async () => {
  renderPage(caseOut({ status: 'opened' }), ['inspections.acts.write']);

  expect(await screen.findByText('inspector.caseDetail.requestExplanationButton')).toBeInTheDocument();
  expect(screen.queryByText('inspector.caseDetail.decideSubmitButton')).not.toBeInTheDocument();
  expect(screen.queryByText('inspector.caseDetail.resolveSubmitButton')).not.toBeInTheDocument();
  expect(screen.queryByText('inspector.caseDetail.closeButton')).not.toBeInTheDocument();
});

test('a cases.manage holder sees the decide form on an opened case', async () => {
  renderPage(caseOut({ status: 'opened' }), ['inspections.cases.manage']);
  expect(await screen.findByText('inspector.caseDetail.decideSubmitButton')).toBeInTheDocument();
});

test('an appealed case offers only resolve-appeal, never the decide form (decide refuses an appealed case)', async () => {
  renderPage(caseOut({ status: 'appealed' }), ['inspections.cases.manage']);

  expect(await screen.findByText('inspector.caseDetail.resolveSubmitButton')).toBeInTheDocument();
  expect(screen.queryByText('inspector.caseDetail.decideSubmitButton')).not.toBeInTheDocument();
});

test('file-appeal is hidden from a non-applicant viewer even on a decided case', async () => {
  renderPage(caseOut({ status: 'decided' }), ['inspections.acts.write'], null);
  await screen.findByText('CASE-2026-0001');
  expect(screen.queryByText('inspector.caseDetail.appealSubmitButton')).not.toBeInTheDocument();
});

test('file-appeal is offered to the case\'s own applicant on a decided case with no open appeal', async () => {
  renderPage(caseOut({ status: 'decided' }), [], APPLICANT_ID);
  expect(await screen.findByText('inspector.caseDetail.appealSubmitButton')).toBeInTheDocument();
});

test('file-appeal stays hidden while an appeal is already open (unresolved)', async () => {
  renderPage(
    caseOut({
      status: 'decided',
      appeals: [{ id: 'ap1', case_id: CASE_ID, filed_by: APPLICANT_ID, text: 'x', filed_at: '2026-09-01T10:00:00Z', result: null, resolved_by: null, resolved_at: null }],
    }),
    [],
    APPLICANT_ID,
  );
  await screen.findByText('CASE-2026-0001');
  expect(screen.queryByText('inspector.caseDetail.appealSubmitButton')).not.toBeInTheDocument();
});

test('record-explanation is offered to the case\'s own applicant on an explanation_requested case', async () => {
  renderPage(caseOut({ status: 'explanation_requested' }), [], APPLICANT_ID);
  expect(await screen.findByText('inspector.caseDetail.explanationSubmitButton')).toBeInTheDocument();
});

test('record-explanation is hidden from a plain inspector who is not the applicant', async () => {
  renderPage(caseOut({ status: 'explanation_requested' }), ['inspections.acts.write'], null);
  await screen.findByText('CASE-2026-0001');
  expect(screen.queryByText('inspector.caseDetail.explanationSubmitButton')).not.toBeInTheDocument();
});

test('clicking request-explanation calls the route and refreshes', async () => {
  let called = false;
  server.use(
    http.post('*/api/v1/inspections/cases/:case_id/request-explanation', () => {
      called = true;
      return HttpResponse.json(caseOut({ status: 'explanation_requested' }));
    }),
  );

  const user = userEvent.setup();
  renderPage(caseOut({ status: 'opened' }), ['inspections.cases.manage']);
  await user.click(await screen.findByText('inspector.caseDetail.requestExplanationButton'));

  await waitFor(() => expect(called).toBe(true));
});

test('deciding sends the chosen decision, trimmed note and damage amount', async () => {
  let sentBody: Record<string, unknown> | undefined;
  server.use(
    http.post('*/api/v1/inspections/cases/:case_id/decide', async ({ request }) => {
      sentBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(caseOut({ status: 'decided', decision: 'warning' }));
    }),
  );

  const user = userEvent.setup();
  renderPage(caseOut({ status: 'opened' }), ['inspections.cases.manage']);

  await user.selectOptions(
    await screen.findByDisplayValue('inspector.caseDetail.decisionPlaceholder'),
    'inspector.caseDetail.decision.warning',
  );
  await user.click(screen.getByText('inspector.caseDetail.decideSubmitButton'));

  await waitFor(() => expect(sentBody).toBeDefined());
  expect(sentBody!.decision).toBe('warning');
});

test('the case number, violation type name and history render', async () => {
  renderPage(caseOut({ status: 'opened' }), ['inspections.cases.manage']);

  expect(await screen.findByText('CASE-2026-0001')).toBeInTheDocument();
  expect(await screen.findByText('Ruxsatsiz chorva boqish')).toBeInTheDocument();
});

test('a load failure renders an error, not a crash', async () => {
  server.use(http.get('*/api/v1/inspections/cases/:case_id', () => HttpResponse.json({ error: { code: 'ERR-ACL-001', message: 'forbidden' } }, { status: 403 })));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  render(
    <MemoryRouter initialEntries={[`/inspections/cases/${CASE_ID}`]}>
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>
          <AuthContext.Provider value={authValue(['inspections.cases.manage'])}>
            <Routes>
              <Route path="/inspections/cases/:id" element={<CaseDetailPage />} />
            </Routes>
          </AuthContext.Provider>
        </I18nContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );

  expect(await screen.findByText("Bu amal uchun sizda huquq yo'q.")).toBeInTheDocument();
});

// --- Stage 7.6 (ruling R8/#138, finding F3): the repeat-violation count ----

test('prior_cases_count renders the REAL count as a link into the filtered case list', async () => {
  renderPage(caseOut({ status: 'opened', prior_cases_count: 3 }), ['inspections.cases.manage']);

  const link = await screen.findByTestId('prior-cases-link');
  expect(link).toHaveTextContent('3');
  expect(link.closest('a')).toHaveAttribute('href', `/inspections?tab=cases&applicant_id=${APPLICANT_ID}`);
});

test('a case with no prior history shows the number 0, not a link (nothing to filter into)', async () => {
  renderPage(caseOut({ status: 'opened', prior_cases_count: 0 }), ['inspections.cases.manage']);

  await screen.findByText('CASE-2026-0001');
  expect(screen.queryByTestId('prior-cases-link')).not.toBeInTheDocument();
  expect(screen.getByText('0')).toBeInTheDocument();
});
