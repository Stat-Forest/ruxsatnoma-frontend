/**
 * Full App-level rendering (`routes.tsx`'s actual `router`, the way
 * `MyApplicationsPage.route.test.tsx` already exercises this for its own
 * gated route) — proves the real wiring end to end: `NAVIGATION`'s
 * `benefits.verify` permission flowing through `RequireAuth`, not just the
 * two pieces checked in isolation. This is the test the task brief asks
 * for by name: a user WITHOUT `benefits.verify` cannot reach this section.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import App from '../../App';

function page<T>(items: T[]) {
  return { items, total: items.length, page: 1, page_size: 100 };
}

const server = setupServer(
  http.get('*/notifications/unread-count', () => HttpResponse.json({ count: 0 })),
  http.get('*/api/v1/applications/benefit-verifications', () => HttpResponse.json(page([]))),
  http.get('*/api/v1/refs/activity-types', () => HttpResponse.json([])),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** See `OneIdReturnPage.test.tsx` for why a bare `pushState` is not enough:
 *  `routes.tsx`'s `router` is a module-level singleton that only re-derives
 *  the matched route on its own `navigate`/`<Navigate>` calls or a real
 *  `popstate` event. */
function arriveAt(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

const STAFF_ME = {
  user: {
    id: '22222222-2222-2222-2222-222222222222',
    full_name: 'Ijrochi Test',
    login: 'executor',
    phone: null,
    email: null,
    must_change_password: false,
    language: 'uz_latn',
  },
  role: { code: 'executor_staff', name: { uz_cyrl: 'Ijrochi' } },
  // Ordinary staff — reviews and decides applications, holds no
  // `benefits.verify` at all. This is the role that must be refused.
  permissions: ['applications.review', 'applications.decide'],
  zone: { region_id: null, district_id: null, organization_id: null },
  csrf_token: 'tok-1',
  is_superuser: false,
  applicant: null,
  representations: [],
  registration_complete: true,
};

const VERIFIER_ME = {
  user: {
    id: '33333333-3333-3333-3333-333333333333',
    full_name: 'Tekshiruvchi Test',
    login: 'verifier',
    phone: null,
    email: null,
    must_change_password: false,
    language: 'uz_latn',
  },
  // Central office role from migration 0051 — no zone, one permission.
  role: { code: 'benefit_verifier', name: { uz_cyrl: 'Имтиёзларни текширувчи' } },
  permissions: ['benefits.verify'],
  zone: { region_id: null, district_id: null, organization_id: null },
  csrf_token: 'tok-2',
  is_superuser: false,
  applicant: null,
  representations: [],
  registration_complete: true,
};

test('a staff account without benefits.verify cannot reach /benefits/verification', async () => {
  server.use(http.get('*/auth/me', () => HttpResponse.json(STAFF_ME)));
  arriveAt('/benefits/verification');
  render(<App />);

  await waitFor(() => expect(screen.getByTestId('forbidden')).toBeInTheDocument());
  expect(screen.queryByTestId('benefit-verification-page')).not.toBeInTheDocument();
});

test('a benefit_verifier account (holding benefits.verify) reaches the queue normally', async () => {
  server.use(http.get('*/auth/me', () => HttpResponse.json(VERIFIER_ME)));
  arriveAt('/benefits/verification');
  render(<App />);

  await waitFor(() => expect(screen.getByTestId('benefit-verification-page')).toBeInTheDocument());
  expect(screen.queryByTestId('forbidden')).not.toBeInTheDocument();
});

test('the nav item is withheld from ordinary staff', async () => {
  server.use(http.get('*/auth/me', () => HttpResponse.json(STAFF_ME)));
  arriveAt('/');
  render(<App />);

  // uz_latn's own `nav.benefitVerification` text (`i18n/uz_latn.ts`) — the
  // real dictionary, through the real `I18nProvider`, not a stub. Wait for
  // an always-visible, ungated nav entry first, so the sidebar has actually
  // finished rendering before checking what it left out.
  await screen.findAllByText('Profil');
  expect(screen.queryByText('Imtiyozlarni tekshirish')).not.toBeInTheDocument();
});

test('the nav item is offered to a benefits.verify holder', async () => {
  server.use(http.get('*/auth/me', () => HttpResponse.json(VERIFIER_ME)));
  arriveAt('/');
  render(<App />);

  // `AppShell` renders the link list twice at once (the persistent desktop
  // sidebar and the mobile drawer, `Nav.tsx`'s own docstring) — `findAll`,
  // same as the "Profil" wait above, not a singular `findByText`.
  expect((await screen.findAllByText('Imtiyozlarni tekshirish')).length).toBeGreaterThan(0);
});
