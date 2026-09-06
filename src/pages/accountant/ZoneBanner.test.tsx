import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ZoneBanner } from './ZoneBanner';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';
import { DICTIONARIES, I18nContext } from '../../i18n/context';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderBanner(zone: { region_id: string | null; district_id: string | null; organization_id: string | null }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const me = {
    user: { id: 'u-1', full_name: 'Accountant', login: 'acc', language: 'uz_latn' },
    role: { code: 'accountant', name: {} },
    permissions: ['payments.view'],
    zone,
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
  return render(<ZoneBanner />, { wrapper });
}

test('an empty zone is shown as the whole republic, with a warning tone, never a silent absence', async () => {
  renderBanner({ region_id: null, district_id: null, organization_id: null });

  const banner = await screen.findByTestId('zone-banner-republic');
  expect(banner).toHaveTextContent(
    'Sizning hisobingizga tashkilot biriktirilmagan — bu butun respublika boʻyicha barcha hisob-fakturalarni koʻrishingiz mumkinligini anglatadi.',
  );
});

test('an organization-scoped zone resolves and shows the organization name', async () => {
  server.use(
    http.get('*/api/v1/refs/organizations', ({ request }) => {
      const url = new URL(request.url);
      const parentId = url.searchParams.get('parent_id');
      if (parentId === null) {
        return HttpResponse.json({
          items: [{ id: 'org-1', parent_id: null, kind: 'leshoz', code: 'L1', name: { uz_latn: 'Zangiota leshozi' }, stir: null, region_id: null, district_id: null, status: 'active' }],
          total: 1,
          page: 1,
          page_size: 100,
        });
      }
      return HttpResponse.json({ items: [], total: 0, page: 1, page_size: 100 });
    }),
  );
  renderBanner({ region_id: null, district_id: null, organization_id: 'org-1' });

  const banner = await screen.findByTestId('zone-banner-scoped');
  expect(await screen.findByText('Zangiota leshozi')).toBeInTheDocument();
  expect(banner).toHaveTextContent('Sizning zonangiz:');
});
