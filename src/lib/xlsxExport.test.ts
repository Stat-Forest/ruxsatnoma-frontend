/**
 * Stage 13 (ruling #204): the one download path every register's «Excel»
 * button goes through. What it must hold:
 *   1. the export URL carries the screen's OWN query — every filter and the
 *      search, none of the paging keys, nothing empty — plus `lang`;
 *   2. the file is saved under the server's `Content-Disposition` name;
 *   3. the truncation headers come back as data, so a screen can warn;
 *   4. a refusal surfaces the server's own `error.message`.
 */
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest';
import { buildExportUrl, downloadXlsx, exportLang } from './xlsxExport';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

test('buildExportUrl keeps the filters, drops paging and empties, adds lang', () => {
  const url = buildExportUrl(
    '/api/v1/applications',
    { status: 'IN_REVIEW', number: '', contour_id: undefined, applicant_id: null, page: 3, page_size: 20, limit: 50, offset: 100, unread: true },
    'ru',
  );
  const parsed = new URL(url);
  expect(parsed.pathname).toBe('/api/v1/applications/export.xlsx');
  expect([...parsed.searchParams.entries()]).toEqual([
    ['status', 'IN_REVIEW'],
    ['unread', 'true'],
    ['lang', 'ru'],
  ]);
});

test('exportLang maps the five UI languages onto the two the server renders', () => {
  expect(exportLang('ru')).toBe('ru');
  expect(exportLang('uz_latn')).toBe('uz_latn');
  expect(exportLang('uz_cyrl')).toBe('uz_latn');
  expect(exportLang('kaa')).toBe('uz_latn');
  expect(exportLang('en')).toBe('uz_latn');
});

function stubDownload() {
  const createObjectURL = vi.fn().mockReturnValue('blob:mock');
  const revokeObjectURL = vi.fn();
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  const clicked: string[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push(this.download);
  });
  return { createObjectURL, revokeObjectURL, clicked };
}

test('downloadXlsx saves the file under the server name and reports the truncation headers', async () => {
  let seen: URL | null = null;
  server.use(
    http.get('*/api/v1/permits/export.xlsx', ({ request }) => {
      seen = new URL(request.url);
      // A string body: jsdom's `Blob` is not undici's, and msw hands the body to
      // undici's `Response` — a jsdom Blob there is "object.stream is not a function".
      return HttpResponse.text('x', {
        headers: {
          'Content-Type': XLSX,
          'Content-Disposition': `attachment; filename="ruxsatnomalar-2026-09-11.xlsx"; filename*=UTF-8''ruxsatnomalar-2026-09-11.xlsx`,
          'X-Export-Total': '12340',
          'X-Export-Rows': '10000',
          'X-Export-Truncated': 'true',
        },
      });
    }),
  );
  const { createObjectURL, revokeObjectURL, clicked } = stubDownload();

  const result = await downloadXlsx('/api/v1/permits', { status: 'active' }, 'uz_latn');

  expect(seen!.searchParams.get('status')).toBe('active');
  expect(seen!.searchParams.get('lang')).toBe('uz_latn');
  expect(result).toEqual({ truncated: true, total: 12340, rows: 10000 });
  expect(clicked).toEqual(['ruxsatnomalar-2026-09-11.xlsx']);
  expect(createObjectURL).toHaveBeenCalledTimes(1);
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
});

test('downloadXlsx decodes a non-ASCII filename* and falls back to a generated name', async () => {
  server.use(
    http.get('*/api/v1/a/export.xlsx', () =>
      HttpResponse.text('x', {
        headers: { 'Content-Disposition': `attachment; filename="arizalar.xlsx"; filename*=UTF-8''%D0%B7%D0%B0%D1%8F%D0%B2%D0%BA%D0%B8.xlsx` },
      }),
    ),
    http.get('*/api/v1/b/export.xlsx', () => HttpResponse.text('x')),
  );
  const { clicked } = stubDownload();
  await downloadXlsx('/api/v1/a', {}, 'ru');
  await downloadXlsx('/api/v1/b', {}, 'ru');
  expect(clicked[0]).toBe('заявки.xlsx');
  expect(clicked[1]).toMatch(/^b-\d{4}-\d{2}-\d{2}\.xlsx$/);
});

test('downloadXlsx surfaces the server error message on a refusal', async () => {
  server.use(
    http.get('*/api/v1/invoices/export.xlsx', () =>
      HttpResponse.json({ error: { code: 'ERR-ACL-001', message: 'Ruxsat yoʻq' } }, { status: 403 }),
    ),
  );
  stubDownload();
  await expect(downloadXlsx('/api/v1/invoices', {}, 'uz_latn')).rejects.toThrow('Ruxsat yoʻq');
});
