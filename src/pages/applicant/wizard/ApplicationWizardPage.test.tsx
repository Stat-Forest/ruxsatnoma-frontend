import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
      { path: '/profile', element: <div>profile-page</div> },
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

test('the address field caps input at the backend bound (ApplicantAddressIn, 500)', async () => {
  const auth = authValueWithAddress(null);
  renderWizard(auth);

  await driveToStep5();
  await acceptRules();

  const addressInput = await screen.findByLabelText(/Manzil/);
  expect(addressInput).toHaveAttribute('maxLength', '500');
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

// Oybek, 2026-09-13: a successful filing no longer jumps to the card at
// once — it first tells the citizen which phone the status SMS will go to
// (`me.user.phone`, the same field the profile's contacts section edits and
// the one `get_notification_contact` reads on the backend), with a way to
// the profile if that number is stale. Every way OUT of that dialog is a
// navigation the leave-guard must let through: the filing is already in
// the database, there is nothing left to lose.
function authValueWithPhone(phone: string | null): AuthContextValue {
  const base = authValue('uz');
  return { ...base, me: { ...base.me!, user: { ...base.me!.user, phone } } };
}

async function fileSuccessfully() {
  await driveToStep5();
  await acceptRules();
  const signButton = await screen.findByRole('button', { name: new RegExp(UZ['wizard.step5.signApplication']) });
  await waitFor(() => expect(signButton).toBeEnabled());
  await userEvent.click(signButton);
  return screen.findByRole('dialog');
}

test('a successful filing names the phone the status messages go to, and stays put until the citizen chooses', async () => {
  const { router } = renderWizard(authValueWithPhone('+998 90 123 45 67'));
  const dialog = await fileSuccessfully();

  expect(within(dialog).getByText(UZ['wizard.filed.title'])).toBeInTheDocument();
  expect(within(dialog).getByText('+998 90 123 45 67')).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/my/applications/new');
  expect(screen.queryByText(/Ariza yuborilmadi/)).not.toBeInTheDocument();
});

test('«Arizaga oʻtish» opens the card without asking to leave', async () => {
  const { router } = renderWizard(authValueWithPhone('+998 90 123 45 67'));
  const dialog = await fileSuccessfully();

  await userEvent.click(within(dialog).getByRole('button', { name: UZ['wizard.filed.openCard'] }));

  await waitFor(() => expect(router.state.location.pathname).toBe(`/my/applications/${APPLICATION_ID}`));
  expect(screen.queryByText(/Ariza yuborilmadi/)).not.toBeInTheDocument();
});

test('«Telefonni oʻzgartirish» opens the profile without asking to leave', async () => {
  const { router } = renderWizard(authValueWithPhone('+998 90 123 45 67'));
  const dialog = await fileSuccessfully();

  await userEvent.click(within(dialog).getByRole('button', { name: UZ['wizard.filed.changePhone'] }));

  await waitFor(() => expect(router.state.location.pathname).toBe('/profile'));
  expect(screen.queryByText(/Ariza yuborilmadi/)).not.toBeInTheDocument();
});

test('dismissing the filed dialog any other way (Esc, the cross, the backdrop) opens the card', async () => {
  const { router } = renderWizard(authValueWithPhone('+998 90 123 45 67'));
  await fileSuccessfully();

  await userEvent.keyboard('{Escape}');

  await waitFor(() => expect(router.state.location.pathname).toBe(`/my/applications/${APPLICATION_ID}`));
  expect(screen.queryByText(/Ariza yuborilmadi/)).not.toBeInTheDocument();
});

test('an account with no phone on file is told to add one in the profile instead', async () => {
  renderWizard(authValueWithPhone(null));
  const dialog = await fileSuccessfully();

  expect(within(dialog).getByText(UZ['wizard.filed.noPhone'])).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: UZ['wizard.filed.changePhone'] })).toBeInTheDocument();
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
// Decision #220: a claimed benefit needs its scan before step 4's Next opens
// — through the benefit row's own file button, the only file input on the
// step while no other row has a type chosen.
async function attachProof() {
  await userEvent.upload(fileInput(), new File(['x'], 'proof.pdf', { type: 'application/pdf' }));
  await screen.findByText(UZ['wizard.step4.benefitProofOk']);
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
  // The number alone is NOT enough (#220: the scan is mandatory too).
  expect(nextButton).toBeDisabled();
  await attachProof();
  await waitFor(() => expect(nextButton).toBeEnabled());
  await userEvent.click(nextButton);

  await waitFor(() =>
    expect(precheckBody).toMatchObject({
      benefit_category_item_id: 'benefit-1',
      benefit_certificate_no: 'AB-12345',
      documents: [{ doc_type_item_id: 'doctype-proof', file_id: 'file-1' }],
    }),
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

// Ruling #219: the Beekeeping Union's register answers on step 4's own
// "Next" — the pre-check runs BEFORE the stepper moves, a number the
// register refuses keeps the applicant on step 4 with the reason at the
// field, and a corrected number goes on to step 5.
test('a number the register refuses on step 4 keeps the applicant there with the reason at the field', async () => {
  const seen: string[] = [];
  server.use(
    classifierHandler([BENEFIT_ITEM], [PROOF_DOC_TYPE]),
    http.post('*/api/v1/applications/precheck', async ({ request }) => {
      const body = (await request.json()) as { benefit_certificate_no?: string };
      seen.push(body.benefit_certificate_no ?? '');
      if (body.benefit_certificate_no === 'AB-00000') {
        return HttpResponse.json(
          { error: { code: 'ERR-APP-003', message: 'x', details: { reason: 'benefit_certificate_unknown' } } },
          { status: 422 },
        );
      }
      return HttpResponse.json({ checks: [], calculation: null });
    }),
  );
  renderWizard();
  await driveToStep4();

  await userEvent.selectOptions(await screen.findByRole('combobox'), 'benefit:benefit-1');
  const certificate = await screen.findByLabelText(new RegExp(UZ['wizard.step4.certificateNumber']));
  await userEvent.type(certificate, 'AB-00000');
  await attachProof();
  await userEvent.click(screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) }));

  expect(await screen.findByText('Bu guvohnoma raqami Asalarichilar uyushmasi reyestrida topilmadi.')).toBeInTheDocument();
  expect(screen.getByText(UZ['wizard.step4.heading'])).toBeInTheDocument();
  expect(screen.queryByText(UZ['wizard.step5.heading'])).not.toBeInTheDocument();

  await userEvent.clear(certificate);
  await userEvent.type(certificate, 'AB-12345');
  expect(screen.queryByText('Bu guvohnoma raqami Asalarichilar uyushmasi reyestrida topilmadi.')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) }));

  expect(await screen.findByText(UZ['wizard.step5.heading'])).toBeInTheDocument();
  expect(seen).toEqual(['AB-00000', 'AB-12345']);
});

