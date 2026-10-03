/**
 * Archive register screen (stage 6.9, track T69). `t` is the identity
 * function, in the style of `pages/inspector/TasksTab.test.tsx`.
 *
 * F23 (`docs/plans/07.3-findings.md`): the route itself gates on
 * `archive.view` (`RequireAuth`, exercised by `shell/navigation.test.tsx`),
 * but INSIDE the screen the archive/verify actions must additionally check
 * `archive.manage` — the tests below are what fails without that in-screen
 * check.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';
import { stubAuthActions } from '../../auth/testAuthActions';
import { DICTIONARIES, I18nContext } from '../../i18n/context';
import { ArchivePage } from './ArchivePage';
import type { ArchiveItemOut } from './api';

function page<T>(items: T[]) {
  return { items, total: items.length, page: 1, page_size: 20 };
}

function archiveItem(overrides: Partial<ArchiveItemOut> = {}): ArchiveItemOut {
  return {
    id: 'i1000000-0000-4000-8000-000000000001',
    object_type: 'application',
    object_id: 'a1000000-0000-4000-8000-000000000001',
    organization_id: null,
    archived_at: '2026-09-01T10:00:00+05:00',
    retention_until: null,
    content_hash: 'a'.repeat(64),
    storage_ref: 'archive/application/a1000000-0000-4000-8000-000000000001.json',
    status: 'stored',
    created_by: null,
    ...overrides,
  };
}

function authValue(permissions: string[]): AuthContextValue {
  return {
    me: {
      user: {
        id: 'u1000000-0000-4000-8000-000000000001',
        full_name: 'Test User',
        login: 'tester',
        phone: null,
        email: null,
        must_change_password: false,
        pinfl: null,
        language: 'uz_latn',
      },
      role: { code: 'central_admin', name: {} },
      permissions,
      zone: { region_id: null, district_id: null, organization_id: null },
      csrf_token: 'tok-1',
      is_superuser: false,
      applicant: null,
      registration_complete: true,
    },
    loading: false,
    authError: null,
    ...stubAuthActions(),
  };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderArchivePage(permissions: string[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>
          <AuthContext.Provider value={authValue(permissions)}>
            <ArchivePage />
          </AuthContext.Provider>
        </I18nContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

/**
 * Stage 14 (#205 R6): the three tests below find the "archive an object"
 * button and the by-number modal's own fields by their real `uz_latn` copy —
 * a person reads a number off the register and types it in, which the
 * identity `t` the rest of this file uses would never render. Same shape as
 * `accountant/RefundsTab.test.tsx`'s `renderTab`.
 */
