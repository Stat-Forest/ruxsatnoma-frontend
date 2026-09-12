import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { DICTIONARIES, I18nContext } from '../../../i18n/context';
import { FaqAdminTab } from './FaqAdminTab';
import type { FaqOut } from './api';

function faq(overrides: Partial<FaqOut> & Pick<FaqOut, 'id'>): FaqOut {
  return {
    category: null,
    question: { uz_cyrl: 'Савол' },
    answer: { uz_cyrl: 'Жавоб' },
    sort_order: 0,
    status: 'draft',
    ...overrides,
  };
}

const DRAFT = faq({
  id: 'f0000000-0000-4000-8000-000000000001',
  status: 'draft',
  question: { ru: 'Черновой вопрос', uz_cyrl: 'Қоралама савол' },
});
const PUBLISHED = faq({
  id: 'f0000000-0000-4000-8000-000000000002',
  status: 'published',
  question: { ru: 'Опубликованный вопрос', uz_cyrl: 'Чоп этилган савол' },
});

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
        <FaqAdminTab />
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

test('the status filter "all" sends no status param; picking one narrows the request', async () => {
  const requestedStatuses: (string | null)[] = [];
  server.use(
    http.get('*/api/v1/admin/help/faq', ({ request }) => {
      requestedStatuses.push(new URL(request.url).searchParams.get('status'));
      return HttpResponse.json([DRAFT, PUBLISHED]);
    }),
  );
  const user = userEvent.setup();
  renderTab();

  await screen.findByTestId(`faq-admin-row-${DRAFT.id}`);
  expect(requestedStatuses).toEqual([null]);

  await user.selectOptions(screen.getByTestId('faq-admin-status-filter'), 'published');
  await waitFor(() => expect(requestedStatuses).toEqual([null, 'published']));
});

test('create flow sends only the filled languages, uz_cyrl included', async () => {
  server.use(http.get('*/api/v1/admin/help/faq', () => HttpResponse.json([])));
  let body: Record<string, unknown> | null = null;
  server.use(
    http.post('*/api/v1/admin/help/faq', async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(faq({ id: 'f0000000-0000-4000-8000-000000000009' }), { status: 201 });
    }),
  );
  const user = userEvent.setup();
  renderTab();

  await screen.findByTestId('faq-admin-empty');
  await user.click(screen.getByRole('button', { name: 'Новый вопрос' }));

  await user.type(screen.getByTestId('faq-question-uz_cyrl'), 'Янги савол');
  await user.type(screen.getByTestId('faq-answer-uz_cyrl'), 'Янги жавоб');
  await user.type(screen.getByTestId('faq-question-ru'), 'Новый вопрос');
  // `answer` in Russian deliberately left blank — only `uz_cyrl` and the
  // Russian question should reach the POST body.

  await user.click(screen.getByRole('button', { name: 'Сохранить' }));

  await waitFor(() => expect(body).not.toBeNull());
  expect(body).toEqual({
    category: null,
    question: { uz_cyrl: 'Янги савол', ru: 'Новый вопрос' },
    answer: { uz_cyrl: 'Янги жавоб' },
    sort_order: 0,
  });
});

test('a blank uz_cyrl question blocks submission client-side — no POST fires', async () => {
  server.use(http.get('*/api/v1/admin/help/faq', () => HttpResponse.json([])));
  let postCalled = false;
  server.use(
    http.post('*/api/v1/admin/help/faq', () => {
      postCalled = true;
      return HttpResponse.json(faq({ id: 'f0000000-0000-4000-8000-000000000009' }), { status: 201 });
    }),
  );
  const user = userEvent.setup();
  renderTab();

  await screen.findByTestId('faq-admin-empty');
  await user.click(screen.getByRole('button', { name: 'Новый вопрос' }));
  // uz_cyrl question/answer left blank, only Russian filled.
  await user.type(screen.getByTestId('faq-question-ru'), 'Только по-русски');
  await user.type(screen.getByTestId('faq-answer-ru'), 'Только ответ по-русски');

  await user.click(screen.getByRole('button', { name: 'Сохранить' }));

  expect(await screen.findByTestId('faq-form-error')).toHaveTextContent(
    'Вопрос и ответ на узбекском (кириллица) обязательны.',
  );
  expect(postCalled).toBe(false);
});

test('the quick "Опубликовать" action sends exactly {status: "published"}', async () => {
  server.use(http.get('*/api/v1/admin/help/faq', () => HttpResponse.json([DRAFT])));
  let body: unknown = null;
  server.use(
    http.patch('*/api/v1/admin/help/faq/:faqId', async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ ...DRAFT, status: 'published' });
    }),
  );
  const user = userEvent.setup();
  renderTab();

  const row = await screen.findByTestId(`faq-admin-row-${DRAFT.id}`);
  await user.click(within(row).getByRole('button', { name: 'Опубликовать' }));

  await waitFor(() => expect(body).toEqual({ status: 'published' }));
});

test('a published row offers only "В архив", not "Опубликовать" again', async () => {
  server.use(http.get('*/api/v1/admin/help/faq', () => HttpResponse.json([PUBLISHED])));
  renderTab();

  const row = await screen.findByTestId(`faq-admin-row-${PUBLISHED.id}`);
  expect(within(row).queryByRole('button', { name: 'Опубликовать' })).not.toBeInTheDocument();
  expect(within(row).getByRole('button', { name: 'В архив' })).toBeInTheDocument();
});

test('a click anywhere on a FAQ row opens its editor', async () => {
  server.use(http.get('*/api/v1/admin/help/faq', () => HttpResponse.json([DRAFT])));
  const user = userEvent.setup();
  renderTab();

  const row = await screen.findByTestId(`faq-admin-row-${DRAFT.id}`);
  await user.click(within(row).getAllByRole('cell')[0]);
  expect(await screen.findByTestId('faq-question-ru')).toBeInTheDocument();
});