// Rulings #181/#219: a refusal of the number at FILING (the register changed
// after step 4's pre-check passed) is shown AT THE FIELD, not only as a
// step-5 banner — the wizard sends the applicant back to step 4 for it.
test('a benefit-certificate refusal at filing (ERR-APP-003, benefit_certificate_expired) sends the applicant back to step 4 and shows it at the field', async () => {
  server.use(
    classifierHandler([BENEFIT_ITEM], [PROOF_DOC_TYPE]),
    http.post('*/api/v1/applications', () =>
      HttpResponse.json(
        { error: { code: 'ERR-APP-003', message: 'x', details: { reason: 'benefit_certificate_expired' } } },
        { status: 422 },
      ),
    ),
  );
  renderWizard();
  await driveToStep4();

  await userEvent.selectOptions(await screen.findByRole('combobox'), 'benefit:benefit-1');
  await userEvent.type(await screen.findByLabelText(new RegExp(UZ['wizard.step4.certificateNumber'])), 'AB-99999');
  await attachProof();
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(UZ['wizard.nav.next']) })); // step4 -> step5

  await acceptRules();
  const signButton = await screen.findByRole('button', { name: new RegExp(UZ['wizard.step5.signApplication']) });
  await waitFor(() => expect(signButton).toBeEnabled());
  await userEvent.click(signButton);

  expect(await screen.findByText(UZ['wizard.step4.heading'])).toBeInTheDocument();
  expect(await screen.findByText('Bu guvohnomaning amal qilish muddati tugagan.')).toBeInTheDocument();
});

// Decision #220 (superseding #189): the certificate's scan is MANDATORY —
// Next stays shut on the number alone, and opens once the benefit row's own
// file button has filed the scan under `benefit_proof` (no doc type to pick:
// the category IS the type).
test('the benefit_proof scan is mandatory: Next stays shut on the number alone and opens once the scan is filed under benefit_proof', async () => {
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
  expect(await screen.findByText(UZ['wizard.step4.benefitProofRequired'])).toBeInTheDocument();
  expect(nextButton).toBeDisabled();

  await attachProof();

  expect(uploadedType).toBe('uploaded');
  expect(screen.queryByText(UZ['wizard.step4.benefitProofRequired'])).not.toBeInTheDocument();
  await waitFor(() => expect(nextButton).toBeEnabled());
});

