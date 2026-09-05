import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ChangePasswordForm } from './ChangePasswordForm';
import { I18nContext } from '../../../i18n/context';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderForm(onDone = () => {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>{children}</I18nContext.Provider>
    </QueryClientProvider>
  );
  return render(<ChangePasswordForm onChanged={onDone} />, { wrapper });
}

async function fill(oldPassword: string, next: string, confirm = next) {
  await userEvent.type(screen.getByTestId('old-password'), oldPassword);
  await userEvent.type(screen.getByTestId('new-password'), next);
  await userEvent.type(screen.getByTestId('confirm-password'), confirm);
}

test('a new password that breaks the policy is refused before any request is sent', async () => {
  let called = false;
  server.use(
    http.post('*/api/v1/auth/password/change', () => {
      called = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );

  renderForm();
  await fill('OldPass1!', 'short');
  await userEvent.click(screen.getByTestId('submit'));

  expect(screen.getByTestId('policy-length')).toBeInTheDocument();
  expect(called).toBe(false);
});

test('a confirmation that does not match is refused before any request is sent', async () => {
  let called = false;
  server.use(
    http.post('*/api/v1/auth/password/change', () => {
      called = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );

  renderForm();
  await fill('OldPass1!', 'Yangi#Parol123', 'Yangi#Parol124');
  await userEvent.click(screen.getByTestId('submit'));

  expect(await screen.findByTestId('mismatch')).toBeInTheDocument();
  expect(called).toBe(false);
});

test('a valid change sends old and new under the contract own field names', async () => {
  let body: unknown = null;
  server.use(
    http.post('*/api/v1/auth/password/change', async ({ request }) => {
      body = await request.json();
      return new HttpResponse(null, { status: 204 });
    }),
  );

  const onChanged = vi.fn();
  renderForm(onChanged);
  await fill('OldPass1!', 'Yangi#Parol123');
  await userEvent.click(screen.getByTestId('submit'));

  await waitFor(() => expect(onChanged).toHaveBeenCalled());
  expect(body).toEqual({ old_password: 'OldPass1!', new_password: 'Yangi#Parol123' });
});

test('the server refusing the old password is shown, not swallowed', async () => {
  server.use(
    http.post('*/api/v1/auth/password/change', () =>
      HttpResponse.json({ error: { code: 'ERR-AUTH-001', message: 'bad credentials' } }, { status: 401 }),
    ),
  );

  renderForm();
  await fill('WrongPass1!', 'Yangi#Parol123');
  await userEvent.click(screen.getByTestId('submit'));

  expect(await screen.findByTestId('server-error')).toBeInTheDocument();
});
