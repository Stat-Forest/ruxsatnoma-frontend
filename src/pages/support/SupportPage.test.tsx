/**
 * Smoke test for the tab shell. Pins the tab-visibility contract Tasks 2-4
 * build against: `faq` and `tickets` are always visible, `faq-admin`
 * (`help.faq.manage`) and `appeals` (`public.appeals.manage`) are not shown
 * to a caller holding neither permission. Task 5 extends this file with
 * more permission combinations once the real tab content exists — kept
 * minimal here on purpose.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { setupServer } from 'msw/node';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';
import { stubAuthActions } from '../../auth/testAuthActions';
import { DICTIONARIES, I18nContext } from '../../i18n/context';
import { SupportPage } from './SupportPage';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function authValue(): AuthContextValue {
  return {
    me: {
      user: {
        id: 'u0000000-0000-4000-8000-000000000001',
        full_name: 'Karimov Aziz',
        login: 'citizen1',
        phone: null,
        email: null,
        must_change_password: false,
        language: 'ru',
      },
      role: { code: 'applicant', name: {} },
      permissions: [],
      zone: { region_id: null, district_id: null, organization_id: null },
      csrf_token: 'tok-1',
      is_superuser: false,
      applicant: null,
      representations: [],
      registration_complete: true,
    },
    loading: false,
    authError: null,
    ...stubAuthActions(),
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = {
    lang: 'ru' as const,
    backendLang: 'ru' as const,
    t: (key: string) => (DICTIONARIES.ru as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <AuthContext.Provider value={authValue()}>
          <MemoryRouter>
            <SupportPage />
          </MemoryRouter>
        </AuthContext.Provider>
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

test('a plain citizen sees only the FAQ and support-ticket tabs', () => {
  renderPage();

  expect(screen.getByRole('button', { name: 'Вопросы и ответы' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Обращения в поддержку' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Управление FAQ' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Обращения граждан' })).not.toBeInTheDocument();
});
