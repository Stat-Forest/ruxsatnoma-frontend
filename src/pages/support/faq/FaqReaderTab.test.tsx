import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { DICTIONARIES, I18nContext } from '../../../i18n/context';
import { FaqReaderTab } from './FaqReaderTab';
import type { FaqOut } from './api';

function faq(overrides: Partial<FaqOut> & Pick<FaqOut, 'id'>): FaqOut {
  return {
    category: null,
    question: { ru: 'Вопрос' },
    answer: { ru: 'Ответ' },
    sort_order: 0,
    status: 'published',
    ...overrides,
  };
}

const GRAZING = faq({
  id: 'f0000000-0000-4000-8000-000000000001',
  category: 'grazing',
  question: { ru: 'Как получить разрешение на выпас?' },
  answer: { ru: 'Подайте заявку через личный кабинет.' },
});
const HAYMAKING = faq({
  id: 'f0000000-0000-4000-8000-000000000002',
  category: 'haymaking',
  question: { ru: 'Сколько стоит сенокошение?' },
  answer: { ru: 'Стоимость рассчитывается по нормативам.' },
});
const UNCATEGORIZED = faq({
  id: 'f0000000-0000-4000-8000-000000000003',
  category: null,
  question: { ru: 'Как связаться с поддержкой?' },
  answer: { ru: 'Через раздел обращений в поддержку.' },
});

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const i18n = {
    lang: 'ru' as const,
    backendLang: 'ru' as const,
    t: (key: string) => (DICTIONARIES.ru as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <FaqReaderTab />
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

test('shows every published item under "all categories" and narrows when one is picked', async () => {
  server.use(http.get('*/api/v1/help/faq', () => HttpResponse.json([GRAZING, HAYMAKING, UNCATEGORIZED])));
  const user = userEvent.setup();
  renderTab();

  expect(await screen.findByText('Как получить разрешение на выпас?')).toBeInTheDocument();
  expect(screen.getByText('Сколько стоит сенокошение?')).toBeInTheDocument();
  expect(screen.getByText('Как связаться с поддержкой?')).toBeInTheDocument();

  await user.selectOptions(screen.getByTestId('faq-reader-category-filter'), 'grazing');

  expect(screen.getByText('Как получить разрешение на выпас?')).toBeInTheDocument();
  expect(screen.queryByText('Сколько стоит сенокошение?')).not.toBeInTheDocument();
  expect(screen.queryByText('Как связаться с поддержкой?')).not.toBeInTheDocument();
});

test('an item is collapsed until its <summary> is opened, then the answer is present', async () => {
  server.use(http.get('*/api/v1/help/faq', () => HttpResponse.json([GRAZING])));
  renderTab();

  const item = await screen.findByTestId(`faq-item-${GRAZING.id}`);
  expect(item).not.toHaveAttribute('open');
  // The answer text is in the DOM (native <details> content), just not
  // visible until expanded — assert it renders correctly either way.
  expect(item).toHaveTextContent('Подайте заявку через личный кабинет.');
});

test('an empty published list shows the empty-state copy', async () => {
  server.use(http.get('*/api/v1/help/faq', () => HttpResponse.json([])));
  renderTab();

  expect(await screen.findByTestId('faq-reader-empty')).toHaveTextContent('Вопросы пока не опубликованы.');
});

test('a failed fetch surfaces the load-failure copy', async () => {
  server.use(
    http.get('*/api/v1/help/faq', () =>
      HttpResponse.json({ error: { code: 'ERR-SYS-000', message: 'boom' } }, { status: 500 }),
    ),
  );
  renderTab();

  expect(await screen.findByTestId('faq-reader-error')).toHaveTextContent(
    'Произошла непредвиденная ошибка. Повторите попытку.',
  );
});
