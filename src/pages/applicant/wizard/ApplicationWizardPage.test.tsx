import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { AuthContext } from '../../../auth/AuthContext';
import type { AuthContextValue } from '../../../auth/AuthContext';
import { I18nContext } from '../../../i18n/context';
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

const server = setupServer(
  http.get('*/api/v1/refs/activity-types', () =>
    HttpResponse.json([{ id: ACTIVITY_ID, code: 'haymaking', name: { uz_latn: 'Pichanchilik' }, quantity_unit: 'ga' }]),
  ),
  http.get('*/api/v1/refs/livestock-types', () => HttpResponse.json([])),
  http.get('*/api/v1/refs/classifiers/:code/items', () => HttpResponse.json([])),
  http.post('*/api/v1/applications', () => HttpResponse.json({ id: APPLICATION_ID })),
  http.patch('*/api/v1/applications/:id', () => HttpResponse.json({ id: APPLICATION_ID })),
  http.get('*/api/v1/applications/:id', () => HttpResponse.json({ id: APPLICATION_ID, documents: [], items: [] })),
  http.post('*/api/v1/applications/:id/precheck', () => HttpResponse.json({ checks: [], calculation: null })),
  http.get(
    '*/api/v1/applications/:id/package',
    () => new HttpResponse(new ArrayBuffer(8), { headers: { 'Content-Type': 'application/octet-stream' } }),
  ),
  http.post('*/api/v1/applications/:id/submit', () => HttpResponse.json({ id: APPLICATION_ID })),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderWizard(auth: AuthContextValue = AUTH_VALUE, lang: UiLanguage = 'uz_latn') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang, backendLang: lang, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <AuthContext.Provider value={auth}>
          <MemoryRouter initialEntries={['/my/applications/new']}>
            <ApplicationWizardPage />
          </MemoryRouter>
        </AuthContext.Provider>
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

// Drives the wizard through steps 1–4 (activity, contour + period, quantity,
// documents) to step 5, where precheck fires automatically.
async function driveToStep5() {
  await userEvent.click(await screen.findByText('Pichanchilik'));
  await userEvent.click(screen.getByRole('button', { name: /Keyingisi/ }));

  await userEvent.click(await screen.findByText('pick-contour'));
  fireEvent.change(screen.getByLabelText(/Boshlanish sanasi/), { target: { value: '2026-01-01' } });
  fireEvent.change(screen.getByLabelText(/Tugash sanasi/), { target: { value: '2026-06-01' } });
  await userEvent.click(screen.getByRole('button', { name: /Keyingisi/ }));

  await userEvent.type(await screen.findByLabelText(/Miqdor/), '5');
  await userEvent.click(screen.getByRole('button', { name: /Keyingisi/ }));

  await userEvent.click(await screen.findByRole('button', { name: /Keyingisi/ }));
}

// Drives the wizard to step 5 and triggers a submit that the server refuses
// with a real domain error — the exact call site F4 named
// (`docs/plans/07.3-findings.md`): `ApplicationWizardPage.tsx`'s
// `handleSignAndSubmit` used to render the server's own Russian string
// verbatim as `${code}: ${message}`, regardless of the applicant's own
// interface language.
async function driveToSubmitFailure() {
  await driveToStep5();

  const signButton = await screen.findByRole('button', { name: /ERI bilan imzolash va yuborish/ });
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

    await driveToSubmitFailure();

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
test('signing and submitting passes the signed-in applicant’s own name into the mock signature', async () => {
  renderWizard();

  await driveToStep5();

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
  let sentPkcs7 = '';
  server.use(
    http.post('*/api/v1/applications/:id/submit', async ({ request }) => {
      sentPkcs7 = ((await request.json()) as { pkcs7: string }).pkcs7;
      return HttpResponse.json({ id: APPLICATION_ID });
    }),
  );
  renderWizard();

  await driveToStep5();
  const signButton = await screen.findByRole('button', { name: /ERI bilan imzolash va yuborish/ });
  await waitFor(() => expect(signButton).toBeEnabled());
  await userEvent.click(signButton);

  await waitFor(() => expect(sentPkcs7).toBe('REAL-PKCS7'));
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
  renderWizard();

  await driveToStep5();
  const signButton = await screen.findByRole('button', { name: /ERI bilan imzolash va yuborish/ });
  await waitFor(() => expect(signButton).toBeEnabled());
  await userEvent.click(signButton);

  expect(await screen.findByText(eimzo.EIMZO_ERROR_MESSAGE_KEYS.wrong_password)).toBeInTheDocument();
  expect(called).toBe(false);
});

// Ruling #113 (`docs/decisions.md`): the address requisite is gated at
// SUBMIT. `CompleteRegistrationGate.tsx` is the only place that ever WROTE
// an address, and it was optional there, so an account that registered
// before this ruling can reach the wizard with none — the wizard is where
// that account gets asked.
test('an account with no address is asked for it in step 5, and can submit once it is filled in', async () => {
  let seenAddressBody: unknown = null;
  const auth = authValueWithAddress(null);
  server.use(
    http.patch('*/api/v1/auth/applicants/:applicantId/address', async ({ request }) => {
      seenAddressBody = await request.json();
      return HttpResponse.json({
        ...auth.me!.applicant,
        address: "Farg'ona sh., Mustaqillik ko'chasi 5",
      });
    }),
  );
  renderWizard(auth);

  await driveToStep5();

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
  // Nothing is signed by that first press. Counted rather than asserted
  // absent: the mock is module-level and carries calls from earlier tests in
  // this file.
  const signaturesBefore = vi.mocked(buildMockSignature).mock.calls.length;

  // Now it signs.
  const signButton = await screen.findByRole('button', { name: /ERI bilan imzolash va yuborish/ });
  expect(vi.mocked(buildMockSignature).mock.calls.length).toBe(signaturesBefore);
  await userEvent.click(signButton);
  // `saveApplicantAddress` hands back an `ApplicantOut`, not a whole
  // `MeOut` — the wizard adopts it through `refreshMe()`, not `applyMe()`.
  await waitFor(() => expect(auth.refreshMe).toHaveBeenCalled());
  await waitFor(() => expect(buildMockSignature).toHaveBeenCalled());
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

  await screen.findByRole('button', { name: /ERI bilan imzolash va yuborish/ });
  expect(screen.queryByLabelText(/Manzil/)).not.toBeInTheDocument();
});
