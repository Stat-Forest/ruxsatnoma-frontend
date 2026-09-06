import { useState } from 'react';
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import App from '../App';
import { api, setCsrfToken } from '../api/client';
import { navigation } from '../lib/navigation';
import { router } from '../routes';
import { AuthProvider, ONEID_NEXT_KEY } from './AuthProvider';
import { useAuth } from './useAuth';

const ME = {
  user: {
    id: '11111111-1111-1111-1111-111111111111',
    full_name: 'Boshliq Test',
    login: 'ehead',
    phone: null,
    email: null,
    must_change_password: false,
    language: 'uz',
  },
  role: { code: 'executor_head', name: { uz_cyrl: "Ijrochi boshlig'i" } },
  permissions: ['applications.view_any', 'auth.users.manage'],
  zone: { region_id: null, district_id: null, organization_id: null },
  csrf_token: 'tok-1',
  is_superuser: false,
  applicant: null,
  representations: [],
  registration_complete: true,
};

function Probe() {
  const { me, loading, authError } = useAuth();
  if (loading) return null;
  if (authError) return <div data-testid="auth-error">{authError.code}</div>;
  if (!me) return <div data-testid="anonymous" />;
  return <div data-testid="who">{me.role.code}</div>;
}

/** Calls verifyMfa on click, without ever calling requestMfa first. */
function MfaOrderProbe() {
  const { verifyMfa } = useAuth();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        onClick={() => {
          verifyMfa('123456').catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
        }}
      >
        verify
      </button>
      {error && <div data-testid="mfa-order-error">{error}</div>}
    </div>
  );
}

// Default handlers for the two calls `AppShell` fires the moment it mounts
// (the superuser test below reaches it) — without them, MSW's default
// pass-through sends the request to whatever is *actually* listening on
// `localhost:8000` (a live backend, in this environment), which answers
// unauthenticated and drags a real, unpredictably-timed `ERR-AUTH-002` into
// this file's session-gone handling, racing later tests that share the same
// module-level client state. Overridable per test via `server.use(...)`.
const server = setupServer(
  http.get('*/notifications/unread-count', () => HttpResponse.json({ count: 0 })),
  http.post('*/auth/logout', () => new HttpResponse(null, { status: 204 })),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  setCsrfToken(null);
});
afterAll(() => server.close());

async function renderAt(path: string) {
  await router.navigate(path);
  return render(<App />);
}

test('a page load with a live cookie restores the session without logging in again', async () => {
  server.use(http.get('*/auth/me', () => HttpResponse.json(ME)));
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  expect(await screen.findByTestId('who')).toHaveTextContent('executor_head');
});

test('the CSRF token from /auth/me reaches the client', async () => {
  server.use(http.get('*/auth/me', () => HttpResponse.json({ ...ME, csrf_token: 'tok-xyz' })));
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await screen.findByTestId('who');
  let seen: string | null = null;
  server.use(
    http.post('*/auth/logout', ({ request }) => {
      seen = request.headers.get('X-CSRF-Token');
      return new HttpResponse(null, { status: 204 });
    }),
  );
  await api.POST('/api/v1/auth/logout', {});
  expect(seen).toBe('tok-xyz');
});

test('no session is not an error state, it is the logged-out state', async () => {
  server.use(
    http.get('*/auth/me', () =>
      HttpResponse.json({ error: { code: 'ERR-AUTH-002', message: 'no session' } }, { status: 401 }),
    ),
  );
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  expect(await screen.findByTestId('anonymous')).toBeInTheDocument();
});

test('a /auth/me failure other than ERR-AUTH-002 is not silently treated as logged out', async () => {
  server.use(
    http.get('*/auth/me', () =>
      HttpResponse.json({ error: { code: 'ERR-SYS-001', message: 'internal error' } }, { status: 500 }),
    ),
  );
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  expect(await screen.findByTestId('auth-error')).toHaveTextContent('ERR-SYS-001');
  expect(screen.queryByTestId('anonymous')).not.toBeInTheDocument();
});

