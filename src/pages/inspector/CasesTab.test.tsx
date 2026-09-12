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
import { vi } from 'vitest';
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
        pinfl: null,
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
  return <div data-testid="landed">{location.pathname + location.search}</div>;
}

/** Rendered ALONGSIDE `CasesTab` (not as a separate `Route`) so a
 *  same-path navigation (`/inspections` -> `/inspections?tab=cases`, the
 *  "clear filter" button's own target) is still observable — a separate
 *  `Route` for that path would just re-match the same element and tell the
 *  test nothing about which search string won. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-location">{location.pathname + location.search}</div>;
}

/** Returns the last request's own query params alongside the RTL render
 *  result — `seenParams` lets a test assert what was actually SENT
 *  (`applicant_id` included), not merely that the screen rendered
 *  something plausible. */
function renderCasesTab(cases: CaseOut[], applicantId?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  const seenParams: URLSearchParams[] = [];
  server.use(
    http.get('*/api/v1/inspections/cases', ({ request }) => {
      seenParams.push(new URL(request.url).searchParams);
      return HttpResponse.json({ items: cases, total: cases.length, page: 1, page_size: 20 });
    }),
  );
  const utils = render(
    <MemoryRouter initialEntries={['/inspections']}>
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>
          <AuthContext.Provider value={authValue()}>
            <Routes>
              <Route
                path="/inspections"
                element={
                  <>
                    <LocationProbe />
                    <CasesTab active applicantId={applicantId} />
                  </>
                }
              />
              <Route path="/inspections/cases/:id" element={<LandedProbe />} />
            </Routes>
          </AuthContext.Provider>
        </I18nContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { ...utils, seenParams };
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

// --- Stage 7.6 (ruling R8/#138, finding F3): applicant_id filtering --------

const APPLICANT_ID = 'ap000000-0000-4000-8000-000000000001';

test('an applicantId prop sends applicant_id as a real query param and renders that applicant\'s own case', async () => {
  const { seenParams } = renderCasesTab(
    [caseOut({ applicant_id: APPLICANT_ID, number: 'CASE-2026-0099' })],
    APPLICANT_ID,
  );

  expect(await screen.findByText('CASE-2026-0099')).toBeInTheDocument();
  expect(seenParams.at(-1)?.get('applicant_id')).toBe(APPLICANT_ID);
});

test('the filtered-by-applicant banner appears only when applicantId is set', async () => {
  renderCasesTab([caseOut()], APPLICANT_ID);
  expect(await screen.findByTestId('cases-applicant-filter-banner')).toBeInTheDocument();
});

test('no applicantId means no banner and no applicant_id query param', async () => {
  const { seenParams } = renderCasesTab([caseOut()]);

  await screen.findByText('CASE-2026-0001');
  expect(screen.queryByTestId('cases-applicant-filter-banner')).not.toBeInTheDocument();
  expect(seenParams.at(-1)?.get('applicant_id')).toBeNull();
});

test('clearing the applicant filter navigates back to the unfiltered cases tab', async () => {
  const user = userEvent.setup();
  renderCasesTab([caseOut()], APPLICANT_ID);

  await user.click(await screen.findByText('inspector.cases.clearApplicantFilter'));

  expect(await screen.findByTestId('current-location')).toHaveTextContent('/inspections?tab=cases');
});

test('a click anywhere on a case card opens the case, not only its Open button', async () => {
  const user = userEvent.setup();
  renderCasesTab([caseOut()]);
  await user.click(await screen.findByText(caseOut().number));

  const landed = await screen.findByTestId('landed');
  expect(landed.textContent).toBe(`/inspections/cases/${CASE_ID}`);
});

test('the Excel button asks the server for the export with the applied filters, never paging the list itself', async () => {
  const user = userEvent.setup();
  const listCalls: string[] = [];
  let exportUrl: URL | null = null;
  server.use(
    http.get('*/api/v1/inspections/cases', ({ request }) => {
      listCalls.push(request.url);
      return HttpResponse.json({ items: [caseOut()], total: 1, page: 1, page_size: 20 });
    }),
    http.get('*/api/v1/inspections/cases/export.xlsx', ({ request }) => {
      exportUrl = new URL(request.url);
      return HttpResponse.text('xlsx-bytes', {
        headers: {
          'Content-Disposition': 'attachment; filename="violation-cases-2026-09-11.xlsx"',
          'X-Export-Total': '1',
          'X-Export-Rows': '1',
          'X-Export-Truncated': 'false',
        },
      });
    }),
  );

  // jsdom's URL has no createObjectURL/revokeObjectURL at all — assigned
  // directly (never `vi.stubGlobal('URL', {...})`, which would replace the
  // constructor itself and break MSW's own `new URL(request.url)` parsing).
  const createObjectURL = vi.fn().mockReturnValue('blob:mock');
  const revokeObjectURL = vi.fn();
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  renderCasesTab([caseOut()]);
  await screen.findByText('CASE-2026-0001');
  const listCallsBefore = listCalls.length;

  await user.click(screen.getByTestId('export-xlsx'));

  await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  expect(clickSpy).toHaveBeenCalled();
  expect(listCalls.length).toBe(listCallsBefore); // the export never re-fetches the list
  expect(exportUrl!.searchParams.get('lang')).toBe('uz_latn');
  expect(exportUrl!.searchParams.has('page')).toBe(false);
  expect(exportUrl!.searchParams.has('page_size')).toBe(false);
});
