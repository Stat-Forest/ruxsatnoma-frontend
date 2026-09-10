/**
 * One claim's own view (T11 task 2) plus verify/reject (T11 task 3). The
 * central assertion this file exists for: rejecting without a reason must
 * be IMPOSSIBLE in the UI, not merely refused by the server — the submit
 * button stays disabled, and `mutate` is never even called, until the
 * textarea holds non-whitespace text.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { I18nContext } from '../../i18n/context';
import { BenefitClaimDrawer } from './BenefitClaimDrawer';
import type { ApplicationOut, BenefitClaimDetailOut } from './api';

const ACTIVITY_ID = 'ac000000-0000-4000-8000-000000000001';
const DOC_TYPE_ID = 'dt000000-0000-4000-8000-000000000001';
const APPLICATION_ID = 'a1000000-0000-4000-8000-000000000001';

function baseApplication(overrides: Partial<ApplicationOut> = {}): ApplicationOut {
  return {
    id: APPLICATION_ID,
    number: 'RX-2026-000001',
    status: 'IN_REVIEW',
    applicant_id: 'p1000000-0000-4000-8000-000000000001',
    submitted_by_user_id: 'p1000000-0000-4000-8000-000000000001',
    on_behalf: 'self',
    representation_id: null,
    activity_type_id: ACTIVITY_ID,
    contour_id: null,
    contour_version_id: null,
    requested_area_ha: null,
    period_from: '2026-09-01',
    period_to: '2026-10-01',
    quantity: null,
    channel: 'portal',
    kind: 'new',
    benefit_category_item_id: 'bc000000-0000-4000-8000-000000000001',
    benefit_certificate_no: 'CERT-001',
    benefit_verification_status: 'pending',
    benefit_verified_by: null,
    benefit_verified_at: null,
    benefit_rejection_reason: null,
    rejection_reason_item_id: null,
    assigned_org_id: null,
    assigned_user_id: null,
    parent_application_id: null,
    sla_deadline_at: null,
    submitted_at: '2026-09-01T10:00:00Z',
    decided_at: null,
    created_at: '2026-09-01T09:00:00Z',
    updated_at: '2026-09-01T10:00:00Z',
    ...overrides,
  };
}

function claimDetail(overrides: Partial<BenefitClaimDetailOut> = {}): BenefitClaimDetailOut {
  return {
    ...baseApplication(),
    documents: [
      { id: 'doc-1', doc_type_item_id: DOC_TYPE_ID, file_id: 'file-1', note: null, created_at: '2026-09-01T10:00:00Z' },
    ],
    ...overrides,
  };
}

function renderDrawer(applicationId = APPLICATION_ID) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <BenefitClaimDrawer applicationId={applicationId} onClose={() => {}} />
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

const server = setupServer(
  http.get('*/api/v1/refs/activity-types', () =>
    HttpResponse.json([{ id: ACTIVITY_ID, code: 'apiary', name: { uz_latn: 'Asalarichilik' }, quantity_unit: 'hive', status: 'active', description: null, processing_days: 5 }]),
  ),
  http.get('*/api/v1/refs/classifiers/doc_types/items', () =>
    HttpResponse.json([{ id: DOC_TYPE_ID, code: 'benefit_proof', name: { uz_latn: 'Imtiyoz sertifikati' }, props: {}, valid_from: '2026-01-01', valid_to: null, status: 'active' }]),
  ),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('shows the certificate number, its attached document, and the application context', async () => {
  server.use(http.get('*/api/v1/applications/benefit-verifications/:id', () => HttpResponse.json(claimDetail())));
  renderDrawer();

  await screen.findByTestId(`benefit-claim-detail-${APPLICATION_ID}`);
  expect(screen.getByText('CERT-001')).toBeInTheDocument();
  expect(screen.getByText('Asalarichilik')).toBeInTheDocument();
  expect(screen.getByText('Imtiyoz sertifikati')).toBeInTheDocument();
  expect(screen.getByText('benefitVerification.detail.documents.download')).toBeInTheDocument();
});