test('verifyMfa before requestMfa fails locally instead of sending an empty token to the server', async () => {
  server.use(
    http.get('*/auth/me', () =>
      HttpResponse.json({ error: { code: 'ERR-AUTH-002', message: 'no session' } }, { status: 401 }),
    ),
  );
  let sawVerifyRequest = false;
  server.use(
    http.post('*/auth/mfa/verify', () => {
      sawVerifyRequest = true;
      return HttpResponse.json(ME);
    }),
  );
  render(
    <AuthProvider>
      <MfaOrderProbe />
    </AuthProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'verify' }));
  expect(await screen.findByTestId('mfa-order-error')).toBeInTheDocument();
  expect(sawVerifyRequest).toBe(false);
});

test('RequireAuth sends an anonymous visitor to /login and keeps where they wanted to go', async () => {
  server.use(
    http.get('*/auth/me', () =>
      HttpResponse.json({ error: { code: 'ERR-AUTH-002', message: '' } }, { status: 401 }),
    ),
  );
  await renderAt('/applications/42');
  expect(await screen.findByTestId('login-page')).toBeInTheDocument();
  expect(screen.getByTestId('login-page')).toHaveAttribute('data-next', '/applications/42');
});

test('RequireAuth shows a distinct notice for a failed session check, not a silent redirect to login', async () => {
  server.use(
    http.get('*/auth/me', () =>
      HttpResponse.json({ error: { code: 'ERR-SYS-001', message: 'internal error' } }, { status: 500 }),
    ),
  );
  await renderAt('/');
  expect(await screen.findByTestId('session-check-failed')).toBeInTheDocument();
  expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
});

test('RequireAuth refuses a route whose permission the user lacks', async () => {
  server.use(
    http.get('*/auth/me', () =>
      HttpResponse.json({ ...ME, permissions: ['applications.view_any'], is_superuser: false }),
    ),
  );
  await renderAt('/admin/users');
  expect(await screen.findByTestId('forbidden')).toBeInTheDocument();
});

test('the superuser passes a gate for a code nobody granted', async () => {
  server.use(
    http.get('*/auth/me', () => HttpResponse.json({ ...ME, permissions: [], is_superuser: true })),
    // `UsersPage` itself fires these the moment it mounts — this test only
    // cares that the gate lets a superuser through to it, not what it shows,
    // so empty answers are enough to let it render without leaking to
    // whatever is actually listening at `localhost:8000`.
    http.get('*/api/v1/admin/users', () =>
      HttpResponse.json({ items: [], total: 0, page: 1, page_size: 20 }),
    ),
    http.get('*/api/v1/admin/users/stats', () =>
      HttpResponse.json({ total: 0, by_status: {}, by_role: {}, active_sessions: 0 }),
    ),
    http.get('*/api/v1/admin/roles', () => HttpResponse.json([])),
    http.get('*/api/v1/refs/organizations', () =>
      HttpResponse.json({ items: [], total: 0, page: 1, page_size: 100 }),
    ),
    http.get('*/api/v1/refs/regions', () => HttpResponse.json([])),
  );
  await renderAt('/admin/users');
  expect(await screen.findByTestId('users-page')).toBeInTheDocument();
});

test('a must_change_password account gets the form that resolves it, not a dead end', async () => {
  server.use(
    http.get('*/auth/me', () =>
      HttpResponse.json({ ...ME, user: { ...ME.user, must_change_password: true } }),
    ),
  );
  await renderAt('/');
  // The gate itself stays — the app is still out of reach — but the screen it
  // shows is the ONE action that lifts it. Only the user can clear this flag
  // (`POST /auth/password/change`); an administrator can merely issue another
  // one-time password, so a notice telling them to "contact the administrator"
  // was advice that led nowhere.
  const gate = within(await screen.findByTestId('must-change-password'));
  expect(gate.getByTestId('new-password')).toBeInTheDocument();
  expect(screen.queryByTestId('dashboard-page')).toBeNull();
});

test('an applicant with an incomplete registration sees the form that resolves it, not a dead end', async () => {
  server.use(
    http.get('*/auth/me', () => HttpResponse.json({ ...ME, registration_complete: false })),
    http.get('*/refs/regions', () => HttpResponse.json([])),
    http.get('*/refs/districts', () => HttpResponse.json([])),
  );
  await renderAt('/');
  // The gate itself still holds the app shut, but — like `must_change_password`
  // just above — it now contains the one action that lifts it, not a notice
  // pointing at an administrator who has no route to help.
  const gate = within(await screen.findByTestId('registration-incomplete'));
  expect(gate.getByTestId('consent-privacy')).toBeInTheDocument();
  expect(gate.getByTestId('phone-input')).toBeInTheDocument();
  expect(screen.queryByTestId('dashboard-page')).toBeNull();
});

