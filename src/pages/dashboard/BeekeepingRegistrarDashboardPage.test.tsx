/**
 * The Beekeeping Union registrar's home screen: the register's counts as of
 * today and the year's apiary-benefit claims, one line per fate. Rendered
 * directly; which role reaches it is `DashboardPage.test.tsx`'s job.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { I18nContext } from '../../i18n/context';
import type { BeekeepersSummaryOut, BeekeepingClaimsSummaryOut } from '../beekeepers/api';
import { BeekeepingRegistrarDashboardPage } from './BeekeepingRegistrarDashboardPage';

const REGISTER: BeekeepersSummaryOut = {
  as_of: '2026-10-04',
  active: 42,
  removed: 3,
  expired: 5,
  expiring_soon: 2,
  expiring_within_days: 30,
};

function claims(year: number, over: Partial<BeekeepingClaimsSummaryOut> = {}): BeekeepingClaimsSummaryOut {
  return {
    year,
    years: [2026, 2025],
    total: 10,
    in_review: 4,
    awaiting_payment: 3,
    permit_issued: 2,
    rejected: 1,
    cancelled_or_unpaid: 0,
    ...over,
  };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>
          <BeekeepingRegistrarDashboardPage />
        </I18nContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function tileValue(testId: string): string {
  return within(screen.getByTestId(testId)).getByTestId(`${testId}-value`).textContent ?? '';
}

test('shows the register as of today and the current year of claims, one tile per line', async () => {
  const seenYears: (string | null)[] = [];
  server.use(
    http.get('*/api/v1/beekeepers/summary', () => HttpResponse.json(REGISTER)),
    http.get('*/api/v1/applications/beekeeping/summary', ({ request }) => {
      seenYears.push(new URL(request.url).searchParams.get('year'));
      return HttpResponse.json(claims(2026));
    }),
  );
  renderPage();

  await waitFor(() => expect(tileValue('registrar-tile-active')).toBe('42'));
  expect(tileValue('registrar-tile-removed')).toBe('3');
  expect(tileValue('registrar-tile-expired')).toBe('5');
  expect(tileValue('registrar-tile-expiring-soon')).toBe('2');

  await waitFor(() => expect(tileValue('registrar-tile-claims-total')).toBe('10'));
  expect(tileValue('registrar-tile-claims-in-review')).toBe('4');
  expect(tileValue('registrar-tile-claims-awaiting-payment')).toBe('3');
  expect(tileValue('registrar-tile-claims-permit-issued')).toBe('2');
  expect(tileValue('registrar-tile-claims-rejected')).toBe('1');
  expect(tileValue('registrar-tile-claims-cancelled')).toBe('0');
  // The first request asks for no year: the backend's own "current year"
  // is the default, never the browser's clock.
  expect(seenYears[0]).toBeNull();

  expect(screen.getByTestId('registrar-open-register')).toHaveAttribute('href', '/beekeepers');
  expect(screen.getByTestId('registrar-open-claims')).toHaveAttribute('href', '/beekeepers?tab=claims');
});

test('switching the year asks the backend for that year and shows its figures', async () => {
  const user = userEvent.setup();
  server.use(
    http.get('*/api/v1/beekeepers/summary', () => HttpResponse.json(REGISTER)),
    http.get('*/api/v1/applications/beekeeping/summary', ({ request }) => {
      const year = new URL(request.url).searchParams.get('year');
      return HttpResponse.json(year === '2025' ? claims(2025, { total: 12, in_review: 0, permit_issued: 12 }) : claims(2026));
    }),
  );
  renderPage();

  await waitFor(() => expect(tileValue('registrar-tile-claims-total')).toBe('10'));
  await user.selectOptions(screen.getByTestId('registrar-claims-year'), '2025');

  await waitFor(() => expect(tileValue('registrar-tile-claims-total')).toBe('12'));
  expect(tileValue('registrar-tile-claims-permit-issued')).toBe('12');
  expect(tileValue('registrar-tile-claims-in-review')).toBe('0');
});

test('a failed request says so instead of drawing zeros', async () => {
  server.use(
    http.get('*/api/v1/beekeepers/summary', () =>
      HttpResponse.json({ error: { code: 'ERR-SYS-001', message: 'boom' } }, { status: 500 }),
    ),
    http.get('*/api/v1/applications/beekeeping/summary', () => HttpResponse.json(claims(2026))),
  );
  renderPage();

  expect(await screen.findByTestId('registrar-register-error')).toBeInTheDocument();
  expect(screen.queryByTestId('registrar-tile-active')).not.toBeInTheDocument();
});
