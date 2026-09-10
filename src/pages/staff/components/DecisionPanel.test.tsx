/**
 * F11 (second sighting, `docs/plans/07.3-findings.md`) — the head approves
 * and signs, `POST /approve` answers `200` with `"status":"INVOICED"`, and
 * the card must show that without a reload. `useApprove`
 * (`../queries.ts`) already invalidates `['staff', 'application', id]` on
 * success; this test pins that behaviour at the component the walkthrough
 * actually watched so a future regression here fails loudly.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { AuthContext } from '../../../auth/AuthContext';
import type { AuthContextValue } from '../../../auth/AuthContext';
import { stubAuthActions } from '../../../auth/testAuthActions';
import { I18nContext } from '../../../i18n/context';
import * as eimzo from '../../../lib/eimzo';
import { DecisionPanel } from './DecisionPanel';
import type { ApplicationCardOut } from '../queries';

function card(over: Partial<ApplicationCardOut> = {}): ApplicationCardOut {
  return {
    id: 'a1000000-0000-4000-8000-000000000001',
    number: 'RX-2026-000005',
    status: 'IN_REVIEW',
    applicant_id: 'ap000000-0000-4000-8000-000000000001',
    submitted_by_user_id: 'u0000000-0000-4000-8000-000000000001',
    on_behalf: 'self',
    representation_id: null,
    activity_type_id: null,
    contour_id: null,
    contour_version_id: null,
    requested_area_ha: '12.5',
    period_from: '2026-01-01',
    period_to: '2026-12-31',
    quantity: null,
    channel: 'portal',
    kind: 'new',
    benefit_category_item_id: null,
    // Ruling #179 (stage 9): a benefit claim now carries its certificate and
    // the verification it is waiting on — required by the schema, so every
    // fixture states them rather than leaning on `undefined`.
    benefit_certificate_no: null,
    benefit_verification_status: 'not_required' as const,
    benefit_verified_by: null,
    benefit_verified_at: null,
    benefit_rejection_reason: null,
    rules_accepted_at: null,
    rejection_reason_item_id: null,
    assigned_org_id: null,
    assigned_user_id: 'u0000000-0000-4000-8000-000000000001',
    parent_application_id: null,
    sla_deadline_at: null,
    submitted_at: '2026-09-01T10:00:00+05:00',
    decided_at: null,
    created_at: '2026-09-01T10:00:00+05:00',
    updated_at: '2026-09-01T10:00:00+05:00',
    items: [],
    documents: [],
    checks: [],
    calculation: null,
    sla_overdue: false,
    conclusions: [],
    ...over,
  };
}

function authValue(pinfl: string | null = '30260904000003'): AuthContextValue {
  return {
    me: {
      user: {
        id: 'u0000000-0000-4000-8000-000000000002',
        full_name: 'Rahbarov Aziz',
        login: 'executor_head1',
        phone: null,
        email: null,
        must_change_password: false,
        pinfl,
        language: 'uz_latn',
      },
      role: { code: 'executor_head', name: {} },
      permissions: ['applications.decide'],
      zone: { region_id: null, district_id: null, organization_id: null },
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

const server = setupServer(
  http.get('*/api/v1/refs/classifiers/:code/items', () => HttpResponse.json([])),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPanel(initial: ApplicationCardOut, client: QueryClient, auth: AuthContextValue = authValue()) {
  function Harness() {
    return <DecisionPanel card={initial} />;
  }
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <AuthContext.Provider value={auth}>
          <MemoryRouter>
            <Harness />
          </MemoryRouter>
        </AuthContext.Provider>
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

