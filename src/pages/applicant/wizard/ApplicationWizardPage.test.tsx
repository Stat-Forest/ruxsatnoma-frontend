import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { AuthContext } from '../../../auth/AuthContext';
import type { AuthContextValue } from '../../../auth/AuthContext';
import { DICTIONARIES, I18nContext } from '../../../i18n/context';
import type { UiLanguage } from '../../../i18n/context';
import { buildMockSignature } from '../../../lib/eimzoMock';
import * as eimzo from '../../../lib/eimzo';
import { ApplicationWizardPage } from './ApplicationWizardPage';

// The map, the organization tree and the contour list are ContourPicker's own
// concern (its own network calls, its own MapLibre instance) — none of it is
// what this file is pinning. A one-click stand-in lets step 2 complete
// without standing up any of that, the same way `recharts` is stubbed out in
// `ApplicantDashboardPage.test.tsx` for an unrelated reason (jsdom can't
// measure a chart) but the same shape of fix: mock what the test does not own.
vi.mock('./ContourPicker', () => ({
  ContourPicker: ({ onChange }: { onChange: (c: { id: string; number: string; areaHa: string | null }) => void }) => (
    <button type="button" onClick={() => onChange({ id: 'contour-1', number: 'C-1', areaHa: '12' })}>
      pick-contour
    </button>
  ),
}));
// Renders the live price as `calculationRequest` changes — its own
// `previewCalculation` round trip is not this test's concern either.
vi.mock('./PricePreviewPanel', () => ({ PricePreviewPanel: () => null }));

vi.mock('../../../lib/eimzoMock', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/eimzoMock')>();
  return { ...actual, buildMockSignature: vi.fn().mockResolvedValue('mock-pkcs7') };
});

const ACTIVITY_ID = 'a0000000-0000-4000-8000-000000000001';
const OTHER_ACTIVITY_ID = 'a0000000-0000-4000-8000-000000000002';
const APPLICATION_ID = 'ap000000-0000-4000-8000-000000000001';
const APPLICANT_NAME = 'Aliyev Vali Applicant';

function authValue(language: string): AuthContextValue {
  return {
  me: {
    user: {
      id: 'u0000000-0000-4000-8000-000000000001',
      full_name: 'Aliyev Vali',
      login: null,
      phone: null,
      email: null,
      must_change_password: false,
      language,
    },
    role: { code: 'applicant', name: {} },
    permissions: [],
    zone: { region_id: null, district_id: null, organization_id: null },
    csrf_token: 'tok-1',
    is_superuser: false,
    applicant: {
      id: 'ap100000-0000-4000-8000-000000000001',
      kind: 'individual',
      pinfl: '30491823410019',
      stir: null,
      name: APPLICANT_NAME,
      phone: null,
      email: null,
      region_id: null,
      district_id: null,
      // Ruling #113: an account that already has an address is never asked
      // for one in the wizard. The "asked, and can submit after filling it
      // in" behaviour for an address-less account gets its own dedicated
      // tests below, each with `address: null` on a fixture of its own.
      address: 'Toshkent sh., Chilonzor tumani, 12-uy',
      verified_at: null,
    },
    representations: [],
    registration_complete: true,
  },
  loading: false,
  authError: null,
  submitPassword: vi.fn(),
  verifyMfa: vi.fn(),
  startOneId: vi.fn(),
  loginViaEimzo: vi.fn(),
  logout: vi.fn(),
  applyMe: vi.fn(),
  refreshMe: vi.fn(),
  };
}

const AUTH_VALUE = authValue('uz');

// Ruling #113: only the account's own address (`MeOut.applicant.address`)
// gates the wizard, so a fixture that varies just that one field is enough
// to drive both branches without duplicating the whole `authValue()` shape.
function authValueWithAddress(address: string | null): AuthContextValue {
  const base = authValue('uz');
  return { ...base, me: { ...base.me!, applicant: { ...base.me!.applicant!, address } } };
}

const LEGAL_ENTITY_ID = 'ap100000-0000-4000-8000-0000000000ff';

// Ruling #183: `on_behalf='legal'` is the ONLY path that still goes through
// ERI (mock or real) — every test that exercises that machinery now needs a
// representation to select, not the bare `AUTH_VALUE` fixture (self).
function authValueLegal(): AuthContextValue {
  const base = authValue('uz');
  const entity = {
    ...base.me!.applicant!,
    id: LEGAL_ENTITY_ID,
    kind: 'legal',
    pinfl: null,
    stir: '302345678',
    name: '"Chorvador" MChJ',
    address: 'Namangan sh., Navoiy 1',
  };
  return {
    ...base,
    me: {
      ...base.me!,
      representations: [
        {
          id: 'rep00000-0000-4000-8000-000000000001',
          applicant: entity,
          basis: 'poa',
          valid_from: '2026-01-01',
          valid_until: null,
          status: 'active',
        },
      ],
    },
  };
}

// Step 1's on-behalf picker is the only `combobox` there (`FormField`
// renders its label as plain text, not an `htmlFor` binding) — must run
// BEFORE `chooseActivity`/`driveToStep5`, the same order the existing
// address-less-entity test already established.
async function selectLegalEntity() {
  await screen.findByText('Pichanchilik');
  await userEvent.selectOptions(screen.getByRole('combobox'), LEGAL_ENTITY_ID);
}

