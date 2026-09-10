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

/** The ten public-site keys `stage-8-api`'s Task 1 appends to `SETTING_SPECS`,
 *  in the order it appends them (nine `site_*` keys, then one `public_*`
 *  key) — used to check that the H7 screen groups them sensibly rather than
 *  merely rendering each with the right editor. */
const SEASON_WINDOWS_KEY = 'site_season_windows';
const CONTOUR_KEY = 'public_permit_contour_enabled';
const SITE_SETTINGS = [
  { key: 'site_contact_phone', value: '+998 71 207 88 77', default: '+998 71 207 88 77', description: 'Public site: hotline number', overridden: false },
  { key: 'site_contact_email', value: 'urmoninfo@gmail.com', default: 'urmoninfo@gmail.com', description: 'Public site: contact e-mail', overridden: false },
  { key: 'site_contact_address_uz', value: '', default: '', description: 'Public site: address, Latin Uzbek', overridden: false },
  { key: 'site_contact_address_ru', value: '', default: '', description: 'Public site: address, Russian', overridden: false },
  { key: 'site_contact_hours_uz', value: 'Dushanba – juma, 9:00 – 18:00', default: 'Dushanba – juma, 9:00 – 18:00', description: 'Public site: working hours, Latin Uzbek', overridden: false },
  { key: 'site_contact_hours_ru', value: 'Понедельник – пятница, 9:00 – 18:00', default: 'Понедельник – пятница, 9:00 – 18:00', description: 'Public site: working hours, Russian', overridden: false },
  { key: 'site_social_telegram', value: '', default: '', description: 'Public site: Telegram channel URL', overridden: false },
  { key: 'site_social_youtube', value: '', default: '', description: 'Public site: YouTube channel URL', overridden: false },
  {
    key: SEASON_WINDOWS_KEY,
    value: { grazing: [4, 5, 6, 7, 8, 9, 10, 11] },
    default: { grazing: [4, 5, 6, 7, 8, 9, 10, 11] },
    description: 'Public site: provisional season windows per activity, months 1-12',
    overridden: false,
  },
  {
    key: CONTOUR_KEY,
    value: false,
    default: false,
    description: 'Publish the permit contour on the anonymous check page (#174)',
    overridden: false,
  },
];

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function mockList(settings: unknown[] = SETTINGS) {
  server.use(http.get('*/api/v1/admin/settings', () => HttpResponse.json(settings)));
}

