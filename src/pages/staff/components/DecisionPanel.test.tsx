/**
 * F11 (second sighting, `docs/plans/07.3-findings.md`) — the head approves
 * and signs, `POST /approve` answers `200` with `"status":"INVOICED"`, and
 * the card must show that without a reload. `useApprove`
 * (`../queries.ts`) already invalidates `['staff', 'application', id]` on
 * success; this test pins that behaviour at the component the walkthrough
 * actually watched so a future regression here fails loudly.
 */
import { render, screen, waitFor } from '@testing-library/react';
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

function authValue(): AuthContextValue {
  return {
    me: {
      user: {
        id: 'u0000000-0000-4000-8000-000000000002',
        full_name: 'Rahbarov Aziz',
        login: 'executor_head1',
        phone: null,
        email: null,
        must_change_password: false,
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

function renderPanel(initial: ApplicationCardOut, client: QueryClient) {
  function Harness() {
    return <DecisionPanel card={initial} />;
  }
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <AuthContext.Provider value={authValue()}>
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
  const pinflInput = await screen.findByPlaceholderText('31207854315218');
  await user.type(pinflInput, '30260904000003');
  await user.click(screen.getByText('Tasdiqlash va imzolash'));

  await screen.findByText(/Ariza tasdiqlandi/);
  // The banner is a local UI echo; the real proof is that the cache the rest
  // of the card reads from was actually invalidated for this application.
  expect(
    client.getQueryState(['staff', 'application', 'a1000000-0000-4000-8000-000000000001'])?.isInvalidated,
  ).toBe(true);
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