const server = setupServer(
  http.get('*/api/v1/refs/activity-types', () =>
    HttpResponse.json([{ id: ACTIVITY_ID, code: 'haymaking', name: { uz_latn: 'Pichanchilik' }, quantity_unit: 'ga' }]),
  ),
  http.get('*/api/v1/refs/livestock-types', () => HttpResponse.json([])),
  http.get('*/api/v1/refs/classifiers/:code/items', () => HttpResponse.json([])),
  // T10: unrestricted by default (no windows, no minimum term) — the same
  // "no dictionary row and no norm windows" meaning `season_source: "none"`
  // already carries, so a test that doesn't care about the season/occupancy
  // calendar sees the wizard behave exactly as it did before this track.
  http.get('*/api/v1/activity-seasons/effective', () =>
    HttpResponse.json({
      activity_type_id: ACTIVITY_ID,
      organization_id: 'org-1',
      contour_id: 'contour-1',
      windows: [],
      season_source: 'none',
      min_term_days: null,
      min_term_source: 'none',
    }),
  ),
  http.get('*/api/v1/gis/contours/:contourId/occupancy', () =>
    HttpResponse.json({
      contour_id: 'contour-1',
      activity_type_id: ACTIVITY_ID,
      period_from: '2020-01-01',
      period_to: '2020-01-31',
      capacity: null,
      unit: 'ga',
      exclusive: false,
      load_source: 'none',
      periods: [],
    }),
  ),
  http.post('*/api/v1/applications', () => HttpResponse.json({ id: APPLICATION_ID })),
  http.patch('*/api/v1/applications/:id', () => HttpResponse.json({ id: APPLICATION_ID })),
  http.get('*/api/v1/applications/:id', () => HttpResponse.json({ id: APPLICATION_ID, documents: [], items: [] })),
  http.post('*/api/v1/applications/:id/precheck', () => HttpResponse.json({ checks: [], calculation: null })),
  http.get(
    '*/api/v1/applications/:id/package',
    () => new HttpResponse(new ArrayBuffer(8), { headers: { 'Content-Type': 'application/octet-stream' } }),
  ),
  http.post('*/api/v1/applications/:id/submit', () => HttpResponse.json({ id: APPLICATION_ID })),
  // Ruling #184: the rules checkbox links here — fetched unconditionally on
  // mount, so every test in this file needs it handled, not only the ones
  // that reach step 5.
  http.get('*/api/v1/public/site-settings', () =>
    HttpResponse.json({ contacts: { phone: '+998 71 200 00 00' }, rules_url: 'https://lex.uz/docs/2770948' }),
  ),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// A real data router (`createMemoryRouter`), not a plain `<MemoryRouter>`:
// T1's leave-guard uses `useBlocker`, which throws outside a data router's
// context. Same pattern `ReportDetailPage.test.tsx` already uses for its
// own real-navigation assertions. Two extra routes stand in for the pages
// the wizard actually navigates to — "back to list" and a successful
// submit's redirect — so a proceeded navigation has somewhere to land
// instead of rendering react-router's own "no route matched" error.
function renderWizard(
  auth: AuthContextValue = AUTH_VALUE,
  lang: UiLanguage = 'uz_latn',
  initialPath = '/my/applications/new',
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const dict = DICTIONARIES[lang] ?? DICTIONARIES.uz_latn;
  const i18n = {
    lang,
    backendLang: lang,
    t: (key: string) => dict[key as keyof typeof dict] ?? key,
    setLanguage: async () => {},
  };
  const router = createMemoryRouter(
    [
      { path: '/my/applications/new', element: <ApplicationWizardPage /> },
      { path: '/my/applications', element: <div>applications-list</div> },
      { path: '/my/applications/:id', element: <div>application-card</div> },
    ],
    { initialEntries: [initialPath] },
  );
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

/** Choosing the activity takes TWO clicks on the same card: the first
 *  selects and stays on step 1, the second moves on (Oybek, 2026-09-10 — one
 *  click both chose and navigated, leaving no moment to see what had been
 *  chosen). Every test that only needs to GET past step 1 goes through here. */
async function chooseActivity(name = 'Pichanchilik') {
  await userEvent.click(await screen.findByText(name));
  await userEvent.click(await screen.findByText(name));
}

// Drives the wizard through steps 1–4 (activity, contour + period, quantity,
// documents) to step 5, where precheck fires automatically.
async function driveToStep5(lang: UiLanguage = 'uz_latn') {
  const dict = DICTIONARIES[lang] ?? DICTIONARIES.uz_latn;
  await chooseActivity();

  await userEvent.click(await screen.findByText('pick-contour'));
  fireEvent.change(screen.getByLabelText(new RegExp(dict['wizard.step2.periodFrom'])), { target: { value: '2026-01-01' } });
  fireEvent.change(screen.getByLabelText(new RegExp(dict['wizard.step2.periodTo'])), { target: { value: '2026-06-01' } });
  await userEvent.click(screen.getByRole('button', { name: new RegExp(dict['wizard.nav.next']) }));

  await userEvent.type(await screen.findByLabelText(new RegExp(dict['wizard.step3.quantity'])), '5');
  await userEvent.click(screen.getByRole('button', { name: new RegExp(dict['wizard.nav.next']) }));

  await userEvent.click(await screen.findByRole('button', { name: new RegExp(dict['wizard.nav.next']) }));
}

// Ruling #184: the checkbox that gates the sign button on every path — its
// own gating is asserted directly in a dedicated test below; every other
// test that needs to actually PRESS the button ticks it first through here.
async function acceptRules() {
  await userEvent.click(await screen.findByRole('checkbox'));
}

// Drives the wizard to step 5 and triggers a submit that the server refuses
// with a real domain error — the exact call site F4 named
// (`docs/plans/07.3-findings.md`): `ApplicationWizardPage.tsx`'s
// `handleSignAndSubmit` used to render the server's own Russian string
// verbatim as `${code}: ${message}`, regardless of the applicant's own
// interface language. Self-filing only (the default `AUTH_VALUE` fixture
// carries no representations) — ruling #183's own button label.
async function driveToSubmitFailure(lang: UiLanguage = 'uz_latn') {
  await driveToStep5(lang);
  const dict = DICTIONARIES[lang] ?? DICTIONARIES.uz_latn;
  await acceptRules();
  const signButton = await screen.findByRole('button', { name: new RegExp(dict['wizard.step5.signApplication']) });
  await waitFor(() => expect(signButton).toBeEnabled());
  await userEvent.click(signButton);
}

test.each([
  ['uz_latn', 'Kesishuvchi davr uchun faol ariza allaqachon mavjud.'],
  ['ru', 'Активная заявка на пересекающийся период уже существует.'],
])(
  'a duplicate-application refusal (ERR-APP-002) renders localized copy, not the raw code, in %s',
  async (language, expectedText) => {
    server.use(
      http.post('*/api/v1/applications/:id/submit', () =>
        HttpResponse.json(
          { error: { code: 'ERR-APP-002', message: 'Активная заявка на пересекающийся период уже существует' } },
          { status: 409 },
        ),
      ),
    );
    renderWizard(AUTH_VALUE, language as UiLanguage);

    await driveToSubmitFailure(language as UiLanguage);

    expect(await screen.findByText(expectedText)).toBeInTheDocument();
    expect(screen.queryByText(/ERR-APP-002:/)).not.toBeInTheDocument();
  },
);

// Regression pin for the wiring that was already lost once: merging two
// copies of the mock ERI codec dropped `fullName` at this exact call site,
// silently degrading a signature's stored evidence from `CN=<name>` to
// `PINFL=<digits>` (`lib/eimzoMock.ts::buildMockSignature`'s own `subject`
// fallback). It was restored by source reading alone — nothing asserted it.
// This test drives the wizard end to end only far enough to prove the wiring,
// not to exercise every step's own behaviour.
//
// Ruling #183: the mock/real ERI machinery below is exercised ONLY for a
// `legal` filing now — a `self` filing never builds an envelope at all
// (covered separately below). `applicant.name` signed here is still the
// SIGNED-IN citizen's own name (`me.applicant`, the representative), never
// the entity's — unaffected by which one is being filed for.
test('signing and submitting passes the signed-in applicant’s own name into the mock signature', async () => {
  const auth = authValueLegal();
  renderWizard(auth);
  await selectLegalEntity();

  await driveToStep5();
  await acceptRules();

  // Step 5 — precheck resolves, then sign and submit.
  const signButton = await screen.findByRole('button', { name: /ERI bilan imzolash va yuborish/ });
  await waitFor(() => expect(signButton).toBeEnabled());
  await userEvent.click(signButton);

  await waitFor(() =>
    expect(buildMockSignature).toHaveBeenCalledWith(expect.objectContaining({ fullName: APPLICANT_NAME })),
  );
});

// Finding 2 (review of stage 5.2): this call site was still hardwired to
// the mock builder, bypassing the mock/real switch entirely — under real
// mode, submitting an application would have signed with a builder the
// real backend cannot verify.
test('real mode: sign calls signDocument over the exact package bytes (DETACHED)', async () => {
  vi.spyOn(eimzo, 'isEimzoMock').mockReturnValue(false);
  const signDocumentSpy = vi.spyOn(eimzo, 'signDocument').mockResolvedValue('REAL-PKCS7');
  let sentBody: { pkcs7?: string; rules_accepted?: boolean } = {};
  server.use(
    http.post('*/api/v1/applications/:id/submit', async ({ request }) => {
      sentBody = (await request.json()) as typeof sentBody;
      return HttpResponse.json({ id: APPLICATION_ID });
    }),
  );
  const auth = authValueLegal();
  renderWizard(auth);
  await selectLegalEntity();

  await driveToStep5();
  await acceptRules();
  const signButton = await screen.findByRole('button', { name: /ERI bilan imzolash va yuborish/ });
  await waitFor(() => expect(signButton).toBeEnabled());
  await userEvent.click(signButton);

  // A legal filing still carries the envelope AND the mandatory acceptance
  // (ruling #184) in the same body.
  await waitFor(() => expect(sentBody.pkcs7).toBe('REAL-PKCS7'));
  expect(sentBody.rules_accepted).toBe(true);
  expect(signDocumentSpy).toHaveBeenCalledTimes(1);
});

test('a real-mode signing failure shows a distinct message and never reaches submit', async () => {
  vi.spyOn(eimzo, 'isEimzoMock').mockReturnValue(false);
  vi.spyOn(eimzo, 'signDocument').mockRejectedValue(new eimzo.EimzoPasswordError());
  let called = false;
  server.use(
    http.post('*/api/v1/applications/:id/submit', () => {
      called = true;
      return HttpResponse.json({ id: APPLICATION_ID });
    }),
  );
  const auth = authValueLegal();
  renderWizard(auth);
  await selectLegalEntity();

  await driveToStep5();
  await acceptRules();
  const signButton = await screen.findByRole('button', { name: /ERI bilan imzolash va yuborish/ });
  await waitFor(() => expect(signButton).toBeEnabled());
  await userEvent.click(signButton);

  expect(
    await screen.findByText(DICTIONARIES.uz_latn[eimzo.EIMZO_ERROR_MESSAGE_KEYS.wrong_password]),
  ).toBeInTheDocument();
  expect(called).toBe(false);
});

// Ruling #183: the OTHER half of the branch — a `self` filing posts no
// envelope at all, and never touches the mock/real ERI machinery above.
test('a self filing (the default fixture) signs with a plain button: no pkcs7, rules_accepted true, no envelope built', async () => {
  let sentBody: { pkcs7?: string | null; rules_accepted?: boolean } = {};
  server.use(
    http.post('*/api/v1/applications/:id/submit', async ({ request }) => {
      sentBody = (await request.json()) as typeof sentBody;
      return HttpResponse.json({ id: APPLICATION_ID });
    }),
  );
  // Counted rather than asserted absent: the mock is module-level and
  // carries calls from earlier (legal-filing) tests in this file.
  const signaturesBefore = vi.mocked(buildMockSignature).mock.calls.length;
  renderWizard();

  await driveToStep5();
  await acceptRules();
  const signButton = await screen.findByRole('button', { name: new RegExp(UZ['wizard.step5.signApplication']) });
  await waitFor(() => expect(signButton).toBeEnabled());
  await userEvent.click(signButton);

  await waitFor(() => expect(sentBody.rules_accepted).toBe(true));
  expect(sentBody.pkcs7).toBeUndefined();
  expect(vi.mocked(buildMockSignature).mock.calls.length).toBe(signaturesBefore);
});

// Ruling #113 (`docs/decisions.md`): the address requisite is gated at
// SUBMIT. `CompleteRegistrationGate.tsx` is the only place that ever WROTE
// an address, and it was optional there, so an account that registered
// before this ruling can reach the wizard with none — the wizard is where
// that account gets asked.
test('an account with no address is asked for it in step 5, and can submit once it is filled in', async () => {
  let seenAddressBody: unknown = null;
  let sentBody: { pkcs7?: string; rules_accepted?: boolean } = {};
  const auth = authValueWithAddress(null);
  server.use(
    http.patch('*/api/v1/auth/applicants/:applicantId/address', async ({ request }) => {
      seenAddressBody = await request.json();
      return HttpResponse.json({
        ...auth.me!.applicant,
        address: "Farg'ona sh., Mustaqillik ko'chasi 5",
      });
    }),
    http.post('*/api/v1/applications/:id/submit', async ({ request }) => {
      sentBody = (await request.json()) as typeof sentBody;
      return HttpResponse.json({ id: APPLICATION_ID });
    }),
  );
  // Counted rather than asserted absent: the mock is module-level and
  // carries calls from earlier (legal-filing) tests in this file.
  const signaturesBefore = vi.mocked(buildMockSignature).mock.calls.length;
  renderWizard(auth);

  await driveToStep5();
  // Ruling #184: the rules checkbox gates this same button too — ticked
  // once, up front, so the address-related disabling below is isolated to
  // the address itself.
  await acceptRules();

  // The button says what the first press DOES: an address-less account has no
  // price yet (`missing_for_pricing` counts the blank address), so pressing it
  // saves the address and re-runs the pre-check rather than signing blind.
  const saveButton = await screen.findByRole('button', {
    name: /Manzilni saqlash va narxni hisoblash/,
  });
  const addressInput = await screen.findByLabelText(/Manzil/);
  // Disabled before the address is filled in — the precheck alone is not
  // enough to unblock submission for an address-less account.
  await waitFor(() => expect(saveButton).toBeDisabled());

  await userEvent.type(addressInput, "Farg'ona sh., Mustaqillik ko'chasi 5");
  await waitFor(() => expect(saveButton).toBeEnabled());
  await userEvent.click(saveButton);

  await waitFor(() => expect(seenAddressBody).toEqual({ address: "Farg'ona sh., Mustaqillik ko'chasi 5" }));
  // Nothing is signed by that first press, and this is a `self` filing (the
  // default fixture carries no representations) — no envelope is EVER built.
  expect(vi.mocked(buildMockSignature).mock.calls.length).toBe(signaturesBefore);

  // Now it signs — ruling #183's plain button, not the ERI one.
  const signButton = await screen.findByRole('button', { name: new RegExp(UZ['wizard.step5.signApplication']) });
  await userEvent.click(signButton);
  // `saveApplicantAddress` hands back an `ApplicantOut`, not a whole
  // `MeOut` — the wizard adopts it through `refreshMe()`, not `applyMe()`.
  await waitFor(() => expect(auth.refreshMe).toHaveBeenCalled());
  await waitFor(() => expect(sentBody.rules_accepted).toBe(true));
  expect(sentBody.pkcs7).toBeUndefined();
  expect(vi.mocked(buildMockSignature).mock.calls.length).toBe(signaturesBefore);
});

// Ruling #113, the representative's case: the address that gets printed is
// the HOLDER's, and when a representative files on behalf of a legal entity
// the holder is that entity. A citizen whose own record carries an address
// can still be filing for an entity that has none — checking `me.applicant`
// alone would leave the backend refusing a submission the wizard never asked
// about.
test('a representative filing for an address-less legal entity is asked for the ENTITY address', async () => {
  let seenPath: string | null = null;
  let seenAddressBody: unknown = null;
  const base = authValue('uz');
  const entity = {
    ...base.me!.applicant!,
    id: 'ap100000-0000-4000-8000-0000000000ff',
    kind: 'legal',
    pinfl: null,
    stir: '302345678',
    name: '"Chorvador" MChJ',
    address: null,
  };
  const auth: AuthContextValue = {
    ...base,
    me: {
      ...base.me!,
      representations: [
        {
          id: 'rep00000-0000-4000-8000-000000000001',
          applicant: entity,
          basis: 'poa',
          valid_from: '2026-01-01',
          valid_until: null,
          status: 'active',
        },
      ],
    },
  };
  server.use(
    http.patch('*/api/v1/auth/applicants/:applicantId/address', async ({ request, params }) => {
      seenPath = String(params.applicantId);
      seenAddressBody = await request.json();
      return HttpResponse.json({ ...entity, address: 'Namangan sh., Navoiy 1' });
    }),
  );
  renderWizard(auth);

  // Step 1 offers the on-behalf-of picker only when representations exist,
  // and it is the only select on that step. `FormField` renders its label as
  // plain text, not an `htmlFor` binding, so the role is the handle here —
  // the same reason `ActFormPage.test.tsx` reaches its selects by value.
  await screen.findByText('Pichanchilik');
  await userEvent.selectOptions(screen.getByRole('combobox'), entity.id);
  await driveToStep5();
  await acceptRules();

  const saveButton = await screen.findByRole('button', {
    name: /Manzilni saqlash va narxni hisoblash/,
  });
  await userEvent.type(await screen.findByLabelText(/Manzil/), 'Namangan sh., Navoiy 1');
  await waitFor(() => expect(saveButton).toBeEnabled());
  await userEvent.click(saveButton);

  // The entity's id, not the signed-in citizen's.
  await waitFor(() => expect(seenPath).toBe(entity.id));
  expect(seenAddressBody).toEqual({ address: 'Namangan sh., Navoiy 1' });
});

test('an account that already has an address is never asked for one', async () => {
  const auth = authValueWithAddress('Toshkent sh., Chilonzor tumani, 12-uy');
  renderWizard(auth);

  await driveToStep5();

  await screen.findByRole('button', { name: /Arizani imzolash/ });
  expect(screen.queryByLabelText(/Manzil/)).not.toBeInTheDocument();
});

test.each(['uz_latn', 'uz_cyrl', 'ru', 'en', 'kaa'] as const)(
  'renders wizard translated in %s',
  (lang) => {
    renderWizard(AUTH_VALUE, lang);
    const dict = DICTIONARIES[lang];
    expect(screen.getByText(dict['wizard.title'])).toBeInTheDocument();
    expect(screen.getByText(dict['wizard.step1.heading'])).toBeInTheDocument();
  },
);

// ─── T1 (`docs/plans/09-odilxon-demo-fixes.md`) ───────────────────────────
// Date validation, the stepper, the leave-guard, and activity auto-advance.

const UZ = DICTIONARIES.uz_latn;

test('choosing the activity type advances to step 2 by itself, and the Next button stays in place', async () => {
  renderWizard();

  await chooseActivity();

  expect(await screen.findByText(UZ['wizard.step2.heading'])).toBeInTheDocument();
  // Not removed (Oybek: "not removed, merely no longer the only way
  // forward") — it now governs step 2's own advance.
  expect(screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) })).toBeInTheDocument();
});

