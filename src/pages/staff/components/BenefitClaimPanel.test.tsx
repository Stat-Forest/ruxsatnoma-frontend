/**
 * Stage 10, F2 (rulings #181/#182) — the benefit claim block on the
 * application card, replacing stage 9's country-wide queue. Four things
 * this panel must not get wrong, one test group each:
 *   1. `not_required` renders nothing at all;
 *   2. `pending` shows the certificate/category/documents and, for a
 *      `benefits.verify` holder, the verify/reject actions — hidden for
 *      someone without the permission;
 *   3. `verified` with no verifier reads the Union-register sentence, never
 *      "decided by (nobody)";
 *   4. `rejected` shows the leshoz's own reason.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthContext } from '../../../auth/AuthContext';
import type { AuthContextValue } from '../../../auth/AuthContext';
import { stubAuthActions } from '../../../auth/testAuthActions';
import { I18nContext } from '../../../i18n/context';
import { BenefitClaimPanel } from './BenefitClaimPanel';
import type { ApplicationCardOut } from '../queries';

const APPLICATION_ID = 'a1000000-0000-4000-8000-000000000001';
const CATEGORY_ID = 'bc000000-0000-4000-8000-000000000001';
const DOC_TYPE_ID = 'dt000000-0000-4000-8000-000000000001';
const VERIFIER_ID = 'v1000000-0000-4000-8000-0000000abcde';

function card(over: Partial<ApplicationCardOut> = {}): ApplicationCardOut {
  return {
    id: APPLICATION_ID,
    number: 'RX-2026-000123',
    status: 'IN_REVIEW',
    applicant_id: 'ap000000-0000-4000-8000-000000000001',
    submitted_by_user_id: 'u0000000-0000-4000-8000-000000000001',
    on_behalf: 'self',
    representation_id: null,
    activity_type_id: null,
    contour_id: null,
    contour_version_id: null,
    requested_area_ha: null,
    period_from: null,
    period_to: null,
    quantity: null,
    channel: 'portal',
    kind: 'new',
    benefit_category_item_id: CATEGORY_ID,
    benefit_certificate_no: 'CERT-001',
    benefit_verification_status: 'pending' as const,
    benefit_verified_by: null,
    benefit_verified_at: null,
    benefit_rejection_reason: null,
    rules_accepted_at: null,
    rejection_reason_item_id: null,
    assigned_org_id: null,
    assigned_user_id: null,
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

const PROOF_DOC = { id: 'doc-1', doc_type_item_id: DOC_TYPE_ID, file_id: 'file-1', note: null, created_at: '2026-09-01T10:00:00Z' };
const OTHER_DOC = { id: 'doc-2', doc_type_item_id: 'd0000000-0000-4000-8000-00000000ffff', file_id: 'file-2', note: null, created_at: '2026-09-01T10:00:00Z' };

function authValue(permissions: string[]): AuthContextValue {
  return {
    me: {
      user: {
        id: 'u0000000-0000-4000-8000-000000000002',
        full_name: 'Ijrochi Aziz',
        login: 'executor_staff1',
        phone: null,
        email: null,
        must_change_password: false,
        language: 'uz_latn',
      },
      role: { code: 'executor_staff', name: {} },
      permissions,
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
  http.get('*/api/v1/refs/classifiers/:code/items', ({ params }) => {
    if (params.code === 'benefit_categories') {
      return HttpResponse.json([{ id: CATEGORY_ID, code: 'beekeeping_union_member', name: { uz_latn: 'Asalarichilik uyushmasi aʼzosi' }, props: {}, valid_from: '2026-01-01', valid_to: null, status: 'active' }]);
    }
    if (params.code === 'doc_types') {
      return HttpResponse.json([{ id: DOC_TYPE_ID, code: 'benefit_proof', name: { uz_latn: 'Imtiyoz sertifikati' }, props: {}, valid_from: '2026-01-01', valid_to: null, status: 'active' }]);
    }
    return HttpResponse.json([]);
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPanel(row: ApplicationCardOut, permissions: string[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <AuthContext.Provider value={authValue(permissions)}>
          <BenefitClaimPanel card={row} />
        </AuthContext.Provider>
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

test('renders nothing when the application carries no benefit claim', () => {
  const { container } = renderPanel(card({ benefit_verification_status: 'not_required' }), []);
  expect(container).toBeEmptyDOMElement();
});

test('a pending claim shows the certificate, category and the benefit_proof documents off the card, plus verify/reject for a benefits.verify holder', async () => {
  // No handler for `GET /applications/benefit-verifications/:id` on purpose:
  // the panel must not call it (review finding 2 — the route is gated on
  // `benefits.verify`, and a viewer without it saw a red ACL error).
  renderPanel(card({ status: 'IN_REVIEW', documents: [PROOF_DOC, OTHER_DOC] }), ['benefits.verify']);

  expect(screen.getByTestId('benefit-claim-panel')).toBeInTheDocument();
  expect(screen.getByText('CERT-001')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText('Asalarichilik uyushmasi aʼzosi')).toBeInTheDocument());
  await waitFor(() => expect(screen.getByText('Imtiyoz sertifikati')).toBeInTheDocument());
  // The other document of the application is not the claim's proof.
  expect(screen.getAllByText('staff.benefitClaim.documents.download')).toHaveLength(1);
  expect(screen.getByTestId('verify-claim-button')).toBeInTheDocument();
  expect(screen.getByTestId('open-reject-claim-modal')).toBeInTheDocument();
});

test('a pending claim offers no verify/reject action without benefits.verify, and still lists the proof', async () => {
  renderPanel(card({ status: 'IN_REVIEW', documents: [PROOF_DOC] }), ['applications.decide']);

  await screen.findByTestId('benefit-claim-panel');
  await waitFor(() => expect(screen.getByText('Imtiyoz sertifikati')).toBeInTheDocument());
  expect(screen.queryByTestId('verify-claim-button')).not.toBeInTheDocument();
  expect(screen.queryByTestId('open-reject-claim-modal')).not.toBeInTheDocument();
});

test('before the application is taken into review the verifier sees the hint, not the buttons', async () => {
  renderPanel(card({ status: 'SUBMITTED', documents: [PROOF_DOC] }), ['benefits.verify']);

  await screen.findByTestId('benefit-claim-not-in-review');
  expect(screen.queryByTestId('verify-claim-button')).not.toBeInTheDocument();
});

test('verifying posts to the verify route and a claim with no attachments shows the empty message', async () => {
  let verifyCalled = false;
  server.use(
    http.post('*/api/v1/applications/benefit-verifications/:id/verify', () => {
      verifyCalled = true;
      return HttpResponse.json(card({ benefit_verification_status: 'verified' }));
    }),
  );
  const user = userEvent.setup();
  renderPanel(card({ status: 'IN_REVIEW' }), ['benefits.verify']);

  expect(await screen.findByText('staff.benefitClaim.documents.empty')).toBeInTheDocument();
  await user.click(screen.getByTestId('verify-claim-button'));
  await waitFor(() => expect(verifyCalled).toBe(true));
});

test('rejecting with a reason posts it to the reject route', async () => {
  let receivedBody: unknown = null;
  server.use(
    http.post('*/api/v1/applications/benefit-verifications/:id/reject', async ({ request }) => {
      receivedBody = await request.json();
      return HttpResponse.json(card({ benefit_verification_status: 'rejected' }));
    }),
  );
  const user = userEvent.setup();
  renderPanel(card(), ['benefits.verify']);

  await user.click(await screen.findByTestId('open-reject-claim-modal'));
  const submit = screen.getByTestId('reject-claim-submit');
  expect(submit).toBeDisabled();
  await user.type(screen.getByTestId('reject-claim-reason'), 'Sertifikat notoʻgʻri koʻrinadi');
  expect(submit).not.toBeDisabled();
  await user.click(submit);

  await waitFor(() => expect(receivedBody).toEqual({ reason: 'Sertifikat notoʻgʻri koʻrinadi' }));
});

test('a verified claim with no verifier reads the Union-register sentence, not "decided by nobody"', async () => {
  renderPanel(card({ benefit_verification_status: 'verified', benefit_verified_by: null }), ['benefits.verify']);

  expect(await screen.findByText('staff.benefitClaim.registryVerified')).toBeInTheDocument();
  expect(screen.queryByTestId('verify-claim-button')).not.toBeInTheDocument();
});

test('a verified claim WITH a human verifier shows no register sentence', async () => {
  renderPanel(card({ benefit_verification_status: 'verified', benefit_verified_by: VERIFIER_ID }), ['benefits.verify']);

  await screen.findByTestId('benefit-claim-panel');
  expect(screen.queryByText('staff.benefitClaim.registryVerified')).not.toBeInTheDocument();
});

test('a rejected claim shows the leshoz\'s own reason', async () => {
  renderPanel(
    card({ benefit_verification_status: 'rejected', benefit_rejection_reason: 'Sertifikat muddati oʻtgan' }),
    ['benefits.verify'],
  );

  expect(await screen.findByText('Sertifikat muddati oʻtgan')).toBeInTheDocument();
  expect(screen.queryByTestId('verify-claim-button')).not.toBeInTheDocument();
});
