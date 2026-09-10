/**
 * Stage 9, T3, item 1 (Odilxon's remark 1, demo of 2026-09-10) — full
 * App-level rendering, the way `OneIdReturnPage.test.tsx` already exercises
 * `routes.tsx`'s `router`, so this proves the actual wiring (`NAVIGATION`'s
 * `applications.create` permission flowing through `routes.tsx`'s
 * `RequireAuth`), not just the two pieces in isolation.
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
  http.get('*/api/v1/applications', () => HttpResponse.json(page([]))),
  http.get('*/api/v1/refs/activity-types', () => HttpResponse.json([])),
);
// `onUnhandledRequest: 'error'` — see `OneIdReturnPage.test.tsx` for why this
// matters: without it, an unmocked request silently falls through to
// whatever is reachable at the real `BASE_URL` instead of failing loudly.
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
  // Reviews and decides applications, but never FILES one — exactly the
  // role the demo caught seeing "My applications" and its "New application"
  // button, which then failed with a 403 on the wizard's first call.
  permissions: ['applications.review', 'applications.decide'],
  zone: { region_id: null, district_id: null, organization_id: null },
  csrf_token: 'tok-1',
  is_superuser: false,
  applicant: null,
  representations: [],
  registration_complete: true,
};

const APPLICANT_ME = {
  user: {
    id: '11111111-1111-1111-1111-111111111111',
    full_name: 'Fuqaro Test',
    login: null,
    phone: '+998901234567',
    email: null,
    must_change_password: false,
    language: 'uz_latn',
  },
  role: { code: 'applicant', name: { uz_cyrl: 'Ariza beruvchi' } },
  permissions: ['applications.create'],
  zone: { region_id: null, district_id: null, organization_id: null },
  csrf_token: 'tok-2',
  is_superuser: false,
  applicant: null,
  representations: [],
  registration_complete: true,
};

test('a staff account without applications.create cannot reach /my/applications', async () => {
  server.use(http.get('*/auth/me', () => HttpResponse.json(STAFF_ME)));
  arriveAt('/my/applications');
  render(<App />);

  await waitFor(() => expect(screen.getByTestId('forbidden')).toBeInTheDocument());
  // The list itself, and its "New application" button, never render.
  expect(screen.queryByText(/Yangi ariza topshirish/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Mening arizalarim/)).not.toBeInTheDocument();
});

test('the applicant (holding applications.create) reaches the list normally', async () => {
  server.use(http.get('*/auth/me', () => HttpResponse.json(APPLICANT_ME)));
  arriveAt('/my/applications');
  render(<App />);

  await waitFor(() => expect(screen.getByRole('heading', { name: 'Mening arizalarim' })).toBeInTheDocument());
  expect(screen.getByText('Yangi ariza topshirish')).toBeInTheDocument();
  expect(screen.queryByTestId('forbidden')).not.toBeInTheDocument();
});

// Found on the dev stand, 2026-09-10, right after the gate above landed:
// `admin` (sys_admin) still opened this list — with all 22 applications in
// the system under the heading «My applications», next to the staff
// «Applications» — and its «New application» button, for an account with
// no applicant profile behind it. The citizen's own cabinet is the one
// place the superuser must not reach — and NOT because a code is missing:
// the live `/auth/me` answers `sys_admin` with every code in the registry
// (`auth/router.py`: `sorted(PERMISSIONS) if is_superuser`), so a fixture
// with `permissions: []` proved nothing (PR #56 shipped green and changed
// nothing on the stand). `applications.create` is deliberately IN here.
const SYSADMIN_ME = {
  ...STAFF_ME,
  user: { ...STAFF_ME.user, id: '33333333-3333-3333-3333-333333333333', full_name: 'Admin Test', login: 'admin' },
  role: { code: 'sys_admin', name: { uz_cyrl: 'Tizim administratori' } },
  permissions: ['applications.create', 'applications.review', 'applications.decide', 'auth.users.manage'],
  is_superuser: true,
};

test('the superuser cannot reach /my/applications either', async () => {
  server.use(http.get('*/auth/me', () => HttpResponse.json(SYSADMIN_ME)));
  arriveAt('/my/applications');
  render(<App />);

  await waitFor(() => expect(screen.getByTestId('forbidden')).toBeInTheDocument());
  expect(screen.queryByText(/Yangi ariza topshirish/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Mening arizalarim/)).not.toBeInTheDocument();
});

// Refused all the same, but the wizard's refusal is a redirect to the
// dashboard, not the «no right to this page» notice: the public landing
// links every visitor to this path from its "Ariza topshirish" buttons,
// signed in as whatever they are (`RequireAuth`'s `forbidden` prop).
test('nor the wizard behind its «New application» button', async () => {
  server.use(
    http.get('*/auth/me', () => HttpResponse.json(SYSADMIN_ME)),
    http.get('*/api/v1/permits', () => HttpResponse.json(page([]))),
    http.get('*/api/v1/invoices', () => HttpResponse.json(page([]))),
  );
  arriveAt('/my/applications/new');
  render(<App />);

  await waitFor(() => expect(window.location.pathname).toBe('/'));
  expect(await screen.findByTestId('app-shell')).toBeInTheDocument();
  expect(screen.queryByTestId('forbidden')).not.toBeInTheDocument();
  expect(screen.queryByText(/Yangi ariza/)).not.toBeInTheDocument();
});
