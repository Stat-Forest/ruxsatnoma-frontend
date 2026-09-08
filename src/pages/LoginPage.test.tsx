import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import App from '../App';
import { setCsrfToken } from '../api/client';
import { ONEID_NEXT_KEY } from '../auth/AuthProvider';
import { navigation } from '../lib/navigation';
import { router } from '../routes';

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
// the login page, unless a test overrides this handler. `unread-count` is
// mocked too: the one test that logs all the way in reaches `AppShell`,
// which fires it the moment it mounts — leaving it unmocked would fall
// through to whatever actually answers on `localhost:8000` in this
// environment, a real backend, instead of a deterministic empty result.
const server = setupServer(
  http.get('*/auth/me', () =>
    HttpResponse.json({ error: { code: 'ERR-AUTH-002', message: 'no session' } }, { status: 401 }),
  ),
  http.get('*/notifications/unread-count', () => HttpResponse.json({ count: 0 })),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  setCsrfToken(null);
  // The OneID failure-path tests below are the only ones in this file that
  // touch it — cleared so a value one of them stores can never leak into an
  // unrelated later test's `next` fallback.
  sessionStorage.removeItem(ONEID_NEXT_KEY);
});
afterAll(() => server.close());

async function fillAndSubmitPassword(loginId: string, password: string) {
  // The password form now lives behind the "Login/Parol" tab — OneID is the
  // default landing tab (citizen-first) — so the staff flow this file
  // exercises must select it first. Everything downstream (the two-step
  // form, the four distinct error messages) is otherwise unchanged.
  await userEvent.click(await screen.findByRole('tab', { name: 'Login/Parol' }));
  await userEvent.type(await screen.findByLabelText(/login/i), loginId);
  await userEvent.type(screen.getByLabelText(/parol/i), password);
  await userEvent.click(screen.getByRole('button', { name: /kirish/i }));
}

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
  await fillAndSubmitPassword('30491823410019', 'Head123!');
  await userEvent.type(await screen.findByLabelText(/kod/i), '123456');
  await userEvent.click(screen.getByRole('button', { name: /tasdiqlash/i }));
  expect(await screen.findByTestId('app-shell')).toBeInTheDocument();
});

test('with MFA switched off the password alone signs in, with no code step', async () => {
  // The server's `mfa_enabled` switch is off: /auth/login answers with the
  // profile and sets the session cookies itself. The code field must never
  // appear — nothing would verify what was typed into it.
  let verifyCalls = 0;
  server.use(
    http.post('*/auth/login', () =>
      HttpResponse.json({ mfa_required: false, mfa_token: null, me: ME }),
    ),
    http.post('*/auth/mfa/verify', () => {
      verifyCalls += 1;
      return HttpResponse.json(ME);
    }),
  );
  render(<App />);
  await fillAndSubmitPassword('30491823410019', 'Head123!');
  expect(await screen.findByTestId('app-shell')).toBeInTheDocument();
  expect(screen.queryByLabelText(/kod/i)).not.toBeInTheDocument();
  expect(verifyCalls).toBe(0);
});

test('a wrong password says so and does not advance to the code step', async () => {
  server.use(
    http.post('*/auth/login', () =>
      HttpResponse.json({ error: { code: 'ERR-AUTH-001', message: 'bad credentials' } }, { status: 401 }),
    ),
  );
  render(<App />);
  await fillAndSubmitPassword('30491823410019', 'wrong');
  expect(await screen.findByTestId('login-error')).toBeInTheDocument();
  expect(screen.queryByTestId('account-blocked')).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/kod/i)).not.toBeInTheDocument();
});

test('a blocked account says so distinctly, not "wrong password"', async () => {
  server.use(
    http.post('*/auth/login', () =>
      HttpResponse.json({ error: { code: 'ERR-AUTH-003', message: 'account blocked' } }, { status: 403 }),
    ),
  );
  render(<App />);
  await fillAndSubmitPassword('30491823410019', 'Head123!');
  expect(await screen.findByTestId('account-blocked')).toBeInTheDocument();
  expect(screen.queryByTestId('login-error')).not.toBeInTheDocument();
});

test('too many attempts is a distinct message, not "wrong password"', async () => {
  server.use(
    http.post('*/auth/login', () =>
      HttpResponse.json({ error: { code: 'ERR-SYS-006', message: 'rate limited' } }, { status: 429 }),
    ),
  );
  render(<App />);
  await fillAndSubmitPassword('30491823410019', 'Head123!');
  expect(await screen.findByTestId('rate-limited')).toBeInTheDocument();
  expect(screen.queryByTestId('login-error')).not.toBeInTheDocument();
});

test('a dropped connection gets a generic message, not "wrong password"', async () => {
  server.use(http.post('*/auth/login', () => HttpResponse.error()));
  render(<App />);
  await fillAndSubmitPassword('30491823410019', 'Head123!');
  expect(await screen.findByTestId('connection-error')).toBeInTheDocument();
  expect(screen.queryByTestId('login-error')).not.toBeInTheDocument();
});

