/**
 * Stage 13, Track B: the «Excel» button on both permit list screens —
 * `PermitsPage` (staff, `variant="staff"`) and `MyPermitsPage` (the citizen's
 * own list, `variant="applicant"`, same component). Both send the SAME
 * request shape to the SAME route (`GET /permits/export.xlsx` is scoped
 * server-side to the caller exactly like `GET /permits` itself,
 * `permits/service.py::list_permits`), so one test file covers both — the
 * idiom is `staff/ApplicationsListPage.test.tsx`'s "the Excel button asks
 * the server…" test.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { I18nContext } from '../../i18n/context';
import { PermitsListPage } from './PermitsListPage';
import type { PermitOut } from './queries';

function permit(over: Partial<PermitOut> = {}): PermitOut {
  return {
    id: 'p1000000-0000-4000-8000-000000000001',
    series: 'А',
    number: 155,
    status: 'active',
    application_id: 'a1000000-0000-4000-8000-000000000001',
    applicant_id: 'ap000000-0000-4000-8000-000000000001',
    activity_type_id: 'at000000-0000-4000-8000-000000000001',
    organization_id: 'o1000000-0000-4000-8000-000000000001',
    contour_id: 'c1000000-0000-4000-8000-000000000001',
    contour_version_id: 'cv000000-0000-4000-8000-000000000001',
    area_ha: '12.5000',
    period_from: '2027-05-01',
    period_to: '2027-09-30',
    amount: '2060000.00',
    sb_load: '40.0000',
    pdf_file_id: null,
    doc_hash: null,
    template_id: null,
    issued_at: '2027-05-02T08:00:00+05:00',
    created_at: '2027-05-01T10:00:00+05:00',
    ...over,
  };
}

const server = setupServer(
  http.get('*/api/v1/refs/activity-types', () => HttpResponse.json([])),
  http.get('*/api/v1/refs/organizations', () =>
    HttpResponse.json({ items: [], total: 0, page: 1, page_size: 100 }),
  ),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPage(variant: 'staff' | 'applicant') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = {
    lang: 'uz_latn' as const,
    backendLang: 'uz_latn' as const,
    t: (key: string) => key,
    setLanguage: async () => {},
  };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <MemoryRouter>
          <PermitsListPage variant={variant} />
        </MemoryRouter>
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

/** jsdom's URL has no createObjectURL/revokeObjectURL — assigned directly
 *  (never `vi.stubGlobal('URL', {...})`, which would replace the constructor
 *  and break MSW's own `new URL(request.url)` parsing). */
function stubDownload() {
  const createObjectURL = vi.fn().mockReturnValue('blob:mock');
  const revokeObjectURL = vi.fn();
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  return { createObjectURL, clickSpy };
}

test('staff: the Excel button asks the server for the export with the applied filters, never paging the list itself', async () => {
  const user = userEvent.setup();
  const listCalls: string[] = [];
  let exportUrl: URL | null = null;
  server.use(
    http.get('*/api/v1/permits', ({ request }) => {
      listCalls.push(request.url);
      return HttpResponse.json({
        items: [permit()],
        total: 1,
        page: 1,
        page_size: 20,
      });
    }),
    http.get('*/api/v1/permits/export.xlsx', ({ request }) => {
      exportUrl = new URL(request.url);
      return HttpResponse.text('xlsx-bytes', {
        headers: {
          'Content-Disposition': 'attachment; filename="ruxsatnomalar-2027-05-01.xlsx"',
          'X-Export-Total': '1',
          'X-Export-Rows': '1',
          'X-Export-Truncated': 'false',
        },
      });
    }),
  );

  const { createObjectURL, clickSpy } = stubDownload();

  renderPage('staff');
  await screen.findByText('А № 000155');
  const listCallsBefore = listCalls.length;

  await user.click(screen.getByTestId('export-xlsx'));

  await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  expect(clickSpy).toHaveBeenCalled();
  expect(listCalls.length).toBe(listCallsBefore); // the export never re-fetches the list
  expect(exportUrl!.searchParams.get('lang')).toBe('uz_latn');
  expect(exportUrl!.searchParams.has('page')).toBe(false);
  expect(exportUrl!.searchParams.has('page_size')).toBe(false);
});

test("the citizen's own list (/my/permits): the Excel button asks the server for the export, scoped to the caller like the list itself", async () => {
  const user = userEvent.setup();
  const listCalls: string[] = [];
  let exportUrl: URL | null = null;
  server.use(
    http.get('*/api/v1/permits', ({ request }) => {
      listCalls.push(request.url);
      return HttpResponse.json({
        items: [permit()],
        total: 1,
        page: 1,
        page_size: 20,
      });
    }),
    http.get('*/api/v1/permits/export.xlsx', ({ request }) => {
      exportUrl = new URL(request.url);
      return HttpResponse.text('xlsx-bytes', {
        headers: {
          'Content-Disposition': 'attachment; filename="ruxsatnomalar-2027-05-01.xlsx"',
          'X-Export-Total': '1',
          'X-Export-Rows': '1',
          'X-Export-Truncated': 'false',
        },
      });
    }),
  );

  const { createObjectURL, clickSpy } = stubDownload();

  renderPage('applicant');
  await screen.findByText('А № 000155');
  const listCallsBefore = listCalls.length;

  await user.click(screen.getByTestId('export-xlsx'));

  await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  expect(clickSpy).toHaveBeenCalled();
  expect(listCalls.length).toBe(listCallsBefore); // the export never re-fetches the list
  // The applicant variant never sends `organization_id` (queryFilters drops it
  // for a non-staff caller) — the export's query must not carry it either,
  // since it is built from the SAME `toPermitsQuery(queryFilters)` object.
  expect(exportUrl!.searchParams.has('organization_id')).toBe(false);
  expect(exportUrl!.searchParams.get('lang')).toBe('uz_latn');
  expect(exportUrl!.searchParams.has('page')).toBe(false);
  expect(exportUrl!.searchParams.has('page_size')).toBe(false);
});
