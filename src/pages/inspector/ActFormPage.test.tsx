/**
 * ActFormPage — draft creation/editing (task 4), plus photos, ERI signing
 * and post-sign case routing (task 5). What this must never get wrong:
 * `task_id` from the URL reaches the create body; a refused create surfaces
 * `ERR-INSP-002` against the named checklist item without crashing; a DRAFT
 * act the viewer owns renders the editable/"Save changes" flow; a SIGNED
 * act renders read-only; a `result: 'violation'` sign is blocked without a
 * violation type; a photo attach calls `POST /files` then `POST
 * .../acts/:id/files` in that order; a successful sign navigates to the
 * matching case.
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
import * as eimzo from '../../lib/eimzo';
import { actPackageJson } from './actPackage';
import { ActFormPage } from './ActFormPage';
import type { ActCardOut, CaseOut, ChecklistOut, ClassifierItemOut } from './queries';

const ME_ID = 'u1000000-0000-4000-8000-000000000001';
const OTHER_ID = 'u2000000-0000-4000-8000-000000000002';
const CHECKLIST_ID = 'cl000000-0000-4000-8000-000000000001';
const ACT_ID = 'ac000000-0000-4000-8000-000000000001';
const CASE_ID = 'ca000000-0000-4000-8000-000000000001';
const VIOLATION_TYPE_ID = 'vt000000-0000-4000-8000-000000000001';

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

const VIOLATION_TYPE: ClassifierItemOut = {
  id: VIOLATION_TYPE_ID,
  code: 'VT-01',
  name: { uz_latn: 'Ruxsatsiz chorva boqish' },
  props: {},
  valid_from: '2020-01-01',
  valid_to: null,
  status: 'active',
};

function caseOut(over: Partial<CaseOut> = {}): CaseOut {
  return {
    id: CASE_ID,
    number: 'CASE-2026-0001',
    act_id: ACT_ID,
    permit_id: null,
    applicant_id: null,
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

// `ActSignCard` fires `GET /refs/classifiers/violation_types/items`
// unconditionally the instant it mounts (any draft act the viewer owns),
// regardless of the act's own `result` — a default empty-list handler here
// keeps every test that doesn't care about violation types quiet; the two
// that do override it with `server.use(...)`.
const server = setupServer(
  http.get('*/api/v1/inspections/checklists', () => HttpResponse.json([CHECKLIST])),
  http.get('*/api/v1/refs/classifiers/:code/items', () => HttpResponse.json([])),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

function LandedProbe() {
  const location = useLocation();
  return <div data-testid="landed">{location.pathname + location.search}</div>;
}

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
              <Route path="/inspections/cases/:id" element={<LandedProbe />} />
              <Route path="/inspections" element={<LandedProbe />} />
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
    // `handleSaveDraft` navigates to the created act's own detail route on
    // success (`replace: true`, so a page refresh doesn't lose it) — that
    // remount fires `useAct(id)` for real, needing its own GET handler or
    // MSW logs an unhandled-request error even though nothing here asserts
    // against it.
    http.get('*/api/v1/inspections/acts/:act_id', () => HttpResponse.json(act())),
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

// --- Task 5: photos, ERI signing, post-sign case routing -----------------

test('signing a violation act without a chosen violation type keeps the Sign button disabled', async () => {
  server.use(
    http.get('*/api/v1/inspections/acts/:act_id', () => HttpResponse.json(act({ status: 'draft', result: 'violation' }))),
    http.get('*/api/v1/refs/classifiers/:code/items', () => HttpResponse.json([VIOLATION_TYPE])),
  );

  const user = userEvent.setup();
  renderAt(`/inspections/acts/${ACT_ID}`);

  const signButton = (await screen.findByText('inspector.actForm.sign.signButton')).closest('button')!;
  expect(signButton).toBeDisabled();

  await screen.findByText('Ruxsatsiz chorva boqish');
  const typeSelect = screen.getByDisplayValue('inspector.actForm.sign.violationTypePlaceholder');
  await user.selectOptions(typeSelect, 'Ruxsatsiz chorva boqish');

  expect(signButton).not.toBeDisabled();
});

