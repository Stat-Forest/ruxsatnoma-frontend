import { render, screen } from '@testing-library/react';
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
  const { me, loading } = useAuth();
  if (loading) return null;
  if (!me) return <div data-testid="anonymous" />;
  return <div data-testid="who">{me.role.code}</div>;
}

const server = setupServer();
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

test('a must_change_password account sees a blocking notice, not the app', async () => {
  server.use(
    http.get('*/auth/me', () =>
      HttpResponse.json({ ...ME, user: { ...ME.user, must_change_password: true } }),
    ),
  );
  await renderAt('/');
  expect(await screen.findByTestId('must-change-password')).toBeInTheDocument();
});

test('an applicant with an incomplete registration sees a blocking notice, not the app', async () => {
  server.use(http.get('*/auth/me', () => HttpResponse.json({ ...ME, registration_complete: false })));
  await renderAt('/');
  expect(await screen.findByTestId('registration-incomplete')).toBeInTheDocument();
});