test('a reversed period is named in the field and blocks Next before any request leaves the browser', async () => {
  let patchCount = 0;
  server.use(
    http.patch('*/api/v1/applications/:id', () => {
      patchCount += 1;
      return HttpResponse.json({ id: APPLICATION_ID });
    }),
  );
  renderWizard();

  await chooseActivity();
  await userEvent.click(await screen.findByText('pick-contour'));
  // The activity-type PATCH already landed by the time step 2 renders —
  // count from here, not from zero.
  await waitFor(() => expect(patchCount).toBeGreaterThan(0));
  const countBeforeDates = patchCount;

  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step2.periodFrom'])), { target: { value: '2026-06-01' } });
  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step2.periodTo'])), { target: { value: '2026-01-01' } });

  expect(await screen.findByText(/Tugash sanasi boshlanish sanasidan oldin/)).toBeInTheDocument();
  const nextButton = screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) });
  expect(nextButton).toBeDisabled();

  await userEvent.click(nextButton);
  expect(patchCount).toBe(countBeforeDates);
});

test('a period longer than 5×366 days is named in the field and blocks Next', async () => {
  renderWizard();

  await chooseActivity();
  await userEvent.click(await screen.findByText('pick-contour'));

  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step2.periodFrom'])), { target: { value: '2020-01-01' } });
  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step2.periodTo'])), { target: { value: '2026-01-01' } });

  expect(await screen.findByText(/1830 kundan/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) })).toBeDisabled();
});