test('a successful sign navigates to the matching case', async () => {
  server.use(
    http.get('*/api/v1/inspections/acts/:act_id', () => HttpResponse.json(act({ status: 'draft', result: 'violation' }))),
    http.get('*/api/v1/refs/classifiers/:code/items', () => HttpResponse.json([VIOLATION_TYPE])),
    http.post('*/api/v1/inspections/acts/:act_id/sign', () =>
      HttpResponse.json(act({ status: 'signed', result: 'violation' })),
    ),
    http.get('*/api/v1/inspections/cases', () => HttpResponse.json({ items: [caseOut()], total: 1, page: 1, page_size: 100 })),
  );

  const user = userEvent.setup();
  renderAt(`/inspections/acts/${ACT_ID}`);

  await screen.findByText('Ruxsatsiz chorva boqish');
  const typeSelect = screen.getByDisplayValue('inspector.actForm.sign.violationTypePlaceholder');
  await user.selectOptions(typeSelect, 'Ruxsatsiz chorva boqish');
  await user.type(screen.getByPlaceholderText('31708860250017'), '31708860250017');
  await user.click(screen.getByText('inspector.actForm.sign.signButton'));

  const landed = await screen.findByTestId('landed');
  expect(landed.textContent).toBe(`/inspections/cases/${CASE_ID}`);
});

test('a successful sign with no matching case on the first page falls back to a Cases-tab banner', async () => {
  server.use(
    http.get('*/api/v1/inspections/acts/:act_id', () => HttpResponse.json(act({ status: 'draft', result: 'violation' }))),
    http.get('*/api/v1/refs/classifiers/:code/items', () => HttpResponse.json([VIOLATION_TYPE])),
    http.post('*/api/v1/inspections/acts/:act_id/sign', () =>
      HttpResponse.json(act({ status: 'signed', result: 'violation' })),
    ),
    http.get('*/api/v1/inspections/cases', () =>
      HttpResponse.json({ items: [caseOut({ act_id: 'ac999999-0000-4000-8000-000000000099' })], total: 1, page: 1, page_size: 100 }),
    ),
  );

  const user = userEvent.setup();
  renderAt(`/inspections/acts/${ACT_ID}`);

  await screen.findByText('Ruxsatsiz chorva boqish');
  await user.selectOptions(screen.getByDisplayValue('inspector.actForm.sign.violationTypePlaceholder'), 'Ruxsatsiz chorva boqish');
  await user.type(screen.getByPlaceholderText('31708860250017'), '31708860250017');
  await user.click(screen.getByText('inspector.actForm.sign.signButton'));

  expect(await screen.findByText('inspector.actForm.sign.violationCaseOpenedFallback')).toBeInTheDocument();
  expect(screen.queryByTestId('landed')).not.toBeInTheDocument();
});

test('real mode: no PINFL box, and sign calls signDocument over the canonical act bytes (DETACHED)', async () => {
  vi.spyOn(eimzo, 'isEimzoMock').mockReturnValue(false);
  const signDocumentSpy = vi.spyOn(eimzo, 'signDocument').mockResolvedValue('REAL-PKCS7');
  let sentBody: { pkcs7: string } | undefined;
  server.use(
    http.get('*/api/v1/inspections/acts/:act_id', () => HttpResponse.json(act({ status: 'draft' }))),
    http.post('*/api/v1/inspections/acts/:act_id/sign', async ({ request }) => {
      sentBody = (await request.json()) as { pkcs7: string };
      return HttpResponse.json(act({ status: 'signed' }));
    }),
  );

  const user = userEvent.setup();
  renderAt(`/inspections/acts/${ACT_ID}`);

  await screen.findByText('inspector.actForm.sign.signButton');
  expect(screen.queryByPlaceholderText('31708860250017')).not.toBeInTheDocument();

  await user.click(screen.getByText('inspector.actForm.sign.signButton'));

  await waitFor(() => expect(sentBody).toBeDefined());
  expect(signDocumentSpy).toHaveBeenCalledTimes(1);
  const signedBytes = signDocumentSpy.mock.calls[0][0];
  const expectedJson = actPackageJson({
    id: ACT_ID,
    inspectorId: ME_ID,
    occurredAtIso: '2026-09-01T10:00:00+05:00',
    checklistId: CHECKLIST_ID,
    answers: { fence_ok: true },
    facts: {},
    result: null,
  });
  expect(new TextDecoder().decode(signedBytes)).toBe(expectedJson);
  expect(sentBody!.pkcs7).toBe('REAL-PKCS7');
});

test('a real-mode signing failure shows a distinct message and never reaches the sign mutation', async () => {
  vi.spyOn(eimzo, 'isEimzoMock').mockReturnValue(false);
  vi.spyOn(eimzo, 'signDocument').mockRejectedValue(new eimzo.EimzoPasswordError());
  let called = false;
  server.use(
    http.get('*/api/v1/inspections/acts/:act_id', () => HttpResponse.json(act({ status: 'draft' }))),
    http.post('*/api/v1/inspections/acts/:act_id/sign', () => {
      called = true;
      return HttpResponse.json(act({ status: 'signed' }));
    }),
  );

  const user = userEvent.setup();
  renderAt(`/inspections/acts/${ACT_ID}`);

  await screen.findByText('inspector.actForm.sign.signButton');
  await user.click(screen.getByText('inspector.actForm.sign.signButton'));

  expect(await screen.findByText(eimzo.EIMZO_ERROR_MESSAGE_KEYS.wrong_password)).toBeInTheDocument();
  expect(called).toBe(false);
});

