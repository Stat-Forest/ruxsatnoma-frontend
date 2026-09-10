/**
 * Stage 10, F1 — ruling #183: the holder's own signature on the permit page.
 * For an application filed `on_behalf='self'` the holder signs with a plain
 * button (`POST /permits/{id}/signatures` with `{purpose}` and NO `pkcs7`);
 * `src/pages/permits/**` (F3's `PermitSignaturesPanel`) stays untouched —
 * this page filters what it hands that component instead, so the OLD
 * E-IMZO/PINFL row it renders for the recipient purpose never shows for a
 * `self` filing.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AuthContext, type AuthContextValue } from '../auth/AuthContext';
import { stubAuthActions } from '../auth/testAuthActions';
import type { components } from '../api/schema';
import { DICTIONARIES, I18nContext } from '../i18n/context';
import { MyPermitPage } from './MyPermitPage';

type PermitCardOut = components['schemas']['PermitCardOut'];
type ApplicationCardOut = components['schemas']['ApplicationCardOut'];

const PERMIT_ID = 'p1000000-0000-4000-8000-000000000001';
const APPLICATION_ID = 'a1000000-0000-4000-8000-000000000001';
const APPLICANT_ID = 'ap000000-0000-4000-8000-000000000001';

function authValue(): AuthContextValue {
  return {
    me: {
      user: { id: 'u1', full_name: 'Aliyev Vali', login: 'applicant1', phone: null, email: null, must_change_password: false, language: 'uz_latn' },
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
    missing_signatures: ['permit_head', 'permit_chief_forester', 'permit_accountant', 'permit_recipient'],
    document_date: '2026-09-01',
    ...over,
  } as PermitCardOut;
}

function applicationCard(over: Partial<ApplicationCardOut> = {}): ApplicationCardOut {
  return {
    id: APPLICATION_ID,
    number: 'A-1',
    status: 'PERMIT_ISSUED',
    applicant_id: APPLICANT_ID,
    submitted_by_user_id: 'u1',
    on_behalf: 'self',
    representation_id: null,
    activity_type_id: 'act00000-0000-4000-8000-000000000001',
    contour_id: 'c0000000-0000-4000-8000-000000000001',
    contour_version_id: 'cv000000-0000-4000-8000-000000000001',
    requested_area_ha: '65.0694',
    period_from: '2026-05-01',
    period_to: '2026-07-31',
    quantity: null,
    channel: 'portal',
    kind: 'new',
    benefit_category_item_id: null,
    benefit_certificate_no: null,
    benefit_verification_status: 'not_required',
    benefit_verified_by: null,
    benefit_verified_at: null,
    benefit_rejection_reason: null,
    rejection_reason_item_id: null,
    assigned_org_id: null,
    assigned_user_id: null,
    parent_application_id: null,
    sla_deadline_at: null,
    submitted_at: '2026-09-01T09:00:00Z',
    decided_at: '2026-09-01T09:30:00Z',
    rules_accepted_at: '2026-09-01T09:00:00Z',
    created_at: '2026-09-01T08:00:00Z',
    documents: [],
    items: [],
    ...over,
  } as unknown as ApplicationCardOut;
}

const server = setupServer(
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

test('a self-filed permit offers a plain sign button for the holder, posting no pkcs7', async () => {
  let sentBody: { purpose?: string; pkcs7?: string } = {};
  server.use(
    http.get('*/api/v1/permits/:id', () => HttpResponse.json(permitCard())),
    http.get('*/api/v1/applications/:id', () => HttpResponse.json(applicationCard({ on_behalf: 'self' }))),
    http.post('*/api/v1/permits/:id/signatures', async ({ request }) => {
      sentBody = (await request.json()) as typeof sentBody;
      return HttpResponse.json({ id: 'sig-1' });
    }),
  );
  renderPermitPage();

  const signButton = await screen.findByRole('button', { name: 'Imzolash' });
  await userEvent.click(signButton);

  await waitFor(() => expect(sentBody.purpose).toBe('permit_recipient'));
  expect(sentBody.pkcs7).toBeUndefined();
});

