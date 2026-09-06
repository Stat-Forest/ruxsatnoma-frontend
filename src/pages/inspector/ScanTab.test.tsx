/**
 * С15 — permit lookup by QR/token or series+number, both through the same
 * anonymous `GET /public/permits/check` a citizen would use.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
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
        <ScanTab />
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

test('the series+number path is collapsed until opened, and sends both fields', async () => {
  let capturedQuery: { series: string | null; number: string | null } | null = null;
  server.use(
    http.get('*/api/v1/public/permits/check', ({ request }) => {
      const url = new URL(request.url);
      capturedQuery = { series: url.searchParams.get('series'), number: url.searchParams.get('number') };
      return HttpResponse.json({ found: false });
    }),
  );

  const user = userEvent.setup();
  renderScanTab();
  expect(screen.queryByText('inspector.scan.seriesLabel')).not.toBeInTheDocument();

  await user.click(screen.getByText('inspector.scan.orByNumberLabel'));
  await user.type(screen.getByPlaceholderText('А'), 'А');
  await user.type(screen.getByPlaceholderText('000002'), '000042');
  await user.click(screen.getAllByText('inspector.scan.checkButton')[1]);

  await waitFor(() => expect(capturedQuery).toEqual({ series: 'А', number: '42' }));
});