test('approving moves the card past IN_REVIEW without a manual reload', async () => {
  const user = userEvent.setup();
  server.use(
    http.get('*/api/v1/applications/:id/package', () => new HttpResponse(new Uint8Array([1, 2, 3]).buffer)),
    http.post('*/api/v1/applications/:id/approve', () =>
      HttpResponse.json({ status: 'INVOICED', forwarded_to_organization: null }),
    ),
  );

  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const initial = card({ status: 'IN_REVIEW' });
  // Stands in for `useApplicationCard`'s own cache entry — `StaffApplicationCard`
  // is the component that actually populates this key; `DecisionPanel` only
  // consumes `card` as a prop, so the cache is seeded here the same way a
  // sibling query already on the page would have left it.
  client.setQueryData(['staff', 'application', initial.id], initial);
  renderPanel(initial, client);

  await user.click(screen.getByText('Tasdiqlash'));
  await user.click(screen.getByText('Tasdiqlash va imzolash'));

  await screen.findByText(/Ariza tasdiqlandi/);
  // The banner is a local UI echo; the real proof is that the cache the rest
  // of the card reads from was actually invalidated for this application.
  expect(
    client.getQueryState(['staff', 'application', 'a1000000-0000-4000-8000-000000000001'])?.isInvalidated,
  ).toBe(true);
});