test('a self-filed, still-unsigned permit hides the old E-IMZO row for the holder purpose', async () => {
  server.use(
    http.get('*/api/v1/permits/:id', () => HttpResponse.json(permitCard())),
    http.get('*/api/v1/applications/:id', () => HttpResponse.json(applicationCard({ on_behalf: 'self' }))),
  );
  renderPermitPage();

  await screen.findByText('Ruxsatnomani imzolash');
  // Ruling #183: a citizen never meets an E-IMZO dialog at all — the old
  // "E-IMZO bilan imzolash" row PermitSignaturesPanel would otherwise render
  // for the recipient purpose must not be on screen alongside the plain one.
  expect(screen.queryByText('E-IMZO bilan imzolash')).not.toBeInTheDocument();
});

test('a legal filing keeps the unchanged ERI flow, and shows no plain-button panel', async () => {
  server.use(
    http.get('*/api/v1/permits/:id', () => HttpResponse.json(permitCard())),
    http.get('*/api/v1/applications/:id', () => HttpResponse.json(applicationCard({ on_behalf: 'legal' }))),
  );
  renderPermitPage();

  await screen.findByText('Elektron raqamli imzolar');
  expect(screen.queryByText('Ruxsatnomani imzolash')).not.toBeInTheDocument();
  // The recipient purpose's own row is still there, offering the old ERI
  // flow — untouched, because `src/pages/permits/**` was not touched here.
  await waitFor(
    () => {
      expect(screen.getByRole('button', { name: /E-IMZO bilan imzolash/ })).toBeInTheDocument();
    },
    { timeout: 3000 },
  );
});

test('once the holder signature succeeds, the plain-button panel disappears', async () => {
  let signed = false;
  server.use(
    http.get('*/api/v1/permits/:id', () =>
      HttpResponse.json(
        signed
          ? permitCard({
              missing_signatures: ['permit_head', 'permit_chief_forester', 'permit_accountant'],
              signatures: [
                {
                  id: 'sig-1',
                  purpose: 'permit_recipient',
                  signer_user_id: 'u1',
                  certificate_id: '00000000-0000-4000-8000-000000000000',
                  signed_at: '2026-09-10T10:00:00Z',
                  verification_status: 'valid',
                },
              ],
            })
          : permitCard(),
      ),
    ),
    http.get('*/api/v1/applications/:id', () => HttpResponse.json(applicationCard({ on_behalf: 'self' }))),
    http.post('*/api/v1/permits/:id/signatures', () => {
      signed = true;
      return HttpResponse.json({ id: 'sig-1' });
    }),
  );
  renderPermitPage();

  const signButton = await screen.findByRole('button', { name: 'Imzolash' });
  await userEvent.click(signButton);

  await waitFor(() => expect(screen.queryByText('Ruxsatnomani imzolash')).not.toBeInTheDocument());
});

test('a refused holder signature shows the server reason in the plain-button panel', async () => {
  server.use(
    http.get('*/api/v1/permits/:id', () => HttpResponse.json(permitCard())),
    http.get('*/api/v1/applications/:id', () => HttpResponse.json(applicationCard({ on_behalf: 'self' }))),
    http.post('*/api/v1/permits/:id/signatures', () =>
      HttpResponse.json(
        { error: { code: 'ERR-SIGN-001', message: 'x', details: { reason: 'signer_pinfl_unknown' } } },
        { status: 422 },
      ),
    ),
  );
  renderPermitPage();

  const signButton = await screen.findByRole('button', { name: 'Imzolash' });
  await userEvent.click(signButton);

  expect(
    await screen.findByText("Imzolovchining JSHSHIR raqami aniqlanmadi — qo'llab-quvvatlash xizmatiga murojaat qiling."),
  ).toBeInTheDocument();
});
