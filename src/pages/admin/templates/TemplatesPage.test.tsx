/**
 * H9 — notification templates.
 *
 * The four things this screen must not get wrong, one test each:
 *   1. the register shows what identifies a template (event code, channel)
 *      AND which VERSION of it you are looking at;
 *   2. an edit is a POST to `/{template_id}` — the supersede verb — and the
 *      version that comes back is what the register then shows;
 *   3. the `warning` the server may return on a save is displayed, never
 *      swallowed: it is the only way the backend tells the author their
 *      placeholder will not resolve;
 *   4. archive is behind a confirmation that actually gates the request.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { TemplatesPage } from './TemplatesPage';
import { I18nContext } from '../../../i18n/context';
import type { TemplateOut } from './api';

const ID_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const ID_B = 'bbbbbbbb-0000-4000-8000-000000000002';

function template(over: Partial<TemplateOut> = {}): TemplateOut {
  return {
    id: ID_A,
    event_code: 'application.submitted',
    channel: 'sms',
    subject: null,
    body: {
      uz_latn: 'Arizangiz {number} qabul qilindi',
      ru: 'Ваша заявка {number} принята',
    },
    version: 1,
    status: 'active',
    created_by: null,
    created_at: '2026-09-01T10:00:00+05:00',
    updated_at: '2026-09-02T11:30:00+05:00',
    ...over,
  };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** The register the GET handler serves — reassigned by a mutation handler so
 *  the refetch after a save returns the new version, as the real one does. */
let store: TemplateOut[] = [];

function mockList(items: TemplateOut[]) {
  store = items;
  server.use(
    http.get('*/api/v1/admin/notification-templates', () =>
      HttpResponse.json({ items: store, total: store.length, page: 1, page_size: 20 }),
    ),
  );
}