test('each date input constrains the other via native min/max', async () => {
  renderWizard();

  await chooseActivity();
  await userEvent.click(await screen.findByText('pick-contour'));

  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step2.periodFrom'])), { target: { value: '2026-01-01' } });
  const toInput = screen.getByLabelText(new RegExp(UZ['wizard.step2.periodTo'])) as HTMLInputElement;
  expect(toInput.min).toBe('2026-01-01');
  expect(toInput.max).toBe('2031-01-05'); // 2026-01-01 + 5×366 days

  fireEvent.change(toInput, { target: { value: '2026-06-01' } });
  const fromInput = screen.getByLabelText(new RegExp(UZ['wizard.step2.periodFrom'])) as HTMLInputElement;
  expect(fromInput.max).toBe('2026-06-01');
  expect(fromInput.min).toBe('2021-05-28'); // 2026-06-01 − 5×366 days
});

test('the stepper returns to a COMPLETED step reached earlier', async () => {
  renderWizard();
  await driveToStep5();

  const step1Buttons = screen.getAllByLabelText(/^1:/);
  await userEvent.click(step1Buttons[0]);

  expect(await screen.findByText(UZ['wizard.step1.heading'])).toBeInTheDocument();
});

test('a step ahead of the furthest one reached stays inert', async () => {
  renderWizard();
  await chooseActivity();
  await screen.findByText('pick-contour'); // now on step 2, furthest reached is 2

  const step4Buttons = screen.getAllByLabelText(/^4:/);
  expect(step4Buttons[0]).toBeDisabled();
  await userEvent.click(step4Buttons[0]);
  expect(screen.getByText(UZ['wizard.step2.heading'])).toBeInTheDocument();
});