function renderPage(permissions: string[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = {
    lang: 'uz_latn' as const,
    backendLang: 'uz_latn' as const,
    t: (key: string) => (DICTIONARIES.uz_latn as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>
          <AuthContext.Provider value={authValue(permissions)}>
            <ArchivePage />
          </AuthContext.Provider>
        </I18nContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

test('a view-only actor (archive.view alone) does not see the archive button or the verify action', async () => {
  server.use(
    http.get('*/api/v1/archive', () => HttpResponse.json(page([archiveItem()]))),
    http.get('*/api/v1/archive/:id', () => HttpResponse.json(archiveItem())),
    http.get('*/api/v1/refs/organizations', () => HttpResponse.json(page([]))),
  );

  const user = userEvent.setup();
  renderArchivePage(['archive.view']);

  await screen.findByTestId('archive-page');
  expect(screen.queryByText('archive.actions.newItem')).not.toBeInTheDocument();

  await user.click(await screen.findByText('archive.col.view'));
  await screen.findByTestId(`archive-item-detail-${archiveItem().id}`);
  expect(screen.queryByTestId('archive-verify-button')).not.toBeInTheDocument();
});

test('archiving an application posts its number to the by-number route', async () => {
  let posted: unknown = null;
  server.use(
    http.get('*/api/v1/archive', () => HttpResponse.json(page([]))),
    http.get('*/api/v1/refs/organizations', () => HttpResponse.json(page([]))),
    http.post('*/api/v1/archive/application/by-number', async ({ request }) => {
      posted = await request.json();
      return HttpResponse.json(archiveItem({ object_number: 'RX-2026-00001' }));
    }),
    http.get('*/api/v1/archive/:id', () => HttpResponse.json(archiveItem({ object_number: 'RX-2026-00001' }))),
  );

  const user = userEvent.setup();
  renderPage(['archive.view', 'archive.manage']);

  await user.click(await screen.findByRole('button', { name: DICTIONARIES.uz_latn['archive.actions.newItem'] }));
  await user.type(screen.getByTestId('archive-object-number'), ' RX-2026-00001 ');
  await user.click(screen.getByTestId('archive-object-submit'));

  await waitFor(() => expect(posted).toEqual({ number: 'RX-2026-00001', retention_until: null }));
  await screen.findByTestId(`archive-item-detail-${archiveItem().id}`);
});

test('archiving a permit posts series and number', async () => {
  let posted: unknown = null;
  server.use(
    http.get('*/api/v1/archive', () => HttpResponse.json(page([]))),
    http.get('*/api/v1/refs/organizations', () => HttpResponse.json(page([]))),
    http.post('*/api/v1/archive/permit/by-number', async ({ request }) => {
      posted = await request.json();
      return HttpResponse.json(archiveItem({ object_type: 'permit', object_number: 'А № 004182' }));
    }),
    http.get('*/api/v1/archive/:id', () =>
      HttpResponse.json(archiveItem({ object_type: 'permit', object_number: 'А № 004182' })),
    ),
  );

  const user = userEvent.setup();
  renderPage(['archive.view', 'archive.manage']);

  await user.click(await screen.findByRole('button', { name: DICTIONARIES.uz_latn['archive.actions.newItem'] }));
  await user.selectOptions(screen.getByTestId('archive-object-type'), 'permit');
  await user.type(screen.getByTestId('archive-permit-no'), 'А № 004182');
  await user.click(screen.getByTestId('archive-object-submit'));

  await waitFor(() => expect(posted).toEqual({ series: 'А', number: 4182, retention_until: null }));
  await screen.findByTestId(`archive-item-detail-${archiveItem().id}`);
});

test('a Latin "A" typed for the permit series posts the Cyrillic series the register uses (final review A2)', async () => {
  let posted: unknown = null;
  server.use(
    http.get('*/api/v1/archive', () => HttpResponse.json(page([]))),
    http.get('*/api/v1/refs/organizations', () => HttpResponse.json(page([]))),
    http.post('*/api/v1/archive/permit/by-number', async ({ request }) => {
      posted = await request.json();
      return HttpResponse.json(archiveItem({ object_type: 'permit', object_number: 'А № 004182' }));
    }),
    http.get('*/api/v1/archive/:id', () =>
      HttpResponse.json(archiveItem({ object_type: 'permit', object_number: 'А № 004182' })),
    ),
  );

  const user = userEvent.setup();
  renderPage(['archive.view', 'archive.manage']);

  await user.click(await screen.findByRole('button', { name: DICTIONARIES.uz_latn['archive.actions.newItem'] }));
  await user.selectOptions(screen.getByTestId('archive-object-type'), 'permit');
  await user.type(screen.getByTestId('archive-permit-no'), 'a4182'); // a Latin keyboard's own 'a'
  await user.click(screen.getByTestId('archive-object-submit'));

  await waitFor(() => expect(posted).toEqual({ series: 'А', number: 4182, retention_until: null }));
});

test('a permit number with trailing letters, or a zero, stays disabled and says so', async () => {
  server.use(
    http.get('*/api/v1/archive', () => HttpResponse.json(page([]))),
    http.get('*/api/v1/refs/organizations', () => HttpResponse.json(page([]))),
  );

  const user = userEvent.setup();
  renderPage(['archive.view', 'archive.manage']);

  await user.click(await screen.findByRole('button', { name: DICTIONARIES.uz_latn['archive.actions.newItem'] }));
  await user.selectOptions(screen.getByTestId('archive-object-type'), 'permit');
  const box = screen.getByTestId('archive-permit-no');
  await user.type(box, 'А 12abc');
  expect(screen.getByTestId('archive-object-submit')).toBeDisabled();
  expect(screen.getByText(DICTIONARIES.uz_latn['archive.newItemModal.permitNoInvalid'])).toBeInTheDocument();

  await user.clear(box);
  await user.type(box, 'А 0'); // the backend's `ge=1` — refused here, not sent (14-findings F18)
  expect(screen.getByTestId('archive-object-submit')).toBeDisabled();
});

test('an unknown number shows the not-found copy, not the raw code', async () => {
  server.use(
    http.get('*/api/v1/archive', () => HttpResponse.json(page([]))),
    http.get('*/api/v1/refs/organizations', () => HttpResponse.json(page([]))),
    http.post('*/api/v1/archive/application/by-number', () =>
      HttpResponse.json(
        { error: { code: 'ERR-SYS-003', message: 'x', details: {}, correlation_id: 'c' } },
        { status: 404 },
      ),
    ),
  );

  const user = userEvent.setup();
  renderPage(['archive.view', 'archive.manage']);

  await user.click(await screen.findByRole('button', { name: DICTIONARIES.uz_latn['archive.actions.newItem'] }));
  await user.type(screen.getByTestId('archive-object-number'), 'RX-2026-99999');
  await user.click(screen.getByTestId('archive-object-submit'));

  await screen.findByText('Bunday obyekt topilmadi');
  expect(screen.queryByText(/ERR-SYS-003/)).not.toBeInTheDocument();
});

test('the register shows the object number, with the id as the tooltip', async () => {
  server.use(
    http.get('*/api/v1/archive', () =>
      HttpResponse.json(
        page([archiveItem({ object_id: 'a1000000-0000-4000-8000-000000000001', object_number: 'RX-2026-00001' })]),
      ),
    ),
    http.get('*/api/v1/refs/organizations', () => HttpResponse.json(page([]))),
  );
  renderPage(['archive.view']);

  const cell = await screen.findByText('RX-2026-00001');
  expect(cell.closest('a')).toHaveAttribute('title', 'a1000000-0000-4000-8000-000000000001');
});

test('an archive.manage holder can verify a stored item, and the card reflects the new status', async () => {
  let verified = false;
  server.use(
    http.get('*/api/v1/archive', () => HttpResponse.json(page([archiveItem({ object_number: 'RX-2026-00001' })]))),
    http.get('*/api/v1/archive/:id', () =>
      HttpResponse.json(archiveItem({ object_number: 'RX-2026-00001', status: verified ? 'verified' : 'stored' })),
    ),
    http.post('*/api/v1/archive/:id/verify', () => {
      verified = true;
      return HttpResponse.json(archiveItem({ object_number: 'RX-2026-00001', status: 'verified' }));
    }),
    http.get('*/api/v1/refs/organizations', () => HttpResponse.json(page([]))),
  );

  const user = userEvent.setup();
  renderArchivePage(['archive.view', 'archive.manage']);

  await user.click(await screen.findByText('archive.col.view'));

  // Final review A3: the drawer shows the object's own public number, with
  // the raw id demoted to a tooltip — same treatment the register row and
  // the invoice drawer already got this stage. Scoped to the drawer itself:
  // the register row behind it renders the same number.
  const drawer = await screen.findByTestId(`archive-item-detail-${archiveItem().id}`);
  const objectLink = within(drawer).getByText('RX-2026-00001').closest('a');
  expect(objectLink).toHaveAttribute('title', archiveItem().object_id);

  const verifyButton = await screen.findByTestId('archive-verify-button');
  await user.click(verifyButton);

  await waitFor(() => expect(verified).toBe(true));
  await waitFor(() => expect(screen.queryByTestId('archive-verify-button')).not.toBeInTheDocument());
});

test('the empty state renders when the register is empty', async () => {
  server.use(
    http.get('*/api/v1/archive', () => HttpResponse.json(page([]))),
    http.get('*/api/v1/refs/organizations', () => HttpResponse.json(page([]))),
  );

  renderArchivePage(['archive.view']);
  expect(await screen.findByText('archive.empty')).toBeInTheDocument();
});

test('an empty list disables the Excel button — there is nothing to export', async () => {
  server.use(
    http.get('*/api/v1/archive', () => HttpResponse.json(page([]))),
    http.get('*/api/v1/refs/organizations', () => HttpResponse.json(page([]))),
  );

  renderArchivePage(['archive.view']);
  await screen.findByText('archive.empty');

  expect(screen.getByTestId('export-xlsx')).toBeDisabled();
});

test('a click anywhere on an archive row opens the item drawer, not the object link', async () => {
  server.use(
    http.get('*/api/v1/archive', () => HttpResponse.json(page([archiveItem()]))),
    http.get('*/api/v1/archive/:id', () => HttpResponse.json(archiveItem())),
    http.get('*/api/v1/refs/organizations', () => HttpResponse.json(page([]))),
  );
  const user = userEvent.setup();
  renderArchivePage(['archive.view']);

  await screen.findByTestId('archive-page');
  // The same label is also a filter <option>; the row's cell is the <td>.
  await screen.findByTestId(`archive-open-${archiveItem().id}`);
  await user.click(screen.getAllByText('archive.typeApplication').find((el) => el.tagName === 'TD')!);
  await screen.findByTestId(`archive-item-detail-${archiveItem().id}`);
});

test('the Excel button asks the server for the export with the applied filters, never paging the list itself', async () => {
  const user = userEvent.setup();
  const listCalls: string[] = [];
  let exportUrl: URL | null = null;
  server.use(
    http.get('*/api/v1/archive', ({ request }) => {
      listCalls.push(request.url);
      return HttpResponse.json(page([archiveItem()]));
    }),
    http.get('*/api/v1/archive/export.xlsx', ({ request }) => {
      exportUrl = new URL(request.url);
      return HttpResponse.text('xlsx-bytes', {
        headers: {
          'Content-Disposition': 'attachment; filename="arxiv-reyestri-2026-09-11.xlsx"',
          'X-Export-Total': '1',
          'X-Export-Rows': '1',
          'X-Export-Truncated': 'false',
        },
      });
    }),
    http.get('*/api/v1/refs/organizations', () => HttpResponse.json(page([]))),
  );

  const createObjectURL = vi.fn().mockReturnValue('blob:mock');
  const revokeObjectURL = vi.fn();
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  renderArchivePage(['archive.view']);
  await screen.findByTestId('archive-page');
  const listCallsBefore = listCalls.length;

  await user.click(screen.getByTestId('export-xlsx'));

  await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  expect(clickSpy).toHaveBeenCalled();
  expect(listCalls.length).toBe(listCallsBefore); // the export never re-fetches the list
  expect(exportUrl!.searchParams.get('lang')).toBe('uz_latn');
  expect(exportUrl!.searchParams.has('page')).toBe(false);
  expect(exportUrl!.searchParams.has('page_size')).toBe(false);
});
