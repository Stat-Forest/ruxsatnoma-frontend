import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ClassifiersPage } from './ClassifiersPage';
import { I18nContext } from '../../../i18n/context';
import { LABELS } from './labels';

const L = LABELS.uz_latn;

const ACTIVE_ID = '0198f100-0004-7000-8000-000000000001';
const SCHEDULED_ID = '0198f100-0004-7000-8000-000000000002';
const ARCHIVED_ID = '0198f100-0004-7000-8000-000000000003';

/** Shaped exactly like `ClassifierItemOut`: `name` and `props` are free-form
 *  dicts on the wire, which is why the screen reads the name through
 *  `pickName` and prints `props` rather than assuming fields. */
const RJ_01 = {
  id: ACTIVE_ID,
  code: 'RJ-01',
  name: { uz_latn: 'Hujjatlar toʻliq emas', ru: 'Документы неполные' },
  props: { kind: 'return', legal_basis: 'ВМҚ 290' },
  valid_from: '2026-01-01',
  valid_to: null,
  status: 'active',
};

/** `valid_from` in the future — nothing has ever been issued under it, so it
 *  is the one row the screen offers a plain edit for. */
const RJ_09_SCHEDULED = {
  id: SCHEDULED_ID,
  code: 'RJ-09',
  name: { uz_latn: 'Yangi asos', ru: 'Новое основание' },
  props: {},
  valid_from: '2027-01-01',
  valid_to: null,
  status: 'active',
};

/** The version RJ-01 replaced. Only a PAST `on_date` brings it back from the
 *  API — and when it does, the screen must show it, not drop it. */
