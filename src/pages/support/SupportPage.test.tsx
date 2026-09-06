/**
 * The tab shell's whole permission contract, end to end: every combination
 * of `help.faq.manage` / `public.appeals.manage` / superuser produces the
 * exact tab SET the plan's menu decision specifies — `faq` and `tickets`
 * always, `faq-admin` only with `help.faq.manage` (or superuser),
 * `appeals` only with `public.appeals.manage` (or superuser). Also checks
 * that clicking a tab actually swaps the rendered body, not just the
 * button state.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';
import { stubAuthActions } from '../../auth/testAuthActions';
import { DICTIONARIES, I18nContext } from '../../i18n/context';
import { SupportPage } from './SupportPage';

const server = setupServer(
  http.get('*/api/v1/help/faq', () => HttpResponse.json([])),
  http.get('*/api/v1/help/tickets', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 20 })),
  http.get('*/api/v1/admin/help/faq', () => HttpResponse.json([])),
  http.get('*/api/v1/admin/public/appeals', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 20 })),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function authValue(permissions: string[], isSuperuser = false): AuthContextValue {
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
      permissions,
      zone: { region_id: null, district_id: null, organization_id: null },
      csrf_token: 'tok-1',
      is_superuser: isSuperuser,
      applicant: null,
      representations: [],
      registration_complete: true,
    },
    loading: false,
    authError: null,
    ...stubAuthActions(),
  };
}

function renderPage(permissions: string[], isSuperuser = false) {
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
        <AuthContext.Provider value={authValue(permissions, isSuperuser)}>
          <MemoryRouter>
            <SupportPage />
          </MemoryRouter>
        </AuthContext.Provider>
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

const FAQ = 'Вопросы и ответы';
const FAQ_ADMIN = 'Управление FAQ';
const TICKETS = 'Обращения в поддержку';
const APPEALS = 'Обращения граждан';

function expectTabs(visible: string[], hidden: string[]) {
  for (const label of visible) {
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
  }
  for (const label of hidden) {
    expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
  }
}

test('a plain citizen sees only the FAQ and support-ticket tabs', () => {
  renderPage([]);
  expectTabs([FAQ, TICKETS], [FAQ_ADMIN, APPEALS]);
});

test('a superuser sees all four tabs', () => {
  renderPage([], true);
  expectTabs([FAQ, FAQ_ADMIN, TICKETS, APPEALS], []);
});

test('a caller holding only help.tickets.manage sees faq and tickets, not faq-admin or appeals', () => {
  renderPage(['help.tickets.manage']);
  expectTabs([FAQ, TICKETS], [FAQ_ADMIN, APPEALS]);
});

test('a caller holding only help.faq.manage sees faq, faq-admin and tickets, not appeals', () => {
  renderPage(['help.faq.manage']);
  expectTabs([FAQ, FAQ_ADMIN, TICKETS], [APPEALS]);
});

test('a caller holding only public.appeals.manage sees faq, tickets and appeals, not faq-admin', () => {
  renderPage(['public.appeals.manage']);
  expectTabs([FAQ, TICKETS, APPEALS], [FAQ_ADMIN]);
});

test('clicking a tab actually swaps the rendered body', async () => {
  const user = userEvent.setup();
  renderPage([]);

  // Default tab is `faq` — the reader's own heading is on screen.
  expect(await screen.findByText('Часто задаваемые вопросы')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: TICKETS }));
  expect(await screen.findByRole('button', { name: 'Новое обращение' })).toBeInTheDocument();
  expect(screen.queryByText('Часто задаваемые вопросы')).not.toBeInTheDocument();
});
