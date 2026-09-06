/**
 * ActFormPage (task 4) — draft creation/editing, no photos/signing yet
 * (task 5). Four things this must never get wrong: `task_id` from the URL
 * reaches the create body; a refused create surfaces `ERR-INSP-002` against
 * the named checklist item without crashing; a DRAFT act the viewer owns
 * renders the editable/"Save changes" flow; a SIGNED act renders read-only.
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
import { ActFormPage } from './ActFormPage';
import type { ActCardOut, ChecklistOut } from './queries';

const ME_ID = 'u1000000-0000-4000-8000-000000000001';
const OTHER_ID = 'u2000000-0000-4000-8000-000000000002';
const CHECKLIST_ID = 'cl000000-0000-4000-8000-000000000001';
const ACT_ID = 'ac000000-0000-4000-8000-000000000001';

const CHECKLIST: ChecklistOut = {
  id: CHECKLIST_ID,
  code: 'CL-GRAZING',
  version: 1,
  name: { uz_latn: 'Chorva boqish' },
  activity_type_id: null,
  items: [
    { code: 'fence_ok', question: { uz_latn: 'Toʻsiq bormi?' }, type: 'bool', required: true },
    { code: 'note', question: { uz_latn: 'Izoh' }, type: 'text', required: false },
  ],
  status: 'active',
};

function act(over: Partial<ActCardOut> = {}): ActCardOut {
  return {
    id: ACT_ID,
    task_id: 't1000000-0000-4000-8000-000000000001',
    permit_id: null,
    application_id: null,
    organization_id: 'org00000-0000-4000-8000-000000000001',
    inspector_id: ME_ID,
    occurred_at: '2026-09-01T10:00:00+05:00',
    gps_accuracy_m: null,
    distance_to_contour_m: null,
    checklist_id: CHECKLIST_ID,
    answers: { fence_ok: true },
    facts: {},
    result: null,
    notes: null,
    status: 'draft',
    created_offline_at: null,
    synced_at: null,
    created_at: '2026-09-01T09:00:00+05:00',
    gps: null,
    files: [],
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

const server = setupServer(http.get('*/api/v1/inspections/checklists', () => HttpResponse.json([CHECKLIST])));
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>
          <AuthContext.Provider value={authValue()}>
            <Routes>
              <Route path="/inspections/acts/new" element={<ActFormPage />} />
              <Route path="/inspections/acts/:id" element={<ActFormPage />} />
            </Routes>
          </AuthContext.Provider>
        </I18nContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

test('a new act sends the task_id from the query string in the create body', async () => {
  let sentBody: Record<string, unknown> | undefined;
  server.use(
    http.post('*/api/v1/inspections/acts', async ({ request }) => {
      sentBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(act(), { status: 201 });
    }),
  );

  const user = userEvent.setup();
  renderAt('/inspections/acts/new?task_id=t1000000-0000-4000-8000-000000000001');

  // `findByDisplayValue` on the placeholder resolves the instant the select
  // mounts — the checklist itself is still loading — so wait for the real
  // option's own text before selecting it, or `selectOptions` races the
  // fetch and fails with "value not found in options".
  await screen.findByText('Chorva boqish');
  const select = screen.getByDisplayValue('inspector.actForm.checklistPlaceholder');
  await user.selectOptions(select, 'Chorva boqish');
  await user.click(screen.getByText('inspector.actForm.saveDraftButton'));

  await waitFor(() => expect(sentBody).toBeDefined());
  expect(sentBody!.task_id).toBe('t1000000-0000-4000-8000-000000000001');
  expect(sentBody!.checklist_id).toBe(CHECKLIST_ID);
});

test('a refused create surfaces ERR-INSP-002 against the named checklist item, without crashing', async () => {
  server.use(
    http.post('*/api/v1/inspections/acts', () =>
      HttpResponse.json(
        { error: { code: 'ERR-INSP-002', message: 'missing required answers', details: { missing: ['fence_ok'] } } },
        { status: 422 },
      ),
    ),
  );

  const user = userEvent.setup();
  renderAt('/inspections/acts/new?task_id=t1000000-0000-4000-8000-000000000001');

  await screen.findByText('Chorva boqish');
  const select = screen.getByDisplayValue('inspector.actForm.checklistPlaceholder');
  await user.selectOptions(select, 'Chorva boqish');
  await user.click(screen.getByText('inspector.actForm.saveDraftButton'));

  expect(await screen.findByText('inspector.actForm.missingAnswers')).toBeInTheDocument();
  expect(screen.getByText('inspector.actForm.requiredField')).toBeInTheDocument();
});

test('an existing draft act the viewer owns renders the Save-changes flow', async () => {
  server.use(http.get('*/api/v1/inspections/acts/:act_id', () => HttpResponse.json(act({ status: 'draft' }))));

  renderAt(`/inspections/acts/${ACT_ID}`);

  expect(await screen.findByText('inspector.actForm.saveChangesButton')).toBeInTheDocument();
  expect(screen.queryByText('inspector.actForm.readOnlyNotice')).not.toBeInTheDocument();
});

test('a signed act renders no editable controls and no Save button', async () => {
  server.use(http.get('*/api/v1/inspections/acts/:act_id', () => HttpResponse.json(act({ status: 'signed' }))));

  renderAt(`/inspections/acts/${ACT_ID}`);

  expect(await screen.findByText('inspector.actForm.readOnlyNotice')).toBeInTheDocument();
  expect(screen.queryByText('inspector.actForm.saveChangesButton')).not.toBeInTheDocument();
  expect(screen.queryByText('inspector.actForm.saveDraftButton')).not.toBeInTheDocument();
});

test('a draft act belonging to another inspector renders read-only too', async () => {
  server.use(http.get('*/api/v1/inspections/acts/:act_id', () => HttpResponse.json(act({ status: 'draft', inspector_id: OTHER_ID }))));

  renderAt(`/inspections/acts/${ACT_ID}`);

  expect(await screen.findByText('inspector.actForm.readOnlyNotice')).toBeInTheDocument();
  expect(screen.queryByText('inspector.actForm.saveChangesButton')).not.toBeInTheDocument();
});
