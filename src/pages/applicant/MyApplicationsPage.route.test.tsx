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
