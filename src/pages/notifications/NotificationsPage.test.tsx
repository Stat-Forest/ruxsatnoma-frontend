import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter, useLocation } from 'react-router';
import { AuthContext, type AuthContextValue } from '../../auth/AuthContext';
import { DICTIONARIES, type UiLanguage, I18nContext } from '../../i18n/context';
import { NotificationsPage } from './NotificationsPage';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const defaultT = (key: string) => DICTIONARIES.uz_latn[key as keyof typeof DICTIONARIES.uz_latn] ?? key;

/** The session the inbox routes by: `permissions` decide whether an
 * application notification opens the citizen's card or the staff one. */
function authValue(permissions: string[], is_superuser = false): AuthContextValue {
  return {
    me: {
      user: {
        id: 'u0000000-0000-4000-8000-000000000001',
        full_name: 'Test User',
        login: 'user1',
        phone: null,
        email: null,
        must_change_password: false,
        language: 'uz_latn',
        pinfl: null,
      },
      role: { code: 'applicant', name: {} },
      permissions,
      zone: { region_id: null, district_id: null, organization_id: null },
      csrf_token: 'tok-1',
      is_superuser,
      applicant: null,
      representations: [],
      registration_complete: true,
    },
    loading: false,
    authError: null,
    submitPassword: async () => 'signed-in',
    verifyMfa: async () => {},
    startOneId: async () => {},
    loginViaEimzo: async () => {},
    logout: async () => {},
    applyMe: () => {},
    refreshMe: async () => {},
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-location">{location.pathname}</div>;
}

function renderPage(lang: UiLanguage = 'uz_latn', permissions: string[] = [], is_superuser = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const dict = DICTIONARIES[lang];
  const t = (key: string) => dict[key as keyof typeof dict] ?? key;
  const i18n = { lang, backendLang: lang, t, setLanguage: async () => {} };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={['/notifications']}>
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>
          <AuthContext.Provider value={authValue(permissions, is_superuser)}>
            {children}
            <LocationProbe />
          </AuthContext.Provider>
        </I18nContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>
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

// --- the row is a link to what it is about --------------------------------

function page(items: object[]) {
  server.use(
    http.get('*/notifications', () =>
      HttpResponse.json({ items, total: items.length, page: 1, page_size: 20 }),
    ),
  );
}

test('an application notification links a citizen to their own card', async () => {
  page([UNREAD]);
  renderPage('uz_latn', ['applications.create']);
  const link = await screen.findByTestId('notification-link-n-1');
  expect(link).toHaveAttribute('href', '/my/applications/app-1');
});

test('the same notification links a reviewer to the staff card', async () => {
  page([UNREAD]);
  renderPage('uz_latn', ['applications.review']);
  const link = await screen.findByTestId('notification-link-n-1');
  expect(link).toHaveAttribute('href', '/applications/app-1');
});

test('sys_admin is routed as staff even though it holds every code', async () => {
  page([UNREAD]);
  renderPage('uz_latn', ['applications.create', 'applications.review'], true);
  expect(await screen.findByTestId('notification-link-n-1')).toHaveAttribute('href', '/applications/app-1');
});

test('a permit notification links to the permit', async () => {
  page([{ ...UNREAD, id: 'n-3', event_code: 'permit.active', object_type: 'permit', object_id: 'p-1' }]);
  renderPage('uz_latn', []);
  expect(await screen.findByTestId('notification-link-n-3')).toHaveAttribute('href', '/my/permits/p-1');
});

test('a notification about nothing in particular is plain text, not a link', async () => {
  page([{ ...UNREAD, id: 'n-4', event_code: 'announcement.published', object_type: null, object_id: null }]);
  renderPage();
  await screen.findByText('Arizangiz qabul qilindi');
  expect(screen.queryByTestId('notification-link-n-4')).toBeNull();
});

test('opening an unread notification marks it read and navigates', async () => {
  let marked = false;
  page([UNREAD]);
  server.use(
    http.post('*/notifications/:id/read', () => {
      marked = true;
      return HttpResponse.json({ ...UNREAD, read_at: '2026-09-05T10:00:00Z' });
    }),
  );
  renderPage('uz_latn', []);
  await userEvent.click(await screen.findByTestId('notification-link-n-1'));
  await waitFor(() => expect(marked).toBe(true));
  expect(screen.getByTestId('current-location')).toHaveTextContent('/my/applications/app-1');
});

test('opening an already-read notification only navigates', async () => {
  let marked = false;
  page([READ]);
  server.use(
    http.post('*/notifications/:id/read', () => {
      marked = true;
      return HttpResponse.json(READ);
    }),
  );
  renderPage('uz_latn', []);
  await userEvent.click(await screen.findByTestId('notification-link-n-2'));
  expect(screen.getByTestId('current-location')).toHaveTextContent('/my/applications/app-1');
  expect(marked).toBe(false);
});

// --- the "from -> to" status chips ----------------------------------------

test('an application transition shows both statuses in the viewer language', async () => {
  page([{ ...UNREAD, params: { application_number: 'RX-1', status_from: 'IN_REVIEW', status_to: 'APPROVED' } }]);
  renderPage('ru');
  const chips = await screen.findByTestId('notification-transition-n-1');
  expect(chips).toHaveTextContent('На рассмотрении');
  expect(chips).toHaveTextContent('Одобрено');
});

test('a permit transition uses the permit vocabulary', async () => {
  page([
    {
      ...UNREAD,
      id: 'n-5',
      event_code: 'permit.suspended',
      object_type: 'permit',
      object_id: 'p-1',
      params: { permit_number: 'RX-1', status_from: 'active', status_to: 'suspended' },
    },
  ]);
  renderPage('uz_latn');
  const chips = await screen.findByTestId('notification-transition-n-5');
  expect(chips).toHaveTextContent('Amalda');
  expect(chips).toHaveTextContent('Toʻxtatilgan');
});

test('a notification without a transition shows no chips', async () => {
  page([{ ...UNREAD, params: { application_number: 'RX-1' } }]);
  renderPage();
  await screen.findByText('Arizangiz qabul qilindi');
  expect(screen.queryByTestId('notification-transition-n-1')).toBeNull();
});

// --- mark read is an icon, not a sentence ---------------------------------

test('the mark-read control is an icon button named by its tooltip text', async () => {
  page([UNREAD]);
  renderPage();
  const button = await screen.findByTestId('mark-read-n-1');
  expect(button).toHaveAccessibleName(defaultT('cabinet.notifications.markRead'));
  expect(button).not.toHaveTextContent(defaultT('cabinet.notifications.markRead'));
});
