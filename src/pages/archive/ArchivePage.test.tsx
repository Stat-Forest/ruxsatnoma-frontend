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
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';
import { stubAuthActions } from '../../auth/testAuthActions';
import { I18nContext } from '../../i18n/context';
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
      representations: [],
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

test('an archive.manage holder can archive a new object and the register refetches', async () => {
  let posted: { objectType: string; objectId: string } | null = null;
  server.use(
    http.get('*/api/v1/archive', () => HttpResponse.json(posted ? page([archiveItem()]) : page([]))),
    http.post('*/api/v1/archive/:object_type/:object_id', ({ params }) => {
      posted = { objectType: String(params.object_type), objectId: String(params.object_id) };
      return HttpResponse.json(archiveItem());
    }),
    http.get('*/api/v1/archive/:id', () => HttpResponse.json(archiveItem())),
    http.get('*/api/v1/refs/organizations', () => HttpResponse.json(page([]))),
  );

  const user = userEvent.setup();
  renderArchivePage(['archive.view', 'archive.manage']);

  await screen.findByTestId('archive-page');
  await user.click(screen.getByText('archive.actions.newItem'));
  await user.type(screen.getByTestId('archive-object-id'), 'a1000000-0000-4000-8000-000000000001');
  await user.click(screen.getByTestId('archive-object-submit'));

  await waitFor(() =>
    expect(posted).toEqual({ objectType: 'application', objectId: 'a1000000-0000-4000-8000-000000000001' }),
  );
  await screen.findByTestId(`archive-item-detail-${archiveItem().id}`);
});

test('an archive.manage holder can verify a stored item, and the card reflects the new status', async () => {
  let verified = false;
  server.use(
    http.get('*/api/v1/archive', () => HttpResponse.json(page([archiveItem()]))),
    http.get('*/api/v1/archive/:id', () => HttpResponse.json(archiveItem({ status: verified ? 'verified' : 'stored' }))),
    http.post('*/api/v1/archive/:id/verify', () => {
      verified = true;
      return HttpResponse.json(archiveItem({ status: 'verified' }));
    }),
    http.get('*/api/v1/refs/organizations', () => HttpResponse.json(page([]))),
  );

  const user = userEvent.setup();
  renderArchivePage(['archive.view', 'archive.manage']);

  await user.click(await screen.findByText('archive.col.view'));
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