function renderPage(lang: 'uz_latn' | 'ru' = 'uz_latn') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const i18n = { lang, backendLang: lang, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <TemplatesPage />
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

test('the register names the event, the channel and the version of each template', async () => {
  mockList([
    template({ id: ID_A, event_code: 'application.submitted', channel: 'sms', version: 2 }),
    template({ id: ID_B, event_code: 'permit.issued', channel: 'email', version: 1, subject: { uz_latn: 'Ruxsatnoma' } }),
  ]);

  renderPage();

  const first = (await screen.findByText('application.submitted')).closest('tr')!;
  expect(within(first).getByText('SMS')).toBeInTheDocument();
  expect(within(first).getByText('v2')).toBeInTheDocument();

  const second = screen.getByText('permit.issued').closest('tr')!;
  expect(within(second).getByText('Email')).toBeInTheDocument();
  expect(within(second).getByText('v1')).toBeInTheDocument();
  // The updated date, through the shared formatter — never a raw ISO string.
  expect(within(second).getByText('02.09.2026 11:30')).toBeInTheDocument();
});

test('saving an edit posts to the supersede route and the new version reaches the register', async () => {
  const user = userEvent.setup();
  mockList([template({ id: ID_A, version: 2 })]);

  let updatePath: string | null = null;
  let updateBody: Record<string, unknown> | null = null;
  server.use(
    http.post('*/api/v1/admin/notification-templates/:templateId', async ({ request, params }) => {
      updatePath = new URL(request.url).pathname;
      updateBody = (await request.json()) as Record<string, unknown>;
      const next = template({ id: params.templateId as string, version: 3, body: updateBody.body as Record<string, string> });
      store = [next];
      return HttpResponse.json(next);
    }),
  );

  renderPage();

  await user.click(await screen.findByTestId(`template-edit-${ID_A}`));

  const body = await screen.findByTestId('template-body-uz_latn');
  await user.clear(body);
  // `{{` is userEvent's escape for a literal `{` — the placeholder braces
  // are exactly what this screen exists to let an author type, so they must
  // survive the keyboard parser and reach the request body intact.
  await user.type(body, 'Ariza {{number} qabul qilindi');
  await user.click(screen.getByTestId('template-save'));

  await waitFor(() => expect(updateBody).not.toBeNull());
  expect(updatePath).toBe(`/api/v1/admin/notification-templates/${ID_A}`);
  expect(updateBody).toMatchObject({
    event_code: 'application.submitted',
    channel: 'sms',
    body: expect.objectContaining({ uz_latn: 'Ariza {number} qabul qilindi' }) as unknown,
  });

  const table = screen.getByTestId('templates-table');
  await waitFor(() => expect(within(table).getByText('v3')).toBeInTheDocument());
});

test('a warning returned with the saved version is shown, not swallowed', async () => {
  const user = userEvent.setup();
  mockList([template({ id: ID_A, version: 2 })]);

  server.use(
    http.post('*/api/v1/admin/notification-templates/:templateId', () =>
      HttpResponse.json(template({ id: ID_A, version: 3, warning: 'Unknown placeholder: {applicant_nam}' })),
    ),
  );

  renderPage();

  await user.click(await screen.findByTestId(`template-edit-${ID_A}`));
  await user.click(screen.getByTestId('template-save'));

  const warning = await screen.findByTestId('template-warning');
  expect(warning).toHaveTextContent('{applicant_nam}');
});

test('archive asks first and sends nothing when the question is dismissed', async () => {
  const user = userEvent.setup();
  mockList([template({ id: ID_A, version: 2 })]);

  let archiveCalls = 0;
  server.use(
    http.post('*/api/v1/admin/notification-templates/:templateId/archive', () => {
      archiveCalls += 1;
      const archived = template({ id: ID_A, version: 2, status: 'archived' });
      store = [archived];
      return HttpResponse.json(archived);
    }),
  );

  renderPage();

  await user.click(await screen.findByTestId(`template-archive-${ID_A}`));
  expect(await screen.findByTestId('archive-confirm')).toBeInTheDocument();

  await user.click(screen.getByTestId('archive-cancel'));
  await waitFor(() => expect(screen.queryByTestId('archive-confirm')).not.toBeInTheDocument());
  expect(archiveCalls).toBe(0);

  // …and fires exactly once when it is confirmed.
  await user.click(screen.getByTestId(`template-archive-${ID_A}`));
  await user.click(await screen.findByTestId('archive-confirm-submit'));
  await waitFor(() => expect(archiveCalls).toBe(1));
});

test('the editor offers every language the contract declares and says a save makes a new version', async () => {
  const user = userEvent.setup();
  mockList([template({ id: ID_A, channel: 'email', version: 2, subject: { uz_latn: 'Ariza' } })]);

  renderPage();
  await user.click(await screen.findByTestId(`template-edit-${ID_A}`));

  for (const language of ['uz_latn', 'uz_cyrl', 'ru', 'kaa', 'en']) {
    expect(screen.getByTestId(`template-body-${language}`)).toBeInTheDocument();
    // An email template has a subject line; an SMS one does not (below).
    expect(screen.getByTestId(`template-subject-${language}`)).toBeInTheDocument();
  }
  // Latin-script Uzbek comes first, and carries the text already stored.
  const bodies = screen.getAllByTestId(/^template-body-/);
  expect(bodies[0]).toBe(screen.getByTestId('template-body-uz_latn'));
  expect(screen.getByTestId('template-body-uz_latn')).toHaveValue('Arizangiz {number} qabul qilindi');

  // Editing is never presented as changing the template in place.
  // The version being superseded is named in the dialog header, the promise
  // that it survives in the body.
  expect(screen.getByRole('dialog')).toHaveTextContent('Joriy versiya v2');
  expect(screen.getByTestId('template-editor')).toHaveTextContent(/yangi versiya yaratadi/i);
  expect(screen.getByTestId('template-save')).toHaveTextContent(/yangi versiya/i);
  // Identity is fixed across versions — a v3 of another event is a different template.
  expect(screen.getByTestId('template-event-code')).toBeDisabled();
  expect(screen.getByTestId('template-channel')).toBeDisabled();
});

test('an SMS template offers no subject line, and none is sent', async () => {
  const user = userEvent.setup();
  mockList([template({ id: ID_A, channel: 'sms' })]);

  let sentSubject: unknown = 'untouched';
  server.use(
    http.post('*/api/v1/admin/notification-templates/:templateId', async ({ request }) => {
      sentSubject = ((await request.json()) as Record<string, unknown>).subject;
      return HttpResponse.json(template({ version: 2 }));
    }),
  );

  renderPage();
  await user.click(await screen.findByTestId(`template-edit-${ID_A}`));
  expect(screen.queryByTestId('template-subject-uz_latn')).not.toBeInTheDocument();

  await user.click(screen.getByTestId('template-save'));
  await waitFor(() => expect(sentSubject).toBeNull());
});

test('creating a template posts to the collection route, not to a version', async () => {
  const user = userEvent.setup();
  mockList([]);

  let createdBody: Record<string, unknown> | null = null;
  server.use(
    http.post('*/api/v1/admin/notification-templates', async ({ request }) => {
      createdBody = (await request.json()) as Record<string, unknown>;
      const created = template({ id: ID_B, event_code: 'permit.revoked', channel: 'email', version: 1 });
      store = [created];
      return HttpResponse.json(created, { status: 201 });
    }),
  );

  renderPage();
  await user.click(screen.getByTestId('template-create'));

  await user.type(screen.getByTestId('template-event-code'), 'permit.revoked');
  await user.selectOptions(screen.getByTestId('template-channel'), 'email');
  await user.type(screen.getByTestId('template-body-uz_latn'), 'Ruxsatnoma bekor qilindi');
  await user.click(screen.getByTestId('template-save'));

  await waitFor(() => expect(createdBody).not.toBeNull());
  expect(createdBody).toMatchObject({
    event_code: 'permit.revoked',
    channel: 'email',
    body: { uz_latn: 'Ruxsatnoma bekor qilindi' },
  });
  // The empty languages are dropped rather than saved as blank strings.
  expect(Object.keys((createdBody as unknown as { body: Record<string, string> }).body)).toEqual(['uz_latn']);
});

test('the filters the route accepts reach the query, and nothing else does', async () => {
  const user = userEvent.setup();
  let seen: URLSearchParams | null = null;
  store = [template()];
  server.use(
    http.get('*/api/v1/admin/notification-templates', ({ request }) => {
      seen = new URL(request.url).searchParams;
      return HttpResponse.json({ items: store, total: store.length, page: 1, page_size: 20 });
    }),
  );

  renderPage();
  await screen.findByText('application.submitted');

  await user.type(screen.getByTestId('filter-event-code'), 'permit.issued');
  await user.selectOptions(screen.getByTestId('filter-channel'), 'email');
  await user.selectOptions(screen.getByTestId('filter-status'), 'archived');
  await user.click(screen.getByText('Qoʻllash'));

  await waitFor(() => expect(seen!.get('event_code')).toBe('permit.issued'));
  expect(seen!.get('channel')).toBe('email');
  expect(seen!.get('status')).toBe('archived');
  expect(seen!.get('page')).toBe('1');
  expect(seen!.get('page_size')).toBe('20');
});

test('the Russian dictionary renders the same screen', async () => {
  mockList([template({ channel: 'inapp', status: 'superseded' })]);

  renderPage('ru');

  expect(screen.getByText('Шаблоны уведомлений')).toBeInTheDocument();
  const row = (await screen.findByText('application.submitted')).closest('tr')!;
  expect(within(row).getByText('В приложении')).toBeInTheDocument();
  expect(within(row).getByText('Устаревший')).toBeInTheDocument();
});

test('a click anywhere on a template row opens its editor', async () => {
  const user = userEvent.setup();
  mockList([template({ id: ID_A, event_code: 'application.submitted', channel: 'sms', version: 2 })]);
  renderPage();

  await user.click(await screen.findByText('v2'));
  expect(await screen.findByTestId('template-body-uz_latn')).toBeInTheDocument();
});