// The mock envelope carries the signed-in user's own PINFL (`useMockSigner`,
// read from `/auth/me`) — there is no box to type one into any more. A typed
// PINFL used to come back as `certificate_pinfl_mismatch` on the first typo,
// indistinguishable from a stranger's key.
test('mock mode: no PINFL box, the envelope carries the signed-in user\'s own PINFL', async () => {
  const user = userEvent.setup();
  let sentPkcs7: string | null = null;
  server.use(
    http.get('*/api/v1/applications/:id/package', () => new HttpResponse(new Uint8Array([1, 2, 3]).buffer)),
    http.post('*/api/v1/applications/:id/approve', async ({ request }) => {
      sentPkcs7 = ((await request.json()) as { pkcs7: string }).pkcs7;
      return HttpResponse.json({ status: 'INVOICED', forwarded_to_organization: null });
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  renderPanel(card({ status: 'IN_REVIEW' }), client);

  await user.click(screen.getByText('Tasdiqlash'));
  expect(screen.queryByPlaceholderText('31207854315218')).toBeNull();
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(await screen.findByTestId('mock-signer-notice')).toHaveTextContent('30260904000003');
  await user.click(screen.getByText('Tasdiqlash va imzolash'));

  await screen.findByText(/Ariza tasdiqlandi/);
  const decoded = JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(atob(sentPkcs7!.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
    ),
  );
  expect(decoded.pinfl_or_stir).toBe('30260904000003');
  expect(decoded.subject).toBe('CN=Rahbarov Aziz');
});

// A staff account with no PINFL recorded cannot sign under the mock — the
// backend would refuse with `signer_pinfl_unknown`; the modal says so up
// front and keeps the button disabled rather than letting the round trip
// fail.
test('mock mode: an account with no PINFL sees why and cannot sign', async () => {
  const user = userEvent.setup();
  server.use(
    http.get('*/api/v1/applications/:id/package', () => new HttpResponse(new Uint8Array([1, 2, 3]).buffer)),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  renderPanel(card({ status: 'IN_REVIEW' }), client, authValue(null));

  await user.click(screen.getByText('Tasdiqlash'));
  expect(await screen.findByRole('alert')).toHaveTextContent('eimzo.mock.pinflMissing');
  // Stays disabled once the package has loaded too — the only gate left is
  // the missing PINFL, not the not-yet-fetched document.
  await waitFor(() => expect(screen.queryByText(/GET \.\.\.\/package/)).toBeNull());
  expect(screen.getByText('Tasdiqlash va imzolash').closest('button')).toBeDisabled();
});

// Finding 2 (review of stage 5.2): `SignDecisionModal` was still hardwired
// to the mock builder, bypassing the mock/real switch entirely — this
// reaches the same `signatures.service.sign()` path (DETACHED) as the
// permit/act/report call sites task 10 already migrated.
test('real mode: no PINFL box, and approve calls signDocument over the exact package bytes (DETACHED)', async () => {
  vi.spyOn(eimzo, 'isEimzoMock').mockReturnValue(false);
  const signDocumentSpy = vi.spyOn(eimzo, 'signDocument').mockResolvedValue('REAL-PKCS7');
  const user = userEvent.setup();
  let sentPkcs7 = '';
  server.use(
    http.get('*/api/v1/applications/:id/package', () => new HttpResponse(new Uint8Array([1, 2, 3]).buffer)),
    http.post('*/api/v1/applications/:id/approve', async ({ request }) => {
      sentPkcs7 = ((await request.json()) as { pkcs7: string }).pkcs7;
      return HttpResponse.json({ status: 'INVOICED', forwarded_to_organization: null });
    }),
  );

  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const initial = card({ status: 'IN_REVIEW' });
  client.setQueryData(['staff', 'application', initial.id], initial);
  renderPanel(initial, client);

  await user.click(screen.getByText('Tasdiqlash'));
  expect(screen.queryByPlaceholderText('31207854315218')).not.toBeInTheDocument();
  const submitButton = await screen.findByText('Tasdiqlash va imzolash');
  await waitFor(() => expect(submitButton.closest('button')).toBeEnabled());
  await user.click(submitButton);

  await waitFor(() => expect(sentPkcs7).toBe('REAL-PKCS7'));
  expect(signDocumentSpy).toHaveBeenCalledTimes(1);
  const signedBytes = signDocumentSpy.mock.calls[0][0];
  expect(Array.from(signedBytes)).toEqual([1, 2, 3]);
});

test('a real-mode signing failure shows a distinct message and never reaches the approve mutation', async () => {
  vi.spyOn(eimzo, 'isEimzoMock').mockReturnValue(false);
  vi.spyOn(eimzo, 'signDocument').mockRejectedValue(new eimzo.EimzoPasswordError());
  const user = userEvent.setup();
  let called = false;
  server.use(
    http.get('*/api/v1/applications/:id/package', () => new HttpResponse(new Uint8Array([1, 2, 3]).buffer)),
    http.post('*/api/v1/applications/:id/approve', () => {
      called = true;
      return HttpResponse.json({ status: 'INVOICED', forwarded_to_organization: null });
    }),
  );

  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const initial = card({ status: 'IN_REVIEW' });
  client.setQueryData(['staff', 'application', initial.id], initial);
  renderPanel(initial, client);

  await user.click(screen.getByText('Tasdiqlash'));
  const submitButton = await screen.findByText('Tasdiqlash va imzolash');
  await waitFor(() => expect(submitButton.closest('button')).toBeEnabled());
  await user.click(submitButton);

  expect(await screen.findByText(eimzo.EIMZO_ERROR_MESSAGE_KEYS.wrong_password)).toBeInTheDocument();
  expect(called).toBe(false);
});

// Stage 10, F2 (rulings #181/#182): the leshoz's own benefit-claim
// verify/reject is a mandatory block before a decision — Approve is
// disabled, with an explanatory line, while it is still `pending` or
// `rejected`, matching the server's own `ERR-APP-004` refusal
// (`benefit_unverified`/`benefit_rejected`).
test('approve is disabled with an explanation while the benefit claim is pending', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const initial = card({ status: 'IN_REVIEW', benefit_verification_status: 'pending' });
  renderPanel(initial, client);

  expect(screen.getByTestId('approve-button')).toBeDisabled();
  expect(screen.getByText('staff.decision.benefit.approveBlockedPending')).toBeInTheDocument();
  // Reject stays available — the head may still reject the whole application.
  expect(screen.getByText('Rad etish')).toBeEnabled();
});

test('approve is disabled with the leshoz\'s own reason while the benefit claim is rejected', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const initial = card({
    status: 'IN_REVIEW',
    benefit_verification_status: 'rejected',
    benefit_rejection_reason: 'Sertifikat muddati oʻtgan',
  });
  renderPanel(initial, client);

  expect(screen.getByTestId('approve-button')).toBeDisabled();
  expect(
    screen.getByText('staff.decision.benefit.approveBlockedRejectedPrefix Sertifikat muddati oʻtgan'),
  ).toBeInTheDocument();
});

test('approve stays enabled once the benefit claim is verified', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const initial = card({ status: 'IN_REVIEW', benefit_verification_status: 'verified', benefit_verified_by: null });
  renderPanel(initial, client);

  expect(screen.getByTestId('approve-button')).toBeEnabled();
  expect(screen.queryByText('staff.decision.benefit.approveBlockedPending')).not.toBeInTheDocument();
});

test('legal_basis becomes optional in the reject form once the benefit claim is rejected, and a blank field sends null', async () => {
  const reasonId = 'rj000000-0000-4000-8000-000000000001';
  server.use(
    http.get('*/api/v1/refs/classifiers/:code/items', ({ params }) =>
      params.code === 'rejection_reasons'
        ? HttpResponse.json([{ id: reasonId, code: 'RJ-01', name: { uz_latn: 'Hujjatlar toʻliq emas' }, props: {}, valid_from: '2026-01-01', valid_to: null, status: 'active' }])
        : HttpResponse.json([]),
    ),
    http.get('*/api/v1/applications/:id/package', () => new HttpResponse(new Uint8Array([1, 2, 3]).buffer)),
  );
  let receivedBody: unknown = null;
  server.use(
    http.post('*/api/v1/applications/:id/reject', async ({ request }) => {
      receivedBody = await request.json();
      return HttpResponse.json({ status: 'REJECTED' });
    }),
  );

  const user = userEvent.setup();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const initial = card({
    status: 'IN_REVIEW',
    benefit_verification_status: 'rejected',
    benefit_rejection_reason: 'Sertifikat muddati oʻtgan',
  });
  client.setQueryData(['staff', 'application', initial.id], initial);
  renderPanel(initial, client);

  await user.click(screen.getByText('Rad etish'));
  expect(await screen.findByText('staff.decision.benefit.legalBasisOptionalHint')).toBeInTheDocument();

  await screen.findByText('Hujjatlar toʻliq emas');
  const reasonSelect = screen.getByDisplayValue('Tanlang...');
  await user.selectOptions(reasonSelect, 'Hujjatlar toʻliq emas');


  // `legal_basis` left blank — the submit button must still enable, since
  // the verifier's own reason will be used.
  const submitButton = screen.getByText('Rad etish va imzolash');
  await waitFor(() => expect(submitButton.closest('button')).toBeEnabled());
  await user.click(submitButton);

  await waitFor(() => expect(receivedBody).not.toBeNull());
  expect((receivedBody as { legal_basis: unknown }).legal_basis).toBeNull();
  expect((receivedBody as { reason_item_id: unknown }).reason_item_id).toBe(reasonId);
});

// "Koʻrib chiqishga olish" used to fire `POST /start-review` on the first
// click — one slip of the mouse moved a SUBMITTED application into
// IN_REVIEW and assigned it to whoever slipped. The click now opens a
// confirmation naming the application; only its own confirm button posts.
function reviewerAuth(): AuthContextValue {
  const base = authValue();
  return { ...base, me: { ...base.me!, permissions: ['applications.review'] } };
}

test('taking into review asks for confirmation first, and only the confirm button posts', async () => {
  const user = userEvent.setup();
  let posted = 0;
  server.use(
    http.post('*/api/v1/applications/:id/start-review', () => {
      posted += 1;
      return HttpResponse.json({ status: 'IN_REVIEW' });
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const initial = card({ status: 'SUBMITTED', assigned_user_id: null });
  client.setQueryData(['staff', 'application', initial.id], initial);
  renderPanel(initial, client, reviewerAuth());

  await user.click(screen.getByText('Koʻrib chiqishga olish'));
  expect(posted).toBe(0);
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveTextContent('RX-2026-000005');

  await user.click(within(dialog).getByText('staff.startReview.confirm.button'));
  await waitFor(() => expect(posted).toBe(1));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(client.getQueryState(['staff', 'application', initial.id])?.isInvalidated).toBe(true);
});

test('cancelling the confirmation posts nothing', async () => {
  const user = userEvent.setup();
  let posted = 0;
  server.use(
    http.post('*/api/v1/applications/:id/start-review', () => {
      posted += 1;
      return HttpResponse.json({ status: 'IN_REVIEW' });
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  renderPanel(card({ status: 'SUBMITTED', assigned_user_id: null }), client, reviewerAuth());

  await user.click(screen.getByText('Koʻrib chiqishga olish'));
  const dialog = await screen.findByRole('dialog');
  await user.click(within(dialog).getByText('staff.startReview.confirm.cancel'));

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(posted).toBe(0);
});
