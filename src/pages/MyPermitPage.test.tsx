/**
 * Ruling #210: the holder signs NOTHING on the permit — their only signature
 * is the one over the application at filing. The permit page shows them the
 * leshoz lines read-only: the three the backend requires by default, or
 * every line a permit signed under the old four-line rule actually carries.
 * (Ruling #183's plain sign button for a `self` filing went with the line.)
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AuthContext, type AuthContextValue } from '../auth/AuthContext';
import { stubAuthActions } from '../auth/testAuthActions';
import type { components } from '../api/schema';
import { DICTIONARIES, I18nContext } from '../i18n/context';
import { MyPermitPage } from './MyPermitPage';

type PermitCardOut = components['schemas']['PermitCardOut'];

const PERMIT_ID = 'p1000000-0000-4000-8000-000000000001';
const APPLICATION_ID = 'a1000000-0000-4000-8000-000000000001';
const APPLICANT_ID = 'ap000000-0000-4000-8000-000000000001';

function authValue(): AuthContextValue {
  return {
    me: {
      user: { id: 'u1', full_name: 'Aliyev Vali', login: 'applicant1', phone: null, email: null, must_change_password: false, pinfl: null, language: 'uz_latn' },
      role: { code: 'applicant', name: {} },
      permissions: [],
      zone: { region_id: null, district_id: null, organization_id: null },
      csrf_token: 'tok-1',
      is_superuser: false,
      applicant: {
        id: APPLICANT_ID,
        kind: 'individual',
        pinfl: '31708860250017',
        stir: null,
        name: 'Aliyev Vali',
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
    ...stubAuthActions(),
  };
}

function permitCard(over: Partial<PermitCardOut> = {}): PermitCardOut {
  return {
    id: PERMIT_ID,
    series: 'A',
    number: 3,
    status: 'pending_signatures',
    application_id: APPLICATION_ID,
    applicant_id: APPLICANT_ID,
    activity_type_id: 'act00000-0000-4000-8000-000000000001',
    organization_id: 'org00000-0000-4000-8000-000000000001',
    contour_id: 'c0000000-0000-4000-8000-000000000001',
    contour_version_id: 'cv000000-0000-4000-8000-000000000001',
    area_ha: '65.0694',
    period_from: '2026-05-01',
    period_to: '2026-07-31',
    amount: '2200000.00',
    sb_load: '50',
    pdf_file_id: 'f1000000-0000-4000-8000-000000000001',
    doc_hash: null,
    template_id: null,
    issued_at: null,
    created_at: '2026-09-01T10:00:00Z',
    signatures: [],
    history: [],
    missing_signatures: ['permit_head', 'permit_chief_forester', 'permit_accountant'],
    document_date: '2026-09-01',
    ...over,
  } as PermitCardOut;
}


const server = setupServer(
  // `PermitSignaturesPanel` reads the full signature rows for the masked
  // PINFL line (F3); an empty page is what a holder who has not signed sees.
  http.get('*/api/v1/signatures', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 20 })),
  http.get('*/api/v1/refs/activity-types', () => HttpResponse.json([])),
  http.get('*/api/v1/refs/organizations', () => HttpResponse.json({ items: [], total: 0 })),
  http.get('*/api/v1/gis/contours/:id', () => HttpResponse.json({ id: 'c0000000-0000-4000-8000-000000000001', number: 'C-1' })),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPermitPage(auth: AuthContextValue = authValue()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const lang = 'uz_latn' as const;
  const i18n = {
    lang,
    backendLang: lang,
    t: (key: string) => (DICTIONARIES[lang] as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
  const router = createMemoryRouter([{ path: '/my/permits/:id', element: <MyPermitPage /> }], {
    initialEntries: [`/my/permits/${PERMIT_ID}`],
  });
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <AuthContext.Provider value={auth}>
          <RouterProvider router={router} />
        </AuthContext.Provider>
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

test('the holder sees the three leshoz lines, each waiting, and no sign button of their own', async () => {
  server.use(http.get('*/api/v1/permits/:id', () => HttpResponse.json(permitCard())));
  renderPermitPage();

  await screen.findByText('Elektron raqamli imzolar');
  expect(screen.getByText('Imzolangan 0 dan 3')).toBeInTheDocument();
  // No line is the holder's, so every one waits on an official — and there is
  // no button at all: neither ruling #183's plain «Imzolash» nor the E-IMZO
  // form (the citizen never meets an E-IMZO dialog on this page).
  expect(screen.getAllByText(/Imzo kutilmoqda/)).toHaveLength(3);
  expect(screen.queryByRole('button', { name: 'Imzolash' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /E-IMZO bilan imzolash/ })).not.toBeInTheDocument();
  expect(screen.queryByText('Foydalanuvchi / Arizachi')).not.toBeInTheDocument();
});

test('a permit signed under the old four-line rule still shows all four rows, signed', async () => {
  const signedAt = '2026-09-10T10:00:00Z';
  const row = (id: string, purpose: string, kind: 'eri' | 'simple') => ({
    id,
    purpose,
    signer_user_id: 'u9',
    kind,
    certificate_id: kind === 'eri' ? 'cert-1' : null,
    signed_at: signedAt,
    verification_status: 'valid' as const,
  });
  server.use(
    http.get('*/api/v1/permits/:id', () =>
      HttpResponse.json(
        permitCard({
          status: 'active',
          issued_at: signedAt,
          missing_signatures: [],
          signatures: [
            row('sig-1', 'permit_head', 'eri'),
            row('sig-2', 'permit_chief_forester', 'eri'),
            row('sig-3', 'permit_accountant', 'eri'),
            row('sig-4', 'permit_recipient', 'simple'),
          ],
        }),
      ),
    ),
  );
  renderPermitPage();

  await screen.findByText('Elektron raqamli imzolar');
  // Read from the permit, never from a hard-coded count: the line exists
  // because the permit carries it, so the counter says 4 of 4, not 3 of 4.
  expect(screen.getByText('Imzolangan 4 dan 4')).toBeInTheDocument();
  expect(screen.getByText('Foydalanuvchi / Arizachi')).toBeInTheDocument();
  expect(screen.queryByText(/Imzo kutilmoqda/)).not.toBeInTheDocument();
});
