import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { RolesPage } from './RolesPage';
import { DICTIONARIES, I18nContext } from '../../../i18n/context';
import type { PermissionOut, RoleAdminOut } from '../api';

const EXECUTOR = 'e0000000-0000-4000-8000-000000000001';
const INSPECTOR = 'e0000000-0000-4000-8000-000000000002';
const APPLICANT = 'e0000000-0000-4000-8000-000000000003';

function role(overrides: Partial<RoleAdminOut> & Pick<RoleAdminOut, 'id' | 'code'>): RoleAdminOut {
  return {
    name: {},
    description: null,
    is_system: false,
    status: 'active',
    max_approve_amount: null,
    max_approve_area: null,
    permission_codes: [],
    holders: 0,
    ...overrides,
  };
}

const ROLES: RoleAdminOut[] = [
  role({
    id: EXECUTOR,
    code: 'executor',
    name: { uz_latn: 'Ijrochi', ru: 'Исполнитель' },
    is_system: true,
    permission_codes: ['applications.view_any', 'permits.issue'],
    holders: 7,
  }),
  role({
    id: INSPECTOR,
    code: 'inspector',
    // No `uz_latn` key at all — `pickName` has to fall through to `ru`
    // rather than render an empty cell.
    name: { ru: 'Инспектор' },
    status: 'archived',
    permission_codes: [],
    holders: 0,
  }),
  role({
    id: APPLICANT,
    code: 'applicant',
    name: { uz_latn: 'Ariza beruvchi', ru: 'Заявитель' },
    is_system: true,
    permission_codes: ['applications.create'],
    holders: 120,
  }),
];

const PERMISSIONS: PermissionOut[] = [
  { code: 'applications.create', description: 'Create an application', roles: ['applicant'] },
  { code: 'applications.view_any', description: 'View any application', roles: ['executor'] },
  { code: 'applications.review', description: 'Review a submitted application', roles: [] },
  { code: 'admin.settings.manage', description: 'Change runtime system settings', roles: [] },
  { code: 'auth.users.manage', description: 'Create and edit users', roles: [] },
  { code: 'gis.contours.manage', description: 'Import and edit contours', roles: [] },
  { code: 'norms.calculate', description: 'Compute a fee', roles: [] },
  { code: 'notifications.send', description: 'Send a notification', roles: [] },
  { code: 'payments.invoices.view', description: 'View invoices', roles: [] },
  { code: 'permits.issue', description: 'Issue a permit', roles: ['executor'] },
  { code: 'signatures.sign', description: 'Attach an ERI signature', roles: [] },
];

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function mockBackend(options: { roles?: RoleAdminOut[]; permissions?: PermissionOut[] } = {}) {
  server.use(
    http.get('*/api/v1/admin/roles', () => HttpResponse.json(options.roles ?? ROLES)),
    http.get('*/api/v1/admin/permissions', () => HttpResponse.json(options.permissions ?? PERMISSIONS)),
  );
}

