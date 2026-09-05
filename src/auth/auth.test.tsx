import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import App from '../App';
import { api, setCsrfToken } from '../api/client';
import { router } from '../routes';
import { AuthProvider } from './AuthProvider';
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
beforeAll(() => server.listen());
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

test('an applicant with an incomplete registration sees a blocking notice, not the app', async () => {
  server.use(http.get('*/auth/me', () => HttpResponse.json({ ...ME, registration_complete: false })));
  await renderAt('/');
  expect(await screen.findByTestId('registration-incomplete')).toBeInTheDocument();
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
