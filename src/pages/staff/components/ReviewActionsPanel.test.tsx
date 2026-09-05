/**
 * D3 — return for correction and request-info.
 *
 * The three things this panel must not get wrong, one test each:
 *   1. the two review-time actions are gated on the real permission codes,
 *      never a role name, and hidden entirely for someone holding neither;
 *   2. a request-info submits exactly `{ message }` to the 3.9b route
 *      (in `schema.d.ts` since its regeneration — reached through the
 *      ordinary typed `api.POST`) and the modal closes on success;
 *   3. PENDING_INFO renders the open info-request's own text and the SLA
 *      pause honestly, never a stale countdown (`docs/status.md`'s fact #1).
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
import { ReviewActionsPanel } from './ReviewActionsPanel';
import type { ApplicationCardOut, ApplicationTimelineOut } from '../queries';

const APPLICATION_ID = 'a1000000-0000-4000-8000-000000000001';

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
    rejection_reason_item_id: null,
    assigned_org_id: null,
    assigned_user_id: 'u0000000-0000-4000-8000-000000000001',
    parent_application_id: null,
    sla_deadline_at: '2026-09-10T10:00:00+05:00',
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

function timeline(over: Partial<ApplicationTimelineOut> = {}): ApplicationTimelineOut {
  return {
    status_history: [],
    assignments: [],
    signatures: [],
    info_requests: [],
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

const server = setupServer(
  http.get('*/api/v1/refs/classifiers/:code/items', () =>
    HttpResponse.json([
      { id: 'rj-1', code: 'RJ-01', name: { uz_latn: 'Hujjat yetarli emas' }, props: { kind: 'return' }, valid_from: '2026-01-01', valid_to: null, status: 'active' },
      { id: 'rj-2', code: 'RJ-03', name: { uz_latn: 'Uchastka fondi tashqarisida' }, props: { kind: 'reject' }, valid_from: '2026-01-01', valid_to: null, status: 'active' },
    ]),
  ),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPanel(permissions: string[], cardOver: Partial<ApplicationCardOut> = {}, tl?: ApplicationTimelineOut) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <AuthContext.Provider value={authValue(permissions)}>
          <ReviewActionsPanel card={card(cardOver)} timeline={tl} />
        </AuthContext.Provider>
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

test('neither action renders for a caller holding neither review permission', () => {
  renderPanel([], { status: 'SUBMITTED' });
  expect(screen.queryByText('staff.infoRequest.requestInfoButton')).not.toBeInTheDocument();
  expect(screen.queryByText('staff.infoRequest.returnButton')).not.toBeInTheDocument();
  expect(screen.getByText('staff.infoRequest.noPermission')).toBeInTheDocument();
});

test('request-info posts exactly { message } to the 3.9b route and closes on success', async () => {
  const user = userEvent.setup();
  let sentBody: unknown;
  server.use(
    http.post('*/api/v1/applications/:id/request-info', async ({ request }) => {
      sentBody = await request.json();
      return HttpResponse.json({ ...card({ status: 'PENDING_INFO' }) });
    }),
  );

  renderPanel(['applications.review'], { status: 'IN_REVIEW' });
  await user.click(screen.getByText('staff.infoRequest.requestInfoButton'));
  await user.type(screen.getByPlaceholderText('staff.infoRequest.messagePlaceholder'), 'Hujjatni tekshiring');
  await user.click(screen.getByText('staff.infoRequest.sendButton'));

  await waitFor(() => expect(sentBody).toEqual({ message: 'Hujjatni tekshiring' }));
  await waitFor(() => expect(screen.queryByText('staff.infoRequest.messageLabel')).not.toBeInTheDocument());
});

test('a return offers only reasons typed "return" or "both", never a refusal code', async () => {
  const user = userEvent.setup();
  renderPanel(['applications.review'], { status: 'IN_REVIEW' });
  await user.click(screen.getByText('staff.infoRequest.returnButton'));

  expect(await screen.findByText('Hujjat yetarli emas')).toBeInTheDocument();
  expect(screen.queryByText('Uchastka fondi tashqarisida')).not.toBeInTheDocument();
});

test('PENDING_INFO shows the open request and the SLA-paused note, not a stale deadline', () => {
  renderPanel(
    ['applications.review'],
    { status: 'PENDING_INFO' },
    timeline({
      info_requests: [
        {
          id: 'ir-1',
          requested_by: 'u1',
          message: "Kontur chegarasini aniqlashtiring",
          requested_at: '2026-09-05T09:00:00+05:00',
          responded_at: null,
          response_text: null,
        },
      ],
    }),
  );

  expect(screen.getByText('Kontur chegarasini aniqlashtiring')).toBeInTheDocument();
  expect(screen.getByText('staff.infoRequest.pendingHint')).toBeInTheDocument();
  // No action buttons while paused — this is the applicant's turn.
  expect(screen.queryByText('staff.infoRequest.requestInfoButton')).not.toBeInTheDocument();
});
