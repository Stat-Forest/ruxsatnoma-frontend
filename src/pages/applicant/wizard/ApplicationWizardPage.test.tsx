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
// A stand-in for the base64 `package` field of `FilingPackageOut` — its
// content never matters to these tests, only that it decodes.
const PACKAGE_B64 = btoa('package-bytes');

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
      pinfl: null,
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

// Plan 12: `POST /applications/precheck` and `POST /applications/package`
// replace the old per-id routes; `POST /applications` is the ONE request
// that files (self, directly, or legal, with `application_id` + `pkcs7`
// from the package). Nothing here holds a server-side draft any more.
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
  http.post('*/api/v1/applications/precheck', () => HttpResponse.json({ checks: [], calculation: null })),
  http.post('*/api/v1/applications/package', () =>
    HttpResponse.json({ application_id: APPLICATION_ID, package: PACKAGE_B64 }),
  ),
  http.post('*/api/v1/applications', () => HttpResponse.json({ id: APPLICATION_ID })),
  http.post('*/api/v1/files', () => HttpResponse.json({ id: 'file-1' })),
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
// filing's redirect — so a proceeded navigation has somewhere to land
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
      http.post('*/api/v1/applications', () =>
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
//
// Plan 12, R2: a legal filing first calls `POST /applications/package` (the
// default handler above mints `APPLICATION_ID` and a base64 `package`), then
// signs those bytes, then posts `POST /applications` with `application_id` +
// `pkcs7` alongside the filing — never a per-id route.
test('signing and submitting passes the signed-in applicant’s own name into the mock signature', async () => {
  const auth = authValueLegal();
  renderWizard(auth);
  await selectLegalEntity();

  await driveToStep5();
  await acceptRules();

  // Step 5 — precheck resolves, then package + sign + file.
  const signButton = await screen.findByRole('button', { name: /ERI bilan imzolash va yuborish/ });
  await waitFor(() => expect(signButton).toBeEnabled());
  await userEvent.click(signButton);

  await waitFor(() =>
    expect(buildMockSignature).toHaveBeenCalledWith(expect.objectContaining({ fullName: APPLICANT_NAME })),
  );
});

// Finding 2 (review of stage 5.2): this call site was still hardwired to
// the mock builder, bypassing the mock/real switch entirely — under real
// mode, filing an application would have signed with a builder the real
// backend cannot verify.
test('real mode: sign calls signDocument over the exact package bytes (DETACHED)', async () => {
  vi.spyOn(eimzo, 'isEimzoMock').mockReturnValue(false);
  const signDocumentSpy = vi.spyOn(eimzo, 'signDocument').mockResolvedValue('REAL-PKCS7');
  let sentBody: { pkcs7?: string; rules_accepted?: boolean; application_id?: string } = {};
  server.use(
    http.post('*/api/v1/applications', async ({ request }) => {
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

  // A legal filing carries the envelope, the id the package minted, AND the
  // mandatory acceptance (ruling #184) in the same body.
  await waitFor(() => expect(sentBody.pkcs7).toBe('REAL-PKCS7'));
  expect(sentBody.rules_accepted).toBe(true);
  expect(sentBody.application_id).toBe(APPLICATION_ID);
  expect(signDocumentSpy).toHaveBeenCalledTimes(1);
});

test('a real-mode signing failure shows a distinct message and never reaches the filing request', async () => {
  vi.spyOn(eimzo, 'isEimzoMock').mockReturnValue(false);
  vi.spyOn(eimzo, 'signDocument').mockRejectedValue(new eimzo.EimzoPasswordError());
  let called = false;
  server.use(
    http.post('*/api/v1/applications', () => {
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
// envelope at all, never calls `POST /applications/package`, and never
// touches the mock/real ERI machinery above.
test('a self filing (the default fixture) signs with a plain button: no pkcs7, rules_accepted true, no package call', async () => {
  let sentBody: { pkcs7?: string | null; rules_accepted?: boolean; application_id?: string | null } = {};
  let packageCalled = false;
  server.use(
    http.post('*/api/v1/applications', async ({ request }) => {
      sentBody = (await request.json()) as typeof sentBody;
      return HttpResponse.json({ id: APPLICATION_ID });
    }),
    http.post('*/api/v1/applications/package', () => {
      packageCalled = true;
      return HttpResponse.json({ application_id: APPLICATION_ID, package: PACKAGE_B64 });
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
  expect(sentBody.application_id).toBeUndefined();
  expect(packageCalled).toBe(false);
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
    http.post('*/api/v1/applications', async ({ request }) => {
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

// Plan 12, R10: steps 1-4 write NOTHING — this is the direct test of that
// contract, over the exact path (haymaking, quantity, no documents) the
// other T1 tests already drive.
test('walking steps 1 through 4 issues no request to /applications*', async () => {
  const seenUrls: string[] = [];
  server.use(
    http.post('*/api/v1/applications', ({ request }) => {
      seenUrls.push(request.url);
      return HttpResponse.json({ id: APPLICATION_ID });
    }),
    http.post('*/api/v1/applications/precheck', ({ request }) => {
      seenUrls.push(request.url);
      return HttpResponse.json({ checks: [], calculation: null });
    }),
    http.post('*/api/v1/applications/package', ({ request }) => {
      seenUrls.push(request.url);
      return HttpResponse.json({ application_id: APPLICATION_ID, package: PACKAGE_B64 });
    }),
  );
  renderWizard();

  await chooseActivity();
  await userEvent.click(await screen.findByText('pick-contour'));
  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step2.periodFrom'])), { target: { value: '2026-01-01' } });
  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step2.periodTo'])), { target: { value: '2026-06-01' } });
  await userEvent.click(screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) }));

  await userEvent.type(await screen.findByLabelText(new RegExp(UZ['wizard.step3.quantity'])), '5');
  await userEvent.click(screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) }));

  await screen.findByText(UZ['wizard.step4.heading']);
  expect(seenUrls).toEqual([]);
});

// Plan 12, R3/R10: the whole filing — assembled from every step so far —
// is what the pre-check receives, over the ONE stateless route.
test('reaching step 5 posts the filing assembled from steps 1-4 to /applications/precheck', async () => {
  let precheckBody: unknown = null;
  server.use(
    http.post('*/api/v1/applications/precheck', async ({ request }) => {
      precheckBody = await request.json();
      return HttpResponse.json({ checks: [], calculation: null });
    }),
  );
  renderWizard();

  await driveToStep5();

  await waitFor(() =>
    expect(precheckBody).toMatchObject({
      on_behalf: 'self',
      activity_type_id: ACTIVITY_ID,
      contour_id: 'contour-1',
      period_from: '2026-01-01',
      period_to: '2026-06-01',
      quantity: '5',
      items: [],
      benefit_category_item_id: null,
      benefit_certificate_no: null,
      documents: [],
    }),
  );
});

// Plan 12, R10: `?draft=` is not read at all — nothing about a former
// resume flow survives, so no request for an existing application is ever
// made from this page.
test('a ?draft= id in the URL is ignored: no request for an existing application is made', async () => {
  let cardRequested = false;
  server.use(
    http.get('*/api/v1/applications/:id', () => {
      cardRequested = true;
      return HttpResponse.json({ id: APPLICATION_ID, documents: [], items: [] });
    }),
  );
  renderWizard(AUTH_VALUE, 'uz_latn', `/my/applications/new?draft=${APPLICATION_ID}`);

  await screen.findByText('Pichanchilik');
  expect(cardRequested).toBe(false);
});

test('a reversed period is named in the field and blocks Next before any request leaves the browser', async () => {
  const seenUrls: string[] = [];
  server.use(
    http.post('*/api/v1/applications', ({ request }) => {
      seenUrls.push(request.url);
      return HttpResponse.json({ id: APPLICATION_ID });
    }),
    http.post('*/api/v1/applications/precheck', ({ request }) => {
      seenUrls.push(request.url);
      return HttpResponse.json({ checks: [], calculation: null });
    }),
    http.post('*/api/v1/applications/package', ({ request }) => {
      seenUrls.push(request.url);
      return HttpResponse.json({ application_id: APPLICATION_ID, package: PACKAGE_B64 });
    }),
  );
  renderWizard();

  await chooseActivity();
  await userEvent.click(await screen.findByText('pick-contour'));

  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step2.periodFrom'])), { target: { value: '2026-06-01' } });
  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step2.periodTo'])), { target: { value: '2026-01-01' } });

  expect(await screen.findByText(/Tugash sanasi boshlanish sanasidan oldin/)).toBeInTheDocument();
  const nextButton = screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) });
  expect(nextButton).toBeDisabled();

  await userEvent.click(nextButton);
  expect(seenUrls).toEqual([]);
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

// Plan 12, R10: nothing is saved before «Yuborish», so leaving mid-way
// genuinely loses everything entered — the modal says so.
test('leaving mid-way via in-app navigation asks first, and everything entered is kept if cancelled', async () => {
  const { router } = renderWizard();
  await chooseActivity(); // progress exists after the first click; the second moves on
  await screen.findByText('pick-contour');

  await userEvent.click(screen.getByRole('button', { name: new RegExp(UZ['wizard.backToList']) }));

  expect(await screen.findByText(/Ariza yuborilmadi/)).toBeInTheDocument();
  expect(screen.getByText(/Ariza saqlanmaydi/)).toBeInTheDocument();
  // Blocked, not navigated yet.
  expect(router.state.location.pathname).toBe('/my/applications/new');

  await userEvent.click(screen.getByRole('button', { name: 'Davom etish' }));
  expect(screen.queryByText(/Ariza yuborilmadi/)).not.toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/my/applications/new');
  // Still on the wizard, the contour picker included — nothing was reset.
  expect(screen.getByText('pick-contour')).toBeInTheDocument();
});

test('leaving mid-way via in-app navigation proceeds once confirmed', async () => {
  const { router } = renderWizard();
  await chooseActivity();
  await screen.findByText('pick-contour');

  await userEvent.click(screen.getByRole('button', { name: new RegExp(UZ['wizard.backToList']) }));
  await userEvent.click(await screen.findByRole('button', { name: 'Chiqish' }));

  await waitFor(() => expect(router.state.location.pathname).toBe('/my/applications'));
});

test('no leave-confirmation is asked before any progress exists (step 1, nothing chosen yet)', async () => {
  const { router } = renderWizard();
  await screen.findByText('Pichanchilik'); // step 1, no activity picked yet

  await userEvent.click(screen.getByRole('button', { name: new RegExp(UZ['wizard.backToList']) }));

  // Nothing to lose yet — navigates straight through, no modal.
  await waitFor(() => expect(router.state.location.pathname).toBe('/my/applications'));
});

test('a successful filing navigates straight through, without asking to leave', async () => {
  const { router } = renderWizard();
  await driveToStep5();
  await acceptRules();

  const signButton = await screen.findByRole('button', { name: new RegExp(UZ['wizard.step5.signApplication']) });
  await waitFor(() => expect(signButton).toBeEnabled());
  await userEvent.click(signButton);

  await waitFor(() => expect(router.state.location.pathname).toBe(`/my/applications/${APPLICATION_ID}`));
  expect(screen.queryByText(/Ariza yuborilmadi/)).not.toBeInTheDocument();
});

test('beforeunload is prevented once progress exists, and not before', async () => {
  renderWizard();
  await screen.findByText('Pichanchilik');

  // Step 1, nothing chosen yet — no progress, nothing to warn about.
  const before = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(before);
  expect(before.defaultPrevented).toBe(false);

  await chooseActivity();
  await screen.findByText('pick-contour'); // progress now exists

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
// Every uploaded file gets its own id, in order, so a test asserting on
// which document a row's file landed under can tell them apart.
function filesHandler() {
  let n = 0;
  return http.post('*/api/v1/files', () => {
    n += 1;
    return HttpResponse.json({ id: `file-${n}` });
  });
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
// still required regardless. Plan 12: the claim rides in the PRE-CHECK body
// (there is no more PATCH to carry it).
test('the benefit certificate number is required before Next for ANY chosen category (no per-item switch), and reaches the pre-check', async () => {
  server.use(classifierHandler([BENEFIT_ITEM], [PROOF_DOC_TYPE]));
  let precheckBody: unknown = null;
  server.use(
    http.post('*/api/v1/applications/precheck', async ({ request }) => {
      precheckBody = await request.json();
      return HttpResponse.json({ checks: [], calculation: null });
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
  // The number alone is enough (#189: the scan is optional).
  await waitFor(() => expect(nextButton).toBeEnabled());
  await userEvent.click(nextButton);

  await waitFor(() =>
    expect(precheckBody).toMatchObject({ benefit_category_item_id: 'benefit-1', benefit_certificate_no: 'AB-12345' }),
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
test('clearing the benefit selection hides the certificate field again and sends null in the pre-check', async () => {
  server.use(classifierHandler([BENEFIT_ITEM], [PROOF_DOC_TYPE]));
  let precheckBody: unknown = null;
  server.use(
    http.post('*/api/v1/applications/precheck', async ({ request }) => {
      precheckBody = await request.json();
      return HttpResponse.json({ checks: [], calculation: null });
    }),
  );
  renderWizard();
  await driveToStep4();

  await userEvent.selectOptions(await screen.findByRole('combobox'), 'benefit:benefit-1');
  expect(await screen.findByLabelText(new RegExp(UZ['wizard.step4.certificateNumber']))).toBeInTheDocument();

  await userEvent.selectOptions(await screen.findByRole('combobox'), '');
  expect(screen.queryByLabelText(new RegExp(UZ['wizard.step4.certificateNumber']))).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) }));

  await waitFor(() => expect(precheckBody).toMatchObject({ benefit_category_item_id: null, benefit_certificate_no: null }));
});

// Every upload is its own row: the row dissolves into the local documents
// list the moment its file lands on the server, and "add document" opens
// the next one. A row with a type chosen and no file holds Next — moving on
// would drop it without a word. Plan 12, R9: `POST /files` is the only
// server call an upload makes now — the association with the (not yet
// filed) application lives only in this component's own state.
test('a second document is added as a new row; a half-filled row holds Next until its file lands', async () => {
  server.use(classifierHandler([], [OTHER_DOC_TYPE]), filesHandler());
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
    http.post('*/api/v1/applications', () =>
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

// Ruling #181: a benefit-certificate refusal from the backend (the client's
// own check passed, e.g. a number of whitespace only) is shown AT THE FIELD,
// not only as a step-5 banner — the wizard sends the applicant back to step
// 4 for it. Ruling #206 left `benefit_certificate_required` as the one such
// reason.
test('a benefit-certificate refusal (ERR-APP-003, benefit_certificate_required) sends the applicant back to step 4 and shows it at the field', async () => {
  server.use(
    classifierHandler([BENEFIT_ITEM], [PROOF_DOC_TYPE]),
    http.post('*/api/v1/applications', () =>
      HttpResponse.json(
        { error: { code: 'ERR-APP-003', message: 'x', details: { reason: 'benefit_certificate_required' } } },
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
  expect(
    await screen.findByText("Tanlangan imtiyoz toifasi uchun guvohnoma/ma'lumotnoma raqami ko'rsatilmagan."),
  ).toBeInTheDocument();
});

// Ruling #189: the certificate's scan is OPTIONAL — Next is open on the
// number alone, and the benefit row's own file button, when used, files the
// scan under `benefit_proof` (no doc type to pick: the category IS the type).
test('the benefit_proof scan is optional: Next opens on the number alone, and the file, when attached, is filed under benefit_proof', async () => {
  let uploadedType: string | null = null;
  server.use(
    classifierHandler([BENEFIT_ITEM], [PROOF_DOC_TYPE, OTHER_DOC_TYPE]),
    http.post('*/api/v1/files', async ({ request }) => {
      const body = await request.formData();
      const file = body.get('file') as File;
      uploadedType = file ? 'uploaded' : null;
      return HttpResponse.json({ id: 'file-1' });
    }),
  );
  renderWizard();
  await driveToStep4();

  await userEvent.selectOptions(await screen.findByRole('combobox'), 'benefit:benefit-1');
  await userEvent.type(await screen.findByLabelText(new RegExp(UZ['wizard.step4.certificateNumber'])), 'AB-1');

  const nextButton = screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) });
  expect(await screen.findByText(UZ['wizard.step4.benefitProofOptional'])).toBeInTheDocument();
  await waitFor(() => expect(nextButton).toBeEnabled());

  await userEvent.upload(fileInput(), new File(['x'], 'proof.pdf', { type: 'application/pdf' }));

  await waitFor(() => expect(screen.getByText(UZ['wizard.step4.benefitProofOk'])).toBeInTheDocument());
  expect(uploadedType).toBe('uploaded');
  expect(screen.queryByText(UZ['wizard.step4.benefitProofOptional'])).not.toBeInTheDocument();
  expect(nextButton).toBeEnabled();
});

// Without a `benefit_proof` doc type (list not loaded, or the item archived)
// the benefit row has nothing to file a scan under, so it offers no file
// button — and, the scan being optional (#189), the claim still moves on.
test('an unknown benefit_proof doc type hides the file button and does not hold the claim', async () => {
  // `doc_types` answers without `benefit_proof`.
  server.use(classifierHandler([BENEFIT_ITEM], [OTHER_DOC_TYPE]));
  renderWizard();
  await driveToStep4();

  await userEvent.selectOptions(await screen.findByRole('combobox'), 'benefit:benefit-1');
  await userEvent.type(await screen.findByLabelText(new RegExp(UZ['wizard.step4.certificateNumber'])), 'AB-1');

  const nextButton = screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) });
  expect(await screen.findByText(UZ['wizard.step4.benefitProofOptional'])).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: new RegExp(UZ['wizard.step4.chooseFile']) })).not.toBeInTheDocument();
  expect(screen.queryByText(UZ['wizard.step4.benefitProofOk'])).not.toBeInTheDocument();
  await waitFor(() => expect(nextButton).toBeEnabled());
});

// ─── The benefit list is scoped to the activity (ruling #181) ─────────────
// Every `benefit_categories` item names the ONE activity it applies to in
// `props.activity` (`apiary` for the Union member, `recreation` for the six
// VMQ 278 ¶12 categories); `norms._check_benefit_claim` refuses a category
// claimed on any other activity as `ERR-VAL-001`/`unknown_benefit_code`,
// which the pre-check on step 5 used to surface as a bare "check failed"
// with nothing to point at. Met on the dev stand: a haymaking draft with
// `persons_with_disabilities` claimed. Step 4 therefore offers only the
// categories of the chosen activity.
const RECREATION_ONLY_ITEM = {
  ...BENEFIT_ITEM,
  id: 'benefit-recreation',
  code: 'persons_with_disabilities',
  name: { uz_latn: 'Nogironligi bor shaxslar' },
  props: { activity: 'recreation' },
};
const HAYMAKING_ITEM = {
  ...BENEFIT_ITEM,
  id: 'benefit-haymaking',
  code: 'haymaking_only',
  name: { uz_latn: 'Pichanchilik imtiyozi' },
  props: { activity: 'haymaking' },
};

test("step 4 offers only the benefit categories whose props.activity is the chosen activity's code; an unscoped item is offered everywhere", async () => {
  server.use(classifierHandler([RECREATION_ONLY_ITEM, HAYMAKING_ITEM, BENEFIT_ITEM], [OTHER_DOC_TYPE]));
  renderWizard();
  await driveToStep4();

  const select = await screen.findByRole('combobox');
  const labels = Array.from((select as HTMLSelectElement).options).map((o) => o.textContent);
  expect(labels).toEqual([
    UZ['wizard.step4.selectDocType'],
    'Pasport',
    `— ${UZ['wizard.step4.benefitsGroup']} —`,
    'Pichanchilik imtiyozi',
    'Urush faxriysi',
  ]);
});

// The safety net for whatever the filter cannot see (a category re-scoped
// after the list was loaded): the refusal names the benefit and points at
// step 4, rather than the generic "check failed".
test('a pre-check refused with unknown_benefit_code says the benefit does not apply to this activity', async () => {
  server.use(
    http.post('*/api/v1/applications/precheck', () =>
      HttpResponse.json(
        { error: { code: 'ERR-VAL-001', message: 'x', details: { reason: 'unknown_benefit_code', code: 'persons_with_disabilities' } } },
        { status: 400 },
      ),
    ),
  );
  renderWizard();
  await driveToStep5();

  expect(await screen.findByText(UZ['wizard.step5.benefitNotForActivity'])).toBeInTheDocument();
});
