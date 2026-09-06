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
      address: null,
      verified_at: null,
    },
    representations: [],
    registration_complete: true,
  },
  loading: false,
  authError: null,
  requestMfa: vi.fn(),
  verifyMfa: vi.fn(),
  startOneId: vi.fn(),
  loginViaEimzo: vi.fn(),
  logout: vi.fn(),
  applyMe: vi.fn(),
  refreshMe: vi.fn(),
  };
}

const AUTH_VALUE = authValue('uz');

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

// Drives the wizard to step 5 and triggers a submit that the server refuses
// with a real domain error — the exact call site F4 named
// (`docs/plans/07.3-findings.md`): `ApplicationWizardPage.tsx`'s
// `handleSignAndSubmit` used to render the server's own Russian string
// verbatim as `${code}: ${message}`, regardless of the applicant's own
// interface language.
async function driveToSubmitFailure() {
  await userEvent.click(await screen.findByText('Pichanchilik'));
  await userEvent.click(screen.getByRole('button', { name: /Keyingisi/ }));

  await userEvent.click(await screen.findByText('pick-contour'));
  fireEvent.change(screen.getByLabelText(/Boshlanish sanasi/), { target: { value: '2026-01-01' } });
  fireEvent.change(screen.getByLabelText(/Tugash sanasi/), { target: { value: '2026-06-01' } });
  await userEvent.click(screen.getByRole('button', { name: /Keyingisi/ }));

  await userEvent.type(await screen.findByLabelText(/Miqdor/), '5');
  await userEvent.click(screen.getByRole('button', { name: /Keyingisi/ }));

  await userEvent.click(await screen.findByRole('button', { name: /Keyingisi/ }));

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

  // Step 1 — activity type.
  await userEvent.click(await screen.findByText('Pichanchilik'));
  await userEvent.click(screen.getByRole('button', { name: /Keyingisi/ }));

  // Step 2 — contour (stubbed) + period. `type="date"` inputs are set
  // directly rather than through `userEvent.type`, which drives them one
  // keystroke at a time and does not reliably land a full ISO date in jsdom.
  await userEvent.click(await screen.findByText('pick-contour'));
  fireEvent.change(screen.getByLabelText(/Boshlanish sanasi/), { target: { value: '2026-01-01' } });
  fireEvent.change(screen.getByLabelText(/Tugash sanasi/), { target: { value: '2026-06-01' } });
  await userEvent.click(screen.getByRole('button', { name: /Keyingisi/ }));

  // Step 3 — quantity (this activity type is not grazing, so a bare amount).
  await userEvent.type(await screen.findByLabelText(/Miqdor/), '5');
  await userEvent.click(screen.getByRole('button', { name: /Keyingisi/ }));

  // Step 4 — no document types configured server-side, nothing to attach.
  await userEvent.click(await screen.findByRole('button', { name: /Keyingisi/ }));

  // Step 5 — precheck resolves, then sign and submit.
  const signButton = await screen.findByRole('button', { name: /ERI bilan imzolash va yuborish/ });
  await waitFor(() => expect(signButton).toBeEnabled());
  await userEvent.click(signButton);

  await waitFor(() =>
    expect(buildMockSignature).toHaveBeenCalledWith(expect.objectContaining({ fullName: APPLICANT_NAME })),
  );
});