it('offers three methods, citizen first', async () => {
  render(<App />);
  const tabs = await screen.findAllByRole('tab');
  expect(tabs.map((t) => t.textContent)).toEqual(['OneID', 'E-IMZO', 'Login/Parol']);
});

it('remembers the tab a returning member of staff last used', async () => {
  localStorage.setItem('ruxsatnoma.login.tab', 'password');
  render(<App />);
  expect(await screen.findByLabelText(/Parol/)).toBeInTheDocument();
});

it('the OneID tab sends the browser to the provider', async () => {
  const assign = vi.spyOn(navigation, 'assign').mockImplementation(() => {});
  server.use(
    http.get('*/auth/oneid/authorize', () =>
      HttpResponse.json({ redirect_url: 'https://id.egov.uz/?state=x' }),
    ),
  );
  render(<App />);
  await userEvent.click(await screen.findByRole('tab', { name: 'OneID' }));
  await userEvent.click(screen.getByRole('button', { name: /OneID/ }));
  await waitFor(() => expect(assign).toHaveBeenCalledWith('https://id.egov.uz/?state=x'));
});

it('a failed OneID round trip surfaces its own message — nobody was reading `?error=oneid` before', async () => {
  // The backend redirects here on a failed `oneid_state` check — a full
  // page load, indistinguishable in a test from any other fresh navigation.
  await router.navigate('/login?error=oneid');
  render(<App />);
  expect(await screen.findByTestId('oneid-error')).toBeInTheDocument();
});

it('a failed OneID round trip does not cost the citizen their destination on retry', async () => {
  // What `startOneId` had written before the browser left for the provider,
  // still there because the round trip failed before anything consumed it.
  sessionStorage.setItem(ONEID_NEXT_KEY, '/my/applications/new');
  const assign = vi.spyOn(navigation, 'assign').mockImplementation(() => {});
  server.use(
    http.get('*/auth/oneid/authorize', () =>
      HttpResponse.json({ redirect_url: 'https://id.egov.uz/?state=retry' }),
    ),
  );
  // A full page load: `location.state.next` is gone, same as production.
  await router.navigate('/login?error=oneid');
  render(<App />);
  await userEvent.click(await screen.findByRole('tab', { name: 'OneID' }));
  await userEvent.click(screen.getByRole('button', { name: /OneID/ }));
  await waitFor(() => expect(assign).toHaveBeenCalledWith('https://id.egov.uz/?state=retry'));
  // The retry re-stored the SAME destination it recovered — not the '/'
  // fallback a lost `location.state.next` used to leave `startOneId` with.
  expect(sessionStorage.getItem(ONEID_NEXT_KEY)).toBe('/my/applications/new');
});

it('the E-IMZO tab refuses a PINFL that is not 14 digits without calling the API', async () => {
  let called = false;
  server.use(
    http.post('*/auth/eimzo/challenge', () => {
      called = true;
      return HttpResponse.json({ challenge: 'c' });
    }),
  );
  render(<App />);
  await userEvent.click(await screen.findByRole('tab', { name: 'E-IMZO' }));
  await userEvent.type(screen.getByLabelText(/PINFL/), '123');
  await userEvent.type(screen.getByLabelText(/F\.I\.SH|ФИО/), 'TEST USER');
  await userEvent.click(screen.getByRole('button', { name: /E-IMZO/ }));
  expect(await screen.findByTestId('eimzo-bad-pinfl')).toBeInTheDocument();
  expect(called).toBe(false);
});

it('leaving the E-IMZO tab and coming back clears a stale bad-PINFL alert', async () => {
  render(<App />);
  await userEvent.click(await screen.findByRole('tab', { name: 'E-IMZO' }));
  await userEvent.type(screen.getByLabelText(/PINFL/), '123');
  await userEvent.click(screen.getByRole('button', { name: /E-IMZO/ }));
  expect(await screen.findByTestId('eimzo-bad-pinfl')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('tab', { name: 'OneID' }));
  await userEvent.click(screen.getByRole('tab', { name: 'E-IMZO' }));
  expect(screen.queryByTestId('eimzo-bad-pinfl')).not.toBeInTheDocument();
});

it('the E-IMZO tab shows the plugin-required notice when the mock flag is off — the branch every real build shows', async () => {
  // `vite.config.ts` turns the mock on for the whole suite so the form
  // above can be tested; the flag defaults OFF in every real build, and
  // nothing else in this file ever exercises that branch. Overridden here
  // only, not suite-wide — `unstubEnvs` in `vite.config.ts` reverts it once
  // this test ends.
  vi.stubEnv('VITE_EIMZO_MOCK', 'false');
  render(<App />);
  await userEvent.click(await screen.findByRole('tab', { name: 'E-IMZO' }));
  expect(await screen.findByText(/E-IMZO kaliti va brauzer plagini talab qilinadi/)).toBeInTheDocument();
  expect(screen.queryByLabelText(/PINFL/)).not.toBeInTheDocument();
});
