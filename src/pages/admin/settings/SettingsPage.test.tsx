import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { SettingsPage } from './SettingsPage';
import { I18nContext } from '../../../i18n/context';
import { LABELS } from './labels';

const BOOL_KEY = 'notifications.email_enabled';
const STRING_KEY = 'permits.default_series';
const NUMBER_KEY = 'payments.invoice_ttl_days';
const JSON_KEY = 'gis.map_defaults';

/** Shaped exactly like `SettingOut`: `value` and `default` are `unknown` on
 *  the wire, which is the whole reason this screen infers its editor from the
 *  value's runtime type rather than from a declared one. */
const SETTINGS = [
  {
    key: BOOL_KEY,
    value: true,
    default: false,
    description: 'Send e-mail notifications to applicants',
    overridden: true,
  },
  {
    key: STRING_KEY,
    value: 'A',
    default: 'A',
    description: 'Series printed on every new permit',
    overridden: false,
  },
  {
    key: NUMBER_KEY,
    value: 10,
    default: 7,
    description: 'Days an unpaid invoice stays valid',
    overridden: true,
  },
  {
    key: JSON_KEY,
    value: { zoom: 9, center: [69.2, 41.3] },
    default: { zoom: 8, center: [69.2, 41.3] },
    description: 'Initial map viewport of the GIS screen',
    overridden: true,
  },
];

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function mockList(settings: unknown[] = SETTINGS) {
  server.use(http.get('*/api/v1/admin/settings', () => HttpResponse.json(settings)));
}

function renderPage(lang: 'uz_latn' | 'ru' = 'uz_latn') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang, backendLang: lang, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <SettingsPage />
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

const L = LABELS.uz_latn;

async function row(key: string) {
  return await screen.findByTestId(`setting-${key}`);
}

test('the editor follows the runtime type of the current value', async () => {
  mockList();
  renderPage();

  const boolRow = await row(BOOL_KEY);
  expect(within(boolRow).getByRole('checkbox')).toBeChecked();

  const stringRow = await row(STRING_KEY);
  const stringInput = within(stringRow).getByRole('textbox');
  expect(stringInput).toHaveAttribute('type', 'text');
  expect(stringInput).toHaveValue('A');

  const numberRow = await row(NUMBER_KEY);
  expect(within(numberRow).getByRole('spinbutton')).toHaveValue(10);

  const jsonRow = await row(JSON_KEY);
  expect(within(jsonRow).getByRole('textbox').tagName).toBe('TEXTAREA');
});

test('an overridden setting is marked as such and one at its default is not', async () => {
  mockList();
  renderPage();

  expect(within(await row(BOOL_KEY)).getByText(L.overridden)).toBeInTheDocument();
  expect(within(await row(STRING_KEY)).getByText(L.atDefault)).toBeInTheDocument();
  expect(within(await row(STRING_KEY)).queryByText(L.overridden)).not.toBeInTheDocument();
});

test('the default value is shown next to the current one, since resetting means typing it back', async () => {
  mockList();
  renderPage();

  expect(await screen.findByTestId(`setting-default-${NUMBER_KEY}`)).toHaveTextContent('7');
  expect(screen.getByTestId(`setting-current-${NUMBER_KEY}`)).toHaveTextContent('10');
});

test('the description arrives from the server in English and is rendered as-is', async () => {
  mockList();
  renderPage('ru');

  expect(await screen.findByText('Days an unpaid invoice stays valid')).toBeInTheDocument();
});

test('saving a boolean sends a real boolean, not the string "true"', async () => {
  mockList();
  let body: unknown;
  server.use(
    http.put('*/api/v1/admin/settings/:key', async ({ request, params }) => {
      body = await request.json();
      return HttpResponse.json({ ...SETTINGS[0], key: params.key, value: false, overridden: true });
    }),
  );
  const user = userEvent.setup();
  renderPage();

  const boolRow = await row(BOOL_KEY);
  await user.click(within(boolRow).getByRole('checkbox'));
  await user.click(within(boolRow).getByTestId(`setting-save-${BOOL_KEY}`));

  await screen.findByTestId(`setting-saved-${BOOL_KEY}`);
  expect(body).toEqual({ value: false });
  expect(typeof (body as { value: unknown }).value).toBe('boolean');
});

