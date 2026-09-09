/**
 * F11 (third sighting, `docs/plans/07.3-findings.md`) — the permit
 * signature. Root cause: `SignatureSlot`'s `onError` ran the mutation's own
 * rejection reason (already a real `ApiError`, thrown by `mutationFn`
 * itself) back through `apiError()`, which only knows how to unwrap a raw
 * `{error: {...}}` response body. Handed an `ApiError` instance instead, it
 * finds no nested `.error` and falls back to `ERR-SYS-000` "Unexpected
 * error" — discarding the server's real code and message. A signer told
 * their attempt failed with a meaningless message, over a signature that in
 * fact went through moments earlier from a previous attempt, has no way to
 * tell the two apart.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';
import { stubAuthActions } from '../../auth/testAuthActions';
import type { components } from '../../api/schema';
import { I18nContext } from '../../i18n/context';
import { uz_latn } from '../../i18n/uz_latn';
import * as eimzo from '../../lib/eimzo';
import { PermitSignaturesPanel } from './PermitSignaturesPanel';

type PermitCardOut = components['schemas']['PermitCardOut'];

function authValue(): AuthContextValue {
  return {
    me: {
      user: {
        id: 'u0000000-0000-4000-8000-000000000001',
        full_name: 'Aliyev Vali',
        login: 'applicant1',
        phone: null,
        email: null,
        must_change_password: false,
        language: 'uz_latn',
      },
      role: { code: 'applicant', name: {} },
      permissions: [],
      zone: { region_id: null, district_id: null, organization_id: null },
      csrf_token: 'tok-1',
      is_superuser: false,
      applicant: {
        id: 'ap000000-0000-4000-8000-000000000001',
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
    id: 'p1000000-0000-4000-8000-000000000001',
    series: 'A',
    number: 3,
    status: 'pending_signatures',
    application_id: 'a1000000-0000-4000-8000-000000000001',
    applicant_id: 'ap000000-0000-4000-8000-000000000001',
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
    doc_hash: 'deadbeef',
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

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

const t = (key: string) => (uz_latn as Record<string, string>)[key] ?? key;

function renderPanel(permit: PermitCardOut, onSigned: () => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t, setLanguage: async () => {} };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <AuthContext.Provider value={authValue()}>
          <PermitSignaturesPanel permit={permit} onSigned={onSigned} />
        </AuthContext.Provider>
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

test('a genuine 409 (already signed) shows the real message, never the generic fallback', async () => {
  const user = userEvent.setup();
  server.use(
    http.post('*/api/v1/permits/:id/signatures', () =>
      HttpResponse.json(
        { error: { code: 'ERR-SIGN-002', message: 'Эта подпись уже проставлена' } },
        { status: 409 },
      ),
    ),
  );

  renderPanel(permitCard(), () => {});
  await user.click(screen.getByText('E-IMZO bilan imzolash'));

  await screen.findByText('Bu qator allaqachon imzolangan.');
  expect(screen.queryByText('Unexpected error')).not.toBeInTheDocument();
});

test('an already-signed conflict still refreshes the card, so the screen catches up without a reload', async () => {
  const user = userEvent.setup();
  server.use(
    http.post('*/api/v1/permits/:id/signatures', () =>
      HttpResponse.json(
        { error: { code: 'ERR-SIGN-002', message: 'Эта подпись уже проставлена' } },
        { status: 409 },
      ),
    ),
  );

  const onSigned = vi.fn();
  renderPanel(permitCard(), onSigned);
  await user.click(screen.getByText('E-IMZO bilan imzolash'));

  await screen.findByText('Bu qator allaqachon imzolangan.');
  expect(onSigned).toHaveBeenCalledTimes(1);
});

test('a successful signature refreshes the panel through onSigned, with no stray error text', async () => {
  const user = userEvent.setup();
  server.use(
    http.post('*/api/v1/permits/:id/signatures', () => HttpResponse.json(permitCard({ status: 'active' }))),
  );

  const onSigned = vi.fn();
  renderPanel(permitCard(), onSigned);
  await user.click(screen.getByText('E-IMZO bilan imzolash'));

  await vi.waitFor(() => expect(onSigned).toHaveBeenCalledTimes(1));
  expect(screen.queryByText('Unexpected error')).not.toBeInTheDocument();
});

