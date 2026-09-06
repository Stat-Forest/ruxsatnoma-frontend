/**
 * MSW is first-match-wins — the specific `POST .../messages` handler is
 * registered before the bare `GET /help/tickets/:id` handler in every test
 * here (Global Constraints' own handler-order gotcha).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthContext } from '../../../auth/AuthContext';
import type { AuthContextValue } from '../../../auth/AuthContext';
import { stubAuthActions } from '../../../auth/testAuthActions';
import { DICTIONARIES, I18nContext } from '../../../i18n/context';
import { TicketDetailPanel } from './TicketDetailPanel';
import type { TicketWithMessagesOut } from './api';

const CITIZEN_ID = 'u0000000-0000-4000-8000-000000000001';
const STAFF_ID = 'u0000000-0000-4000-8000-000000000002';

function withMessages(overrides: Partial<TicketWithMessagesOut> & Pick<TicketWithMessagesOut, 'id' | 'number' | 'status'>): TicketWithMessagesOut {
  return {
    user_id: CITIZEN_ID,
    subject: 'Не открывается личный кабинет',
    assigned_to: null,
    created_at: '2026-09-01T10:00:00+05:00',
    closed_at: null,
    messages: [],
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
        language: 'ru',
      },
      role: { code: 'applicant', name: {} },
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

function renderPanel(permissions: string[], canManage: boolean) {
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
          <TicketDetailPanel ticketId="t-1" canManage={canManage} onClose={() => {}} />
        </AuthContext.Provider>
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

test('a message from the ticket owner is labeled "requester", a different author is labeled "staff"', async () => {
  server.use(
    http.get('*/api/v1/help/tickets/t-1', () =>
      HttpResponse.json(
        withMessages({
          id: 't-1',
          number: 'ST-1',
          status: 'in_progress',
          messages: [
            { id: 'm-1', ticket_id: 't-1', author_id: CITIZEN_ID, body: 'Не могу войти', file_id: null, created_at: '2026-09-01T10:00:00+05:00' },
            { id: 'm-2', ticket_id: 't-1', author_id: STAFF_ID, body: 'Проверяем', file_id: null, created_at: '2026-09-01T11:00:00+05:00' },
          ],
        }),
      ),
    ),
  );
  renderPanel([], false);

  const requesterMsg = await screen.findByTestId('ticket-message-m-1');
  expect(requesterMsg).toHaveTextContent('Заявитель');
  const staffMsg = screen.getByTestId('ticket-message-m-2');
  expect(staffMsg).toHaveTextContent('Служба поддержки');
});

test('a reply posts and the input clears', async () => {
  server.use(
    http.post('*/api/v1/help/tickets/:id/messages', async ({ request }) => {
      const body = (await request.json()) as { body: string };
      return HttpResponse.json({ id: 'm-new', ticket_id: 't-1', author_id: CITIZEN_ID, body: body.body, file_id: null, created_at: '2026-09-01T12:00:00+05:00' }, { status: 201 });
    }),
    http.get('*/api/v1/help/tickets/t-1', () =>
      HttpResponse.json(withMessages({ id: 't-1', number: 'ST-1', status: 'new', messages: [] })),
    ),
  );
  const user = userEvent.setup();
  renderPanel([], false);

  await screen.findByTestId('ticket-detail-t-1');
  const input = screen.getByTestId('ticket-reply-input');
  await user.type(input, 'Дополнительный вопрос');
  await user.click(screen.getByRole('button', { name: 'Ответить' }));

  await waitFor(() => expect(input).toHaveValue(''));
});

test('a closed ticket hides the reply form and shows the closed notice', async () => {
  server.use(
    http.get('*/api/v1/help/tickets/t-1', () =>
      HttpResponse.json(withMessages({ id: 't-1', number: 'ST-1', status: 'closed', closed_at: '2026-09-02T09:00:00+05:00' })),
    ),
  );
  renderPanel([], false);

  const panel = await screen.findByTestId('ticket-detail-t-1');
  expect(within(panel).queryByTestId('ticket-reply-input')).not.toBeInTheDocument();
  expect(within(panel).getByText('Обращение закрыто — переписка недоступна.')).toBeInTheDocument();
});

test('resolve only appears for an in_progress ticket with manage permission', async () => {
  server.use(
    http.get('*/api/v1/help/tickets/t-1', () =>
      HttpResponse.json(withMessages({ id: 't-1', number: 'ST-1', status: 'in_progress' })),
    ),
  );
  renderPanel(['help.tickets.manage'], true);

  const panel = await screen.findByTestId('ticket-detail-t-1');
  expect(within(panel).getByRole('button', { name: 'Отметить решённым' })).toBeInTheDocument();
});

test('resolve does NOT appear for a "new" ticket even with manage permission', async () => {
  server.use(
    http.get('*/api/v1/help/tickets/t-1', () =>
      HttpResponse.json(withMessages({ id: 't-1', number: 'ST-1', status: 'new' })),
    ),
  );
  renderPanel(['help.tickets.manage'], true);

  const panel = await screen.findByTestId('ticket-detail-t-1');
  expect(within(panel).queryByRole('button', { name: 'Отметить решённым' })).not.toBeInTheDocument();
});

test('close appears for the citizen who owns a "new" ticket, with no manage permission', async () => {
  server.use(
    http.get('*/api/v1/help/tickets/t-1', () =>
      HttpResponse.json(withMessages({ id: 't-1', number: 'ST-1', status: 'new', user_id: CITIZEN_ID })),
    ),
  );
  renderPanel([], false);

  const panel = await screen.findByTestId('ticket-detail-t-1');
  expect(within(panel).getByRole('button', { name: 'Закрыть обращение' })).toBeInTheDocument();
});
