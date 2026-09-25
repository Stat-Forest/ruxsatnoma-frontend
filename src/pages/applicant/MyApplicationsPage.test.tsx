import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { I18nContext } from '../../i18n/context';
import { MyApplicationsPage } from './MyApplicationsPage';
import type { ApplicationOut } from './api';

const APPLICATION_ID = 'a1000000-0000-4000-8000-000000000001';

function row(over: Partial<ApplicationOut> = {}): ApplicationOut {
  return {
    id: APPLICATION_ID,
    number: 'RX-2026-000001',
    status: 'IN_REVIEW',
    applicant_id: 'ap000000-0000-4000-8000-000000000001',
    submitted_by_user_id: 'u0000000-0000-4000-8000-000000000001',
    on_behalf: 'self',
    representation_id: null,
    activity_type_id: null,
    contour_id: null,
    contour_version_id: null,
    requested_area_ha: '12.5',
    period_from: '2026-01-01',
    period_to: '2026-12-31',
    quantity: null,
    // Decision #215 R6: the deadwood and recreation blanks' own lines —
    // required by the schema (nullable), null for every other activity.
    deadwood_product: null,
    removal_deadline: null,
    recreation_purpose: null,
    event_at: null,
    channel: 'portal',
    kind: 'new',
    benefit_category_item_id: null,
    // Ruling #179 (stage 9): a benefit claim now carries its certificate and
    // the verification it is waiting on — required by the schema, so every
    // fixture states them rather than leaning on `undefined`.
    benefit_certificate_no: null,
    benefit_verification_status: 'not_required' as const,
    benefit_verified_by: null,
    benefit_verified_at: null,
    benefit_rejection_reason: null,
    rules_accepted_at: null,
    rejection_reason_item_id: null,
    assigned_org_id: null,
    assigned_user_id: null,
    parent_application_id: null,
    sla_deadline_at: null,
    submitted_at: '2026-09-01T10:00:00+05:00',
    decided_at: null,
    created_at: '2026-09-01T10:00:00+05:00',
    updated_at: '2026-09-01T10:00:00+05:00',
    ...over,
  };
}

const server = setupServer(
  http.get('*/api/v1/refs/activity-types', () => HttpResponse.json([])),
  http.get('*/api/v1/applications', () => HttpResponse.json({ items: [row()], total: 1, page: 1, page_size: 20 })),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-location">{location.pathname}</div>;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>
          <MyApplicationsPage />
          <LocationProbe />
        </I18nContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

test('a click anywhere on a row opens the application, not only "Ochish"', async () => {
  renderPage();
  // The number is also on the mobile card; the desktop table's cell is the <td>.
  const cell = (await screen.findAllByText('RX-2026-000001')).find((el) => el.closest('td'))!;
  await userEvent.setup().click(cell);
  expect(screen.getByTestId('current-location')).toHaveTextContent(`/my/applications/${APPLICATION_ID}`);
});

test('an empty list disables the Excel button — there is nothing to export', async () => {
  server.use(
    http.get('*/api/v1/applications', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 20 })),
  );

  renderPage();
  // Rendered twice — the mobile card empty state and the desktop DataTable's
  // own — both mounted at once and toggled by CSS breakpoint, not by JS.
  await screen.findAllByText('Hozircha arizalar yoʻq');

  expect(screen.getByTestId('export-xlsx')).toBeDisabled();
});

test('the Excel button asks the server for the export with the applied filter and no paging (stage 13)', async () => {
  let exportUrl: URL | null = null;
  server.use(
    http.get('*/api/v1/applications/export.xlsx', ({ request }) => {
      exportUrl = new URL(request.url);
      return HttpResponse.text('xlsx-bytes', {
        headers: { 'Content-Disposition': 'attachment; filename="arizalar.xlsx"', 'X-Export-Truncated': 'false' },
      });
    }),
  );
  const createObjectURL = vi.fn().mockReturnValue('blob:mock');
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  renderPage();
  await screen.findAllByText('RX-2026-000001');
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText('Holati'), 'IN_REVIEW');
  await user.click(screen.getByTestId('export-xlsx'));

  await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  expect(exportUrl!.searchParams.get('status')).toBe('IN_REVIEW');
  expect(exportUrl!.searchParams.get('lang')).toBe('uz_latn');
  expect(exportUrl!.searchParams.has('page')).toBe(false);
  expect(exportUrl!.searchParams.has('page_size')).toBe(false);
});

