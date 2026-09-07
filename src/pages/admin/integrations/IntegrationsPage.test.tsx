import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { IntegrationsPage } from './IntegrationsPage';
import { I18nContext } from '../../../i18n/context';
import { AuthContext, type AuthContextValue } from '../../../auth/AuthContext';
import { stubAuthActions } from '../../../auth/testAuthActions';

const DEAD_MESSAGE = '01930000-0000-7000-8000-000000000001';
const PENDING_MESSAGE = '01930000-0000-7000-8000-000000000002';
const NEW_LETTER = '01940000-0000-7000-8000-000000000001';
const DISCARDED_LETTER = '01940000-0000-7000-8000-000000000002';

function outboxMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: DEAD_MESSAGE,
    destination: 'sms_otp',
    status: 'dead',
    attempts: 5,
    next_attempt_at: '2026-09-04T09:15:00+05:00',
    last_error: 'EskizError: eskiz send failed: HTTP 503',
    correlation_id: 'req-7f3a',
    created_at: '2026-09-04T08:00:00+05:00',
    delivered_at: null,
    ...overrides,
  };
}

function deadLetter(overrides: Record<string, unknown> = {}) {
  return {
    id: NEW_LETTER,
    source: 'payme_callback',
    error: 'ValidationError: field "amount" is not an integer',
    status: 'new',
    received_at: '2026-09-04T07:40:00+05:00',
    processed_by: null,
    processed_at: null,
    ...overrides,
  };
}

