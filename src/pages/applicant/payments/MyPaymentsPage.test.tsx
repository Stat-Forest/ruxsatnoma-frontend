import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { DICTIONARIES, I18nContext } from '../../../i18n/context';
import { MyPaymentsPage } from './MyPaymentsPage';

function page<T>(items: T[]) {
  return { items, total: items.length, page: 1, page_size: 50 };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** The four GETs either tab (or the applications index both share) can fire
 * — all answering an empty page, so each tab's own empty-state text is what
 * distinguishes it on screen. */
function mockBackend() {
  server.use(
    http.get('*/api/v1/refunds', () => HttpResponse.json(page([]))),
    http.get('*/api/v1/invoices', () => HttpResponse.json(page([]))),
    http.get('*/api/v1/applications', () => HttpResponse.json(page([]))),
    http.get('*/api/v1/refs/classifiers/refund_reasons/items', () => HttpResponse.json([])),
  );
}

function renderPage(initialEntry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const i18n = {
    lang: 'uz_latn' as const,
    backendLang: 'uz_latn' as const,
    t: (key: string) => (DICTIONARIES.uz_latn as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>{children}</I18nContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>
  );
  return render(<MyPaymentsPage />, { wrapper });
}

test('?tab=refunds opens the refunds tab, not the invoices one', async () => {
  mockBackend();
  renderPage('/my/payments?tab=refunds');

  expect(await screen.findByText('Qaytarish soʻrovlari yoʻq.')).toBeInTheDocument();
  expect(screen.queryByText('Hali hisob-faktura yoʻq.')).not.toBeInTheDocument();
});

test('with no ?tab the invoices tab opens by default', async () => {
  mockBackend();
  renderPage('/my/payments');

  expect(await screen.findByText('Hali hisob-faktura yoʻq.')).toBeInTheDocument();
  expect(screen.queryByText('Qaytarish soʻrovlari yoʻq.')).not.toBeInTheDocument();
});
