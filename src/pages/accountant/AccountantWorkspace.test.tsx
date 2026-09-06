import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { AccountantWorkspace } from './AccountantWorkspace';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';
import { DICTIONARIES, I18nContext } from '../../i18n/context';

// No network calls in this suite — it only exercises tab switching, which
// happens entirely in component state (`06.5-accountant.md` ruling R3: one
// route, four tabs, `routes.tsx` untouched).
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderWorkspace() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const me = {
    user: { id: 'u-1', full_name: 'Accountant', login: 'acc', language: 'uz_latn' },
    role: { code: 'accountant', name: {} },
    permissions: ['payments.view', 'payments.manage'],
    zone: { region_id: null, district_id: null, organization_id: null },
    csrf_token: 'tok',
    is_superuser: false,
    applicant: null,
    representations: [],
    registration_complete: true,
  };
  const authValue = { me, loading: false, authError: null } as unknown as AuthContextValue;
  const i18n = {
    lang: 'uz_latn' as const,
    backendLang: 'uz_latn' as const,
    t: (key: string) => (DICTIONARIES.uz_latn as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={authValue}>
        <I18nContext.Provider value={i18n}>{children}</I18nContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
  return render(<AccountantWorkspace />, { wrapper });
}

test('opens on the Invoices tab, and switching tabs swaps the panel without navigating', async () => {
  const user = userEvent.setup();
  renderWorkspace();

  expect(screen.getByTestId('invoices-tab')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Bank hisobotlari' }));
  expect(screen.queryByTestId('invoices-tab')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Hisob-fakturalar' }));
  expect(screen.getByTestId('invoices-tab')).toBeInTheDocument();
});

test('an empty zone shows the republic-wide warning in the shell', () => {
  renderWorkspace();
  expect(screen.getByTestId('zone-banner-republic')).toBeInTheDocument();
});