// Without a `benefit_proof` doc type (list not loaded, or the item archived)
// the benefit row has nothing to file a scan under, so it offers no file
// button — and, the scan being mandatory (#220), the claim cannot move on:
// fail-closed, exactly as the backend refuses it.
test('an unknown benefit_proof doc type hides the file button and holds the claim', async () => {
  // `doc_types` answers without `benefit_proof`.
  server.use(classifierHandler([BENEFIT_ITEM], [OTHER_DOC_TYPE]));
  renderWizard();
  await driveToStep4();

  await userEvent.selectOptions(await screen.findByRole('combobox'), 'benefit:benefit-1');
  await userEvent.type(await screen.findByLabelText(new RegExp(UZ['wizard.step4.certificateNumber'])), 'AB-1');

  expect(await screen.findByText(UZ['wizard.step4.benefitProofRequired'])).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: new RegExp(UZ['wizard.step4.chooseFile']) })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) })).toBeDisabled();
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

// Decision #215 R6: the deadwood and recreation blanks carry lines of their
// own (`deadwood_product`/`removal_deadline`, `recreation_purpose`/`event_at`)
// that the backend requires at pre-check and filing for THOSE two activities
// alone. Step 3 asks them for exactly those activities, holds Next until
// both are filled (mirroring the server's refusal client-side, so the citizen
// never first learns of them from `checks.missing_for_pricing`), and sends
// them in the filing. A haymaking filing never sees them.
const DEADWOOD_NAME = 'Oʻtin yigʻish';
const RECREATION_NAME = 'Rekreatsiya';

function activityHandler(code: string, name: string, unit: string) {
  return http.get('*/api/v1/refs/activity-types', () =>
    HttpResponse.json([{ id: ACTIVITY_ID, code, name: { uz_latn: name }, quantity_unit: unit }]),
  );
}
function precheckRecorder(seen: unknown[]) {
  return http.post('*/api/v1/applications/precheck', async ({ request }) => {
    seen.push(await request.json());
    return HttpResponse.json({ checks: [], calculation: null });
  });
}
// Steps 1–2 (activity, contour + period), ending on step 3.
async function driveToStep3(activityName = 'Pichanchilik') {
  await chooseActivity(activityName);
  await userEvent.click(await screen.findByText('pick-contour'));
  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step2.periodFrom'])), { target: { value: '2026-01-01' } });
  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step2.periodTo'])), { target: { value: '2026-06-01' } });
  await userEvent.click(screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) }));
  await screen.findByLabelText(new RegExp(UZ['wizard.step3.quantity']));
}
function nextButton() {
  return screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) });
}
// The pre-check fires on leaving step 4 (`goNext`), so reaching it from
// step 3 takes two Nexts — the same two `driveToStep5` already presses.
async function nextTwiceToPrecheck() {
  await userEvent.click(nextButton());
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(UZ['wizard.nav.next']) }));
}

test('asks a deadwood filing for its product and removal deadline, and sends them', async () => {
  const seen: unknown[] = [];
  server.use(activityHandler('deadwood', DEADWOOD_NAME, 'm3'), precheckRecorder(seen));
  renderWizard();
  await driveToStep3(DEADWOOD_NAME);

  await userEvent.type(screen.getByLabelText(new RegExp(UZ['wizard.step3.quantity'])), '3');
  // Next is held until BOTH blank lines are filled (R6, mirrored client-side).
  expect(nextButton()).toBeDisabled();
  await userEvent.selectOptions(screen.getByLabelText(new RegExp(UZ['wizard.step3.deadwoodProduct'])), 'firewood');
  expect(nextButton()).toBeDisabled();
  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step3.removalDeadline'])), { target: { value: '2027-06-15' } });
  expect(nextButton()).toBeEnabled();

  await nextTwiceToPrecheck();
  await waitFor(() => expect(seen.length).toBeGreaterThan(0));
  expect(seen.at(-1)).toMatchObject({ deadwood_product: 'firewood', removal_deadline: '2027-06-15', quantity: '3' });
  expect(seen.at(-1)).not.toHaveProperty('recreation_purpose');
  expect(seen.at(-1)).not.toHaveProperty('event_at');
});

