import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { LegalDocumentsPage } from './LegalDocumentsPage';
import { I18nContext, DICTIONARIES } from '../../../i18n/context';
import type { LegalDocumentAdminOut } from './api';

const DRAFT = 'd0000000-0000-4000-8000-000000000001';
const PUBLISHED = 'd0000000-0000-4000-8000-000000000002';
const ARCHIVED = 'd0000000-0000-4000-8000-000000000003';
const AUTHOR = 'u0000000-0000-4000-8000-000000000001';

function document(
  overrides: Partial<LegalDocumentAdminOut> & Pick<LegalDocumentAdminOut, 'id'>,
): LegalDocumentAdminOut {
  return {
    title: { uz_latn: "O'rmon kodeksi" },
    summary: null,
    doc_number: 'ZRU-475',
    adopted_on: '2018-04-16',
    source_url: null,
    file: null,
    status: 'draft',
    sort_order: 0,
    created_by: AUTHOR,
    created_at: '2026-09-01T09:00:00+05:00',
    ...overrides,
  };
}

const LIST: LegalDocumentAdminOut[] = [
  document({ id: DRAFT }),
  document({
    id: PUBLISHED,
    status: 'published',
    doc_number: 'VMQ-342',
    adopted_on: '2021-05-12',
    source_url: 'https://lex.uz/docs/5390790',
    title: { uz_latn: 'Chorva boqish nizomi', ru: 'Положение о выпасе' },
  }),
  document({ id: ARCHIVED, status: 'archived', doc_number: 'ST-04' }),
];

function page(items: LegalDocumentAdminOut[]) {
  return { items, total: items.length, page: 1, page_size: 20 };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function mockBackend(items: LegalDocumentAdminOut[] = LIST) {
  server.use(http.get('*/api/v1/admin/legal-documents', () => HttpResponse.json(page(items))));
}

function renderPage(lang: 'uz_latn' | 'ru' = 'uz_latn') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const i18n = {
    lang,
    backendLang: lang,
    t: (key: string) => (DICTIONARIES[lang] as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <LegalDocumentsPage />
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

test('every row shows the act number, its date and where it opens from', async () => {
  mockBackend();
  renderPage();

  const draftRow = await screen.findByTestId(`legal-document-row-${DRAFT}`);
  const publishedRow = screen.getByTestId(`legal-document-row-${PUBLISHED}`);

  expect(draftRow).toHaveTextContent('ZRU-475');
  expect(draftRow).toHaveTextContent('16.04.2018');
  expect(draftRow).toHaveAttribute('data-status', 'draft');
  expect(within(draftRow).getByTestId('legal-document-status')).toHaveTextContent('Qoralama');

  expect(publishedRow).toHaveTextContent('Chorva boqish nizomi');
  expect(within(publishedRow).getByTestId('legal-document-source')).toHaveTextContent(
    'lex.uz havolasi',
  );
});

test('only a draft offers Publish, and an archived row offers neither action', async () => {
  mockBackend();
  renderPage();

  const draftRow = await screen.findByTestId(`legal-document-row-${DRAFT}`);
  const publishedRow = screen.getByTestId(`legal-document-row-${PUBLISHED}`);
  const archivedRow = screen.getByTestId(`legal-document-row-${ARCHIVED}`);

  expect(within(draftRow).getByRole('button', { name: 'Chop etish' })).toBeInTheDocument();
  expect(within(publishedRow).queryByRole('button', { name: 'Chop etish' })).not.toBeInTheDocument();
  expect(within(archivedRow).queryByRole('button', { name: 'Arxivlash' })).not.toBeInTheDocument();
});

test('publishing asks first, then sends the row the operator confirmed', async () => {
  mockBackend();
  let published: string | null = null;
  server.use(
    http.post('*/api/v1/admin/legal-documents/:id/publish', ({ params }) => {
      published = String(params.id);
      return HttpResponse.json(document({ id: DRAFT, status: 'published' }));
    }),
  );
  renderPage();

  const draftRow = await screen.findByTestId(`legal-document-row-${DRAFT}`);
  await userEvent.click(within(draftRow).getByRole('button', { name: 'Chop etish' }));
  expect(await screen.findByTestId('legal-document-confirm')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Tasdiqlash' }));

  await waitFor(() => expect(published).toBe(DRAFT));
});

test('a publish the backend refuses is shown, not swallowed', async () => {
  /** `ERR-VAL-001 nothing_to_open`: the row has neither a PDF nor a link, and
   *  a silent no-op would leave the operator convinced the page is live. */
  mockBackend();
  server.use(
    http.post('*/api/v1/admin/legal-documents/:id/publish', () =>
      HttpResponse.json(
        {
          error: {
            code: 'ERR-VAL-001',
            message: 'Validation error',
            details: { reason: 'nothing_to_open' },
          },
        },
        { status: 422 },
      ),
    ),
  );
  renderPage();

  const draftRow = await screen.findByTestId(`legal-document-row-${DRAFT}`);
  await userEvent.click(within(draftRow).getByRole('button', { name: 'Chop etish' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Tasdiqlash' }));

  expect(await screen.findByTestId('legal-document-confirm-error')).toHaveTextContent(
    'PDF fayl yoki lex.uz havolasi',
  );
});

test('the empty register says so instead of showing an empty table', async () => {
  mockBackend([]);
  renderPage();

  expect(await screen.findByTestId('legal-documents-empty')).toBeInTheDocument();
});

test('a new document cannot be saved without its Latin title, number and date', async () => {
  mockBackend();
  let posted = false;
  server.use(
    http.post('*/api/v1/admin/legal-documents', () => {
      posted = true;
      return HttpResponse.json(document({ id: DRAFT }), { status: 201 });
    }),
  );
  renderPage('ru');

  await userEvent.click(await screen.findByRole('button', { name: 'Новый документ' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Сохранить' }));

  expect(await screen.findByTestId('legal-document-form-error')).toBeInTheDocument();
  expect(posted).toBe(false);
});

test('a filled form posts exactly what the editor typed', async () => {
  mockBackend();
  let body: unknown = null;
  server.use(
    http.post('*/api/v1/admin/legal-documents', async ({ request }) => {
      body = await request.json();
      return HttpResponse.json(document({ id: DRAFT }), { status: 201 });
    }),
  );
  renderPage('ru');

  await userEvent.click(await screen.findByRole('button', { name: 'Новый документ' }));
  await userEvent.type(screen.getByTestId('legal-document-title-uz_latn'), "O'rmon kodeksi");
  await userEvent.type(screen.getByTestId('legal-document-number'), 'ZRU-475');
  await userEvent.type(screen.getByTestId('legal-document-adopted'), '2018-04-16');
  await userEvent.type(
    screen.getByTestId('legal-document-source-url'),
    'https://lex.uz/docs/3799819',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

  await waitFor(() => expect(body).not.toBeNull());
  expect(body).toMatchObject({
    title: { uz_latn: "O'rmon kodeksi" },
    doc_number: 'ZRU-475',
    adopted_on: '2018-04-16',
    source_url: 'https://lex.uz/docs/3799819',
  });
});