function page<T>(items: T[], total = items.length) {
  return { items, total, page: 1, page_size: 20 };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

interface BackendOptions {
  outbox?: unknown[];
  letters?: unknown[];
}

/** Counts every list GET so a test can prove the screen refetched, and keeps
 *  the last query string so a test can prove which filters were sent. */
const calls = { outbox: 0, letters: 0, outboxQuery: '', lettersQuery: '' };

function mockBackend(options: BackendOptions = {}) {
  calls.outbox = 0;
  calls.letters = 0;
  calls.outboxQuery = '';
  calls.lettersQuery = '';
  server.use(
    http.get('*/api/v1/admin/integrations/outbox', ({ request }) => {
      calls.outbox += 1;
      calls.outboxQuery = new URL(request.url).search;
      return HttpResponse.json(page(options.outbox ?? []));
    }),
    http.get('*/api/v1/admin/integrations/dead-letters', ({ request }) => {
      calls.letters += 1;
      calls.lettersQuery = new URL(request.url).search;
      return HttpResponse.json(page(options.letters ?? []));
    }),
  );
}

/** Defaults to holding BOTH codes — the only seed grants them together
 *  (`IntegrationsPage.tsx`'s own comment) — so every existing test below
 *  keeps exercising the "can do everything" caller unless it opts into a
 *  narrower one via `permissions`. */
function meWith(permissions: string[]): AuthContextValue {
  return {
    me: {
      user: { id: 'u1', full_name: 'Test', login: 'test', phone: null, email: null, must_change_password: false, language: 'uz_latn' },
      role: { code: 'central_admin', name: { uz_latn: 'Markaziy apparat' } },
      permissions,
      zone: { region_id: null, district_id: null, organization_id: null },
      csrf_token: 'x',
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

function renderPage(
  lang: 'uz_latn' | 'ru' = 'uz_latn',
  permissions: string[] = ['admin.integrations.view', 'admin.integrations.manage'],
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang, backendLang: lang, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>
          <AuthContext.Provider value={meWith(permissions)}>
            <IntegrationsPage />
          </AuthContext.Provider>
        </I18nContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

test('the outbox tab lists the messages the route returned', async () => {
  mockBackend({
    outbox: [
      outboxMessage(),
      outboxMessage({ id: PENDING_MESSAGE, destination: 'rn_event', status: 'pending', attempts: 0, last_error: null }),
    ],
  });

  renderPage();

  const dead = await screen.findByTestId(`outbox-row-${DEAD_MESSAGE}`);
  expect(dead).toHaveTextContent('sms_otp');
  expect(dead).toHaveTextContent('Yetkazilmadi');
  expect(dead).toHaveTextContent('5');

  const pending = screen.getByTestId(`outbox-row-${PENDING_MESSAGE}`);
  expect(pending).toHaveTextContent('rn_event');
  expect(pending).toHaveTextContent('Navbatda');
});

test('the dead-letter tab lists its own rows once opened', async () => {
  mockBackend({
    outbox: [outboxMessage()],
    letters: [deadLetter(), deadLetter({ id: DISCARDED_LETTER, source: 'eskiz_callback', status: 'discarded' })],
  });

  const user = userEvent.setup();
  renderPage();
  await screen.findByTestId(`outbox-row-${DEAD_MESSAGE}`);

  await user.click(screen.getByRole('button', { name: /Kiruvchi xatolar/ }));

  const letter = await screen.findByTestId(`letter-row-${NEW_LETTER}`);
  expect(letter).toHaveTextContent('payme_callback');
  expect(letter).toHaveTextContent('Yangi');
  expect(letter).toHaveTextContent('field "amount" is not an integer');
  expect(screen.getByTestId(`letter-row-${DISCARDED_LETTER}`)).toHaveTextContent('Rad etilgan');
});

test('the details view shows the whole record as pretty-printed JSON and the last error', async () => {
  mockBackend({ outbox: [outboxMessage()] });

  const user = userEvent.setup();
  renderPage();
  const row = await screen.findByTestId(`outbox-row-${DEAD_MESSAGE}`);

  await user.click(within(row).getByRole('button', { name: 'Batafsil' }));

  const details = await screen.findByTestId('details-modal');
  const json = within(details).getByTestId('details-json');
  // Pretty-printed, not a single line: indented keys are what makes a
  // payload readable at all.
  expect(json.textContent).toContain('"correlation_id": "req-7f3a"');
  expect(json.textContent).toContain('\n  "destination": "sms_otp"');
  // Wide content scrolls inside its own box; the page never scrolls sideways.
  expect(json.className).toContain('overflow-x-auto');
  expect(within(details).getByTestId('details-error')).toHaveTextContent('HTTP 503');
});

test('requeue asks first, then fires the right request and refetches the list', async () => {
  mockBackend({ outbox: [outboxMessage()] });
  let requeued: string | null = null;
  server.use(
    http.post('*/api/v1/admin/integrations/outbox/:messageId/requeue', ({ params }) => {
      requeued = params.messageId as string;
      return HttpResponse.json(outboxMessage({ status: 'pending', attempts: 0, last_error: null }));
    }),
  );

  const user = userEvent.setup();
  renderPage();
  const row = await screen.findByTestId(`outbox-row-${DEAD_MESSAGE}`);
  const before = calls.outbox;

  await user.click(within(row).getByRole('button', { name: 'Navbatga qaytarish' }));

  const confirm = await screen.findByTestId('confirm-requeue');
  expect(confirm).toHaveTextContent('sms_otp');
  expect(requeued).toBeNull();

  await user.click(within(confirm).getByRole('button', { name: 'Ha, navbatga qaytarilsin' }));

  await vi.waitFor(() => expect(requeued).toBe(DEAD_MESSAGE));
  await vi.waitFor(() => expect(calls.outbox).toBeGreaterThan(before));
  expect(screen.queryByTestId('confirm-requeue')).not.toBeInTheDocument();
});

test('a dismissed discard confirmation fires nothing at all', async () => {
  mockBackend({ letters: [deadLetter()] });
  let discarded = false;
  server.use(
    http.post('*/api/v1/admin/integrations/dead-letters/:letterId/discard', () => {
      discarded = true;
      return HttpResponse.json(deadLetter({ status: 'discarded' }));
    }),
  );

  const user = userEvent.setup();
  renderPage();
  await user.click(screen.getByRole('button', { name: /Kiruvchi xatolar/ }));
  const row = await screen.findByTestId(`letter-row-${NEW_LETTER}`);

  await user.click(within(row).getByRole('button', { name: 'Rad etish' }));
  const confirm = await screen.findByTestId('confirm-discard');

  await user.click(within(confirm).getByRole('button', { name: 'Bekor qilish' }));

  expect(screen.queryByTestId('confirm-discard')).not.toBeInTheDocument();
  expect(discarded).toBe(false);
});

test('the discard confirmation names the letter it is about to throw away', async () => {
  mockBackend({ letters: [deadLetter()] });
  let discarded: string | null = null;
  server.use(
    http.post('*/api/v1/admin/integrations/dead-letters/:letterId/discard', ({ params }) => {
      discarded = params.letterId as string;
      return HttpResponse.json(deadLetter({ status: 'discarded' }));
    }),
  );

  const user = userEvent.setup();
  renderPage();
  await user.click(screen.getByRole('button', { name: /Kiruvchi xatolar/ }));
  const row = await screen.findByTestId(`letter-row-${NEW_LETTER}`);
  const before = calls.letters;

  await user.click(within(row).getByRole('button', { name: 'Rad etish' }));

  const confirm = await screen.findByTestId('confirm-discard');
  // Not "are you sure": the dialog names the source, the id and the error, and
  // says the action cannot be undone.
  expect(confirm).toHaveTextContent('payme_callback');
  expect(confirm).toHaveTextContent(NEW_LETTER);
  expect(confirm).toHaveTextContent('field "amount" is not an integer');
  expect(confirm).toHaveTextContent(/ortga qaytarib bo/i);

  await user.click(within(confirm).getByRole('button', { name: 'Ha, rad etilsin' }));

  await vi.waitFor(() => expect(discarded).toBe(NEW_LETTER));
  await vi.waitFor(() => expect(calls.letters).toBeGreaterThan(before));
});

test('a refused action is reported instead of passing for success', async () => {
  mockBackend({ outbox: [outboxMessage()] });
  server.use(
    http.post('*/api/v1/admin/integrations/outbox/:messageId/requeue', () =>
      HttpResponse.json({ error: { code: 'ERR-VAL-001', message: 'not_dead' } }, { status: 409 }),
    ),
  );

  const user = userEvent.setup();
  renderPage();
  const row = await screen.findByTestId(`outbox-row-${DEAD_MESSAGE}`);

  await user.click(within(row).getByRole('button', { name: 'Navbatga qaytarish' }));
  const confirm = await screen.findByTestId('confirm-requeue');
  await user.click(within(confirm).getByRole('button', { name: 'Ha, navbatga qaytarilsin' }));

  const error = await screen.findByTestId('action-error');
  expect(error).toHaveTextContent("Kiritilgan ma'lumotlarni tekshirishda xatolik.");
});

test('a failed list load says so rather than showing an empty table', async () => {
  server.use(
    http.get('*/api/v1/admin/integrations/outbox', () =>
      HttpResponse.json({ error: { code: 'ERR-AUTH-004', message: 'forbidden' } }, { status: 403 }),
    ),
    http.get('*/api/v1/admin/integrations/dead-letters', () => HttpResponse.json(page([]))),
  );

  renderPage();

  expect(await screen.findByTestId('list-error')).toHaveTextContent(
    'Elektron raqamli imzo sertifikatining muddati tugagan yoki bekor qilingan.',
  );
});

test('only the routes own filters are offered, and applying one reaches the API', async () => {
  mockBackend({ outbox: [outboxMessage()] });

  const user = userEvent.setup();
  renderPage();
  await screen.findByTestId(`outbox-row-${DEAD_MESSAGE}`);

  await user.selectOptions(screen.getByTestId('outbox-status-filter'), 'dead');
  await user.type(screen.getByTestId('outbox-destination-filter'), 'sms_otp');
  await user.click(screen.getByRole('button', { name: 'Qoʻllash' }));

  await vi.waitFor(() => expect(calls.outboxQuery).toContain('status=dead'));
  expect(calls.outboxQuery).toContain('destination=sms_otp');
  expect(calls.outboxQuery).toContain('page=1');
});

test('the requeue button is offered only where the backend would accept it', async () => {
  mockBackend({
    outbox: [outboxMessage({ id: PENDING_MESSAGE, status: 'pending', last_error: null })],
    letters: [deadLetter({ id: DISCARDED_LETTER, status: 'discarded' })],
  });

  const user = userEvent.setup();
  renderPage();
  const row = await screen.findByTestId(`outbox-row-${PENDING_MESSAGE}`);
  expect(within(row).queryByRole('button', { name: 'Navbatga qaytarish' })).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /Kiruvchi xatolar/ }));
  const letter = await screen.findByTestId(`letter-row-${DISCARDED_LETTER}`);
  expect(within(letter).queryByRole('button', { name: 'Rad etish' })).not.toBeInTheDocument();
});

test('requeue is not offered to a view-only holder, even on a dead row', async () => {
  mockBackend({ outbox: [outboxMessage()] });

  renderPage('uz_latn', ['admin.integrations.view']);

  const row = await screen.findByTestId(`outbox-row-${DEAD_MESSAGE}`);
  expect(within(row).queryByRole('button', { name: 'Navbatga qaytarish' })).not.toBeInTheDocument();
  expect(row).toHaveTextContent('admin.integrations.manage');
});

test('discard is not offered to a view-only holder, even on a new letter', async () => {
  mockBackend({ letters: [deadLetter()] });

  const user = userEvent.setup();
  renderPage('uz_latn', ['admin.integrations.view']);
  await user.click(screen.getByRole('button', { name: /Kiruvchi xatolar/ }));

  const row = await screen.findByTestId(`letter-row-${NEW_LETTER}`);
  expect(within(row).queryByRole('button', { name: 'Rad etish' })).not.toBeInTheDocument();
  expect(row).toHaveTextContent('admin.integrations.manage');
});

test('requeue and discard are offered to a superuser holding neither code', async () => {
  mockBackend({ outbox: [outboxMessage()], letters: [deadLetter()] });

  const user = userEvent.setup();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  const superuser = meWith([]);
  superuser.me!.is_superuser = true;
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>
          <AuthContext.Provider value={superuser}>
            <IntegrationsPage />
          </AuthContext.Provider>
        </I18nContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );

  const row = await screen.findByTestId(`outbox-row-${DEAD_MESSAGE}`);
  expect(within(row).getByRole('button', { name: 'Navbatga qaytarish' })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /Kiruvchi xatolar/ }));
  const letter = await screen.findByTestId(`letter-row-${NEW_LETTER}`);
  expect(within(letter).getByRole('button', { name: 'Rad etish' })).toBeInTheDocument();
});

test('the screen speaks Russian when the session does', async () => {
  mockBackend({ outbox: [outboxMessage()] });

  renderPage('ru');

  const row = await screen.findByTestId(`outbox-row-${DEAD_MESSAGE}`);
  expect(row).toHaveTextContent('Не доставлено');
  expect(within(row).getByRole('button', { name: 'Вернуть в очередь' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Входящие ошибки/ })).toBeInTheDocument();
});
