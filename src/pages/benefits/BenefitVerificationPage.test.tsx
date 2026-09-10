/**
 * The verifier's queue (T11 task 1). Rendering/wiring tests here; the sort
 * arithmetic itself is `format.test.ts`'s job (same split
 * `pages/dashboard/metrics.ts`'s own header comment explains) — this file
 * only proves the page actually applies `compareForQueue` to what the
 * server returns, plus the filter, the columns and the failure posture.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { I18nContext } from '../../i18n/context';
import { BenefitVerificationPage } from './BenefitVerificationPage';
import type { ApplicationOut } from './api';

const ACTIVITY_ID = 'ac000000-0000-4000-8000-000000000001';

function page<T>(items: T[]) {
  return { items, total: items.length, page: 1, page_size: 20 };
}

function claim(overrides: Partial<ApplicationOut> = {}): ApplicationOut {
  return {
    id: 'a1000000-0000-4000-8000-000000000001',
    number: 'RX-2026-000001',
    status: 'IN_REVIEW',
    applicant_id: 'p1000000-0000-4000-8000-00000000ABCD',
    submitted_by_user_id: 'p1000000-0000-4000-8000-00000000ABCD',
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

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <BenefitVerificationPage />
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

const server = setupServer(
  http.get('*/api/v1/refs/activity-types', () =>
    HttpResponse.json([{ id: ACTIVITY_ID, code: 'apiary', name: { uz_latn: 'Asalarichilik' }, quantity_unit: 'hive', status: 'active', description: null, processing_days: 5 }]),
  ),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('renders the certificate number, applicant, activity name and status for a queued claim', async () => {
  server.use(http.get('*/api/v1/applications/benefit-verifications', () => HttpResponse.json(page([claim()]))));
  renderPage();

  expect(await screen.findByText('CERT-001')).toBeInTheDocument();
  expect(await screen.findByText('Asalarichilik')).toBeInTheDocument();
  // No route resolves an applicant id to a name for this office either
  // (`format.ts::shortId`'s own docstring) — the last 8 characters of the id
  // (`applicant_id` above ends in "...00000000ABCD").
  expect(screen.getByText('0000ABCD')).toBeInTheDocument();
});

test('a pending claim sorts above an already-decided one, regardless of what order the server sent them in', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-10T10:00:00Z') });
  const decided = claim({
    id: 'decided-claim',
    benefit_certificate_no: 'CERT-DECIDED',
    benefit_verification_status: 'verified',
    benefit_verified_at: '2026-09-09T00:00:00Z',
    submitted_at: '2026-08-01T00:00:00Z',
  });
  const pending = claim({
    id: 'pending-claim',
    benefit_certificate_no: 'CERT-PENDING',
    benefit_verification_status: 'pending',
    submitted_at: '2026-09-08T00:00:00Z',
  });
  // Server order is decided-first (its own `id DESC` recency order) — the
  // page must still show the pending one first.
  server.use(http.get('*/api/v1/applications/benefit-verifications', () => HttpResponse.json(page([decided, pending]))));

  renderPage();
  await screen.findByText('CERT-DECIDED');

  const rows = screen.getAllByTestId(/^benefit-claim-open-/);
  expect(rows.map((el) => el.getAttribute('data-testid'))).toEqual([
    'benefit-claim-open-pending-claim',
    'benefit-claim-open-decided-claim',
  ]);
  vi.useRealTimers();
});

test('changing the status filter re-queries with the chosen status', async () => {
  const seenStatuses: string[] = [];
  server.use(
    http.get('*/api/v1/applications/benefit-verifications', ({ request }) => {
      const url = new URL(request.url);
      seenStatuses.push(url.searchParams.get('verification_status') ?? '');
      return HttpResponse.json(page([claim()]));
    }),
  );
  const user = userEvent.setup();
  renderPage();

  await screen.findByText('CERT-001');
  await user.selectOptions(screen.getByRole('combobox'), 'verified');

  await waitFor(() => expect(seenStatuses).toContain('verified'));
});

test('the empty state renders when there are no certificate-bearing claims', async () => {
  server.use(http.get('*/api/v1/applications/benefit-verifications', () => HttpResponse.json(page([]))));
  renderPage();
  expect(await screen.findByText('benefitVerification.empty')).toBeInTheDocument();
});

test('a failed list fetch shows a visible alert, never a silently blank screen', async () => {
  server.use(
    http.get('*/api/v1/applications/benefit-verifications', () =>
      HttpResponse.json({ error: { code: 'ERR-SYS-000', message: 'Unexpected error' } }, { status: 500 }),
    ),
  );
  renderPage();
  expect(await screen.findByRole('alert')).toBeInTheDocument();
});

test('opening a row shows its own drawer', async () => {
  server.use(
    http.get('*/api/v1/applications/benefit-verifications', () => HttpResponse.json(page([claim()]))),
    http.get('*/api/v1/applications/benefit-verifications/:id', () =>
      HttpResponse.json({ ...claim(), documents: [] }),
    ),
  );
  const user = userEvent.setup();
  renderPage();

  await user.click(await screen.findByTestId('benefit-claim-open-a1000000-0000-4000-8000-000000000001'));
  expect(await screen.findByTestId('benefit-claim-detail-a1000000-0000-4000-8000-000000000001')).toBeInTheDocument();
});
