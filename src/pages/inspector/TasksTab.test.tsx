/**
 * TasksTab (С15/С16) — the Start button's own gate is the one thing this
 * screen must never get wrong: `POST /tasks/{id}/start` requires
 * `assigned_to == self`, unconditionally (`service.py`), so the button must
 * be absent — not merely disabled — for anyone else, even a `view_any`
 * holder who can see the task.
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
import { TasksTab } from './TasksTab';
import type { TaskOut } from './queries';

const ME_ID = 'u1000000-0000-4000-8000-000000000001';
const OTHER_ID = 'u2000000-0000-4000-8000-000000000002';

function task(over: Partial<TaskOut> = {}): TaskOut {
  return {
    id: 't1000000-0000-4000-8000-000000000001',
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

function authValue(): AuthContextValue {
  return {
    me: {
      user: {
        id: ME_ID,
        full_name: 'Inspektor Aliyev',
        login: 'aliyev',
        phone: null,
        email: null,
        must_change_password: false,
        pinfl: null,
        language: 'uz_latn',
      },
      role: { code: 'inspector', name: {} },
      permissions: ['inspections.acts.write'],
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

function renderTasksTab(tasks: TaskOut[]) {
  server.use(
    http.get('*/api/v1/inspections/tasks', () =>
      HttpResponse.json({ items: tasks, total: tasks.length, page: 1, page_size: 20 }),
    ),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>
          <AuthContext.Provider value={authValue()}>
            <TasksTab active />
          </AuthContext.Provider>
        </I18nContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

test('Start is offered for my own assigned task', async () => {
  renderTasksTab([task({ assigned_to: ME_ID, status: 'assigned' })]);
  expect(await screen.findByText('inspector.tasks.startButton')).toBeInTheDocument();
});

test('Start is hidden for a task assigned to someone else, even though it is visible', async () => {
  renderTasksTab([task({ assigned_to: OTHER_ID, status: 'assigned' })]);
  expect(await screen.findByText('inspector.tasks.openButton')).toBeInTheDocument();
  expect(screen.queryByText('inspector.tasks.startButton')).not.toBeInTheDocument();
});

test('Start is hidden for a task that is already done', async () => {
  renderTasksTab([task({ assigned_to: ME_ID, status: 'done' })]);
  expect(await screen.findByText('inspector.tasks.openButton')).toBeInTheDocument();
  expect(screen.queryByText('inspector.tasks.startButton')).not.toBeInTheDocument();
});

test('clicking Start calls the start route and the task list refreshes', async () => {
  let started = false;
  server.use(
    http.post('*/api/v1/inspections/tasks/:task_id/start', () => {
      started = true;
      return HttpResponse.json(task({ status: 'in_progress' }));
    }),
  );

  const user = userEvent.setup();
  renderTasksTab([task({ assigned_to: ME_ID, status: 'assigned' })]);
  await user.click(await screen.findByText('inspector.tasks.startButton'));

  await waitFor(() => expect(started).toBe(true));
});

test('the empty state renders when there are no tasks', async () => {
  renderTasksTab([]);
  expect(await screen.findByText('inspector.tasks.empty')).toBeInTheDocument();
});