test('asks a recreation filing for its purpose and event time, and sends them', async () => {
  const seen: unknown[] = [];
  server.use(activityHandler('recreation', RECREATION_NAME, 'ga'), precheckRecorder(seen));
  renderWizard();
  await driveToStep3(RECREATION_NAME);

  await userEvent.type(screen.getByLabelText(new RegExp(UZ['wizard.step3.quantity'])), '2');
  expect(nextButton()).toBeDisabled();
  await userEvent.selectOptions(screen.getByLabelText(new RegExp(UZ['wizard.step3.recreationPurpose'])), 'health');
  expect(nextButton()).toBeDisabled();
  // `datetime-local` yields `YYYY-MM-DDTHH:MM`, sent verbatim (Tashkent wall-clock).
  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step3.eventAt'])), { target: { value: '2026-05-09T10:30' } });
  expect(nextButton()).toBeEnabled();

  await nextTwiceToPrecheck();
  await waitFor(() => expect(seen.length).toBeGreaterThan(0));
  expect(seen.at(-1)).toMatchObject({ recreation_purpose: 'health', event_at: '2026-05-09T10:30', quantity: '2' });
  expect(seen.at(-1)).not.toHaveProperty('deadwood_product');
  expect(seen.at(-1)).not.toHaveProperty('removal_deadline');
});

test('does not show the deadwood or recreation lines to a haymaking filing', async () => {
  renderWizard();
  await driveToStep3(); // default handler: haymaking

  expect(screen.queryByLabelText(new RegExp(UZ['wizard.step3.deadwoodProduct']))).toBeNull();
  expect(screen.queryByLabelText(new RegExp(UZ['wizard.step3.removalDeadline']))).toBeNull();
  expect(screen.queryByLabelText(new RegExp(UZ['wizard.step3.recreationPurpose']))).toBeNull();
  expect(screen.queryByLabelText(new RegExp(UZ['wizard.step3.eventAt']))).toBeNull();
  // Nothing of the two blanks holds Next for an activity that has no such lines.
  await userEvent.type(screen.getByLabelText(new RegExp(UZ['wizard.step3.quantity'])), '5');
  expect(nextButton()).toBeEnabled();
});

// Stage 17, QA-01 task A1 — the defect that triggered the whole QA run: an
// applicant could add livestock rows without limit and pick the same species
// twice, because neither the row list nor the "add" button ever looked at
// what the OTHER rows already held. `duplicate_livestock_type` (R6/R7) is
// the backend's own name for exactly this refusal.
const LIVESTOCK_TYPE_A = {
  id: 'aa000000-0000-4000-8000-000000000001',
  code: 'sheep',
  name: { uz_latn: 'Sheep' },
  status: 'active',
};
const LIVESTOCK_TYPE_B = {
  id: 'bb000000-0000-4000-8000-000000000002',
  code: 'cattle',
  name: { uz_latn: 'Cattle' },
  status: 'active',
};

function livestockTypesHandler(types: unknown[]) {
  return http.get('*/api/v1/refs/livestock-types', () => HttpResponse.json(types));
}

// Steps 1-2 for a grazing filing, ending on step 3. Unlike `driveToStep3`,
// there is no quantity field to wait on here (grazing's step 3 shows the
// livestock rows instead) — the row list starts empty, so the "add" button
// is what marks step 3 as reached.
async function driveToStep3Grazing() {
  await chooseActivity('Yaylov');
  await userEvent.click(await screen.findByText('pick-contour'));
  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step2.periodFrom'])), { target: { value: '2026-01-01' } });
  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step2.periodTo'])), { target: { value: '2026-06-01' } });
  await userEvent.click(screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) }));
  await screen.findByRole('button', { name: new RegExp(UZ['wizard.step3.addLivestock']) });
}

test('a species already picked in one livestock row is not offered again in another, and the add button disappears once every type is used', async () => {
  server.use(activityHandler('grazing', 'Yaylov', 'head'), livestockTypesHandler([LIVESTOCK_TYPE_A, LIVESTOCK_TYPE_B]));
  renderWizard();
  await driveToStep3Grazing();

  const addButton = () => screen.getByRole('button', { name: new RegExp(UZ['wizard.step3.addLivestock']) });
  await userEvent.click(addButton());
  await userEvent.selectOptions(screen.getAllByRole('combobox')[0], LIVESTOCK_TYPE_A.id);

  // A second type still exists, so the add button is still there.
  await userEvent.click(addButton());
  const row2 = screen.getAllByRole('combobox')[1];
  expect(within(row2).queryByText('Sheep')).toBeNull();
  expect(within(row2).getByText('Cattle')).toBeInTheDocument();

  // Two rows, two types — nothing left to add.
  expect(screen.queryByRole('button', { name: new RegExp(UZ['wizard.step3.addLivestock']) })).toBeNull();
});