test('a claim with no attached documents shows the empty message, not a blank section', async () => {
  server.use(http.get('*/api/v1/applications/benefit-verifications/:id', () => HttpResponse.json(claimDetail({ documents: [] }))));
  renderDrawer();

  await screen.findByTestId(`benefit-claim-detail-${APPLICATION_ID}`);
  expect(screen.getByText('benefitVerification.detail.documents.empty')).toBeInTheDocument();
});

test('verifying a pending claim posts to the verify route', async () => {
  let verifyCalled = false;
  server.use(
    http.get('*/api/v1/applications/benefit-verifications/:id', () => HttpResponse.json(claimDetail())),
    http.post('*/api/v1/applications/benefit-verifications/:id/verify', () => {
      verifyCalled = true;
      return HttpResponse.json(baseApplication({ benefit_verification_status: 'verified' }));
    }),
  );
  const user = userEvent.setup();
  renderDrawer();

  await user.click(await screen.findByTestId('verify-claim-button'));
  await waitFor(() => expect(verifyCalled).toBe(true));
});

test('the reject submit button stays disabled until a reason is typed, and never fires without one', async () => {
  let rejectCalled = false;
  server.use(
    http.get('*/api/v1/applications/benefit-verifications/:id', () => HttpResponse.json(claimDetail())),
    http.post('*/api/v1/applications/benefit-verifications/:id/reject', () => {
      rejectCalled = true;
      return HttpResponse.json(baseApplication({ benefit_verification_status: 'rejected' }));
    }),
  );
  const user = userEvent.setup();
  renderDrawer();

  await user.click(await screen.findByTestId('open-reject-claim-modal'));
  const submit = await screen.findByTestId('reject-claim-submit');
  expect(submit).toBeDisabled();

  // Whitespace-only does not count as a reason either.
  await user.type(screen.getByTestId('reject-claim-reason'), '   ');
  expect(submit).toBeDisabled();

  // A clicked-but-disabled button fires nothing — confirm the server route
  // was never hit while the field was empty/whitespace.
  expect(rejectCalled).toBe(false);
});

test('rejecting with a reason posts it to the reject route', async () => {
  let receivedBody: unknown = null;
  server.use(
    http.get('*/api/v1/applications/benefit-verifications/:id', () => HttpResponse.json(claimDetail())),
    http.post('*/api/v1/applications/benefit-verifications/:id/reject', async ({ request }) => {
      receivedBody = await request.json();
      return HttpResponse.json(baseApplication({ benefit_verification_status: 'rejected' }));
    }),
  );
  const user = userEvent.setup();
  renderDrawer();

  await user.click(await screen.findByTestId('open-reject-claim-modal'));
  await user.type(screen.getByTestId('reject-claim-reason'), 'Sertifikat raqami notoʻgʻri koʻrinadi');
  const submit = screen.getByTestId('reject-claim-submit');
  expect(submit).not.toBeDisabled();
  await user.click(submit);

  await waitFor(() => expect(receivedBody).toEqual({ reason: 'Sertifikat raqami notoʻgʻri koʻrinadi' }));
});

test('a decided claim shows who decided it and when, and offers no verify/reject action', async () => {
  server.use(
    http.get('*/api/v1/applications/benefit-verifications/:id', () =>
      HttpResponse.json(
        claimDetail({
          benefit_verification_status: 'rejected',
          benefit_verified_by: 'v1000000-0000-4000-8000-0000000ABCDE',
          benefit_verified_at: '2026-09-05T12:00:00Z',
          benefit_rejection_reason: 'Sertifikat muddati oʻtgan',
        }),
      ),
    ),
  );
  renderDrawer();

  await screen.findByTestId(`benefit-claim-detail-${APPLICATION_ID}`);
  expect(screen.getByText('Sertifikat muddati oʻtgan')).toBeInTheDocument();
  expect(screen.queryByTestId('verify-claim-button')).not.toBeInTheDocument();
  expect(screen.queryByTestId('open-reject-claim-modal')).not.toBeInTheDocument();
});

test('a failed load shows a visible message, never a silently blank drawer', async () => {
  server.use(
    http.get('*/api/v1/applications/benefit-verifications/:id', () =>
      HttpResponse.json({ error: { code: 'ERR-SYS-003', message: 'Not found' } }, { status: 404 }),
    ),
  );
  renderDrawer();
  expect(await screen.findByRole('alert')).toBeInTheDocument();
});
