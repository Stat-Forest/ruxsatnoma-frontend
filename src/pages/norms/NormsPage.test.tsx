import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';
import { I18nContext } from '../../i18n/context';
import { NormsPage } from './NormsPage';

// Params is mounted (hidden or not — see `NormsPage.tsx`'s file header) for
// the whole test, so its own `useQuery` calls (task 3) fire regardless of
// which tab this suite is exercising. A permissive handler is enough: this
// file tests tab-switch visibility, never Parameters' own data. Task 6 adds
// the identical need for Norms: switching to it flips its own `active` prop
// to `true`, firing `useNormsList`/`useActivityTypes` for real (they were
// never called at all while the tab stayed hidden — the whole point of
// `active`) — permissive handlers for both keep this suite about
// visibility, never about Norms' own data.
const server = setupServer(
  http.get('*/api/v1/rule-parameters', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 50 })),
  http.get('*/api/v1/norms', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 50 })),
  http.get('*/api/v1/refs/activity-types', () => HttpResponse.json([])),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// `t` returns the key itself — the tab-switch behaviour under test does not
// depend on which language is active, and IntegrationsPage.test.tsx sets the
// same precedent for a page rendered outside `I18nProvider`.
//
// Task 4's `ParamsTab` calls `useAuth()` to gate its write controls, so this
// suite now needs an `AuthContext` — a permissive `me` (task-4 brief's own
// two permissions) is enough; this file still only asserts tab visibility.
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'ru' as const, backendLang: 'ru' as const, t: (key: string) => key, setLanguage: async () => {} };
  const me = {
    user: { id: 'u-1', full_name: 'Test', login: 'test', language: 'uz_latn' },
    role: { code: 'norms_admin', name: {} },
    permissions: ['norms.tariffs.manage', 'norms.tariffs.publish'],
    zone: {},
    csrf_token: 'tok',
    is_superuser: false,
    applicant: null,
    representations: [],
    registration_complete: true,
  };
  const authValue = { me, loading: false, authError: null } as unknown as AuthContextValue;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
  );
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <NormsPage />
      </I18nContext.Provider>
    </QueryClientProvider>,
    { wrapper },
  );
}

test('parameters is shown on mount', () => {
  renderPage();
  expect(screen.getByTestId('norms-page')).toBeInTheDocument();
  expect(screen.getByTestId('norms-tab-params')).toBeVisible();
  expect(screen.getByTestId('norms-tab-norms')).not.toBeVisible();
  expect(screen.getByTestId('norms-tab-tariffs')).not.toBeVisible();
});

test('clicking a tab shows its body and hides the others', async () => {
  const user = userEvent.setup();
  renderPage();

  await user.click(screen.getByText('norms.tab.norms'));
  expect(screen.getByTestId('norms-tab-norms')).toBeVisible();
  expect(screen.getByTestId('norms-tab-params')).not.toBeVisible();
  expect(screen.getByTestId('norms-tab-tariffs')).not.toBeVisible();

  // Clicking back to Parameters restores it — and it never unmounted, so
  // any state it held (filters land in task 3) would still be there.
  await user.click(screen.getByText('norms.tab.params'));
  expect(screen.getByTestId('norms-tab-params')).toBeVisible();
  expect(screen.getByTestId('norms-tab-norms')).not.toBeVisible();
});