test('a step already reached stays clickable even after going further back than that step', async () => {
  renderWizard();
  await driveToStep5(); // furthest reached is 5, currently on step 5

  const step1Buttons = screen.getAllByLabelText(/^1:/);
  await userEvent.click(step1Buttons[0]); // back to step 1 — furthest reached still 5

  const step4Buttons = screen.getAllByLabelText(/^4:/);
  expect(step4Buttons[0]).not.toBeDisabled();
  await userEvent.click(step4Buttons[0]);
  expect(await screen.findByText(UZ['wizard.step4.heading'])).toBeInTheDocument();
});

test('leaving mid-draft via in-app navigation asks first, and the draft is kept if cancelled', async () => {
  const { router } = renderWizard();
  await chooseActivity(); // draft exists after the first click; the second moves on
  await screen.findByText('pick-contour');

  await userEvent.click(screen.getByRole('button', { name: new RegExp(UZ['wizard.backToList']) }));

  expect(await screen.findByText(/Vizarddan chiqasizmi/)).toBeInTheDocument();
  // Blocked, not navigated yet.
  expect(router.state.location.pathname).toBe('/my/applications/new');

  await userEvent.click(screen.getByRole('button', { name: 'Davom etish' }));
  expect(screen.queryByText(/Vizarddan chiqasizmi/)).not.toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/my/applications/new');
  // Still on the wizard, the contour picker included — nothing was reset.
  expect(screen.getByText('pick-contour')).toBeInTheDocument();
});

test('leaving mid-draft via in-app navigation proceeds once confirmed', async () => {
  const { router } = renderWizard();
  await chooseActivity();
  await screen.findByText('pick-contour');

  await userEvent.click(screen.getByRole('button', { name: new RegExp(UZ['wizard.backToList']) }));
  await userEvent.click(await screen.findByRole('button', { name: 'Chiqish' }));

  await waitFor(() => expect(router.state.location.pathname).toBe('/my/applications'));
});

test('no leave-confirmation is asked before any draft exists (step 1, nothing chosen yet)', async () => {
  const { router } = renderWizard();
  await screen.findByText('Pichanchilik'); // step 1, no activity picked yet

  await userEvent.click(screen.getByRole('button', { name: new RegExp(UZ['wizard.backToList']) }));

  // Nothing to lose yet — navigates straight through, no modal.
  await waitFor(() => expect(router.state.location.pathname).toBe('/my/applications'));
});

test('a successful submit navigates straight through, without asking to leave', async () => {
  const { router } = renderWizard();
  await driveToStep5();
  await acceptRules();

  const signButton = await screen.findByRole('button', { name: new RegExp(UZ['wizard.step5.signApplication']) });
  await waitFor(() => expect(signButton).toBeEnabled());
  await userEvent.click(signButton);

  await waitFor(() => expect(router.state.location.pathname).toBe(`/my/applications/${APPLICATION_ID}`));
  expect(screen.queryByText(/Vizarddan chiqasizmi/)).not.toBeInTheDocument();
});

test('beforeunload is prevented while a draft exists, and not before one does', async () => {
  renderWizard();
  await screen.findByText('Pichanchilik');

  // Step 1, nothing chosen yet — no draft, nothing to warn about.
  const before = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(before);
  expect(before.defaultPrevented).toBe(false);

  await chooseActivity();
  await screen.findByText('pick-contour'); // draft now exists

  const after = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(after);
  expect(after.defaultPrevented).toBe(true);
});

// ─── T10 (`docs/plans/09-odilxon-demo-fixes.md`, decisions #177/#179) ─────
// Season/minimum-term validation on the native period inputs (the
// `OccupancyCalendar` component's own behaviour — the season windows, the
// wrap-around case, the three occupancy colours, the minimum-term disabling
// — is covered directly in `OccupancyCalendar.test.tsx` and
// `seasonCalendar.test.ts`), and the benefit certificate-number field.

test('a date outside the effective season is refused in the field, before any request leaves the browser', async () => {
  server.use(
    http.get('*/api/v1/activity-seasons/effective', () =>
      HttpResponse.json({
        activity_type_id: ACTIVITY_ID,
        organization_id: 'org-1',
        contour_id: 'contour-1',
        windows: [{ from: '05-01', to: '09-30' }],
        season_source: 'activity_season',
        min_term_days: null,
        min_term_source: 'none',
      }),
    ),
  );
  renderWizard();

  await chooseActivity();
  await userEvent.click(await screen.findByText('pick-contour'));

  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step2.periodFrom'])), { target: { value: '2026-01-01' } });
  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step2.periodTo'])), { target: { value: '2026-01-15' } });

  expect(await screen.findByText(UZ['wizard.step2.seasonOutOfRange'])).toBeInTheDocument();
  expect(screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) })).toBeDisabled();

  // Inside the effective window (May–September), the same pair is accepted.
  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step2.periodFrom'])), { target: { value: '2026-05-01' } });
  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step2.periodTo'])), { target: { value: '2026-06-01' } });
  await waitFor(() => expect(screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) })).toBeEnabled());
});

test('the minimum term is stated before any date is picked, and enforced once a too-short pair is', async () => {
  server.use(
    http.get('*/api/v1/activity-seasons/effective', () =>
      HttpResponse.json({
        activity_type_id: ACTIVITY_ID,
        organization_id: 'org-1',
        contour_id: 'contour-1',
        windows: [],
        season_source: 'none',
        min_term_days: 30,
        min_term_source: 'activity_season',
      }),
    ),
  );
  renderWizard();

  await chooseActivity();
  await userEvent.click(await screen.findByText('pick-contour'));

  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step2.periodFrom'])), { target: { value: '2026-01-01' } });

  // Stated up front, as a helper note, before an end date narrows it into
  // an error — the applicant sees "not less than 30 days" rather than
  // discovering it from a refusal.
  expect(await screen.findByText('Davr muddati kamida 30 kun boʻlishi kerak.')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step2.periodTo'])), { target: { value: '2026-01-10' } }); // 9-day span
  expect(await screen.findByText('Davr muddati kamida 30 kun boʻlishi kerak.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) })).toBeDisabled();

  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step2.periodTo'])), { target: { value: '2026-02-01' } }); // 31-day span
  await waitFor(() => expect(screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) })).toBeEnabled());
});

