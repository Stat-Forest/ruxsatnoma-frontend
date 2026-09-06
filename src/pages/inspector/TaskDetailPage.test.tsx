/**
 * TaskDetailPage — the same Start gate as TasksTab, plus Cancel
 * (`tasks.manage` only) and "Start inspection act" (own task, not yet
 * terminal), each independently gated.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';
import { stubAuthActions } from '../../auth/testAuthActions';
import { I18nContext } from '../../i18n/context';
import { TaskDetailPage } from './TaskDetailPage';
import type { TaskOut } from './queries';

const ME_ID = 'u1000000-0000-4000-8000-000000000001';
const OTHER_ID = 'u2000000-0000-4000-8000-000000000002';
const TASK_ID = 't1000000-0000-4000-8000-000000000001';

function task(over: Partial<TaskOut> = {}): TaskOut {
  return {
    id: TASK_ID,
    kind: 'permit_inspection',
    application_id: null,
    permit_id: 'p1000000-0000-4000-8000-000000000001',
    contour_id: null,
    organization_id: 'org00000-0000-4000-8000-000000000001',
    assigned_to: ME_ID,
    due_at: '2026-09-10',
    status: 'assigned',
    created_by: null,
    completed_at: null,
    created_at: '2026-09-01T10:00:00+05:00',
    ...over,
  };
}

function authValue(permissions: string[]): AuthContextValue {
  return {
    me: {
      user: {
        id: ME_ID,
        full_name: 'Inspektor Aliyev',
        login: 'aliyev',
        phone: null,
        email: null,
        must_change_password: false,
        language: 'uz_latn',
      },
      role: { code: 'inspector', name: {} },
      permissions,
      zone: { region_id: null, district_id: null, organization_id: 'org00000-0000-4000-8000-000000000001' },
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

function LandedProbe() {
  const location = useLocation();
  return <div data-testid="landed">{location.pathname + location.search}</div>;
}

function renderPage(taskOver: Partial<TaskOut>, permissions: string[]) {
  server.use(http.get('*/api/v1/inspections/tasks/:task_id', () => HttpResponse.json(task(taskOver))));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <MemoryRouter initialEntries={[`/inspections/tasks/${TASK_ID}`]}>
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>
          <AuthContext.Provider value={authValue(permissions)}>
            <Routes>
              <Route path="/inspections/tasks/:id" element={<TaskDetailPage />} />
              <Route path="/inspections/acts/new" element={<LandedProbe />} />
            </Routes>
          </AuthContext.Provider>
        </I18nContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

test('Start is offered for my own assigned task', async () => {
  renderPage({ assigned_to: ME_ID, status: 'assigned' }, ['inspections.acts.write']);
  expect(await screen.findByText('inspector.taskDetail.startButton')).toBeInTheDocument();
});

test('Start is hidden when the task is assigned to someone else', async () => {
  renderPage({ assigned_to: OTHER_ID, status: 'assigned' }, ['inspections.acts.write']);
  await screen.findByText('inspector.taskDetail.title');
  expect(screen.queryByText('inspector.taskDetail.startButton')).not.toBeInTheDocument();
});

test('Cancel is hidden without tasks.manage', async () => {
  renderPage({ assigned_to: ME_ID, status: 'assigned' }, ['inspections.acts.write']);
  await screen.findByText('inspector.taskDetail.title');
  expect(screen.queryByText('inspector.taskDetail.cancelButton')).not.toBeInTheDocument();
});

test('Cancel is offered to a tasks.manage holder while the task is not terminal', async () => {
  renderPage({ assigned_to: OTHER_ID, status: 'in_progress' }, ['inspections.tasks.manage']);
  expect(await screen.findByText('inspector.taskDetail.cancelButton')).toBeInTheDocument();
});

test('Cancel is hidden once the task is done, even for a tasks.manage holder', async () => {
  renderPage({ assigned_to: OTHER_ID, status: 'done' }, ['inspections.tasks.manage']);
  await screen.findByText('inspector.taskDetail.title');
  expect(screen.queryByText('inspector.taskDetail.cancelButton')).not.toBeInTheDocument();
});

test('Start inspection act carries task_id and permit_id in its query string', async () => {
  const user = userEvent.setup();
  renderPage(
    { assigned_to: ME_ID, status: 'assigned', permit_id: 'p1000000-0000-4000-8000-000000000001', application_id: null },
    ['inspections.acts.write'],
  );
  await user.click(await screen.findByText('inspector.taskDetail.startActButton'));

  const landed = await screen.findByTestId('landed');
  expect(landed.textContent).toContain('/inspections/acts/new?');
  expect(landed.textContent).toContain(`task_id=${TASK_ID}`);
  expect(landed.textContent).toContain('permit_id=p1000000-0000-4000-8000-000000000001');
});

test('Start inspection act is hidden once the task is done', async () => {
  renderPage({ assigned_to: ME_ID, status: 'done' }, ['inspections.acts.write']);
  await screen.findByText('inspector.taskDetail.title');
  expect(screen.queryByText('inspector.taskDetail.startActButton')).not.toBeInTheDocument();
});

test('a permit link is rendered with the right href when permit_id is set', async () => {
  renderPage({ permit_id: 'p1000000-0000-4000-8000-000000000001' }, ['inspections.acts.write']);
  const link = await screen.findByText('inspector.taskDetail.viewPermitButton');
  expect(link.closest('a')).toHaveAttribute('href', '/permits/p1000000-0000-4000-8000-000000000001');
});

test('an ApiError renders instead of crashing when the task fails to load', async () => {
  server.use(
    http.get('*/api/v1/inspections/tasks/:task_id', () =>
      HttpResponse.json({ error: { code: 'ERR-SYS-003', message: 'not found' } }, { status: 404 }),
    ),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  render(
    <MemoryRouter initialEntries={[`/inspections/tasks/${TASK_ID}`]}>
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>
          <AuthContext.Provider value={authValue(['inspections.acts.write'])}>
            <Routes>
              <Route path="/inspections/tasks/:id" element={<TaskDetailPage />} />
            </Routes>
          </AuthContext.Provider>
        </I18nContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByText('Manba topilmadi.')).toBeInTheDocument());
});
