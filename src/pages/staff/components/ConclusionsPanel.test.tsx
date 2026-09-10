/**
 * D4 — conclusions.
 *
 * Three things this panel must not get wrong:
 *   1. the GIS automatic-checks summary from the old `GisConclusionPanel`
 *      still renders (this replaces that file, not just adds to it);
 *   2. every conclusion on record renders — executor AND gis, oldest first,
 *      never "only the latest" (ruling 10, immutability);
 *   3. the write form posts `kind: "executor"` and is gated on
 *      `applications.review`, never offered to someone who lacks it.
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
import { ConclusionsPanel } from './ConclusionsPanel';
import type { ApplicationCardOut, ApplicationConclusionOut } from '../queries';

const APPLICATION_ID = 'a1000000-0000-4000-8000-000000000001';

function conclusion(over: Partial<ApplicationConclusionOut> = {}): ApplicationConclusionOut {
  return {
    id: 'c-1',
    author_id: 'u2000000-0000-4000-8000-000000000002',
    kind: 'executor',
    text: 'Hujjatlar toʻliq, veterinariya spravkasi mavjud.',
    recommendation: 'approve',
    created_at: '2026-09-02T09:00:00+05:00',
    ...over,
  };
}

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
    benefit_category_item_id: null,
    // Ruling #179 (stage 9): a benefit claim now carries its certificate and
    // the verification it is waiting on — required by the schema, so every
    // fixture states them rather than leaning on `undefined`.
    benefit_certificate_no: null,
    benefit_verification_status: 'not_required' as const,
    benefit_verified_by: null,
    benefit_verified_at: null,
    benefit_rejection_reason: null,
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
    checks: [
      {
        id: 'chk-1',
        check_type: 'gis_within_fund',
        result: 'skipped',
        details: null,
        source: 'auto',
        checked_at: '2026-09-01T10:00:00+05:00',
        created_by: 'u0000000-0000-4000-8000-000000000001',
        confirmed_by: null,
        confirmed_at: null,
      },
    ],
    calculation: null,
    sla_overdue: false,
    conclusions: [],
    ...over,
  };
}

function authValue(permissions: string[]): AuthContextValue {
  return {
    me: {
      user: {
        id: 'u0000000-0000-4000-8000-000000000001',
        full_name: 'Karimov Aziz',
        login: 'karimov',
        phone: null,
        email: null,
        must_change_password: false,
        language: 'uz_latn',
      },
      role: { code: 'executor_staff', name: {} },
      permissions,
      zone: { region_id: null, district_id: null, organization_id: 'org-1' },
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

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPanel(permissions: string[], cardOver: Partial<ApplicationCardOut> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <AuthContext.Provider value={authValue(permissions)}>
          <ConclusionsPanel card={card(cardOver)} />
        </AuthContext.Provider>
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

test('the GIS automatic-checks summary from the old panel still renders', () => {
  renderPanel([]);
  expect(screen.getByText('staff.conclusions.gisChecksTitle')).toBeInTheDocument();
  expect(screen.getByText(/fondi chegarasida/)).toBeInTheDocument();
});

test('every conclusion renders, executor and gis alike', () => {
  renderPanel([], {
    conclusions: [
      conclusion({ id: 'c-1', kind: 'executor', text: 'Ijrochi xulosasi' }),
      conclusion({ id: 'c-2', kind: 'gis', text: 'GIS xulosasi', recommendation: 'reject' }),
    ],
  });
  expect(screen.getByText('Ijrochi xulosasi')).toBeInTheDocument();
  expect(screen.getByText('GIS xulosasi')).toBeInTheDocument();
});

test('the write form is hidden without applications.review', () => {
  renderPanel([]);
  expect(screen.queryByText('staff.conclusions.submitButton')).not.toBeInTheDocument();
});

test('submitting posts kind "executor" to the 3.9b conclusion route', async () => {
  const user = userEvent.setup();
  let sentBody: unknown;
  server.use(
    http.post('*/api/v1/applications/:id/conclusion', async ({ request }) => {
      sentBody = await request.json();
      return HttpResponse.json(conclusion({ text: 'Yangi xulosa' }), { status: 201 });
    }),
  );

  renderPanel(['applications.review']);
  await user.type(screen.getByPlaceholderText('staff.conclusions.writePlaceholder'), 'Yangi xulosa');
  await user.click(screen.getByText('staff.conclusions.submitButton'));

  await waitFor(() =>
    expect(sentBody).toEqual({ kind: 'executor', text: 'Yangi xulosa', recommendation: null }),
  );
});
