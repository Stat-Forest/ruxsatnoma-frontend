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
type PermitSignatureRow = components['schemas']['PermitSignatureRow'];
type SignatureOut = components['schemas']['SignatureOut'];

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

// Stage 10, F3: `PermitSignaturesPanel` now also fetches `GET
// /api/v1/signatures?object_type=permit&object_id=…` (ruling #183, to learn
// each row's `kind`), so every test needs a handler for it — a default,
// empty-list one here, overridden per test via `server.use(...)` where the
// scenario actually needs signature rows.
function emptySignaturesPage() {
  return HttpResponse.json({ items: [], total: 0, page: 1, page_size: 20 });
}

/** The reduced row `permit.signatures` carries (`PermitSignatureRow` —
 *  `kind` and a nullable `certificate_id` since the stage 10 integration,
 *  no `verification`): drives `validRow`/`invalidAttempts` matching. */
function permitSignatureRow(over: Partial<PermitSignatureRow> = {}): PermitSignatureRow {
  return {
    id: 'sig00000-0000-4000-8000-000000000001',
    purpose: 'permit_recipient',
    signer_user_id: 'u0000000-0000-4000-8000-000000000001',
    kind: 'eri',
    certificate_id: 'cert0000-0000-4000-8000-000000000001',
    signed_at: '2026-09-05T08:00:00Z',
    verification_status: 'valid',
    ...over,
  };
}

/** The full row `GET /api/v1/signatures` answers (`SignatureOut` — `kind`,
 *  nullable `certificate_id`, the raw `verification` payload) — what this
 *  panel now fetches to tell a `simple` signature apart from an `eri` one. */
function signatureOut(over: Partial<SignatureOut> = {}): SignatureOut {
  return {
    id: 'sig00000-0000-4000-8000-000000000001',
    object_type: 'permit',
    object_id: 'p1000000-0000-4000-8000-000000000001',
    purpose: 'permit_recipient',
    kind: 'eri',
    signer_user_id: 'u0000000-0000-4000-8000-000000000001',
    certificate_id: 'cert0000-0000-4000-8000-000000000001',
    doc_hash: 'deadbeef',
    signature_value: 'MOCK-PKCS7',
    signed_at: '2026-09-05T08:00:00Z',
    verification: {},
    verification_status: 'valid',
    ...over,
  };
}

const server = setupServer(http.get('*/api/v1/signatures', emptySignaturesPage));
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

// Stage 10, F3 (ruling #183): the holder's simple signature.
test('a simple signature renders masked as "Oddiy imzo", with the time and never a certificate field', async () => {
  const permit = permitCard({
    signatures: [permitSignatureRow({ id: 'sig00000-0000-4000-8000-000000000009', purpose: 'permit_recipient' })],
    missing_signatures: ['permit_head', 'permit_chief_forester', 'permit_accountant'],
  });
  server.use(
    http.get('*/api/v1/signatures', () =>
      HttpResponse.json({
        items: [
          signatureOut({
            id: 'sig00000-0000-4000-8000-000000000009',
            purpose: 'permit_recipient',
            kind: 'simple',
            certificate_id: null,
            verification: { kind: 'simple', pinfl: '30212345678911', auth_method: 'oneid', ip: '10.0.0.1' },
          }),
        ],
        total: 1,
        page: 1,
        page_size: 20,
      }),
    ),
  );

  renderPanel(permit, () => {});

  expect(await screen.findByText('Oddiy imzo')).toBeInTheDocument();
  expect(screen.getByText('302•••••••••11')).toBeInTheDocument();
  expect(screen.queryByText('30212345678911')).not.toBeInTheDocument();
  await screen.findByText('Imzolangan:');
});

test('an eri signature is unchanged: no "Oddiy imzo" badge, no PINFL row', async () => {
  const permit = permitCard({
    signatures: [permitSignatureRow({ id: 'sig00000-0000-4000-8000-000000000010', purpose: 'permit_head' })],
    missing_signatures: ['permit_chief_forester', 'permit_accountant', 'permit_recipient'],
  });
  server.use(
    http.get('*/api/v1/signatures', () =>
      HttpResponse.json({
        items: [signatureOut({ id: 'sig00000-0000-4000-8000-000000000010', purpose: 'permit_head', kind: 'eri' })],
        total: 1,
        page: 1,
        page_size: 20,
      }),
    ),
  );

  renderPanel(permit, () => {});

  await screen.findByText('Imzolangan:');
  expect(screen.queryByText('Oddiy imzo')).not.toBeInTheDocument();
  expect(screen.queryByTestId('signature-simple-badge')).not.toBeInTheDocument();
});

// `GET /signatures` gates on the caller already holding a valid row of
// their own (or oversight) — a viewer this refuses for still sees the row
// itself (`permit.signatures`), and since the stage 10 integration the card
// row carries `kind`: the badge shows for EVERY viewer of the card, only the
// masked PINFL (from `verification`, card-less) needs the full list.
test('a simple card row this viewer cannot look up in the full list still says "Oddiy imzo", without a PINFL', async () => {
  const permit = permitCard({
    signatures: [
      permitSignatureRow({
        id: 'sig00000-0000-4000-8000-000000000011',
        purpose: 'permit_recipient',
        kind: 'simple',
        certificate_id: null,
      }),
    ],
    missing_signatures: ['permit_head', 'permit_chief_forester', 'permit_accountant'],
  });
  // No override: the suite-wide default handler answers an empty list.
  renderPanel(permit, () => {});

  await screen.findByText('Imzolangan:');
  expect(screen.getByTestId('signature-simple-badge')).toBeInTheDocument();
  expect(screen.queryByText('PINFL')).not.toBeInTheDocument();
});

test('an eri card row this viewer cannot look up in the full list renders as an ordinary signed row', async () => {
  const permit = permitCard({
    signatures: [permitSignatureRow({ id: 'sig00000-0000-4000-8000-000000000012', purpose: 'permit_head' })],
    missing_signatures: ['permit_chief_forester', 'permit_accountant', 'permit_recipient'],
  });
  renderPanel(permit, () => {});

  await screen.findByText('Imzolangan:');
  expect(screen.queryByTestId('signature-simple-badge')).not.toBeInTheDocument();
});
