/**
 * I1 — the prosecutor reaches this SAME worklist screen (no new page, see
 * `docs/plans/06.5-staff-tails.md`). Two things this test file pins:
 *   1. a caller holding only `applications.view_any` (never `.review`) sees
 *      the register but no "Ishga olish" action — read-only, honestly;
 *   2. "CSV eksport" fetches every matching page (not just the one on
 *      screen) and hands the browser a real file.
 *
 * A third (F11, `docs/plans/07.3-findings.md`, first sighting): after
 * "Ishga olish" the row must show the new status on its own, never leave the
 * reader waiting for a manual reload. `useStartReviewRow` (`./queries.ts`)
 * already invalidates `['staff', 'applications']` on success; this pins that
 * behaviour at the screen the walkthrough actually watched.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';
import { stubAuthActions } from '../../auth/testAuthActions';
import { I18nContext } from '../../i18n/context';
import { ApplicationsListPage } from './ApplicationsListPage';
import type { ApplicationOut } from './queries';

function row(over: Partial<ApplicationOut> = {}): ApplicationOut {
  return {
    id: 'a1000000-0000-4000-8000-000000000001',
    number: 'RX-2026-000001',
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
    assigned_user_id: null,
    parent_application_id: null,
    sla_deadline_at: null,
    submitted_at: '2026-09-01T10:00:00+05:00',
    decided_at: null,
    created_at: '2026-09-01T10:00:00+05:00',
    updated_at: '2026-09-01T10:00:00+05:00',
    ...over,
  };
}

function authValue(permissions: string[]): AuthContextValue {
  return {
    me: {
      user: {
        id: 'u0000000-0000-4000-8000-000000000001',
        full_name: 'Nazarov Sherzod',
        login: 'prosecutor1',
        phone: null,
        email: null,
        must_change_password: false,
        pinfl: null,
        language: 'uz_latn',
      },
      role: { code: 'prosecutor', name: {} },
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
  http.get('*/api/v1/refs/activity-types', () => HttpResponse.json([])),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPage(permissions: string[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <AuthContext.Provider value={authValue(permissions)}>
          <MemoryRouter>
            <ApplicationsListPage />
          </MemoryRouter>
        </AuthContext.Provider>
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

test('a prosecutor (applications.view_any, never .review) sees rows but no "Ishga olish" action', async () => {
  server.use(
    http.get('*/api/v1/applications', () =>
      HttpResponse.json({ items: [row({ status: 'SUBMITTED' })], total: 1, page: 1, page_size: 20 }),
    ),
  );

  renderPage(['applications.view_any']);
  expect(await screen.findByText('RX-2026-000001')).toBeInTheDocument();
  expect(screen.queryByText('Ishga olish')).not.toBeInTheDocument();
});

test('a worklist row shows the new status right after "Ishga olish", with no reload', async () => {
  const user = userEvent.setup();
  let status: ApplicationOut['status'] = 'SUBMITTED';
  server.use(
    http.get('*/api/v1/applications', () =>
      HttpResponse.json({ items: [row({ status })], total: 1, page: 1, page_size: 20 }),
    ),
    http.post('*/api/v1/applications/:id/start-review', () => {
      status = 'IN_REVIEW';
      return HttpResponse.json(row({ status: 'IN_REVIEW' }));
    }),
  );

  renderPage(['applications.review']);
  const tableRow = (await screen.findByText('RX-2026-000001')).closest('tr')!;
  expect(within(tableRow).getByText(/Yuborilgan/)).toBeInTheDocument();

  await user.click(within(tableRow).getByText('Ishga olish'));

  await waitFor(() => expect(within(tableRow).getByText(/Koʻrib chiqilmoqda/)).toBeInTheDocument());
  expect(within(tableRow).queryByText('Ishga olish')).not.toBeInTheDocument();
});

test('CSV export requests the server\'s own page-size ceiling (100), not the on-screen page size (20), and downloads one file', async () => {
  const user = userEvent.setup();
  const requestedPageSizes: string[] = [];
  server.use(
    http.get('*/api/v1/applications', ({ request }) => {
      const url = new URL(request.url);
      requestedPageSizes.push(url.searchParams.get('page_size') ?? '');
      return HttpResponse.json({
        items: [row({ id: 'a-1', number: 'RX-1' })],
        total: 1,
        page: 1,
        page_size: 20,
      });
    }),
  );

  // jsdom's URL has no createObjectURL/revokeObjectURL at all — assigned
  // directly (never `vi.stubGlobal('URL', {...})`, which would replace the
  // constructor itself and break MSW's own `new URL(request.url)` parsing).
  const createObjectURL = vi.fn().mockReturnValue('blob:mock');
  const revokeObjectURL = vi.fn();
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  renderPage(['applications.view_any']);
  await screen.findByText('RX-1'); // the on-screen load, requested with page_size=20

  await user.click(screen.getByText('prosecutor.exportCsv'));

  await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  expect(clickSpy).toHaveBeenCalled();
  expect(requestedPageSizes).toContain('20'); // the on-screen table
  expect(requestedPageSizes).toContain('100'); // the export's own fetch
});
