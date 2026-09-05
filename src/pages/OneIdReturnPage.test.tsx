import { StrictMode } from 'react';
import { render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { beforeEach } from 'vitest';
import App from '../App';
import { ONEID_NEXT_KEY } from '../auth/AuthProvider';
import { resetOneIdReturnCache } from './oneIdReturnCache';

// ME and the server setup mirror LoginPage.test.tsx — a session EXISTS here,
// because the browser arrives on this route already carrying the cookies the
// backend callback set.
const ME = {
  user: {
    id: '11111111-1111-1111-1111-111111111111',
    full_name: 'Fuqaro Test',
    login: null,
    phone: '+998901234567',
    email: null,
    must_change_password: false,
    language: 'uz',
  },
  role: { code: 'applicant', name: { uz_cyrl: 'Ariza beruvchi' } },
  // `applications.create` — the wizard's own gate in `routes.tsx` — so the
  // first test below lands where a real citizen actually can: on the
  // wizard, not bounced to `Forbidden` by an under-permissioned fixture.
  permissions: ['applications.create'],
  zone: { region_id: null, district_id: null, organization_id: null },
  csrf_token: 'tok-1',
  is_superuser: false,
  applicant: null,
  representations: [],
  registration_complete: true,
};

const server = setupServer(
  http.get('*/auth/me', () => HttpResponse.json(ME)),
  http.get('*/notifications/unread-count', () => HttpResponse.json({ count: 0 })),
);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// The page caches its answer for the whole page load (StrictMode renders it
// twice); each test is a fresh "page load" and must say so.
beforeEach(() => {
  resetOneIdReturnCache();
  sessionStorage.clear();
});

/**
 * `routes.tsx`'s `router` is a module-level `createBrowserRouter` singleton
 * that self-initialises (and attaches its `popstate` listener) once, at
 * import time — well before any test body runs. A bare
 * `window.history.pushState()` moves `window.location` but the router never
 * hears about it (only its own `navigate`/`<Navigate>` calls, or a real
 * `popstate` event, make it re-derive the matched route), so the app would
 * keep rendering whatever it matched at import time. Dispatching `popstate`
 * ourselves is the same signal a real browser back/forward navigation sends,
 * and is what makes the router pick up the path we just pushed.
 */
function arriveAt(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

it('sends the citizen on to the page they originally asked for', async () => {
  sessionStorage.setItem(ONEID_NEXT_KEY, '/my/applications/new');
  arriveAt('/auth/oneid/return');
  render(<App />);
  await waitFor(() => expect(window.location.pathname).toBe('/my/applications/new'));
  // Consumed, not left behind: a second, unrelated login must not be hijacked.
  expect(sessionStorage.getItem(ONEID_NEXT_KEY)).toBeNull();
});

it('falls back to the dashboard when nothing was remembered', async () => {
  arriveAt('/auth/oneid/return');
  render(<App />);
  await waitFor(() => expect(window.location.pathname).toBe('/'));
});

it('refuses an absolute URL in storage and goes to the dashboard', async () => {
  sessionStorage.setItem(ONEID_NEXT_KEY, 'https://evil.example/steal');
  arriveAt('/auth/oneid/return');
  render(<App />);
  await waitFor(() => expect(window.location.pathname).toBe('/'));
});

// The interesting case: a protocol-relative URL passes `startsWith('/')` —
// it needs the explicit `startsWith('//')` check `takeNext` also applies, or
// the browser would be sent off-origin to whatever host follows the slashes.
it('refuses a protocol-relative URL in storage and goes to the dashboard', async () => {
  sessionStorage.setItem(ONEID_NEXT_KEY, '//evil.example/steal');
  arriveAt('/auth/oneid/return');
  render(<App />);
  await waitFor(() => expect(window.location.pathname).toBe('/'));
});

// The regression this page's module cache exists for. `main.tsx` wraps the
// app in StrictMode, which renders every component twice: a naive
// read-and-delete gives the second render nothing, and the second answer is
// the one that lands — so the citizen would be sent to the dashboard in dev
// and to the right page in prod. Rendered here inside StrictMode explicitly,
// because `render(<App />)` above is not.
it('survives StrictMode double rendering', async () => {
  sessionStorage.setItem(ONEID_NEXT_KEY, '/my/permits');
  arriveAt('/auth/oneid/return');
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  await waitFor(() => expect(window.location.pathname).toBe('/my/permits'));
});