// Finding 4 (review of stage 5.2): `ERR-SIGN-001` used to map unconditionally
// to "this signature is not required" without ever reading `details.reason`.
// Under the mock that code effectively only ever meant `purpose_not_required`;
// a real backend answers with the SAME code for `certificate_revoked`,
// `certificate_pinfl_mismatch`, etc. — collapsing them all into "not required"
// told a signer whose certificate was revoked that nothing was needed at all.
test('ERR-SIGN-001 with reason=certificate_revoked shows the revoked message, never "not required"', async () => {
  const user = userEvent.setup();
  server.use(
    http.post('*/api/v1/permits/:id/signatures', () =>
      HttpResponse.json(
        { error: { code: 'ERR-SIGN-001', message: 'refused', details: { reason: 'certificate_revoked' } } },
        { status: 422 },
      ),
    ),
  );

  renderPanel(permitCard(), () => {});
  await user.click(screen.getByText('E-IMZO bilan imzolash'));

  await screen.findByText(t('permits.signatures.errors.certificateRevoked'));
  expect(screen.queryByText(t('permits.signatures.errors.purposeNotRequired'))).not.toBeInTheDocument();
});

test('ERR-SIGN-001 with no reason at all (or one this list does not name) falls back to a generic refusal, still never "not required"', async () => {
  const user = userEvent.setup();
  server.use(
    http.post('*/api/v1/permits/:id/signatures', () =>
      HttpResponse.json({ error: { code: 'ERR-SIGN-001', message: 'refused' } }, { status: 422 }),
    ),
  );

  renderPanel(permitCard(), () => {});
  await user.click(screen.getByText('E-IMZO bilan imzolash'));

  await screen.findByText(t('permits.signatures.errors.signRefusedGeneric'));
  expect(screen.queryByText(t('permits.signatures.errors.purposeNotRequired'))).not.toBeInTheDocument();
});

// Minor finding (fix wave): the PDF-fetch failure used to surface as
// `err.message` verbatim — an untranslated English sentence.
test('real mode: a failed PDF fetch shows a localized message, never the raw English fetch error', async () => {
  vi.spyOn(eimzo, 'isEimzoMock').mockReturnValue(false);
  server.use(http.get('*/api/v1/permits/:id/pdf', () => new HttpResponse(null, { status: 403 })));

  renderPanel(permitCard(), () => {});
  await userEvent.click(screen.getByText('E-IMZO bilan imzolash'));

  await screen.findByText(t('permits.signatures.errors.pdfFetchFailed'));
  expect(screen.queryByText(/Failed to fetch the permit PDF/)).not.toBeInTheDocument();
});

// Minor finding (fix wave): mock mode used to check `doc_hash` BEFORE the
// PINFL/STIR field, reversing the original order — with both wrong, a signer
// saw the hash message instead of the PINFL one they could actually act on.
// The `permit_recipient` slot pre-fills the applicant's own (valid) PINFL, so
// this test clears it to an invalid value first.
test('mock mode: with both the PINFL and the missing doc_hash wrong, the PINFL error wins (original order)', async () => {
  const user = userEvent.setup();
  renderPanel(permitCard({ doc_hash: null }), () => {});
  const pinflInput = screen.getByPlaceholderText('31708860250017');
  await user.clear(pinflInput);
  await user.type(pinflInput, '123');
  await user.click(screen.getByText('E-IMZO bilan imzolash'));

  await screen.findByText('PINFL 14 ta, tashkilot STIR 9 ta raqamdan iborat boʻlishi kerak.');
  expect(screen.queryByText('Hujjat hali render qilinmagan — imzolab boʻlmaydi.')).not.toBeInTheDocument();
});

test('real mode: no PINFL/STIR box, and a sign fetches the PDF then calls signDocument (DETACHED)', async () => {
  vi.spyOn(eimzo, 'isEimzoMock').mockReturnValue(false);
  const signDocumentSpy = vi.spyOn(eimzo, 'signDocument').mockResolvedValue('REAL-PKCS7');
  let sentPkcs7 = '';
  server.use(
    http.get('*/api/v1/permits/:id/pdf', () => new HttpResponse(new Uint8Array([1, 2, 3]).buffer)),
    http.post('*/api/v1/permits/:id/signatures', async ({ request }) => {
      sentPkcs7 = ((await request.json()) as { pkcs7: string }).pkcs7;
      return HttpResponse.json(permitCard({ status: 'active' }));
    }),
  );

  const onSigned = vi.fn();
  renderPanel(permitCard(), onSigned);
  expect(screen.queryByPlaceholderText('31708860250017')).not.toBeInTheDocument();

  await userEvent.click(screen.getByText('E-IMZO bilan imzolash'));

  await vi.waitFor(() => expect(onSigned).toHaveBeenCalledTimes(1));
  expect(signDocumentSpy).toHaveBeenCalledTimes(1);
  expect(sentPkcs7).toBe('REAL-PKCS7');
});