// The benefit claim lives on step 4 with the documents: a category is one
// more option of the same "document type" select every row carries, under a
// divider after the `doc_types` items. These fixtures answer both
// classifiers at once — `doc_types` must carry at least one item for the
// step to render its rows at all, and `benefit_proof` is what a chosen
// category is filed under (migration `0024`).
const BENEFIT_ITEM = {
  id: 'benefit-1',
  code: 'veteran',
  name: { uz_latn: 'Urush faxriysi' },
  props: {},
  valid_from: '2020-01-01',
  valid_to: null,
  status: 'active',
};
const PROOF_DOC_TYPE = {
  id: 'doctype-proof',
  code: 'benefit_proof',
  name: { uz_latn: 'Imtiyozni tasdiqlovchi hujjat' },
  props: {},
  valid_from: '2020-01-01',
  valid_to: null,
  status: 'active',
};
const OTHER_DOC_TYPE = {
  id: 'doctype-other',
  code: 'passport',
  name: { uz_latn: 'Pasport' },
  props: {},
  valid_from: '2020-01-01',
  valid_to: null,
  status: 'active',
};
function classifierHandler(benefits: object[], docTypes: object[]) {
  return http.get('*/api/v1/refs/classifiers/:code/items', ({ params }) => {
    if (params.code === 'benefit_categories') return HttpResponse.json(benefits);
    if (params.code === 'doc_types') return HttpResponse.json(docTypes);
    return HttpResponse.json([]);
  });
}
// A card whose `documents` grow as `POST .../documents` lands — the wizard
// re-reads the card after every upload, and step 4's rows are drawn from it.
function documentsStore(initial: { id: string; doc_type_item_id: string; file_id: string }[] = []) {
  let documents = initial;
  return [
    http.get('*/api/v1/applications/:id', () => HttpResponse.json({ id: APPLICATION_ID, documents, items: [] })),
    http.post('*/api/v1/applications/:id/documents', async ({ request }) => {
      const body = (await request.json()) as { doc_type_item_id: string; file_id: string };
      const doc = { id: `doc-${documents.length + 1}`, doc_type_item_id: body.doc_type_item_id, file_id: body.file_id };
      documents = [...documents, doc];
      return HttpResponse.json(doc);
    }),
    http.delete('*/api/v1/applications/:id/documents/:documentId', ({ params }) => {
      documents = documents.filter((d) => d.id !== params.documentId);
      return new HttpResponse(null, { status: 204 });
    }),
    http.post('*/api/v1/files', () => HttpResponse.json({ id: 'file-1' })),
  ];
}
// Steps 1–3 for a non-grazing activity, ending on step 4's first row.
async function driveToStep4() {
  await chooseActivity();
  await userEvent.click(await screen.findByText('pick-contour'));
  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step2.periodFrom'])), { target: { value: '2026-01-01' } });
  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step2.periodTo'])), { target: { value: '2026-06-01' } });
  await userEvent.click(screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) }));
  await userEvent.type(await screen.findByLabelText(new RegExp(UZ['wizard.step3.quantity'])), '5');
  await userEvent.click(screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) }));
  await screen.findByText(UZ['wizard.step4.heading']);
}
function fileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

test('the benefit is not asked on step 3 any more — it is an option of the document-type select on step 4', async () => {
  server.use(classifierHandler([BENEFIT_ITEM], [PROOF_DOC_TYPE, OTHER_DOC_TYPE]));
  renderWizard();

  await chooseActivity();
  await userEvent.click(await screen.findByText('pick-contour'));
  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step2.periodFrom'])), { target: { value: '2026-01-01' } });
  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step2.periodTo'])), { target: { value: '2026-06-01' } });
  await userEvent.click(screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) }));

  await screen.findByLabelText(new RegExp(UZ['wizard.step3.quantity']));
  // No select on step 3 for a non-grazing activity: the benefit one is gone.
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  await userEvent.type(screen.getByLabelText(new RegExp(UZ['wizard.step3.quantity'])), '5');
  await userEvent.click(screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) }));

  const select = await screen.findByRole('combobox');
  const labels = Array.from((select as HTMLSelectElement).options).map((o) => o.textContent);
  expect(labels).toEqual([UZ['wizard.step4.selectDocType'], 'Pasport', `— ${UZ['wizard.step4.benefitsGroup']} —`, 'Urush faxriysi']);
});

// Ruling #181: the certificate number is mandatory for EVERY benefit
// category now — there is no `props.requires_certificate` switch any more,
// so this fixture deliberately carries `props: {}` to prove the field is
// still required regardless.
test('the benefit certificate number is required before Next for ANY chosen category (no per-item switch), and reaches the PATCH', async () => {
  server.use(classifierHandler([BENEFIT_ITEM], [PROOF_DOC_TYPE]), ...documentsStore());
  let lastPatchBody: unknown = null;
  server.use(
    http.patch('*/api/v1/applications/:id', async ({ request }) => {
      lastPatchBody = await request.json();
      return HttpResponse.json({ id: APPLICATION_ID });
    }),
  );
  renderWizard();
  await driveToStep4();

  await userEvent.selectOptions(await screen.findByRole('combobox'), 'benefit:benefit-1');

  const certificateInput = await screen.findByLabelText(new RegExp(UZ['wizard.step4.certificateNumber']));
  const nextButton = screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) });
  // The field is required BEFORE the backend ever has a chance to refuse
  // with `ERR-APP-003`/`benefit_certificate_required`.
  expect(nextButton).toBeDisabled();

  await userEvent.type(certificateInput, 'AB-12345');
  // The number alone is not enough: the proof file is the other half.
  expect(nextButton).toBeDisabled();
  await userEvent.upload(fileInput(), new File(['x'], 'proof.pdf', { type: 'application/pdf' }));
  await waitFor(() => expect(nextButton).toBeEnabled());
  await userEvent.click(nextButton);

  await waitFor(() =>
    expect(lastPatchBody).toMatchObject({ benefit_category_item_id: 'benefit-1', benefit_certificate_no: 'AB-12345' }),
  );
});

