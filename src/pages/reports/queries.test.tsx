/**
 * Standing regression test: `list_forms_api_v1_reports_forms_get` and
 * `list_reports_api_v1_reports_get` both declare `query?: { ...; page?:
 * number; page_size?: number }` in `src/api/schema.d.ts` — this route
 * family pages by `page`/`page_size`, NOT `offset`/`limit` the way
 * `pages/norms/tariffs` does. A stage-6.7 task brief that spawned this
 * track's own plan claimed the opposite ("send offset"); worth pinning here
 * so a future edit that "fixes" this back to `offset` fails loudly with a
 * 422 from the mock server instead of silently shipping.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest';
import { useReportFormsList, useReportsList } from './queries';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

test('useReportsList sends page/page_size (never offset/limit) and reads total/page/page_size back', async () => {
  const seenQuery = vi.fn();
  server.use(
    http.get('*/api/v1/reports', ({ request }) => {
      const url = new URL(request.url);
      seenQuery(Object.fromEntries(url.searchParams.entries()));
      return HttpResponse.json({ items: [], total: 7, page: 2, page_size: 20 });
    }),
  );

  const { result } = renderHook(() => useReportsList({ page: 2, page_size: 20 }), { wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(seenQuery).toHaveBeenCalledWith(expect.objectContaining({ page: '2', page_size: '20' }));
  const params = seenQuery.mock.calls[0][0] as Record<string, string>;
  expect(params.offset).toBeUndefined();
  expect(params.limit).toBeUndefined();
  expect(result.current.data).toEqual({ items: [], total: 7, page: 2, page_size: 20 });
});

test('useReportFormsList sends page/page_size (never offset/limit) and reads total/page/page_size back', async () => {
  const seenQuery = vi.fn();
  server.use(
    http.get('*/api/v1/reports/forms', ({ request }) => {
      const url = new URL(request.url);
      seenQuery(Object.fromEntries(url.searchParams.entries()));
      return HttpResponse.json({ items: [], total: 3, page: 1, page_size: 50 });
    }),
  );

  const { result } = renderHook(() => useReportFormsList({ page: 1, page_size: 50 }), { wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(seenQuery).toHaveBeenCalledWith(expect.objectContaining({ page: '1', page_size: '50' }));
  const params = seenQuery.mock.calls[0][0] as Record<string, string>;
  expect(params.offset).toBeUndefined();
  expect(params.limit).toBeUndefined();
  expect(result.current.data).toEqual({ items: [], total: 3, page: 1, page_size: 50 });
});