function renderPage(lang: 'uz_latn' | 'uz_cyrl' | 'ru' | 'en' | 'kaa' = 'uz_latn') {
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

test.each(['uz_latn', 'uz_cyrl', 'ru', 'en', 'kaa'] as const)('the copy is complete in %s', async (lang) => {
  mockList();
  renderPage(lang);

  await screen.findByTestId(`setting-${BOOL_KEY}`);
  const expected = LABELS[lang];
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(expected.title);
  expect(screen.getByTestId(`setting-save-${BOOL_KEY}`)).toHaveTextContent(expected.save);
  expect(within(await row(BOOL_KEY)).getByText(expected.overridden)).toBeInTheDocument();
  expect(within(await row(STRING_KEY)).getByText(expected.atDefault)).toBeInTheDocument();
});

test('the nine public-site keys land in one group, separate from the unrelated contour flag', async () => {
  mockList([...SETTINGS, ...SITE_SETTINGS]);
  renderPage();

  const siteGroup = await screen.findByRole('group', { name: /site/i });
  // Eight strings plus the JSON textarea for the season windows.
  expect(within(siteGroup).getAllByRole('textbox').length).toBeGreaterThanOrEqual(8);
  expect(within(siteGroup).getByTestId(`setting-${SEASON_WINDOWS_KEY}`)).toBeInTheDocument();
  // `public_permit_contour_enabled` shares no prefix with `site_*` and must
  // not be swept into the same group just because it ships alongside them.
  expect(within(siteGroup).queryByTestId(`setting-${CONTOUR_KEY}`)).not.toBeInTheDocument();

  const publicGroup = await screen.findByRole('group', { name: /public/i });
  expect(within(publicGroup).getByTestId(`setting-${CONTOUR_KEY}`)).toBeInTheDocument();
  expect(within(publicGroup).getByRole('checkbox')).toBeInTheDocument();
});

// Stage 10, F3 (ruling #184): `site_rules_url`'s own label, hint and
// client-side URL validation.
const RULES_URL_KEY = 'site_rules_url';
const RULES_URL_SETTING = {
  key: RULES_URL_KEY,
  value: 'https://lex.uz/docs/-2770948',
  default: 'https://lex.uz/docs/-2770948',
  description: 'The rules a citizen accepts before signing (ruling #184)',
  overridden: false,
};

test('site_rules_url gets a human label and a hint that the applicant checkbox links here', async () => {
  mockList([...SETTINGS, RULES_URL_SETTING]);
  renderPage();

  const urlRow = await row(RULES_URL_KEY);
  expect(within(urlRow).getByText(L.siteRulesUrlLabel)).toBeInTheDocument();
  expect(within(urlRow).getByText(L.siteRulesUrlHint)).toBeInTheDocument();
  // The raw key is still shown too — this screen never hides it, only adds
  // a label above it.
  expect(within(urlRow).getByText(RULES_URL_KEY)).toBeInTheDocument();
});

test('site_rules_url refuses a value that is not an absolute http(s) URL, and sends nothing', async () => {
  mockList([...SETTINGS, RULES_URL_SETTING]);
  let puts = 0;
  server.use(
    http.put('*/api/v1/admin/settings/:key', () => {
      puts += 1;
      return HttpResponse.json(RULES_URL_SETTING);
    }),
  );
  const user = userEvent.setup();
  renderPage();

  const urlRow = await row(RULES_URL_KEY);
  const input = within(urlRow).getByRole('textbox');
  await user.clear(input);
  await user.type(input, 'lex.uz/docs/-2770948');
  await user.click(within(urlRow).getByTestId(`setting-save-${RULES_URL_KEY}`));

  const error = await within(urlRow).findByTestId(`setting-error-${RULES_URL_KEY}`);
  expect(error).toHaveTextContent(L.invalidUrl);
  expect(puts).toBe(0);
});

test('site_rules_url saves a valid absolute URL', async () => {
  mockList([...SETTINGS, RULES_URL_SETTING]);
  let body: unknown;
  const newUrl = 'https://lex.uz/docs/1234567';
  server.use(
    http.put('*/api/v1/admin/settings/:key', async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ ...RULES_URL_SETTING, value: newUrl, overridden: true });
    }),
  );
  const user = userEvent.setup();
  renderPage();

  const urlRow = await row(RULES_URL_KEY);
  const input = within(urlRow).getByRole('textbox');
  await user.clear(input);
  await user.type(input, newUrl);
  await user.click(within(urlRow).getByTestId(`setting-save-${RULES_URL_KEY}`));

  await within(urlRow).findByTestId(`setting-saved-${RULES_URL_KEY}`);
  expect(body).toEqual({ value: newUrl });
  expect(within(urlRow).queryByTestId(`setting-error-${RULES_URL_KEY}`)).not.toBeInTheDocument();
});

test('the season windows editor names its shape, instead of the generic JSON hint', async () => {
  mockList([...SETTINGS, ...SITE_SETTINGS]);
  renderPage();

  const seasonRow = await row(SEASON_WINDOWS_KEY);
  expect(within(seasonRow).getByText(L.seasonWindowsHint)).toBeInTheDocument();
  expect(within(seasonRow).queryByText(L.jsonHint)).not.toBeInTheDocument();

  // A JSON setting outside `site_season_windows` still gets the generic hint.
  const otherJsonRow = await row(JSON_KEY);
  expect(within(otherJsonRow).getByText(L.jsonHint)).toBeInTheDocument();
});
