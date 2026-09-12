/**
 * Pins the single most important correctness point in this task: the
 * backend already scopes `GET /help/tickets` server-side by the caller's
 * permission (`help.service.list_tickets`) — this component must trust
 * whatever the mock returns and add NO client-side ownership filter of its
 * own. The citizen-scenario fixture below deliberately includes a ticket
 * NOT owned by that scenario's `me.user.id`, and the test asserts it still
 * renders — a `.filter(t => t.user_id === me.user.id)` anywhere in this
 * component would make that assertion fail.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { AuthContext } from '../../../auth/AuthContext';
import type { AuthContextValue } from '../../../auth/AuthContext';
import { stubAuthActions } from '../../../auth/testAuthActions';
import { DICTIONARIES, I18nContext } from '../../../i18n/context';
import { TicketsTab } from './TicketsTab';
import type { TicketOut } from './api';

const CITIZEN_ID = 'u0000000-0000-4000-8000-000000000001';
const OTHER_USER_ID = 'u0000000-0000-4000-8000-000000000099';

function ticket(overrides: Partial<TicketOut> & Pick<TicketOut, 'id' | 'number'>): TicketOut {
  return {
    user_id: CITIZEN_ID,
    subject: 'Тема обращения',
    status: 'new',
    assigned_to: null,
    created_at: '2026-09-01T10:00:00+05:00',
    closed_at: null,
    ...overrides,
  };
}

function authValue(permissions: string[]): AuthContextValue {
  return {
    me: {
      user: {
        id: CITIZEN_ID,
        full_name: 'Каримов Азиз',
        login: 'citizen1',
        phone: null,
        email: null,
        must_change_password: false,
        pinfl: null,
        language: 'ru',
      },
      role: { code: permissions.length > 0 ? 'staff' : 'applicant', name: {} },
      permissions,
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

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderTab(permissions: string[]) {
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
        <AuthContext.Provider value={authValue(permissions)}>
          <MemoryRouter>
            <TicketsTab />
          </MemoryRouter>
        </AuthContext.Provider>
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

function page(items: TicketOut[]) {
  return { items, total: items.length, page: 1, page_size: 20 };
}

test('a ticket not owned by the caller still renders — the UI adds no client-side ownership filter', async () => {
  server.use(
    http.get('*/api/v1/help/tickets', () =>
      HttpResponse.json(
        page([ticket({ id: 't-1', number: 'ST-1', user_id: CITIZEN_ID }), ticket({ id: 't-2', number: 'ST-2', user_id: OTHER_USER_ID })]),
      ),
    ),
  );
  renderTab([]);

  expect(await screen.findByText('ST-1')).toBeInTheDocument();
  expect(screen.getByText('ST-2')).toBeInTheDocument();
});

test('the status filter "all" sends no status param', async () => {
  const requestedStatuses: (string | null)[] = [];
  server.use(
    http.get('*/api/v1/help/tickets', ({ request }) => {
      requestedStatuses.push(new URL(request.url).searchParams.get('status'));
      return HttpResponse.json(page([ticket({ id: 't-1', number: 'ST-1' })]));
    }),
  );
  const user = userEvent.setup();
  renderTab([]);

  await screen.findByText('ST-1');
  expect(requestedStatuses).toEqual([null]);

  await user.selectOptions(screen.getByTestId('tickets-status-filter'), 'new');
  await waitFor(() => expect(requestedStatuses).toEqual([null, 'new']));
});

test('pagination requests page/page_size, not limit/offset', async () => {
  const requested: { page: string | null; pageSize: string | null; limit: string | null; offset: string | null } = {
    page: null,
    pageSize: null,
    limit: null,
    offset: null,
  };
  server.use(
    http.get('*/api/v1/help/tickets', ({ request }) => {
      const url = new URL(request.url);
      requested.page = url.searchParams.get('page');
      requested.pageSize = url.searchParams.get('page_size');
      requested.limit = url.searchParams.get('limit');
      requested.offset = url.searchParams.get('offset');
      return HttpResponse.json(page([ticket({ id: 't-1', number: 'ST-1' })]));
    }),
  );
  renderTab([]);

  await screen.findByText('ST-1');
  expect(requested.page).toBe('1');
  expect(requested.pageSize).toBe('20');
  expect(requested.limit).toBeNull();
  expect(requested.offset).toBeNull();
});

