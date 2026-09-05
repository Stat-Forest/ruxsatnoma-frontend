import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';
import { I18nContext } from '../../i18n/context';
import { GisPage } from './GisPage';

// The map is not this test's concern (house rule) — every tab that can reach
// a `DrawMap` is exercised on its own, mocked, in its own test file.
vi.mock('./contours/DrawMap', () => ({ DrawMap: () => <div data-testid="draw-map-mock" /> }));

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const me = {
    user: { id: 'u-1', full_name: 'Test', login: 'test', language: 'uz_latn' },
    role: { code: 'gis_specialist', name: {} },
    permissions: ['gis.contours.manage'],
    zone: {},
    csrf_token: 'tok',
    is_superuser: false,
    applicant: null,
    representations: [],
    registration_complete: true,
  };
  const authValue = { me, loading: false, authError: null } as unknown as AuthContextValue;
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={authValue}>
        <I18nContext.Provider value={i18n}>{children}</I18nContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
  return render(<GisPage />, { wrapper });
}

test('opens on the Contours tab and switches to Imports and Layers on click', async () => {
  server.use(
    http.get('*/api/v1/gis/contours', () => HttpResponse.json({ items: [], total: 0 })),
    http.get('*/api/v1/refs/organizations', () => HttpResponse.json({ items: [], total: 0 })),
    http.get('*/api/v1/gis/layers', () => HttpResponse.json({ items: [] })),
  );
  const ui = userEvent.setup();
  renderPage();

  expect(screen.getByTestId('gis-page')).toBeInTheDocument();
  await screen.findByText('gis.contours.listTitle');

  await ui.click(screen.getByRole('button', { name: 'gis.page.tabImports' }));
  await screen.findByText('gis.imports.noneSelected');

  await ui.click(screen.getByRole('button', { name: 'gis.page.tabLayers' }));
  await screen.findByText('gis.layers.noneSelected');
});
