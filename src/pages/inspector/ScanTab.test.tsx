/**
 * С15 — permit lookup by QR/token (the anonymous `GET /public/permits/check`
 * a citizen would use — no authenticated equivalent exists for a scanned
 * token, see `queries.ts::usePermitByNumber`'s own comment) or by series+
 * number (F17 — the inspector's OWN authenticated read, `GET /permits`,
 * `permits.view_any`, never the masked citizen view).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router';
import { I18nContext } from '../../i18n/context';
import { ScanTab } from './ScanTab';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderScanTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <MemoryRouter>
          <ScanTab />
        </MemoryRouter>
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

test('a found permit renders every field the endpoint returns', async () => {
  server.use(
    http.get('*/api/v1/public/permits/check', () =>
      HttpResponse.json({
        found: true,
        status: 'амалда',
        valid_from: '2026-01-01',
        valid_to: '2026-12-31',
        organization: 'Toshkent tumani oʻrmon xoʻjaligi',
        activity_type: 'Chorva boqish',
        signatures_valid: true,
        holder: 'A*** B***',
      }),
    ),
  );

  const user = userEvent.setup();
  renderScanTab();
  await user.type(screen.getByPlaceholderText('inspector.scan.qrPlaceholder'), 'TOKEN-1');
  await user.click(screen.getByText('inspector.scan.checkButton'));

  expect(await screen.findByText('амалда')).toBeInTheDocument();
  expect(screen.getByText('Toshkent tumani oʻrmon xoʻjaligi')).toBeInTheDocument();
  expect(screen.getByText('Chorva boqish')).toBeInTheDocument();
  expect(screen.getByText('A*** B***')).toBeInTheDocument();
  expect(screen.getByText('inspector.scan.signaturesValidYes')).toBeInTheDocument();
});

test('an unknown code renders the plain not-found card, never an error', async () => {
  server.use(http.get('*/api/v1/public/permits/check', () => HttpResponse.json({ found: false })));

  const user = userEvent.setup();
  renderScanTab();
  await user.type(screen.getByPlaceholderText('inspector.scan.qrPlaceholder'), 'UNKNOWN');
  await user.click(screen.getByText('inspector.scan.checkButton'));

  expect(await screen.findByText('inspector.scan.notFound')).toBeInTheDocument();
});

test('pasting a full check URL sends only the qr token it names', async () => {
  let capturedQr: string | null = null;
  server.use(
    http.get('*/api/v1/public/permits/check', ({ request }) => {
      capturedQr = new URL(request.url).searchParams.get('qr');
      return HttpResponse.json({ found: false });
    }),
  );

  const user = userEvent.setup();
  renderScanTab();
  await user.type(screen.getByPlaceholderText('inspector.scan.qrPlaceholder'), 'https://ruxsatnoma.uz/check?qr=XYZ789');
  await user.click(screen.getByText('inspector.scan.checkButton'));

  await waitFor(() => expect(capturedQr).toBe('XYZ789'));
});

test('the series+number path calls the authenticated permits read, never the anonymous public check', async () => {
  let capturedQuery: { series: string | null; number: string | null } | null = null;
  server.use(
    http.get('*/api/v1/permits', ({ request }) => {
      const url = new URL(request.url);
      capturedQuery = { series: url.searchParams.get('series'), number: url.searchParams.get('number') };
      return HttpResponse.json({ items: [], total: 0, page: 1, page_size: 1 });
    }),
    // If the fix regresses and the number path falls back to the anonymous
    // endpoint, this handler answers it — `onUnhandledRequest: 'error'`
    // alone would also catch that, this just makes the failure legible.
    http.get('*/api/v1/public/permits/check', () =>
      HttpResponse.json({ __wrongEndpointCalled: true }, { status: 500 }),
    ),
  );

  const user = userEvent.setup();
  renderScanTab();
  expect(screen.queryByText('inspector.scan.seriesLabel')).not.toBeInTheDocument();

  await user.click(screen.getByText('inspector.scan.orByNumberLabel'));
  await user.type(screen.getByPlaceholderText('А'), 'А');
  await user.type(screen.getByPlaceholderText('000002'), '000042');
  await user.click(screen.getAllByText('inspector.scan.checkButton')[1]);

  await waitFor(() => expect(capturedQuery).toEqual({ series: 'А', number: '42' }));
  expect(await screen.findByText('inspector.scan.notFound')).toBeInTheDocument();
});

test('a permit found by series+number renders the FULL authenticated record — real id, contour, load, no mask', async () => {
  server.use(
    http.get('*/api/v1/permits', () =>
      HttpResponse.json({
        items: [
          {
            id: 'a1a1a1a1-0000-4000-8000-000000000001',
            series: 'А',
            number: 42,
            status: 'active',
            application_id: 'b2b2b2b2-0000-4000-8000-000000000002',
            applicant_id: 'c3c3c3c3-0000-4000-8000-000000000003',
            activity_type_id: 'activity-grazing',
            organization_id: 'org-1',
            contour_id: 'contour-1',
            contour_version_id: 'd4d4d4d4-0000-4000-8000-000000000004',
            area_ha: '65.0700',
            period_from: '2026-05-01',
            period_to: '2026-07-31',
            amount: '2200000.00',
            sb_load: '50.0000',
            pdf_file_id: null,
            doc_hash: null,
            template_id: null,
            issued_at: '2026-05-02T10:00:00+05:00',
            created_at: '2026-05-01T09:00:00+05:00',
          },
        ],
        total: 1,
        page: 1,
        page_size: 1,
      }),
    ),
    http.get('*/api/v1/refs/activity-types', () =>
      HttpResponse.json([{ id: 'activity-grazing', code: 'grazing', name: { uz_latn: 'Chorva boqish' } }]),
    ),
    http.get('*/api/v1/refs/organizations', () =>
      HttpResponse.json({
        items: [{ id: 'org-1', code: 'burchmulla', kind: 'leshoz', name: { uz_latn: 'Burchmulla OʻXH' } }],
        total: 1,
        page: 1,
        page_size: 100,
      }),
    ),
    http.get('*/api/v1/gis/contours/contour-1', () => HttpResponse.json({ id: 'contour-1', number: '10517қ' })),
  );

  const user = userEvent.setup();
  renderScanTab();
  await user.click(screen.getByText('inspector.scan.orByNumberLabel'));
  await user.type(screen.getByPlaceholderText('А'), 'А');
  await user.type(screen.getByPlaceholderText('000002'), '000042');
  await user.click(screen.getAllByText('inspector.scan.checkButton')[1]);

  expect(await screen.findByText('А № 000042')).toBeInTheDocument();
  expect(await screen.findByText('Burchmulla OʻXH')).toBeInTheDocument();
  expect(screen.getByText('Chorva boqish')).toBeInTheDocument();
  expect(await screen.findByText('№ 10517қ')).toBeInTheDocument();
  expect(screen.getByText('50')).toBeInTheDocument();
  const link = screen.getByRole('link', { name: 'inspector.scan.openFullRecord' });
  expect(link).toHaveAttribute('href', '/permits/a1a1a1a1-0000-4000-8000-000000000001');
});