test('filing a new ticket posts subject/body and opens its detail panel', async () => {
  server.use(http.get('*/api/v1/help/tickets', () => HttpResponse.json(page([]))));
  let body: Record<string, unknown> | null = null;
  server.use(
    http.post('*/api/v1/help/tickets', async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(ticket({ id: 't-new', number: 'ST-99' }), { status: 201 });
    }),
    http.get('*/api/v1/help/tickets/t-new', () =>
      HttpResponse.json({ ...ticket({ id: 't-new', number: 'ST-99' }), messages: [] }),
    ),
  );
  const user = userEvent.setup();
  renderTab([]);

  await user.click(await screen.findByRole('button', { name: 'Новое обращение' }));
  await user.type(screen.getByTestId('ticket-form-subject'), 'Не открывается ЛК');
  await user.type(screen.getByTestId('ticket-form-body'), 'При входе выдаёт ошибку');
  await user.click(screen.getByRole('button', { name: 'Отправить обращение' }));

  await waitFor(() => expect(body).toEqual({ subject: 'Не открывается ЛК', body: 'При входе выдаёт ошибку' }));
  expect(await screen.findByTestId('ticket-detail-t-new')).toBeInTheDocument();
});

test('the "Взять в работу" assign action is visible for a manage-holder and absent for a plain citizen', async () => {
  server.use(
    http.get('*/api/v1/help/tickets', () => HttpResponse.json(page([ticket({ id: 't-1', number: 'ST-1', status: 'new' })]))),
    http.get('*/api/v1/help/tickets/t-1', () =>
      HttpResponse.json({ ...ticket({ id: 't-1', number: 'ST-1', status: 'new' }), messages: [] }),
    ),
  );

  const { unmount } = renderTab(['help.tickets.manage']);
  await userEvent.setup().click(await screen.findByTestId('ticket-open-t-1'));
  const drawerManage = await screen.findByTestId('ticket-detail-t-1');
  expect(within(drawerManage).getByRole('button', { name: 'Взять в работу' })).toBeInTheDocument();
  unmount();

  renderTab([]);
  await userEvent.setup().click(await screen.findByTestId('ticket-open-t-1'));
  const drawerCitizen = await screen.findByTestId('ticket-detail-t-1');
  expect(within(drawerCitizen).queryByRole('button', { name: 'Взять в работу' })).not.toBeInTheDocument();
});

test('a click anywhere on a ticket row opens its detail panel', async () => {
  server.use(
    http.get('*/api/v1/help/tickets', () =>
      HttpResponse.json(page([ticket({ id: 't-1', number: 'ST-1', subject: 'Row subject', user_id: CITIZEN_ID })])),
    ),
    http.get('*/api/v1/help/tickets/t-1', () =>
      HttpResponse.json({ ...ticket({ id: 't-1', number: 'ST-1', subject: 'Row subject', user_id: CITIZEN_ID }), messages: [] }),
    ),
  );
  renderTab([]);

  await userEvent.setup().click(await screen.findByText('Row subject'));
  expect(await screen.findByTestId('ticket-detail-t-1')).toBeInTheDocument();
});

test('the Excel button asks the server for the export with the applied filters, never paging the list itself', async () => {
  const user = userEvent.setup();
  const listCalls: string[] = [];
  let exportUrl: URL | null = null;
  server.use(
    http.get('*/api/v1/help/tickets', ({ request }) => {
      listCalls.push(request.url);
      return HttpResponse.json(page([ticket({ id: 't-1', number: 'ST-1' })]));
    }),
    http.get('*/api/v1/help/tickets/export.xlsx', ({ request }) => {
      exportUrl = new URL(request.url);
      return HttpResponse.text('xlsx-bytes', {
        headers: {
          'Content-Disposition': 'attachment; filename="support-tickets-2026-09-11.xlsx"',
          'X-Export-Total': '1',
          'X-Export-Rows': '1',
          'X-Export-Truncated': 'false',
        },
      });
    }),
  );

  // jsdom's URL has no createObjectURL/revokeObjectURL at all — assigned
  // directly (never `vi.stubGlobal('URL', {...})`, which would replace the
  // constructor itself and break MSW's own `new URL(request.url)` parsing).
  const createObjectURL = vi.fn().mockReturnValue('blob:mock');
  const revokeObjectURL = vi.fn();
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  renderTab([]);
  await screen.findByText('ST-1');
  const listCallsBefore = listCalls.length;

  await user.click(screen.getByTestId('export-xlsx'));

  await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  expect(clickSpy).toHaveBeenCalled();
  expect(listCalls.length).toBe(listCallsBefore); // the export never re-fetches the list
  expect(exportUrl!.searchParams.get('lang')).toBe('ru'); // this screen's own UI language
  expect(exportUrl!.searchParams.has('page')).toBe(false);
  expect(exportUrl!.searchParams.has('page_size')).toBe(false);
});
