import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { DICTIONARIES, I18nContext } from '../../../i18n/context';
import { AppealsTab } from './AppealsTab';
import type { AppealAdminOut } from './api';

function appeal(overrides: Partial<AppealAdminOut> & Pick<AppealAdminOut, 'id' | 'number' | 'status'>): AppealAdminOut {
  return {
    applicant_name: 'Иванов Иван',
    contact: { phone: '+998901234567', email: 'ivanov@example.com' },
    subject: 'Жалоба на решение',
    body: 'Текст обращения гражданина.',
    answer_text: null,
    answered_by: null,
    answered_at: null,
    created_at: '2026-09-01T10:00:00+05:00',
    ...overrides,
  };
}

function page(items: AppealAdminOut[]) {
  return { items, total: items.length, page: 1, page_size: 20 };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderTab() {
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
        <AppealsTab />
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

test('the status filter "all" sends no status param', async () => {
  const requestedStatuses: (string | null)[] = [];
  server.use(
    http.get('*/api/v1/admin/public/appeals', ({ request }) => {
      requestedStatuses.push(new URL(request.url).searchParams.get('status'));
      return HttpResponse.json(page([appeal({ id: 'a-1', number: 'PA-1', status: 'new' })]));
    }),
  );
  const user = userEvent.setup();
  renderTab();

  await screen.findByText('PA-1');
  expect(requestedStatuses).toEqual([null]);

  await user.selectOptions(screen.getByTestId('appeals-status-filter'), 'answered');
  await waitFor(() => expect(requestedStatuses).toEqual([null, 'answered']));
});

test('pagination requests page/page_size', async () => {
  const requested: { page: string | null; pageSize: string | null } = { page: null, pageSize: null };
  server.use(
    http.get('*/api/v1/admin/public/appeals', ({ request }) => {
      const url = new URL(request.url);
      requested.page = url.searchParams.get('page');
      requested.pageSize = url.searchParams.get('page_size');
      return HttpResponse.json(page([appeal({ id: 'a-1', number: 'PA-1', status: 'new' })]));
    }),
  );
  renderTab();

  await screen.findByText('PA-1');
  expect(requested.page).toBe('1');
  expect(requested.pageSize).toBe('20');
});

test('a contact object missing email renders only the phone, no crash', async () => {
  server.use(
    http.get('*/api/v1/admin/public/appeals', () =>
      HttpResponse.json(page([appeal({ id: 'a-1', number: 'PA-1', status: 'new', contact: { phone: '+998901234567' } })])),
    ),
    http.get('*/api/v1/admin/public/appeals/a-1', () =>
      HttpResponse.json(appeal({ id: 'a-1', number: 'PA-1', status: 'new', contact: { phone: '+998901234567' } })),
    ),
  );
  const user = userEvent.setup();
  renderTab();

  await user.click(await screen.findByTestId('appeal-open-a-1'));
  const contactBlock = await screen.findByTestId('appeal-contact');
  expect(contactBlock).toHaveTextContent('+998901234567');
  expect(contactBlock).not.toHaveTextContent('Эл. почта');
});

test('a "new" appeal offers all three actions: take in progress, answer, close', async () => {
  server.use(
    http.get('*/api/v1/admin/public/appeals', () => HttpResponse.json(page([appeal({ id: 'a-1', number: 'PA-1', status: 'new' })]))),
    http.get('*/api/v1/admin/public/appeals/a-1', () => HttpResponse.json(appeal({ id: 'a-1', number: 'PA-1', status: 'new' }))),
  );
  const user = userEvent.setup();
  renderTab();

  await user.click(await screen.findByTestId('appeal-open-a-1'));
  const panel = await screen.findByTestId('appeal-detail-a-1');
  expect(within(panel).getByRole('button', { name: 'Взять в работу' })).toBeInTheDocument();
  expect(within(panel).getByRole('button', { name: 'Ответить' })).toBeInTheDocument();
  expect(within(panel).getByRole('button', { name: 'Закрыть' })).toBeInTheDocument();
});

test('an "in_progress" appeal offers only answer and close', async () => {
  server.use(
    http.get('*/api/v1/admin/public/appeals', () => HttpResponse.json(page([appeal({ id: 'a-1', number: 'PA-1', status: 'in_progress' })]))),
    http.get('*/api/v1/admin/public/appeals/a-1', () => HttpResponse.json(appeal({ id: 'a-1', number: 'PA-1', status: 'in_progress' }))),
  );
  const user = userEvent.setup();
  renderTab();

  await user.click(await screen.findByTestId('appeal-open-a-1'));
  const panel = await screen.findByTestId('appeal-detail-a-1');
  expect(within(panel).queryByRole('button', { name: 'Взять в работу' })).not.toBeInTheDocument();
  expect(within(panel).getByRole('button', { name: 'Ответить' })).toBeInTheDocument();
  expect(within(panel).getByRole('button', { name: 'Закрыть' })).toBeInTheDocument();
});

test('an "answered" appeal offers only close, and shows the answer section', async () => {
  server.use(
    http.get('*/api/v1/admin/public/appeals', () =>
      HttpResponse.json(
        page([appeal({ id: 'a-1', number: 'PA-1', status: 'answered', answer_text: 'Ваш вопрос рассмотрен.', answered_at: '2026-09-03T09:00:00+05:00' })]),
      ),
    ),
    http.get('*/api/v1/admin/public/appeals/a-1', () =>
      HttpResponse.json(appeal({ id: 'a-1', number: 'PA-1', status: 'answered', answer_text: 'Ваш вопрос рассмотрен.', answered_at: '2026-09-03T09:00:00+05:00' })),
    ),
  );
  const user = userEvent.setup();
  renderTab();

  await user.click(await screen.findByTestId('appeal-open-a-1'));
  const panel = await screen.findByTestId('appeal-detail-a-1');
  expect(within(panel).queryByRole('button', { name: 'Взять в работу' })).not.toBeInTheDocument();
  expect(within(panel).queryByRole('button', { name: 'Ответить' })).not.toBeInTheDocument();
  expect(within(panel).getByRole('button', { name: 'Закрыть' })).toBeInTheDocument();
  expect(within(panel).getByTestId('appeal-answer')).toHaveTextContent('Ваш вопрос рассмотрен.');
});

test('a "closed" appeal shows no actions and the terminal notice', async () => {
  server.use(
    http.get('*/api/v1/admin/public/appeals', () => HttpResponse.json(page([appeal({ id: 'a-1', number: 'PA-1', status: 'closed' })]))),
    http.get('*/api/v1/admin/public/appeals/a-1', () => HttpResponse.json(appeal({ id: 'a-1', number: 'PA-1', status: 'closed' }))),
  );
  const user = userEvent.setup();
  renderTab();

  await user.click(await screen.findByTestId('appeal-open-a-1'));
  const panel = await screen.findByTestId('appeal-detail-a-1');
  expect(within(panel).queryByRole('button', { name: 'Взять в работу' })).not.toBeInTheDocument();
  expect(within(panel).queryByRole('button', { name: 'Ответить' })).not.toBeInTheDocument();
  expect(within(panel).queryByRole('button', { name: 'Закрыть' })).not.toBeInTheDocument();
  expect(within(panel).getByText('Обращение закрыто.')).toBeInTheDocument();
});

test('answering posts {answer_text} and the panel reflects the answered state afterward', async () => {
  server.use(
    http.get('*/api/v1/admin/public/appeals', () => HttpResponse.json(page([appeal({ id: 'a-1', number: 'PA-1', status: 'new' })]))),
  );
  let body: unknown = null;
  let answered = false;
  server.use(
    http.get('*/api/v1/admin/public/appeals/a-1', () =>
      HttpResponse.json(
        answered
          ? appeal({ id: 'a-1', number: 'PA-1', status: 'answered', answer_text: 'Спасибо за обращение.', answered_at: '2026-09-03T09:00:00+05:00' })
          : appeal({ id: 'a-1', number: 'PA-1', status: 'new' }),
      ),
    ),
    http.post('*/api/v1/admin/public/appeals/a-1/answer', async ({ request }) => {
      body = await request.json();
      answered = true;
      return HttpResponse.json(appeal({ id: 'a-1', number: 'PA-1', status: 'answered', answer_text: 'Спасибо за обращение.', answered_at: '2026-09-03T09:00:00+05:00' }));
    }),
  );
  const user = userEvent.setup();
  renderTab();

  await user.click(await screen.findByTestId('appeal-open-a-1'));
  await user.click(await screen.findByRole('button', { name: 'Ответить' }));
  await user.type(screen.getByTestId('appeal-answer-input'), 'Спасибо за обращение.');
  await user.click(screen.getByRole('button', { name: 'Отправить ответ' }));

  await waitFor(() => expect(body).toEqual({ answer_text: 'Спасибо за обращение.' }));
  expect(await screen.findByTestId('appeal-answer')).toHaveTextContent('Спасибо за обращение.');
});

test('a click anywhere on an appeal row opens its detail panel', async () => {
  server.use(
    http.get('*/api/v1/admin/public/appeals', () =>
      HttpResponse.json(page([appeal({ id: 'a-1', number: 'PA-1', status: 'new', subject: 'Row subject' })])),
    ),
    http.get('*/api/v1/admin/public/appeals/a-1', () =>
      HttpResponse.json(appeal({ id: 'a-1', number: 'PA-1', status: 'new', subject: 'Row subject', contact: { phone: '+998901234567' } })),
    ),
  );
  renderTab();

  await userEvent.setup().click(await screen.findByText('Row subject'));
  expect(await screen.findByTestId('appeal-contact')).toBeInTheDocument();
});
