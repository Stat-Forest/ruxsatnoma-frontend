/**
 * ActsTab (task 6) — the result filter must actually reach the server as a
 * query param, the empty state must render, and "New inspection" (the
 * activity-without-a-permit entry point) must be gated on
 * `inspections.acts.write`, not merely on being able to see the list at all
 * (`view_any` holders such as `executor_head` can see acts they did not
 * write, but `POST /acts` would refuse them).
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
import { ActsTab } from './ActsTab';
import type { ActOut } from './queries';

const ME_ID = 'u1000000-0000-4000-8000-000000000001';
const ACT_ID = 'ac000000-0000-4000-8000-000000000001';

function act(over: Partial<ActOut> = {}): ActOut {
  return {
    id: ACT_ID,
    task_id: null,
    permit_id: null,
    application_id: null,
    organization_id: 'org00000-0000-4000-8000-000000000001',
    inspector_id: ME_ID,
    occurred_at: '2026-09-01T10:00:00+05:00',
    gps_accuracy_m: null,
    distance_to_contour_m: null,
    checklist_id: 'cl000000-0000-4000-8000-000000000001',
    answers: {},
    facts: {},
    result: null,
    notes: null,
    status: 'draft',
    created_offline_at: null,
    synced_at: null,
    created_at: '2026-09-01T09:00:00+05:00',
    ...over,
  };
}

function authValue(permissions: string[]): AuthContextValue {
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

function renderActsTab(acts: ActOut[], permissions: string[] = ['inspections.acts.write']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  server.use(http.get('*/api/v1/inspections/acts', () => HttpResponse.json({ items: acts, total: acts.length, page: 1, page_size: 20 })));
  return render(
    <MemoryRouter initialEntries={['/inspections']}>
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>
          <AuthContext.Provider value={authValue(permissions)}>
            <Routes>
              <Route path="/inspections" element={<ActsTab active />} />
              <Route path="/inspections/acts/new" element={<LandedProbe />} />
              <Route path="/inspections/acts/:id" element={<LandedProbe />} />
            </Routes>
          </AuthContext.Provider>
        </I18nContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

test('the empty state renders when there are no acts', async () => {
  renderActsTab([]);
  expect(await screen.findByText('inspector.acts.empty')).toBeInTheDocument();
});

test('a populated page renders each act with its own Open button', async () => {
  renderActsTab([act(), act({ id: 'ac000000-0000-4000-8000-000000000002', status: 'signed', result: 'violation' })]);
  expect(await screen.findAllByText('inspector.acts.openButton')).toHaveLength(2);
});

test('changing the result filter sends it as a query param', async () => {
  const seenFilters: (string | null)[] = [];
  const user = userEvent.setup();
  // `renderActsTab` installs its own default handler via `server.use()` —
  // registered AFTER this tracking one, `use()`'s own last-registered-wins
  // order would bury it. Install the tracking handler only once the initial
  // load (against the default handler) has already settled.
  renderActsTab([]);
  await screen.findByText('inspector.acts.empty');

  server.use(
    http.get('*/api/v1/inspections/acts', ({ request }) => {
      seenFilters.push(new URL(request.url).searchParams.get('result'));
      return HttpResponse.json({ items: [], total: 0, page: 1, page_size: 20 });
    }),
  );

  await user.selectOptions(screen.getByDisplayValue('inspector.acts.status.all'), 'inspector.actForm.result.violation');

  await waitFor(() => expect(seenFilters).toContain('violation'));
});

test('"New inspection" is offered to an acts.write holder', async () => {
  renderActsTab([], ['inspections.acts.write']);
  expect(await screen.findByText('inspector.acts.newButton')).toBeInTheDocument();
});

test('"New inspection" is hidden for a view_any-only holder (e.g. executor_head)', async () => {
  renderActsTab([], ['inspections.view_any']);
  await screen.findByText('inspector.acts.empty');
  expect(screen.queryByText('inspector.acts.newButton')).not.toBeInTheDocument();
});

test('"New inspection" navigates to /inspections/acts/new with no query params', async () => {
  const user = userEvent.setup();
  renderActsTab([]);
  await user.click(await screen.findByText('inspector.acts.newButton'));

  const landed = await screen.findByTestId('landed');
  expect(landed.textContent).toBe('/inspections/acts/new');
});

test('a click anywhere on an act card opens the act, not only its Open button', async () => {
  const user = userEvent.setup();
  renderActsTab([act()]);
  const card = (await screen.findByText('inspector.acts.openButton')).closest('div.bg-white')!;
  await user.click(card);

  const landed = await screen.findByTestId('landed');
  expect(landed.textContent).toBe(`/inspections/acts/${ACT_ID}`);
});