// Important 3 (review of stage 5.2): a signing failure that was neither an
// `EimzoError` nor `isProviderUnreachable` used to hit a bare `return` — the
// spinner stopped and NOTHING appeared. A network blip mid-signing
// (`TypeError: Failed to fetch`) is exactly such a failure.
test('a signing failure that is neither an EimzoError nor provider-unreachable still shows a message, not silence', async () => {
  vi.spyOn(eimzo, 'isEimzoMock').mockReturnValue(false);
  vi.spyOn(eimzo, 'signDocument').mockRejectedValue(new TypeError('Failed to fetch'));
  let called = false;
  server.use(
    http.get('*/api/v1/inspections/acts/:act_id', () => HttpResponse.json(act({ status: 'draft' }))),
    http.post('*/api/v1/inspections/acts/:act_id/sign', () => {
      called = true;
      return HttpResponse.json(act({ status: 'signed' }));
    }),
  );

  const user = userEvent.setup();
  renderAt(`/inspections/acts/${ACT_ID}`);

  await screen.findByText('inspector.actForm.sign.signButton');
  await user.click(screen.getByText('inspector.actForm.sign.signButton'));

  expect(await screen.findByText(eimzo.EIMZO_ERROR_MESSAGE_KEYS.unknown)).toBeInTheDocument();
  expect(called).toBe(false);
});

test('a photo attach calls POST /files then POST .../acts/:id/files, in that order', async () => {
  const callOrder: string[] = [];
  server.use(
    http.get('*/api/v1/inspections/acts/:act_id', () => HttpResponse.json(act({ status: 'draft' }))),
    http.post('*/api/v1/files', () => {
      callOrder.push('upload');
      return HttpResponse.json(
        { id: 'fi000000-0000-4000-8000-000000000001', filename: 'photo.jpg', content_type: 'image/jpeg', size_bytes: 3, sha256: 'abc', created_at: '2026-09-01T10:00:00Z' },
        { status: 201 },
      );
    }),
    http.post('*/api/v1/inspections/acts/:act_id/files', () => {
      callOrder.push('attach');
      return HttpResponse.json(
        { id: 'af000000-0000-4000-8000-000000000001', act_id: ACT_ID, file_id: 'fi000000-0000-4000-8000-000000000001', kind: 'photo', created_at: '2026-09-01T10:01:00Z' },
        { status: 201 },
      );
    }),
  );

  const user = userEvent.setup();
  renderAt(`/inspections/acts/${ACT_ID}`);

  await screen.findByText('inspector.actForm.photos.addButton');
  const fileInput = screen.getByTestId('act-photo-input');
  await user.upload(fileInput, new File(['x'], 'photo.jpg', { type: 'image/jpeg' }));

  await waitFor(() => expect(callOrder).toEqual(['upload', 'attach']));
});

test('an already-attached photo renders as a real inline thumbnail via GET /files/{file_id} — and stays visible on a signed (read-only) act', async () => {
  const FILE_ID = 'fi100000-0000-4000-8000-000000000001';
  server.use(
    http.get('*/api/v1/inspections/acts/:act_id', () =>
      HttpResponse.json(
        act({
          status: 'signed',
          files: [{ id: 'af1000000-0000-4000-8000-000000000001', act_id: ACT_ID, file_id: FILE_ID, kind: 'photo', created_at: '2026-09-01T10:01:00Z' }],
        }),
      ),
    ),
    http.get(
      `*/api/v1/files/${FILE_ID}`,
      () => new HttpResponse(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/jpeg' } }),
    ),
  );

  // jsdom's URL has no createObjectURL/revokeObjectURL at all — assigned
  // directly, the same way `ApplicationsListPage.test.tsx`'s CSV-export
  // test does (never `vi.stubGlobal('URL', {...})`, which would replace the
  // constructor MSW's own `new URL(request.url)` needs).
  const createObjectURL = vi.fn().mockReturnValue('blob:mock-photo');
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = vi.fn();

  renderAt(`/inspections/acts/${ACT_ID}`);

  // signed -> read-only, but the photo gallery itself stays visible. The
  // thumbnail's `<img alt="">` is deliberately decorative (a short caption
  // right below already names the file) and so carries no accessible `img`
  // role for `getByRole` to find — queried via its own `data-testid` instead.
  await screen.findByText('inspector.actForm.readOnlyNotice');
  const thumbnail = await screen.findByTestId('act-photo-thumbnail');
  await waitFor(() => expect(thumbnail.querySelector('img')).toHaveAttribute('src', 'blob:mock-photo'));
  expect(createObjectURL).toHaveBeenCalledTimes(1);
});
