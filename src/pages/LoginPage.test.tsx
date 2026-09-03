import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import App from '../App';
import { setCsrfToken } from '../api/client';

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
  permissions: ['applications.view_any'],
  zone: { region_id: null, district_id: null, organization_id: null },
  csrf_token: 'tok-1',
  is_superuser: false,
  applicant: null,
  representations: [],
  registration_complete: true,
};

// No live cookie by default — every test in this file starts anonymous, at
// the login page, unless a test overrides this handler.
const server = setupServer(
  http.get('*/auth/me', () =>
    HttpResponse.json({ error: { code: 'ERR-AUTH-002', message: 'no session' } }, { status: 401 }),
  ),
);
beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  setCsrfToken(null);
});
afterAll(() => server.close());

test('login is two steps: password, then the TOTP code', async () => {
  server.use(
    http.post('*/auth/login', () => HttpResponse.json({ mfa_required: true, mfa_token: 'mfa-1' })),
    http.post('*/auth/mfa/verify', async ({ request }) => {
      const body = (await request.json()) as { mfa_token: string; code: string };
      expect(body.mfa_token).toBe('mfa-1');
      expect(body.code).toBe('123456');
      return HttpResponse.json(ME);
    }),
  );
  render(<App />);
  await userEvent.type(await screen.findByLabelText(/login/i), '30491823410019');
  await userEvent.type(screen.getByLabelText(/parol/i), 'Head123!');
  await userEvent.click(screen.getByRole('button', { name: /kirish/i }));
  await userEvent.type(await screen.findByLabelText(/kod/i), '123456');
  await userEvent.click(screen.getByRole('button', { name: /tasdiqlash/i }));
  expect(await screen.findByTestId('app-shell')).toBeInTheDocument();
});

test('a wrong password says so and does not advance to the code step', async () => {
  server.use(
    http.post('*/auth/login', () =>
      HttpResponse.json({ error: { code: 'ERR-AUTH-001', message: 'bad credentials' } }, { status: 401 }),
    ),
  );
  render(<App />);
  await userEvent.type(await screen.findByLabelText(/login/i), '30491823410019');
  await userEvent.type(screen.getByLabelText(/parol/i), 'wrong');
  await userEvent.click(screen.getByRole('button', { name: /kirish/i }));
  expect(await screen.findByTestId('login-error')).toBeInTheDocument();
  expect(screen.queryByLabelText(/kod/i)).not.toBeInTheDocument();
});

test('too many attempts is a distinct message, not "wrong password"', async () => {
  server.use(
    http.post('*/auth/login', () =>
      HttpResponse.json({ error: { code: 'ERR-SYS-006', message: 'rate limited' } }, { status: 429 }),
    ),
  );
  render(<App />);
  await userEvent.type(await screen.findByLabelText(/login/i), '30491823410019');
  await userEvent.type(screen.getByLabelText(/parol/i), 'Head123!');
  await userEvent.click(screen.getByRole('button', { name: /kirish/i }));
  expect(await screen.findByTestId('rate-limited')).toBeInTheDocument();
});