// Ruling #181: the certificate field appears for ANY chosen category — a
// second item with equally bare `props: {}` is enough to show it is not
// reading the flag at all any more.
test('the certificate field is shown for a SECOND category with no special props either', async () => {
  server.use(classifierHandler([{ ...BENEFIT_ITEM, id: 'benefit-2', code: 'other', name: { uz_latn: 'Boshqa imtiyoz' } }], [PROOF_DOC_TYPE]));
  renderWizard();
  await driveToStep4();

  await userEvent.selectOptions(await screen.findByRole('combobox'), 'benefit:benefit-2');

  expect(await screen.findByLabelText(new RegExp(UZ['wizard.step4.certificateNumber']))).toBeInTheDocument();
  expect(screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) })).toBeDisabled();
});

// Choosing "no benefit" (clearing the selection) is the one way to make the
// certificate optional again — not a per-item classifier flag.
test('clearing the benefit selection hides the certificate field again and sends null', async () => {
  server.use(classifierHandler([BENEFIT_ITEM], [PROOF_DOC_TYPE]));
  let lastPatchBody: unknown = null;
  server.use(
    http.patch('*/api/v1/applications/:id', async ({ request }) => {
      lastPatchBody = await request.json();
      return HttpResponse.json({ id: APPLICATION_ID });
    }),
  );
  renderWizard();
  await driveToStep4();

  await userEvent.selectOptions(await screen.findByRole('combobox'), 'benefit:benefit-1');
  expect(await screen.findByLabelText(new RegExp(UZ['wizard.step4.certificateNumber']))).toBeInTheDocument();

  await userEvent.selectOptions(await screen.findByRole('combobox'), '');
  expect(screen.queryByLabelText(new RegExp(UZ['wizard.step4.certificateNumber']))).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) }));

  await waitFor(() => expect(lastPatchBody).toMatchObject({ benefit_category_item_id: null, benefit_certificate_no: null }));
});

// Every upload is its own row: the row dissolves into the card's list once
// its file is on the server, and "add document" opens the next one. A row
// with a type chosen and no file holds Next — moving on would drop it
// without a word.
test('a second document is added as a new row; a half-filled row holds Next until its file lands', async () => {
  server.use(classifierHandler([], [OTHER_DOC_TYPE]), ...documentsStore());
  renderWizard();
  await driveToStep4();

  await userEvent.selectOptions(await screen.findByRole('combobox'), 'doctype-other');
  const nextButton = screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) });
  expect(await screen.findByText(UZ['wizard.step4.pendingRowHint'])).toBeInTheDocument();
  expect(nextButton).toBeDisabled();

  await userEvent.upload(fileInput(), new File(['x'], 'a.pdf', { type: 'application/pdf' }));
  await waitFor(() => expect(screen.getAllByText('Pasport')).toHaveLength(1));
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  await waitFor(() => expect(nextButton).toBeEnabled());

  await userEvent.click(screen.getByRole('button', { name: new RegExp(UZ['wizard.step4.addDoc']) }));
  await userEvent.selectOptions(await screen.findByRole('combobox'), 'doctype-other');
  await userEvent.upload(fileInput(), new File(['y'], 'b.pdf', { type: 'application/pdf' }));
  await waitFor(() => expect(screen.getAllByText('Pasport')).toHaveLength(2));
});

test('choosing an activity takes two clicks: the first selects, the second moves on', async () => {
  renderWizard();
  await screen.findByText('Pichanchilik');

  // First click: chosen, and still on step 1 — the applicant gets a moment to
  // see WHAT was chosen before the screen changes under them.
  await userEvent.click(screen.getByText('Pichanchilik'));
  await waitFor(() => expect(screen.getByText('Pichanchilik')).toBeInTheDocument());
  expect(screen.queryByText('pick-contour')).not.toBeInTheDocument();

  // Second click on the SAME card: now it advances.
  await userEvent.click(screen.getByText('Pichanchilik'));
  expect(await screen.findByText('pick-contour')).toBeInTheDocument();
});

test('clicking a different activity re-selects instead of advancing', async () => {
  server.use(
    http.get('*/api/v1/refs/activity-types', () =>
      HttpResponse.json([
        { id: ACTIVITY_ID, code: 'haymaking', name: { uz_latn: 'Pichanchilik' }, quantity_unit: 'ga' },
        { id: OTHER_ACTIVITY_ID, code: 'apiary', name: { uz_latn: 'Asalarichilik' }, quantity_unit: 'hive' },
      ]),
    ),
  );
  renderWizard();
  await screen.findByText('Pichanchilik');

  await userEvent.click(screen.getByText('Pichanchilik'));
  // Correcting a misclick must NOT carry the applicant forward on the wrong
  // activity — which is the very thing the second click exists to prevent.
  await userEvent.click(screen.getByText('Asalarichilik'));
  expect(screen.queryByText('pick-contour')).not.toBeInTheDocument();

  await userEvent.click(screen.getByText('Asalarichilik'));
  expect(await screen.findByText('pick-contour')).toBeInTheDocument();
});

// ─── Stage 10, F1 (rulings #181, #183, #184) ──────────────────────────────
// The rules checkbox, the self/legal branch at signing, the new submit
// refusals, and the benefit block's certificate/document requirement for
// EVERY category.

test('the rules checkbox gates the sign button and links to rules_url', async () => {
  renderWizard();
  await driveToStep5();

  const signButton = await screen.findByRole('button', { name: new RegExp(UZ['wizard.step5.signApplication']) });
  expect(signButton).toBeDisabled();

  const link = await screen.findByRole('link', { name: UZ['wizard.step5.rulesLinkText'] });
  expect(link).toHaveAttribute('href', 'https://lex.uz/docs/2770948');

  await acceptRules();
  await waitFor(() => expect(signButton).toBeEnabled());
});

test('a simple-signature refusal (ERR-SIGN-001, simple_signature_not_allowed) is shown at the sign button', async () => {
  server.use(
    http.post('*/api/v1/applications/:id/submit', () =>
      HttpResponse.json(
        { error: { code: 'ERR-SIGN-001', message: 'x', details: { reason: 'simple_signature_not_allowed' } } },
        { status: 422 },
      ),
    ),
  );
  renderWizard();

  await driveToSubmitFailure();

  expect(
    await screen.findByText(
      "Kalitsiz oddiy imzo faqat o'zi uchun ariza topshirayotgan fuqaroga ruxsat etilgan — bu ariza uchun elektron raqamli imzo (ERI) kerak.",
    ),
  ).toBeInTheDocument();
});