test('the head-count input is capped at LIVESTOCK_HEAD_COUNT_MAX', async () => {
  server.use(activityHandler('grazing', 'Yaylov', 'head'), livestockTypesHandler([LIVESTOCK_TYPE_A, LIVESTOCK_TYPE_B]));
  renderWizard();
  await driveToStep3Grazing();
  await userEvent.click(screen.getByRole('button', { name: new RegExp(UZ['wizard.step3.addLivestock']) }));

  expect(screen.getAllByRole('spinbutton')[0]).toHaveAttribute('max', '1000000');
});

// Fix round 1 (stage 17 QA-01 review, Important — the QA trigger itself):
// `max` on a number input with no surrounding `<form>` does nothing — a
// browser lets the value through regardless. These three cover the actual
// BEHAVIOUR: Next must react to the value, not just decorate the input.
test('a head count above LIVESTOCK_HEAD_COUNT_MAX blocks Next and shows the field error', async () => {
  server.use(activityHandler('grazing', 'Yaylov', 'head'), livestockTypesHandler([LIVESTOCK_TYPE_A, LIVESTOCK_TYPE_B]));
  renderWizard();
  await driveToStep3Grazing();
  await userEvent.click(screen.getByRole('button', { name: new RegExp(UZ['wizard.step3.addLivestock']) }));
  await userEvent.selectOptions(screen.getAllByRole('combobox')[0], LIVESTOCK_TYPE_A.id);
  fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '2000000' } });

  expect(await screen.findByText(UZ['wizard.step3.headCountInvalid'])).toBeInTheDocument();
  expect(nextButton()).toBeDisabled();
});

test('a row with a species but no head count blocks Next and names the missing part', async () => {
  server.use(activityHandler('grazing', 'Yaylov', 'head'), livestockTypesHandler([LIVESTOCK_TYPE_A, LIVESTOCK_TYPE_B]));
  renderWizard();
  await driveToStep3Grazing();
  await userEvent.click(screen.getByRole('button', { name: new RegExp(UZ['wizard.step3.addLivestock']) }));
  await userEvent.selectOptions(screen.getAllByRole('combobox')[0], LIVESTOCK_TYPE_A.id);
  // Head count left empty — a half-filled row, the pre-existing hiding
  // direction: `buildFiling`/`calculationRequest` used to drop it in
  // silence rather than holding Next on it.

  expect(await screen.findByText(UZ['wizard.step3.headCountRequired'])).toBeInTheDocument();
  expect(nextButton()).toBeDisabled();
});

test('a row with a head count but no species blocks Next and names the missing part', async () => {
  server.use(activityHandler('grazing', 'Yaylov', 'head'), livestockTypesHandler([LIVESTOCK_TYPE_A, LIVESTOCK_TYPE_B]));
  renderWizard();
  await driveToStep3Grazing();
  await userEvent.click(screen.getByRole('button', { name: new RegExp(UZ['wizard.step3.addLivestock']) }));
  fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '10' } });

  expect(await screen.findByText(UZ['wizard.step3.typeRequired'])).toBeInTheDocument();
  expect(nextButton()).toBeDisabled();
});

test('a single complete, in-range row enables Next', async () => {
  server.use(activityHandler('grazing', 'Yaylov', 'head'), livestockTypesHandler([LIVESTOCK_TYPE_A, LIVESTOCK_TYPE_B]));
  renderWizard();
  await driveToStep3Grazing();
  await userEvent.click(screen.getByRole('button', { name: new RegExp(UZ['wizard.step3.addLivestock']) }));
  await userEvent.selectOptions(screen.getAllByRole('combobox')[0], LIVESTOCK_TYPE_A.id);
  fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '10' } });

  expect(screen.queryByText(UZ['wizard.step3.headCountInvalid'])).toBeNull();
  expect(screen.queryByText(UZ['wizard.step3.typeRequired'])).toBeNull();
  expect(screen.queryByText(UZ['wizard.step3.headCountRequired'])).toBeNull();
  expect(nextButton()).toBeEnabled();
});

