import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthContext } from '../../../../auth/AuthContext';
import type { AuthContextValue } from '../../../../auth/AuthContext';
import { I18nContext } from '../../../../i18n/context';
import { ContactsSection } from './ContactsSection';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderSection(applyMe: (me: unknown) => void = () => {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = {
    lang: 'uz_latn' as const,
    backendLang: 'uz_latn' as const,
    t: (key: string) => key,
    setLanguage: async () => {},
  };
  const auth = {
    me: {
      user: { phone: '+998900000000', email: null },
    },
    loading: false,
    authError: null,
    requestMfa: async () => {},
    verifyMfa: async () => {},
    startOneId: async () => {},
    loginViaEimzo: async () => {},
    logout: async () => {},
    applyMe,
  } as unknown as AuthContextValue;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
      </I18nContext.Provider>
    </QueryClientProvider>
  );
  return render(<ContactsSection />, { wrapper });
}

test('the current phone shows, and email shows as not set', () => {
  renderSection();
  expect(screen.getByText('+998900000000')).toBeInTheDocument();
  expect(screen.getByText('cabinet.profile.notSet')).toBeInTheDocument();
});

test('changing the phone requests a code, verifies it, and adopts the fresh MeOut', async () => {
  const seenPatchBody: Record<string, unknown>[] = [];
  server.use(
    http.post('*/auth/otp/request', () => new HttpResponse(null, { status: 204 })),
    http.post('*/auth/otp/verify', () => HttpResponse.json({ otp_token: 'tok-1' })),
    http.patch('*/auth/me', async ({ request }) => {
      seenPatchBody.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({ marker: 'updated' });
    }),
  );
  let adopted: unknown = null;
  renderSection((me) => {
    adopted = me;
  });

  await userEvent.click(screen.getByTestId('phone-change'));
  await userEvent.type(screen.getByTestId('phone-new-value'), '+998901112233');
  await userEvent.click(screen.getByTestId('phone-send-code'));
  await userEvent.type(await screen.findByTestId('phone-otp-code'), '654321');
  await userEvent.click(screen.getByTestId('phone-verify'));

  await waitFor(() => expect(adopted).toEqual({ marker: 'updated' }));
  expect(seenPatchBody[0]).toMatchObject({
    phone: '+998901112233',
    otp_token: 'tok-1',
  });
  // Back to the read-only row — the edit form is gone.
  expect(screen.queryByTestId('phone-new-value')).toBeNull();
});

test('cancel leaves the stored value untouched and no request is made', async () => {
  let called = false;
  server.use(
    http.post('*/auth/otp/request', () => {
      called = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  renderSection();
  await userEvent.click(screen.getByTestId('email-change'));
  await userEvent.type(screen.getByTestId('email-new-value'), 'a@example.com');
  await userEvent.click(screen.getByText('cabinet.profile.cancel'));
  expect(screen.queryByTestId('email-new-value')).toBeNull();
  expect(called).toBe(false);
});