test('a failed initial session check does not lock a user out who then logs in successfully', async () => {
  // Boot fails once with something other than "no session" — a 500, a CORS
  // blip during a deploy — which sets `authError`. `/login` is ungated, so
  // the user reaches it despite `authError` being set, and logs in.
  server.use(
    http.get('*/auth/me', () =>
      HttpResponse.json({ error: { code: 'ERR-SYS-001', message: 'internal error' } }, { status: 500 }),
    ),
    http.post('*/auth/login', () => HttpResponse.json({ mfa_required: true, mfa_token: 'mfa-1' })),
    http.post('*/auth/mfa/verify', () => HttpResponse.json(ME)),
  );
  await renderAt('/login');
  expect(await screen.findByTestId('login-page')).toBeInTheDocument();

  // The password form now lives behind the "Login/Parol" tab — OneID is the
  // default landing tab (citizen-first) — so the staff flow this test
  // exercises must select it first.
  await userEvent.click(await screen.findByRole('tab', { name: 'Login/Parol' }));
  await userEvent.type(screen.getByLabelText(/login/i), '30491823410019');
  await userEvent.type(screen.getByLabelText(/parol/i), 'Head123!');
  await userEvent.click(screen.getByRole('button', { name: /kirish/i }));
  await userEvent.type(await screen.findByLabelText(/kod/i), '123456');
  await userEvent.click(screen.getByRole('button', { name: /tasdiqlash/i }));

  // Login succeeded and `next` (default '/') is a protected route. If the
  // stale `authError` from the failed boot survived the login, RequireAuth
  // would still show "session-check-failed" here instead of the app.
  expect(await screen.findByTestId('app-shell')).toBeInTheDocument();
  expect(screen.queryByTestId('session-check-failed')).not.toBeInTheDocument();
});

it('loginViaEimzo signs the challenge and lands a session', async () => {
  const seen: { signed?: string } = {};
  server.use(
    // Not this test's concern, but needed so the provider's own boot-time
    // `/auth/me` lands on the ordinary logged-out state instead of MSW's
    // unhandled-request pass-through hitting a real socket (see the note
    // on `server` above).
    http.get('*/auth/me', () =>
      HttpResponse.json({ error: { code: 'ERR-AUTH-002', message: 'no session' } }, { status: 401 }),
    ),
    http.post('*/auth/eimzo/challenge', () => HttpResponse.json({ challenge: 'chal-42' })),
    http.post('*/auth/eimzo/login', async ({ request }) => {
      seen.signed = ((await request.json()) as { signed_challenge: string }).signed_challenge;
      return HttpResponse.json(ME);
    }),
  );
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(() => result.current.loginViaEimzo('30491823410019', 'TEST USER'));
  await waitFor(() => expect(result.current.me).not.toBeNull());
  const payload = JSON.parse(atob(seen.signed!.replace(/-/g, '+').replace(/_/g, '/')));
  expect(payload.challenge).toBe('chal-42');
  expect(payload.pinfl).toBe('30491823410019');
});

it('startOneId remembers where the user was heading before leaving for the provider', async () => {
  const assign = vi.spyOn(navigation, 'assign').mockImplementation(() => {});
  server.use(
    // See the comment in the previous test — same reason.
    http.get('*/auth/me', () =>
      HttpResponse.json({ error: { code: 'ERR-AUTH-002', message: 'no session' } }, { status: 401 }),
    ),
    http.get('*/auth/oneid/authorize', () =>
      HttpResponse.json({ redirect_url: 'https://id.egov.uz/?state=x' }),
    ),
  );
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(() => result.current.startOneId('/my/applications/new'));
  expect(sessionStorage.getItem(ONEID_NEXT_KEY)).toBe('/my/applications/new');
  expect(assign).toHaveBeenCalledWith('https://id.egov.uz/?state=x');
});
