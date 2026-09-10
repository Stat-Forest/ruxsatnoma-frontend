import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { DICTIONARIES, type UiLanguage, I18nContext } from '../../i18n/context';
import { NotificationsPage } from './NotificationsPage';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const defaultT = (key: string) => DICTIONARIES.uz_latn[key as keyof typeof DICTIONARIES.uz_latn] ?? key;

function renderPage(lang: UiLanguage = 'uz_latn') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const dict = DICTIONARIES[lang];
  const t = (key: string) => dict[key as keyof typeof dict] ?? key;
  const i18n = { lang, backendLang: lang, t, setLanguage: async () => {} };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>{children}</I18nContext.Provider>
    </QueryClientProvider>
  );
  return render(<NotificationsPage />, { wrapper });
}

const UNREAD = {
  id: 'n-1',
  event_code: 'application.submitted',
  channel: 'inapp',
  subject: null,
  text: 'Arizangiz qabul qilindi',
  params: {},
  status: 'sent',
  object_type: 'application',
  object_id: 'app-1',
  created_at: '2026-09-05T08:00:00Z',
  read_at: null,
};

const READ = { ...UNREAD, id: 'n-2', text: 'Toʻlov qabul qilindi', read_at: '2026-09-05T09:00:00Z' };

test('an empty inbox shows the empty state', async () => {
  server.use(
    http.get('*/notifications', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 20 })),
  );
  renderPage();
  expect(await screen.findByTestId('notifications-empty')).toBeInTheDocument();
});

test('unread items show a Mark read button, read ones do not', async () => {
  server.use(
    http.get('*/notifications', () =>
      HttpResponse.json({ items: [UNREAD, READ], total: 2, page: 1, page_size: 20 }),
    ),
  );
  renderPage();
  expect(await screen.findByText('Arizangiz qabul qilindi')).toBeInTheDocument();
  expect(screen.getByTestId('mark-read-n-1')).toBeInTheDocument();
  expect(screen.queryByTestId('mark-read-n-2')).toBeNull();
});

test('switching to the Unread filter re-queries with unread=true', async () => {
  const seenUnread: string[] = [];
  server.use(
    http.get('*/notifications', ({ request }) => {
      seenUnread.push(new URL(request.url).searchParams.get('unread') ?? 'null');
      return HttpResponse.json({ items: [], total: 0, page: 1, page_size: 20 });
    }),
  );
  renderPage();
  await screen.findByTestId('notifications-empty');
  await userEvent.click(screen.getByRole('button', { name: defaultT('cabinet.notifications.filterUnread') }));
  await waitFor(() => expect(seenUnread).toContain('true'));
});

test('marking one notification read calls the route and it drops off the list', async () => {
  let marked = false;
  server.use(
    http.get('*/notifications', () =>
      HttpResponse.json({ items: marked ? [] : [UNREAD], total: marked ? 0 : 1, page: 1, page_size: 20 }),
    ),
    http.post('*/notifications/:id/read', () => {
      marked = true;
      return HttpResponse.json({ ...UNREAD, read_at: '2026-09-05T10:00:00Z' });
    }),
  );
  renderPage();
  await screen.findByText('Arizangiz qabul qilindi');
  await userEvent.click(screen.getByTestId('mark-read-n-1'));
  expect(await screen.findByTestId('notifications-empty')).toBeInTheDocument();
});

test('mark-all-read calls the route and clears the unread filter view', async () => {
  let allMarked = false;
  server.use(
    http.get('*/notifications', () =>
      HttpResponse.json({
        items: allMarked ? [] : [UNREAD],
        total: allMarked ? 0 : 1,
        page: 1,
        page_size: 20,
      }),
    ),
    http.post('*/notifications/read-all', () => {
      allMarked = true;
      return HttpResponse.json({ updated: 1 });
    }),
  );
  renderPage();
  await screen.findByText('Arizangiz qabul qilindi');
  await userEvent.click(screen.getByTestId('mark-all-read'));
  expect(await screen.findByTestId('notifications-empty')).toBeInTheDocument();
});

test('shows loading indicator while fetching', () => {
  server.use(
    http.get('*/notifications', () => new Promise(() => {})),
  );
  renderPage();
  expect(screen.getByTestId('notifications-loading')).toBeInTheDocument();
});

test('shows error message when fetch fails', async () => {
  server.use(
    http.get('*/notifications', () =>
      HttpResponse.json({ error: { code: 'ERR-SYS-000', message: 'Failed to load' } }, { status: 500 }),
    ),
  );
  renderPage();
  expect(await screen.findByTestId('notifications-error')).toBeInTheDocument();
});

test.each(['uz_latn', 'uz_cyrl', 'ru', 'en', 'kaa'] as const)(
  'notifications page renders in %s',
  async (lang) => {
    server.use(
      http.get('*/notifications', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 20 })),
    );
    renderPage(lang);

    const dict = DICTIONARIES[lang];
    expect(await screen.findByTestId('notifications-empty')).toHaveTextContent(dict['cabinet.notifications.empty']);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(dict['cabinet.notifications.title']);
    expect(screen.getByTestId('mark-all-read')).toHaveTextContent(dict['cabinet.notifications.markAllRead']);
    expect(screen.getByText(dict['cabinet.notifications.filterAll'])).toBeInTheDocument();
    expect(screen.getByText(dict['cabinet.notifications.filterUnread'])).toBeInTheDocument();
  },
);