// Ruling #181: a benefit-certificate refusal the client could not have
// caught itself (the number LOOKS filled in, but the register disagrees) is
// shown AT THE FIELD, not only as a step-5 banner — the wizard sends the
// applicant back to step 4 for it.
test('a benefit-certificate refusal (ERR-APP-003, benefit_certificate_unknown) sends the applicant back to step 4 and shows it at the field', async () => {
  server.use(
    classifierHandler([BENEFIT_ITEM], [PROOF_DOC_TYPE]),
    // The proof is already on the card: step 4's gate is fail-closed (review
    // finding 3), so reaching the sign button needs a real `benefit_proof`
    // row, not an unloaded doc-type list.
    http.get('*/api/v1/applications/:id', () =>
      HttpResponse.json({
        id: APPLICATION_ID,
        documents: [{ id: 'doc-1', doc_type_item_id: 'doctype-proof', file_id: 'file-1' }],
        items: [],
      }),
    ),
    http.post('*/api/v1/applications/:id/submit', () =>
      HttpResponse.json(
        { error: { code: 'ERR-APP-003', message: 'x', details: { reason: 'benefit_certificate_unknown' } } },
        { status: 422 },
      ),
    ),
  );
  renderWizard();
  await driveToStep4();

  await userEvent.selectOptions(await screen.findByRole('combobox'), 'benefit:benefit-1');
  await userEvent.type(await screen.findByLabelText(new RegExp(UZ['wizard.step4.certificateNumber'])), 'AB-99999');
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(UZ['wizard.nav.next']) })); // step4 -> step5

  await acceptRules();
  const signButton = await screen.findByRole('button', { name: new RegExp(UZ['wizard.step5.signApplication']) });
  await waitFor(() => expect(signButton).toBeEnabled());
  await userEvent.click(signButton);

  expect(await screen.findByText(UZ['wizard.step4.heading'])).toBeInTheDocument();
  expect(await screen.findByText("Bunday guvohnoma/ma'lumotnoma raqami reyestrda topilmadi.")).toBeInTheDocument();
});

// Ruling #181: the supporting document is required exactly like the
// certificate number — the benefit row's own file button files it under
// `benefit_proof`, and the gate clears the moment it lands.
test('the benefit_proof document is required before step 4\'s Next once a category is chosen', async () => {
  let uploadedType: string | null = null;
  let documents: { id: string; doc_type_item_id: string; file_id: string }[] = [];
  server.use(
    classifierHandler([BENEFIT_ITEM], [PROOF_DOC_TYPE, OTHER_DOC_TYPE]),
    http.get('*/api/v1/applications/:id', () => HttpResponse.json({ id: APPLICATION_ID, documents, items: [] })),
    http.post('*/api/v1/applications/:id/documents', async ({ request }) => {
      const body = (await request.json()) as { doc_type_item_id: string; file_id: string };
      uploadedType = body.doc_type_item_id;
      const doc = { id: 'doc-1', doc_type_item_id: body.doc_type_item_id, file_id: body.file_id };
      documents = [...documents, doc];
      return HttpResponse.json(doc);
    }),
    http.post('*/api/v1/files', () => HttpResponse.json({ id: 'file-1' })),
  );
  renderWizard();
  await driveToStep4();

  await userEvent.selectOptions(await screen.findByRole('combobox'), 'benefit:benefit-1');
  await userEvent.type(await screen.findByLabelText(new RegExp(UZ['wizard.step4.certificateNumber'])), 'AB-1');

  const nextButton = screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) });
  expect(await screen.findByText(UZ['wizard.step4.benefitProofRequired'])).toBeInTheDocument();
  expect(nextButton).toBeDisabled();

  // The benefit row's own button — no doc type to pick: the category IS the type.
  await userEvent.upload(fileInput(), new File(['x'], 'proof.pdf', { type: 'application/pdf' }));

  await waitFor(() => expect(screen.getByText(UZ['wizard.step4.benefitProofOk'])).toBeInTheDocument());
  expect(uploadedType).toBe('doctype-proof');
  await waitFor(() => expect(nextButton).toBeEnabled());
});

// Stage 10 review, finding 3: the gate used to OPEN when the doc-type list
// did not carry `benefit_proof` (not loaded, or not configured) — step 4
// printed the green "attached" sentence over an empty list and the citizen
// met the refusal only at the sign button. Fail-closed now, like the backend.
test('an unknown benefit_proof doc type keeps step 4 shut instead of waving the claim through', async () => {
  server.use(
    // `doc_types` answers without `benefit_proof`.
    classifierHandler([BENEFIT_ITEM], [OTHER_DOC_TYPE]),
    http.get('*/api/v1/applications/:id', () =>
      HttpResponse.json({ id: APPLICATION_ID, documents: [{ id: 'doc-1', doc_type_item_id: 'some-other-type', file_id: 'file-1' }], items: [] }),
    ),
  );
  renderWizard();
  await driveToStep4();

  await userEvent.selectOptions(await screen.findByRole('combobox'), 'benefit:benefit-1');
  await userEvent.type(await screen.findByLabelText(new RegExp(UZ['wizard.step4.certificateNumber'])), 'AB-1');

  const nextButton = screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) });
  expect(await screen.findByText(UZ['wizard.step4.benefitProofRequired'])).toBeInTheDocument();
  expect(screen.queryByText(UZ['wizard.step4.benefitProofOk'])).not.toBeInTheDocument();
  expect(nextButton).toBeDisabled();
});

// A resumed draft must restore WHO it is filed for — the last step's
// self/legal branch reads local `onBehalf` state, which defaults to 'self'
// unless the hydration explicitly restores it from the card.
test('resuming a legal draft restores the representation, not the self default', async () => {
  server.use(
    http.get('*/api/v1/applications/:id', () =>
      HttpResponse.json({
        id: APPLICATION_ID,
        on_behalf: 'legal',
        applicant_id: LEGAL_ENTITY_ID,
        activity_type_id: ACTIVITY_ID,
        contour_id: 'contour-1',
        requested_area_ha: '12',
        period_from: '2026-01-01',
        period_to: '2026-06-01',
        quantity: '5',
        documents: [],
        items: [],
      }),
    ),
  );
  renderWizard(authValueLegal(), 'uz_latn', `/my/applications/new?draft=${APPLICATION_ID}`);

  // Resuming never auto-advances the step — still step 1, but the on-behalf
  // dropdown is never touched in this test, only restored from the card.
  await screen.findByText('Pichanchilik');
  const next = () => screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) });
  await waitFor(() => expect(next()).toBeEnabled());
  await userEvent.click(next());

  await screen.findByText(UZ['wizard.step2.heading']);
  await waitFor(() => expect(next()).toBeEnabled());
  await userEvent.click(next());

  await screen.findByText(UZ['wizard.step3.heading']);
  await waitFor(() => expect(next()).toBeEnabled());
  await userEvent.click(next());

  await screen.findByText(UZ['wizard.step4.heading']);
  await userEvent.click(next());

  await acceptRules();
  // The LEGAL branch's own button — proof `onBehalf` came from the card,
  // not the 'self' default.
  expect(await screen.findByRole('button', { name: /ERI bilan imzolash va yuborish/ })).toBeInTheDocument();
});
