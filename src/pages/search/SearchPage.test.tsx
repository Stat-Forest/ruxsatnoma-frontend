/**
 * Search screen (stage 6.9, track T69). `t` is the identity function, in the
 * style of `pages/inspector/TasksTab.test.tsx` — a translation key IS the
 * text a `findByText` looks for.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { I18nContext } from '../../i18n/context';
import { SearchPage } from './SearchPage';
import type { SavedFilterOut, SearchResultOut } from './api';

function page<T>(items: T[]) {
  return { items, total: items.length, page: 1, page_size: 20 };
}

function applicationResult(overrides: Partial<SearchResultOut> = {}): SearchResultOut {
  return {
    kind: 'applications',
    id: 'a1000000-0000-4000-8000-000000000001',
    number: 'APP-00000001',
    status: 'SUBMITTED',
    organization_id: null,
    applicant_name: 'Тестов Тест',
    created_at: '2026-09-01T10:00:00+05:00',
    ...overrides,
  };
}

function permitResult(overrides: Partial<SearchResultOut> = {}): SearchResultOut {
  return {
    kind: 'permits',
    id: 'p1000000-0000-4000-8000-000000000001',
    number: 'А № 000003',
    status: 'active',
    organization_id: null,
    applicant_name: 'Тестов Тест',
    created_at: '2026-09-01T10:00:00+05:00',
    ...overrides,
  };
}

function savedFilter(overrides: Partial<SavedFilterOut> = {}): SavedFilterOut {
  return {
    id: 'f1000000-0000-4000-8000-000000000001',
    user_id: 'u1000000-0000-4000-8000-000000000001',
    name: 'My saved filter',
    kind: 'permits',
    params: { series: 'А' },
    shared: null,
    created_at: '2026-09-01T10:00:00+05:00',
    updated_at: '2026-09-01T10:00:00+05:00',
    ...overrides,
  };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderSearchPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>
          <SearchPage />
        </I18nContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

test('renders application results with a link to the application card', async () => {
  server.use(
    http.get('*/api/v1/search', ({ request }) => {
      expect(new URL(request.url).searchParams.get('kind')).toBe('applications');
      return HttpResponse.json(page([applicationResult()]));
    }),
    http.get('*/api/v1/search/profiles', () => HttpResponse.json([])),
    http.get('*/api/v1/refs/organizations', () => HttpResponse.json(page([]))),
    http.get('*/api/v1/refs/activity-types', () => HttpResponse.json([])),
  );

  renderSearchPage();

  const link = await screen.findByText('APP-00000001');
  expect(link.closest('a')).toHaveAttribute('href', '/applications/a1000000-0000-4000-8000-000000000001');
});

test('a permit result shows the printed number exactly as the backend sends it, unreformatted', async () => {
  server.use(
    http.get('*/api/v1/search', () => HttpResponse.json(page([permitResult()]))),
    http.get('*/api/v1/search/profiles', () => HttpResponse.json([])),
    http.get('*/api/v1/refs/organizations', () => HttpResponse.json(page([]))),
    http.get('*/api/v1/refs/activity-types', () => HttpResponse.json([])),
  );

  const user = userEvent.setup();
  renderSearchPage();
  await user.click(screen.getByTestId('search-kind-permits'));

  const link = await screen.findByText('А № 000003');
  expect(link.closest('a')).toHaveAttribute('href', '/permits/p1000000-0000-4000-8000-000000000001');
});

test('applying a saved profile switches kind and re-issues the search with its params', async () => {
  let lastSeries: string | null = null;
  server.use(
    http.get('*/api/v1/search', ({ request }) => {
      lastSeries = new URL(request.url).searchParams.get('series');
      return HttpResponse.json(page([]));
    }),
    http.get('*/api/v1/search/profiles', () => HttpResponse.json([savedFilter()])),
    http.get('*/api/v1/refs/organizations', () => HttpResponse.json(page([]))),
    http.get('*/api/v1/refs/activity-types', () => HttpResponse.json([])),
  );

  const user = userEvent.setup();
  renderSearchPage();

  const profileButton = await screen.findByText('My saved filter');
  await user.click(profileButton);

  await waitFor(() => expect(lastSeries).toBe('А'));
  expect(screen.getByTestId('search-kind-permits')).toHaveAttribute('aria-selected', 'true');
});

test('saving the current filters posts a new profile and the list refetches', async () => {
  let created: unknown = null;
  server.use(
    http.get('*/api/v1/search', () => HttpResponse.json(page([]))),
    http.get('*/api/v1/search/profiles', () =>
      HttpResponse.json(created ? [savedFilter({ name: 'New one' })] : []),
    ),
    http.post('*/api/v1/search/profiles', async ({ request }) => {
      created = await request.json();
      return HttpResponse.json(savedFilter({ name: 'New one' }), { status: 201 });
    }),
    http.get('*/api/v1/refs/organizations', () => HttpResponse.json(page([]))),
    http.get('*/api/v1/refs/activity-types', () => HttpResponse.json([])),
  );

  const user = userEvent.setup();
  renderSearchPage();

  await user.click(screen.getByText('search.profiles.saveCurrent'));
  const row = screen.getByTestId('save-profile-row');
  await user.type(within(row).getByRole('textbox'), 'New one');
  await user.click(screen.getByTestId('save-profile-confirm'));

  await waitFor(() => expect(created).toMatchObject({ name: 'New one', kind: 'applications' }));
  await screen.findByText('New one');
});

test('deleting a saved profile calls DELETE and it disappears from the list', async () => {
  let deleted = false;
  server.use(
    http.get('*/api/v1/search', () => HttpResponse.json(page([]))),
    http.get('*/api/v1/search/profiles', () => HttpResponse.json(deleted ? [] : [savedFilter()])),
    http.delete('*/api/v1/search/profiles/:id', () => {
      deleted = true;
      return new HttpResponse(null, { status: 204 });
    }),
    http.get('*/api/v1/refs/organizations', () => HttpResponse.json(page([]))),
    http.get('*/api/v1/refs/activity-types', () => HttpResponse.json([])),
  );

  const user = userEvent.setup();
  renderSearchPage();

  await screen.findByText('My saved filter');
  await user.click(screen.getByTestId(`saved-profile-delete-${savedFilter().id}`));

  await waitFor(() => expect(deleted).toBe(true));
  await waitFor(() => expect(screen.queryByText('My saved filter')).not.toBeInTheDocument());
});

test('the empty state renders when there are no results', async () => {
  server.use(
    http.get('*/api/v1/search', () => HttpResponse.json(page([]))),
    http.get('*/api/v1/search/profiles', () => HttpResponse.json([])),
    http.get('*/api/v1/refs/organizations', () => HttpResponse.json(page([]))),
    http.get('*/api/v1/refs/activity-types', () => HttpResponse.json([])),
  );

  renderSearchPage();
  expect(await screen.findByText('search.empty')).toBeInTheDocument();
});
