import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthContext } from '../../../auth/AuthContext';
import type { AuthContextValue } from '../../../auth/AuthContext';
import { I18nContext } from '../../../i18n/context';
import { CompleteRegistrationGate } from './CompleteRegistrationGate';

const server = setupServer(
  http.get('*/refs/regions', () => HttpResponse.json([])),
  http.get('*/refs/districts', () => HttpResponse.json([])),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderGate(applyMe: (me: unknown) => void = () => {}, logout: () => Promise<void> = async () => {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = {
    lang: 'uz_latn' as const,
    backendLang: 'uz_latn' as const,
    t: (key: string) => key,
    setLanguage: async () => {},
  };
  const auth = {
    me: null,
    loading: false,
    authError: null,
    requestMfa: async () => {},
    verifyMfa: async () => {},
    startOneId: async () => {},
    loginViaEimzo: async () => {},
    logout,
    applyMe,
  } as unknown as AuthContextValue;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
      </I18nContext.Provider>
    </QueryClientProvider>
  );
  return render(<CompleteRegistrationGate />, { wrapper });
}

async function completePhoneOtp() {
  await userEvent.type(screen.getByTestId('phone-input'), '+998901234567');
  await userEvent.click(screen.getByTestId('send-code'));
  await userEvent.type(await screen.findByTestId('otp-code'), '123456');
  await userEvent.click(screen.getByTestId('verify-code'));
  await screen.findByTestId('phone-verified');
}

test('submitting with nothing done shows both the consents and the phone warning', async () => {
  renderGate();
  await userEvent.click(screen.getByTestId('submit'));
  expect(screen.getByText('cabinet.registration.needConsents')).toBeInTheDocument();
  expect(screen.getByText('cabinet.registration.needPhoneVerified')).toBeInTheDocument();
});

test('an unverified phone cannot be submitted even with both consents checked', async () => {
  let called = false;
  server.use(
    http.post('*/auth/complete-registration', () => {
      called = true;
      return HttpResponse.json({});
    }),
  );
  renderGate();
  await userEvent.click(screen.getByTestId('consent-privacy'));
  await userEvent.click(screen.getByTestId('consent-offer'));
  await userEvent.click(screen.getByTestId('submit'));
  expect(called).toBe(false);
});

test('the full happy path sends the otp_token and consent versions, and adopts the fresh MeOut', async () => {
  const seenBody: Record<string, unknown>[] = [];
  const freshMe = { registration_complete: true, marker: 'fresh' };
  server.use(
    http.post('*/auth/otp/request', () => new HttpResponse(null, { status: 204 })),
    http.post('*/auth/otp/verify', () => HttpResponse.json({ otp_token: 'tok-otp-1' })),
    http.post('*/auth/complete-registration', async ({ request }) => {
      seenBody.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json(freshMe);
    }),
  );
  let adopted: unknown = null;
  renderGate((me) => {
    adopted = me;
  });

  await userEvent.click(screen.getByTestId('consent-privacy'));
  await userEvent.click(screen.getByTestId('consent-offer'));
  await completePhoneOtp();
  await userEvent.click(screen.getByTestId('submit'));

  await waitFor(() => expect(adopted).toEqual(freshMe));
  expect(seenBody[0]).toMatchObject({
    otp_token: 'tok-otp-1',
    phone: '+998901234567',
    consents: { privacy_policy: '1.0', offer: '1.0' },
  });
});

test('a stale consent version is corrected from the error and must be re-accepted, not fatal', async () => {
  server.use(
    http.post('*/auth/otp/request', () => new HttpResponse(null, { status: 204 })),
    http.post('*/auth/otp/verify', () => HttpResponse.json({ otp_token: 'tok-otp-2' })),
    http.post('*/auth/complete-registration', () =>
      HttpResponse.json(
        {
          error: {
            code: 'ERR-VAL-001',
            message: 'stale consents',
            details: { consents_current: { privacy_policy: '2.0', offer: '1.0' } },
          },
        },
        { status: 422 },
      ),
    ),
  );
  renderGate();
  await userEvent.click(screen.getByTestId('consent-privacy'));
  await userEvent.click(screen.getByTestId('consent-offer'));
  await completePhoneOtp();
  await userEvent.click(screen.getByTestId('submit'));

  expect(await screen.findByText('cabinet.registration.consentsStale')).toBeInTheDocument();
  // Un-checked again — the whole point is that these are NOT the versions
  // the citizen just accepted, so ticking them again is a fresh decision.
  expect(screen.getByTestId('consent-privacy')).not.toBeChecked();
  expect(screen.getByTestId('consent-offer')).not.toBeChecked();
});

// F9 (`docs/plans/07.3-findings.md`): the gate used to render with no
// header, no logout and no link back — typing `/login` by hand was the only
// way out. A citizen stuck here (OneID with no `applicants` row yet, and no
// admin route creates one on their behalf) must have a visible exit.
test('the gate offers a visible logout, not only a URL typed by hand', async () => {
  let loggedOut = false;
  renderGate(undefined, async () => {
    loggedOut = true;
  });
  await userEvent.click(screen.getByText('shell.logout'));
  expect(loggedOut).toBe(true);
});

test('a rate-limited OTP request gets its own message, not a generic one', async () => {
  server.use(
    http.post('*/auth/otp/request', () =>
      HttpResponse.json({ error: { code: 'ERR-AUTH-009', message: 'too many' } }, { status: 429 }),
    ),
  );
  renderGate();
  await userEvent.type(screen.getByTestId('phone-input'), '+998901234567');
  await userEvent.click(screen.getByTestId('send-code'));
  expect(await screen.findByText('cabinet.otp.rateLimited')).toBeInTheDocument();
});
