import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { AuthContext } from '../../../auth/AuthContext';
import type { AuthContextValue } from '../../../auth/AuthContext';
import { I18nContext } from '../../../i18n/context';
import { uz_latn } from '../../../i18n/uz_latn';
import { ProfilePage } from './ProfilePage';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPage(roleCode: string = 'applicant') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = {
    lang: 'uz_latn' as const,
    backendLang: 'uz_latn' as const,
    t: (key: string) => (uz_latn as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
  const auth = {
    me: {
      user: { full_name: 'Test Applicant', login: null, phone: null, email: null },
      role: { code: roleCode, name: { uz_latn: 'Ariza beruvchi' } },
      representations: [],
    },
    loading: false,
    authError: null,
    requestMfa: async () => {},
    verifyMfa: async () => {},
    startOneId: async () => {},
    loginViaEimzo: async () => {},
    logout: async () => {},
    applyMe: () => {},
    refreshMe: async () => {},
  } as unknown as AuthContextValue;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
      </I18nContext.Provider>
    </QueryClientProvider>
  );
  return render(<ProfilePage />, { wrapper });
}

test('the profile tab is selected by default and shows contacts', () => {
  renderPage();
  expect(screen.getByText('Test Applicant')).toBeInTheDocument();
  expect(screen.getByTestId('phone-change')).toBeInTheDocument();
});

test('switching to the password tab shows the existing change-password form (C5)', async () => {
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: uz_latn['cabinet.profile.tabPassword'] }));
  expect(screen.getByTestId('old-password')).toBeInTheDocument();
  expect(screen.queryByTestId('phone-change')).toBeNull();
});

test('an applicant sees the legal-entity representation tab', async () => {
  renderPage('applicant');
  await userEvent.click(screen.getByRole('button', { name: uz_latn['cabinet.profile.tabRepresentation'] }));
  expect(screen.getByTestId('attach-stir')).toBeInTheDocument();
});

test('a staff role is not offered the representation tab at all — the backend would refuse it', () => {
  renderPage('executor_staff');
  expect(screen.queryByRole('button', { name: uz_latn['cabinet.profile.tabRepresentation'] })).toBeNull();
});