function captureListRequests() {
  const seen: URL[] = [];
  server.use(
    http.get('*/api/v1/applications', ({ request }) => {
      seen.push(new URL(request.url));
      return HttpResponse.json({ items: [row()], total: 1, page: 1, page_size: 20 });
    }),
  );
  return seen;
}

test('the date window filters by the filing day by default, and by the period once switched', async () => {
  const seen = captureListRequests();
  renderPage();
  await screen.findAllByText('RX-2026-000001');
  const user = userEvent.setup();

  await user.type(screen.getByLabelText('Sana — dan'), '2026-09-01');
  await user.type(screen.getByLabelText('Sana — gacha'), '2026-09-30');
  await waitFor(() => expect(seen.at(-1)!.searchParams.get('created_to')).toBe('2026-09-30'));
  let last = seen.at(-1)!;
  expect(last.searchParams.get('created_from')).toBe('2026-09-01');
  expect(last.searchParams.has('period_from')).toBe(false);
  expect(last.searchParams.has('period_to')).toBe(false);

  await user.click(screen.getByRole('button', { name: 'Davr' }));
  await waitFor(() => expect(seen.at(-1)!.searchParams.get('period_to')).toBe('2026-09-30'));
  last = seen.at(-1)!;
  expect(last.searchParams.get('period_from')).toBe('2026-09-01');
  expect(last.searchParams.has('created_from')).toBe(false);
  expect(last.searchParams.has('created_to')).toBe(false);
  expect(screen.getByRole('button', { name: 'Davr' })).toHaveAttribute('aria-pressed', 'true');
});

test('a reversed window is refused on the form and never sent', async () => {
  const seen = captureListRequests();
  renderPage();
  await screen.findAllByText('RX-2026-000001');
  const user = userEvent.setup();

  await user.type(screen.getByLabelText('Sana — dan'), '2026-09-30');
  await user.type(screen.getByLabelText('Sana — gacha'), '2026-09-01');

  expect(await screen.findByRole('alert')).toHaveTextContent('Boshlanish sanasi tugash sanasidan keyin boʻlmasligi kerak');
  const last = seen.at(-1)!;
  expect(last.searchParams.has('created_from')).toBe(false);
  expect(last.searchParams.has('created_to')).toBe(false);
});

test('the Excel button carries the date window too', async () => {
  let exportUrl: URL | null = null;
  server.use(
    http.get('*/api/v1/applications/export.xlsx', ({ request }) => {
      exportUrl = new URL(request.url);
      return HttpResponse.text('xlsx-bytes', {
        headers: { 'Content-Disposition': 'attachment; filename="arizalar.xlsx"', 'X-Export-Truncated': 'false' },
      });
    }),
  );
  const createObjectURL = vi.fn().mockReturnValue('blob:mock');
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  renderPage();
  await screen.findAllByText('RX-2026-000001');
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Sana — dan'), '2026-09-01');
  await user.click(screen.getByTestId('export-xlsx'));

  await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  expect(exportUrl!.searchParams.get('created_from')).toBe('2026-09-01');
});

test('each status is drawn in its own colour, not the one blue for all', async () => {
  server.use(
    http.get('*/api/v1/applications', () =>
      HttpResponse.json({
        items: [
          row({ id: 'a1000000-0000-4000-8000-000000000011', number: 'RX-1', status: 'SUBMITTED' }),
          row({ id: 'a1000000-0000-4000-8000-000000000012', number: 'RX-2', status: 'INVOICED' }),
        ],
        total: 2,
        page: 1,
        page_size: 20,
      }),
    ),
  );
  renderPage();
  // The status <select> lists the same labels as <option>s; only badges carry `data-status`.
  const badge = (els: HTMLElement[]) => els.map((el) => el.closest('[data-status]')).find((el) => el !== null)!;
  await screen.findAllByText('RX-1');
  const submitted = badge(screen.getAllByText('Yuborildi'));
  const invoiced = badge(screen.getAllByText('Hisob-faktura chiqarildi'));
  expect(submitted.className).not.toBe(invoiced.className);
});