const RJ_01_OLD = {
  id: ARCHIVED_ID,
  code: 'RJ-01',
  name: { uz_latn: 'Hujjatlar toʻliq emas (eski tahrir)', ru: 'Документы неполные (старая редакция)' },
  props: { kind: 'return', legal_basis: 'ВМҚ 278' },
  valid_from: '2025-01-01',
  valid_to: '2025-12-31',
  status: 'archived',
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

interface Recorded {
  url: string;
  body: unknown;
}

/** Every mutating call the screen makes, in order — so a test can assert not
 *  only what WAS sent but what was NOT (a supersede must not be a PATCH). */
let sent: Recorded[] = [];

/** Whether an item is "in force" or "not yet in force" is decided against
 *  today, so today is pinned — the screen reads it through `Date.now()`
 *  exactly so this can be a spy rather than fake timers, which `user-event`
 *  does not sit well with. */
const TODAY = new Date('2026-09-05T09:00:00Z').getTime();

beforeEach(() => {
  sent = [];
  vi.spyOn(Date, 'now').mockReturnValue(TODAY);
});
afterEach(() => vi.restoreAllMocks());

function mockBackend(itemsFor: (onDate: string | null) => unknown[]) {
  server.use(
    http.get('*/api/v1/refs/classifiers/:code/items', ({ request }) => {
      const onDate = new URL(request.url).searchParams.get('on_date');
      return HttpResponse.json(itemsFor(onDate));
    }),
    http.post('*/api/v1/admin/classifiers', async ({ request }) => {
      sent.push({ url: new URL(request.url).pathname, body: await request.json() });
      return HttpResponse.json({}, { status: 201 });
    }),
    http.post('*/api/v1/admin/classifiers/:code/items', async ({ request }) => {
      sent.push({ url: new URL(request.url).pathname, body: await request.json() });
      return HttpResponse.json(RJ_09_SCHEDULED, { status: 201 });
    }),
    http.patch('*/api/v1/admin/classifier-items/:id', async ({ request }) => {
      sent.push({ url: new URL(request.url).pathname, body: await request.json() });
      return HttpResponse.json(RJ_09_SCHEDULED);
    }),
    http.post('*/api/v1/admin/classifier-items/:id/archive', async ({ request }) => {
      sent.push({ url: new URL(request.url).pathname, body: null });
      return HttpResponse.json({ ...RJ_01, status: 'archived', valid_to: '2026-09-04' });
    }),
    http.post('*/api/v1/admin/classifier-items/:id/supersede', async ({ request }) => {
      sent.push({ url: new URL(request.url).pathname, body: await request.json() });
      return HttpResponse.json({ ...RJ_01, id: 'new', valid_from: '2027-03-01' }, { status: 201 });
    }),
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
        <ClassifiersPage />
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

async function row(id: string) {
  return await screen.findByTestId(`item-${id}`);
}

test('an item carries its code, localized name and validity window', async () => {
  mockBackend(() => [RJ_01, RJ_09_SCHEDULED]);
  renderPage();

  const active = await row(ACTIVE_ID);
  expect(within(active).getByText('RJ-01')).toBeInTheDocument();
  expect(within(active).getByText('Hujjatlar toʻliq emas')).toBeInTheDocument();
  // Plain `YYYY-MM-DD` rendered through `formatDate` — never re-parsed
  // through `Date`, which would shift the day by the browser's timezone.
  expect(active).toHaveTextContent('01.01.2026');
  expect(active).toHaveTextContent(L.validOpenEnded);
  expect(within(active).getByText(L.statusActive)).toBeInTheDocument();

  // A window that has not opened yet is not "active" to a reader, whatever
  // the status column says.
  const scheduled = await row(SCHEDULED_ID);
  expect(scheduled).toHaveTextContent('01.01.2027');
  expect(within(scheduled).getByText(L.statusScheduled)).toBeInTheDocument();
});

test('props are printed as JSON in a block that scrolls rather than wrapping', async () => {
  mockBackend(() => [RJ_01]);
  renderPage();

  const active = await row(ACTIVE_ID);
  const props = within(active).getByTestId(`props-${ACTIVE_ID}`);
  expect(props).toHaveTextContent('"kind": "return"');
  expect(props.className).toContain('overflow-x-auto');
});

test('an archived version is shown, marked and explained — never silently dropped', async () => {
  // The API only returns an archived row for a PAST `on_date`; the screen's
  // date control is the only way to ask for one, so this drives it.
  mockBackend((onDate) => (onDate ? [RJ_01_OLD] : [RJ_01]));
  renderPage();

  await row(ACTIVE_ID);

  await userEvent.type(screen.getByTestId('on-date-input'), '2025-06-01');
  await userEvent.click(screen.getByRole('button', { name: L.onDateApply }));

  const archived = await row(ARCHIVED_ID);
  expect(archived).toBeInTheDocument();
  expect(archived).toHaveAttribute('data-archived', 'true');
  expect(within(archived).getByText(L.statusArchived)).toBeInTheDocument();
  expect(archived).toHaveTextContent(L.archivedNote);
  // Closed window, both ends printed — the whole point of keeping the row.
  expect(archived).toHaveTextContent('01.01.2025');
  expect(archived).toHaveTextContent('31.12.2025');

  // An archived version is history: it is not offered as something to rewrite.
  expect(within(archived).queryByRole('button', { name: L.actionEdit })).not.toBeInTheDocument();
  expect(
    within(archived).queryByRole('button', { name: L.actionSupersede }),
  ).not.toBeInTheDocument();
});

test('an item already in force offers a successor, never a plain edit', async () => {
  mockBackend(() => [RJ_01, RJ_09_SCHEDULED]);
  renderPage();

  const active = await row(ACTIVE_ID);
  expect(within(active).getByRole('button', { name: L.actionSupersede })).toBeInTheDocument();
  expect(within(active).queryByRole('button', { name: L.actionEdit })).not.toBeInTheDocument();
  expect(active).toHaveTextContent(L.editLockedHint);

  // The one row that MAY be edited in place is the one nothing was issued
  // under: its window has not opened yet.
  const scheduled = await row(SCHEDULED_ID);
  expect(within(scheduled).getByRole('button', { name: L.actionEdit })).toBeInTheDocument();
});

test('invalid JSON in props refuses the save and shows the parse error', async () => {
  mockBackend(() => [RJ_01]);
  renderPage();

  await row(ACTIVE_ID);
  await userEvent.click(screen.getByRole('button', { name: L.actionAdd }));

  await userEvent.type(screen.getByTestId('field-code'), 'RJ-99');
  await userEvent.type(screen.getByTestId('field-name-uz'), 'Sinov');
  await userEvent.clear(screen.getByTestId('field-props'));
  await userEvent.type(screen.getByTestId('field-props'), '{{"kind": ');
  await userEvent.click(screen.getByRole('button', { name: L.save }));

  const error = await screen.findByTestId('props-error');
  expect(error).toHaveTextContent(L.errInvalidJson);
  // The browser's own message, not a generic "something is wrong".
  expect(error.textContent!.length).toBeGreaterThan(L.errInvalidJson.length + 1);
  expect(sent).toEqual([]);
  // The dialog stays open on the bad value rather than closing over it.
  expect(screen.getByTestId('field-props')).toBeInTheDocument();
});

test('valid JSON in props is sent as an object, not as a string', async () => {
  mockBackend(() => [RJ_01]);
  renderPage();

  await row(ACTIVE_ID);
  await userEvent.click(screen.getByRole('button', { name: L.actionAdd }));

  await userEvent.type(screen.getByTestId('field-code'), 'RJ-99');
  await userEvent.type(screen.getByTestId('field-name-uz'), 'Sinov');
  await userEvent.clear(screen.getByTestId('field-props'));
  await userEvent.type(screen.getByTestId('field-props'), '{{"kind": "reject"}');
  await userEvent.click(screen.getByRole('button', { name: L.save }));

  await waitFor(() => expect(sent).toHaveLength(1));
  expect(sent[0].url).toBe('/api/v1/admin/classifiers/rejection_reasons/items');
  expect(sent[0].body).toMatchObject({
    code: 'RJ-99',
    props: { kind: 'reject' },
    name: { uz_latn: 'Sinov' },
  });
});

test('supersede posts the successor to /supersede and never patches the original', async () => {
  mockBackend(() => [RJ_01]);
  renderPage();

  const active = await row(ACTIVE_ID);
  await userEvent.click(within(active).getByRole('button', { name: L.actionSupersede }));

  // The successor starts pre-filled from the version it replaces, so the
  // operator edits a copy — the original is never the thing being changed.
  expect(screen.getByTestId('field-code')).toHaveValue('RJ-01');
  expect(screen.getByTestId('field-code')).toBeDisabled();

  await userEvent.clear(screen.getByTestId('field-name-uz'));
  await userEvent.type(screen.getByTestId('field-name-uz'), 'Hujjatlar toʻliq emas (2027)');
  await userEvent.clear(screen.getByTestId('field-valid-from'));
  await userEvent.type(screen.getByTestId('field-valid-from'), '2027-03-01');
  await userEvent.click(screen.getByRole('button', { name: L.save }));

  await waitFor(() => expect(sent).toHaveLength(1));
  expect(sent[0].url).toBe(`/api/v1/admin/classifier-items/${ACTIVE_ID}/supersede`);
  expect(sent[0].body).toMatchObject({
    // The service refuses a successor whose code differs from the original's.
    code: 'RJ-01',
    valid_from: '2027-03-01',
    name: { uz_latn: 'Hujjatlar toʻliq emas (2027)' },
    props: { kind: 'return', legal_basis: 'ВМҚ 290' },
  });
  expect(sent.some((call) => call.url === `/api/v1/admin/classifier-items/${ACTIVE_ID}`)).toBe(
    false,
  );
});

test('editing a not-yet-in-force item patches only presentation fields', async () => {
  mockBackend(() => [RJ_09_SCHEDULED]);
  renderPage();

  const scheduled = await row(SCHEDULED_ID);
  await userEvent.click(within(scheduled).getByRole('button', { name: L.actionEdit }));

  await userEvent.clear(screen.getByTestId('field-name-uz'));
  await userEvent.type(screen.getByTestId('field-name-uz'), 'Yangilangan asos');
  await userEvent.click(screen.getByRole('button', { name: L.save }));

  await waitFor(() => expect(sent).toHaveLength(1));
  expect(sent[0].url).toBe(`/api/v1/admin/classifier-items/${SCHEDULED_ID}`);
  // `code` and `valid_from` are identity: `ClassifierItemPatch` has no room
  // for them, and the screen must not invent one.
  expect(sent[0].body).not.toHaveProperty('code');
  expect(sent[0].body).not.toHaveProperty('valid_from');
  expect(sent[0].body).toMatchObject({ name: { uz_latn: 'Yangilangan asos' } });
});

test('archiving is presented as closing the row, not deleting it', async () => {
  mockBackend(() => [RJ_01]);
  renderPage();

  const active = await row(ACTIVE_ID);
  await userEvent.click(within(active).getByRole('button', { name: L.actionArchive }));

  expect(screen.getByText(L.archiveBody)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: L.archiveConfirm }));

  await waitFor(() => expect(sent).toHaveLength(1));
  expect(sent[0].url).toBe(`/api/v1/admin/classifier-items/${ACTIVE_ID}/archive`);
});

test('a failed load says so instead of showing an empty classifier', async () => {
  server.use(
    http.get('*/api/v1/refs/classifiers/:code/items', () =>
      HttpResponse.json({ error: { code: 'ERR-SYS-003', message: 'unknown classifier' } }, { status: 404 }),
    ),
  );
  renderPage();

  expect(await screen.findByTestId('classifiers-error')).toHaveTextContent('Manba topilmadi.');
});

test.each(['uz_latn', 'ru'] as const)('no untranslated key reaches the screen in %s', async (lang) => {
  mockBackend(() => [RJ_01]);
  renderPage(lang);

  await row(ACTIVE_ID);
  // `renderPage` gives `t` the identity function, so a shared-dictionary key
  // would render as itself. This screen must be reading only `labels.ts`.
  expect(document.body.textContent).not.toMatch(/\b(nav|dash|common)\.[a-z]/i);
});
