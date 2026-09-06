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
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPanel(permit: PermitCardOut, onSigned: () => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={authValue()}>
        <PermitSignaturesPanel permit={permit} onSigned={onSigned} />
      </AuthContext.Provider>
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