// Fix round 1 (stage 17 QA-01 review, Important): the add-row gate used to
// read `items.length < (livestockTypesQuery.data?.length ?? 0)` — while the
// query is loading, erroring, or comes back `[]`, `data?.length ?? 0` is `0`
// and the button silently never renders. A grazing applicant would see no
// row, no button, and no explanation — exactly the HIDING-direction defect
// this stage exists to close. The fix keeps the button visible (disabled)
// on error and shows a danger Alert naming what went wrong.
test('the livestock-types query failing (500) shows an error Alert, and the add-row button stays visible but not clickable', async () => {
  server.use(
    activityHandler('grazing', 'Yaylov', 'head'),
    http.get('*/api/v1/refs/livestock-types', () =>
      HttpResponse.json({ error: { code: 'ERR-SYS-001', message: 'boom' } }, { status: 500 }),
    ),
  );
  renderWizard();
  await driveToStep3Grazing();

  // The wizard's own `errorText`/`useApiErrorText` resolves a known code
  // (`ERR-SYS-001`) to its normal localized copy — the same text any other
  // Alert in this file would show for the same code.
  expect(await screen.findByText("Serverning ichki xatosi. Keyinroq urinib ko'ring.")).toBeInTheDocument();
  expect(screen.getByRole('button', { name: new RegExp(UZ['wizard.step3.addLivestock']) })).toBeDisabled();
});

test('an empty livestock-types list shows a "not configured" message instead of a silent nothing', async () => {
  server.use(activityHandler('grazing', 'Yaylov', 'head'), livestockTypesHandler([]));
  renderWizard();
  await chooseActivity('Yaylov');
  await userEvent.click(await screen.findByText('pick-contour'));
  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step2.periodFrom'])), { target: { value: '2026-01-01' } });
  fireEvent.change(screen.getByLabelText(new RegExp(UZ['wizard.step2.periodTo'])), { target: { value: '2026-06-01' } });
  await userEvent.click(screen.getByRole('button', { name: new RegExp(UZ['wizard.nav.next']) }));

  expect(await screen.findByText(UZ['wizard.step3.livestockNotConfigured'])).toBeInTheDocument();
  // Nothing to add — the message IS the explanation, so the button is gone
  // rather than sitting there disabled with nothing to point at.
  expect(screen.queryByRole('button', { name: new RegExp(UZ['wizard.step3.addLivestock']) })).toBeNull();
});

test('the quantity input for a non-livestock activity is capped at QUANTITY_MAX', async () => {
  renderWizard();
  await driveToStep3(); // default handler: haymaking

  expect(screen.getByLabelText(new RegExp(UZ['wizard.step3.quantity']))).toHaveAttribute('max', '99999999.9999');
});

// Fix round 1 (stage 17 QA-01 review, Important): same "max does nothing
// without a <form>" gap on the non-livestock side — a value above
// QUANTITY_MAX, or with more than 4 decimal places, must hold Next.
test('a quantity above QUANTITY_MAX blocks Next and shows the field error', async () => {
  renderWizard();
  await driveToStep3(); // default handler: haymaking

  await userEvent.type(screen.getByLabelText(new RegExp(UZ['wizard.step3.quantity'])), '100000000');

  expect(await screen.findByText(UZ['wizard.step3.quantityInvalid'])).toBeInTheDocument();
  expect(nextButton()).toBeDisabled();
});

test('a quantity with more than 4 decimal places blocks Next', async () => {
  renderWizard();
  await driveToStep3(); // default handler: haymaking

  await userEvent.type(screen.getByLabelText(new RegExp(UZ['wizard.step3.quantity'])), '1.23456');

  expect(await screen.findByText(UZ['wizard.step3.quantityInvalid'])).toBeInTheDocument();
  expect(nextButton()).toBeDisabled();
});

test('a valid quantity enables Next', async () => {
  renderWizard();
  await driveToStep3(); // default handler: haymaking

  await userEvent.type(screen.getByLabelText(new RegExp(UZ['wizard.step3.quantity'])), '12.5');

  expect(screen.queryByText(UZ['wizard.step3.quantityInvalid'])).toBeNull();
  expect(nextButton()).toBeEnabled();
});

test('a duplicate-livestock-type refusal (ERR-VAL-001) at the pre-check renders the specific message, not the generic one', async () => {
  server.use(
    http.post('*/api/v1/applications/precheck', () =>
      HttpResponse.json(
        { error: { code: 'ERR-VAL-001', message: 'validation failed', details: { reason: 'duplicate_livestock_type' } } },
        { status: 422 },
      ),
    ),
  );
  renderWizard();

  await driveToStep5();

  expect(await screen.findByText("Har bir chorva turini faqat bir marta ko'rsatish mumkin.")).toBeInTheDocument();
});
