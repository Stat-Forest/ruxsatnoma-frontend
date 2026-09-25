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

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderGate(
  applyMe: (me: unknown) => void = () => {},
  logout: () => Promise<void> = async () => {},
  me: unknown = null,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = {
    lang: 'uz_latn' as const,
    backendLang: 'uz_latn' as const,
    t: (key: string) => key,
    setLanguage: async () => {},
  };
  const auth = {
    me,
    loading: false,
    authError: null,
    submitPassword: async () => 'mfa-required',
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

test('the form carries no consent checkboxes — the login page already names both documents', async () => {
  renderGate();
  expect(screen.queryByTestId('consent-privacy')).not.toBeInTheDocument();
  expect(screen.queryByTestId('consent-offer')).not.toBeInTheDocument();
});

// Decision #226 I1 (final review): a legal cabinet's own account has no
// PINFL at all (R1) — this screen must not assume one. `RequireAuth` renders
// it purely off `me.registration_complete`, with no branch on `applicant.kind`
// anywhere in this component, so a legal cabinet completes it exactly like an
// individual's.
test('a legal cabinet (no PINFL at all) completes registration the same way as an individual', async () => {
  let sentBody: unknown = null;
  server.use(
    http.post('*/auth/otp/request', () => new HttpResponse(null, { status: 204 })),
    http.post('*/auth/otp/verify', () => HttpResponse.json({ otp_token: 'tok-otp-legal' })),
    http.post('*/auth/complete-registration', async ({ request }) => {
      sentBody = await request.json();
      return HttpResponse.json({ registration_complete: true });
    }),
  );
  const applyMe = vi.fn();
  renderGate(applyMe, async () => {}, {
    user: { full_name: '"Chorvador" MChJ', pinfl: null },
    applicant: { kind: 'legal', pinfl: null, stir: '302345678', name: '"Chorvador" MChJ' },
    registration_complete: false,
  });

  await completePhoneOtp();
  await userEvent.click(screen.getByTestId('submit'));

  await waitFor(() => expect(applyMe).toHaveBeenCalledWith(expect.objectContaining({ registration_complete: true })));
  expect(sentBody).toMatchObject({ phone: '+998901234567', otp_token: 'tok-otp-legal' });
});

test('the submit button stays disabled until the phone is verified, and says why', async () => {
  renderGate();
  expect(screen.getByTestId('submit')).toBeDisabled();
  expect(screen.getByTestId('need-phone-verified')).toHaveTextContent('cabinet.registration.needPhoneVerified');
  server.use(
    http.post('*/auth/otp/request', () => new HttpResponse(null, { status: 204 })),
    http.post('*/auth/otp/verify', () => HttpResponse.json({ otp_token: 'tok-otp-0' })),
  );
  await completePhoneOtp();
  expect(screen.getByTestId('submit')).toBeEnabled();
  expect(screen.queryByTestId('need-phone-verified')).not.toBeInTheDocument();
});

test('a malformed phone is flagged once the field loses focus', async () => {
  renderGate();
  await userEvent.type(screen.getByTestId('phone-input'), '12312312');
  await userEvent.tab();
  expect(screen.getByText('cabinet.registration.invalidPhone')).toBeInTheDocument();
});

test('the form asks for the phone only — no email, region, district or address', async () => {
  renderGate();
  expect(screen.getByTestId('phone-input')).toBeInTheDocument();
  for (const id of ['email-input', 'region-select', 'district-select', 'address-input']) {
    expect(screen.queryByTestId(id)).not.toBeInTheDocument();
  }
});

test('the phone field starts with +998, and the prefix cannot be erased', async () => {
  renderGate();
  const input = screen.getByTestId('phone-input');
  expect(input).toHaveValue('+998');
  await userEvent.type(input, '{backspace}{backspace}{backspace}');
  expect(input).toHaveValue('+998');
  await userEvent.type(input, '901234567');
  expect(input).toHaveValue('+998901234567');
  await userEvent.type(input, '8');
  expect(input).toHaveValue('+998901234567');
});

test('a pasted full number does not double the prefix', async () => {
  renderGate();
  const input = screen.getByTestId('phone-input');
  await userEvent.clear(input);
  await userEvent.paste('+998 90 123 45 67');
  expect(input).toHaveValue('+998901234567');
});

test('an unverified phone cannot be submitted', async () => {
  let called = false;
  server.use(
    http.post('*/auth/complete-registration', () => {
      called = true;
      return HttpResponse.json({});
    }),
  );
  renderGate();
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

  await completePhoneOtp();
  await userEvent.click(screen.getByTestId('submit'));

  await waitFor(() => expect(adopted).toEqual(freshMe));
  expect(seenBody[0]).toMatchObject({
    otp_token: 'tok-otp-1',
    phone: '+998901234567',
    consents: { privacy_policy: '1.0', offer: '1.0' },
  });
});

test('a stale consent version is retried once with the versions the server names', async () => {
  const seen: Record<string, unknown>[] = [];
  const freshMe = { registration_complete: true, marker: 'fresh' };
  server.use(
    http.post('*/auth/otp/request', () => new HttpResponse(null, { status: 204 })),
    http.post('*/auth/otp/verify', () => HttpResponse.json({ otp_token: 'tok-otp-2' })),
    http.post('*/auth/complete-registration', async ({ request }) => {
      seen.push((await request.json()) as Record<string, unknown>);
      if (seen.length === 1) {
        return HttpResponse.json(
          {
            error: {
              code: 'ERR-VAL-001',
              message: 'stale consents',
              details: { consents_current: { privacy_policy: '2.0', offer: '1.0' } },
            },
          },
          { status: 422 },
        );
      }
      return HttpResponse.json(freshMe);
    }),
  );
  let adopted: unknown = null;
  renderGate((me) => {
    adopted = me;
  });
  await completePhoneOtp();
  await userEvent.click(screen.getByTestId('submit'));

  await waitFor(() => expect(adopted).toEqual(freshMe));
  expect(seen).toHaveLength(2);
  expect(seen[1]).toMatchObject({ consents: { privacy_policy: '2.0', offer: '1.0' } });
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