function renderPage(lang: 'uz_latn' | 'ru' = 'uz_latn') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = {
    lang,
    backendLang: lang,
    t: (key: string) => (DICTIONARIES[lang] as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <RolesPage />
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

/** Opens the matrix for one role and waits for it to be on screen. */
async function openRole(code: string) {
  const row = await screen.findByTestId(`role-row-${code}`);
  await userEvent.click(row);
  return screen.findByTestId('permission-matrix');
}

test('the list names every role in the reader own language, with its code, kind, status and permission count', async () => {
  mockBackend();
  renderPage();

  const executor = await screen.findByTestId('role-row-executor');
  expect(executor).toHaveTextContent('Ijrochi');
  expect(executor).toHaveTextContent('executor');
  // Two of the eleven permissions — the count is the role's own, not the registry's.
  expect(within(executor).getByTestId('role-permission-count')).toHaveTextContent('2');
  expect(within(executor).getByTestId('role-system-badge')).toBeInTheDocument();

  // A name with no `uz_latn` key falls back rather than rendering blank.
  expect(screen.getByTestId('role-row-inspector')).toHaveTextContent('Инспектор');
  expect(within(screen.getByTestId('role-row-inspector')).queryByTestId('role-system-badge')).not.toBeInTheDocument();
  expect(screen.getByTestId('role-row-inspector')).toHaveTextContent(/arxiv/i);
});

test('the list follows the interface language, not the backend default', async () => {
  mockBackend();
  renderPage('ru');

  expect(await screen.findByTestId('role-row-executor')).toHaveTextContent('Исполнитель');
  expect(screen.getByTestId('role-row-applicant')).toHaveTextContent('Заявитель');
});

test('the matrix checks exactly the codes the role holds, grouped by module, each with its description', async () => {
  mockBackend();
  renderPage();

  const matrix = await openRole('executor');

  expect(within(matrix).getByLabelText('applications.view_any')).toBeChecked();
  expect(within(matrix).getByLabelText('permits.issue')).toBeChecked();
  expect(within(matrix).getByLabelText('applications.create')).not.toBeChecked();
  expect(within(matrix).getByLabelText('admin.settings.manage')).not.toBeChecked();

  // Grouped by the prefix before the first dot, and the three
  // `applications.*` codes land in the same group.
  const applications = within(matrix).getByTestId('permission-group-applications');
  expect(within(applications).getAllByRole('checkbox')).toHaveLength(3 + 1); // + the group's own toggle
  expect(applications).toHaveTextContent('View any application');
  expect(within(matrix).getByTestId('permission-group-signatures')).toBeInTheDocument();
});

test('switching roles re-reads the matrix from the role that is now selected', async () => {
  mockBackend();
  renderPage();

  await openRole('executor');
  const matrix = await openRole('applicant');

  expect(within(matrix).getByLabelText('applications.create')).toBeChecked();
  expect(within(matrix).getByLabelText('applications.view_any')).not.toBeChecked();
});

test('saving sends exactly the checked codes — the ones added and the ones left alone, never the ones cleared', async () => {
  mockBackend();
  let body: { codes: string[] } | null = null;
  server.use(
    http.put('*/api/v1/admin/roles/:roleId/permissions', async ({ request, params }) => {
      expect(params.roleId).toBe(EXECUTOR);
      body = (await request.json()) as { codes: string[] };
      return HttpResponse.json({ ...ROLES[0], permission_codes: body.codes });
    }),
  );
  renderPage();

  const matrix = await openRole('executor');
  await userEvent.click(within(matrix).getByLabelText('applications.review')); // add
  await userEvent.click(within(matrix).getByLabelText('permits.issue')); // remove
  await userEvent.click(screen.getByTestId('save-permissions'));

  await screen.findByTestId('save-success');
  expect(body).not.toBeNull();
  expect([...body!.codes].sort()).toEqual(['applications.review', 'applications.view_any']);
});

test('a system role keeps an editable matrix while its code and name stay read-only', async () => {
  mockBackend();
  server.use(
    http.put('*/api/v1/admin/roles/:roleId/permissions', async ({ request }) =>
      HttpResponse.json({ ...ROLES[0], permission_codes: ((await request.json()) as { codes: string[] }).codes }),
    ),
  );
  renderPage();

  const matrix = await openRole('executor');
  expect(within(matrix).getByLabelText('applications.view_any')).toBeEnabled();
  // Nothing on this screen renames a role — there is no such route here.
  expect(within(matrix).queryByRole('textbox')).not.toBeInTheDocument();

  await userEvent.click(within(matrix).getByLabelText('norms.calculate'));
  await userEvent.click(screen.getByTestId('save-permissions'));
  expect(await screen.findByTestId('save-success')).toBeInTheDocument();
});

test('a module heading grants or clears the whole module at once', async () => {
  mockBackend();
  let body: { codes: string[] } | null = null;
  server.use(
    http.put('*/api/v1/admin/roles/:roleId/permissions', async ({ request }) => {
      body = (await request.json()) as { codes: string[] };
      return HttpResponse.json({ ...ROLES[0], permission_codes: body.codes });
    }),
  );
  renderPage();

  const matrix = await openRole('executor');
  const applications = within(matrix).getByTestId('permission-group-applications');
  // The module is half-granted (1 of 3), so its heading is neither checked
  // nor unchecked — one click grants the rest rather than clearing the one.
  const heading = within(applications).getByLabelText('Arizalar');
  expect(heading).toBeInstanceOf(HTMLInputElement);
  expect((heading as HTMLInputElement).indeterminate).toBe(true);

  await userEvent.click(heading);
  expect(within(applications).getByLabelText('applications.create')).toBeChecked();
  expect(within(applications).getByLabelText('applications.review')).toBeChecked();

  await userEvent.click(screen.getByTestId('save-permissions'));
  await screen.findByTestId('save-success');
  expect([...body!.codes].sort()).toEqual([
    'applications.create',
    'applications.review',
    'applications.view_any',
    'permits.issue',
  ]);
});

test('the public applicant role is shown read-only — the backend refuses every write to it', async () => {
  mockBackend();
  renderPage();

  const matrix = await openRole('applicant');

  expect(within(matrix).getByTestId('role-read-only')).toBeInTheDocument();
  expect(within(matrix).getByLabelText('applications.create')).toBeChecked();
  expect(within(matrix).getByLabelText('applications.create')).toBeDisabled();
  expect(within(matrix).getByLabelText('permits.issue')).toBeDisabled();
  expect(screen.queryByTestId('save-permissions')).not.toBeInTheDocument();
});

test('a refused save says so and keeps the edit on screen instead of silently reverting it', async () => {
  mockBackend();
  server.use(
    http.put('*/api/v1/admin/roles/:roleId/permissions', () =>
      HttpResponse.json(
        { error: { code: 'ERR-VAL-001', message: 'unknown permission', details: { reason: 'unknown_permission' } } },
        { status: 422 },
      ),
    ),
  );
  renderPage();

  const matrix = await openRole('executor');
  await userEvent.click(within(matrix).getByLabelText('applications.review'));
  await userEvent.click(screen.getByTestId('save-permissions'));

  const error = await screen.findByTestId('save-error');
  expect(error).toHaveTextContent('ERR-VAL-001');
  expect(screen.queryByTestId('save-success')).not.toBeInTheDocument();
  // The operator's own edit survives the refusal — reverting it would hide
  // what was rejected.
  expect(within(screen.getByTestId('permission-matrix')).getByLabelText('applications.review')).toBeChecked();
});

test('a failed load says so rather than showing an empty register as fact', async () => {
  server.use(
    http.get('*/api/v1/admin/roles', () =>
      HttpResponse.json({ error: { code: 'ERR-AUTH-003', message: 'forbidden' } }, { status: 403 }),
    ),
    http.get('*/api/v1/admin/permissions', () => HttpResponse.json(PERMISSIONS)),
  );
  renderPage();

  expect(await screen.findByTestId('roles-error')).toHaveTextContent('ERR-AUTH-003');
  expect(screen.queryByTestId('role-row-executor')).not.toBeInTheDocument();
});

test('the screen own copy is translated too, not only the data', async () => {
  mockBackend();

  const uz = renderPage('uz_latn');
  await openRole('executor');
  const uzSave = screen.getByTestId('save-permissions').textContent ?? '';
  const uzHeading = screen.getByRole('heading', { level: 1 }).textContent ?? '';
  uz.unmount();

  renderPage('ru');
  await openRole('executor');
  const ruSave = screen.getByTestId('save-permissions').textContent ?? '';
  const ruHeading = screen.getByRole('heading', { level: 1 }).textContent ?? '';

  expect(uzSave.trim()).not.toBe('');
  expect(uzHeading.trim()).not.toBe('');
  expect(ruSave).not.toBe(uzSave);
  expect(ruHeading).not.toBe(uzHeading);
  // A label read straight out of `labels.ts` renders as copy; a key that
  // slipped through as a string would render as a dotted identifier.
  expect(document.body.textContent).not.toMatch(/\broles\.[a-z]+\b/i);
});