test('saving a number sends a number, not its text', async () => {
  mockList();
  let body: unknown;
  server.use(
    http.put('*/api/v1/admin/settings/:key', async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ ...SETTINGS[2], value: 21 });
    }),
  );
  const user = userEvent.setup();
  renderPage();

  const numberRow = await row(NUMBER_KEY);
  const input = within(numberRow).getByRole('spinbutton');
  await user.clear(input);
  await user.type(input, '21');
  await user.click(within(numberRow).getByTestId(`setting-save-${NUMBER_KEY}`));

  await screen.findByTestId(`setting-saved-${NUMBER_KEY}`);
  expect(body).toEqual({ value: 21 });
  expect(typeof (body as { value: unknown }).value).toBe('number');
});

test('invalid JSON blocks the save, shows the parse error and sends nothing', async () => {
  mockList();
  let puts = 0;
  server.use(
    http.put('*/api/v1/admin/settings/:key', () => {
      puts += 1;
      return HttpResponse.json(SETTINGS[3]);
    }),
  );
  const user = userEvent.setup();
  renderPage();

  const jsonRow = await row(JSON_KEY);
  const textarea = within(jsonRow).getByRole('textbox');
  await user.clear(textarea);
  await user.type(textarea, '{{"zoom": 9,}');
  await user.click(within(jsonRow).getByTestId(`setting-save-${JSON_KEY}`));

  const error = await within(jsonRow).findByTestId(`setting-error-${JSON_KEY}`);
  expect(error).toHaveTextContent(L.invalidJson);
  expect(puts).toBe(0);
  // The row is still a row: the value it came with is still on screen.
  expect(screen.getByTestId(`setting-current-${JSON_KEY}`)).toHaveTextContent('{"zoom":9,"center":[69.2,41.3]}');
});

test('a refused save surfaces the error and leaves the previous value on screen', async () => {
  mockList();
  server.use(
    http.put('*/api/v1/admin/settings/:key', () =>
      HttpResponse.json(
        { error: { code: 'ERR-ADM-011', message: 'Setting is read-only' } },
        { status: 409 },
      ),
    ),
  );
  const user = userEvent.setup();
  renderPage();

  const numberRow = await row(NUMBER_KEY);
  const input = within(numberRow).getByRole('spinbutton');
  await user.clear(input);
  await user.type(input, '99');
  await user.click(within(numberRow).getByTestId(`setting-save-${NUMBER_KEY}`));

  const error = await within(numberRow).findByTestId(`setting-error-${NUMBER_KEY}`);
  // A code this map does not know yet falls back to the server's own message
  // (F4, `docs/plans/07.3-findings.md`) rather than the raw code.
  expect(error).toHaveTextContent('Setting is read-only');
  expect(error).not.toHaveTextContent('ERR-ADM-011');
  expect(screen.getByTestId(`setting-current-${NUMBER_KEY}`)).toHaveTextContent('10');
  expect(within(numberRow).getByRole('spinbutton')).toHaveValue(99);
  // The neighbours are untouched — one failed row does not blank the screen.
  expect(within(await row(STRING_KEY)).getByRole('textbox')).toHaveValue('A');
});

test('saving one setting leaves the unsaved edits of the others alone', async () => {
  mockList();
  server.use(
    http.put('*/api/v1/admin/settings/:key', () =>
      HttpResponse.json({ ...SETTINGS[1], value: 'B', overridden: true }),
    ),
  );
  const user = userEvent.setup();
  renderPage();

  const numberRow = await row(NUMBER_KEY);
  await user.clear(within(numberRow).getByRole('spinbutton'));
  await user.type(within(numberRow).getByRole('spinbutton'), '42');

  const stringRow = await row(STRING_KEY);
  await user.clear(within(stringRow).getByRole('textbox'));
  await user.type(within(stringRow).getByRole('textbox'), 'B');
  await user.click(within(stringRow).getByTestId(`setting-save-${STRING_KEY}`));

  await screen.findByTestId(`setting-saved-${STRING_KEY}`);
  expect(within(stringRow).getByText(L.overridden)).toBeInTheDocument();
  expect(within(numberRow).getByRole('spinbutton')).toHaveValue(42);
});

test('a failed load says so instead of showing an empty list', async () => {
  server.use(
    http.get('*/api/v1/admin/settings', () =>
      HttpResponse.json({ error: { code: 'ERR-SYS-000', message: 'boom' } }, { status: 500 }),
    ),
  );
  renderPage();

  expect(await screen.findByTestId('settings-error')).toBeInTheDocument();
});

test.each(['uz_latn', 'ru'] as const)('the copy is complete in %s', async (lang) => {
  mockList();
  renderPage(lang);

  await screen.findByTestId(`setting-${BOOL_KEY}`);
  const expected = LABELS[lang];
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(expected.title);
  expect(screen.getByTestId(`setting-save-${BOOL_KEY}`)).toHaveTextContent(expected.save);
});
