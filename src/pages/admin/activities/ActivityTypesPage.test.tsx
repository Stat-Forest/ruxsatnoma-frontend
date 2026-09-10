/**
 * H-services — the activity types catalog screen (rulings #138, #139, #139a).
 *
 * Three things this screen must not get wrong, one test each, plus a rendering
 * smoke test and the "no create route" guard:
 *   1. archiving a service is behind a confirmation that says PLAINLY that
 *      this closes new applications too, not just the landing (#139a) — and
 *      the request it sends is nothing but `{status: 'archived'}`;
 *   2. a description written in only one language without `uz_latn` is
 *      refused BEFORE any request is sent — the backend's own 422 for this
 *      renders as a generic "validation failed" sentence
 *      (`i18n/errorMessages.ts`'s `ERR-VAL-001`), so the specific "uz_latn"
 *      complaint has to come from the screen itself;
 *   3. a valid edit sends a `PATCH` carrying only what the dialog actually
 *      edits (`name`, `description`, `processing_days` — never `sort_order`,
 *      which `ActivityTypeOut` does not even expose to read back) — AND
 *      still carries the `uz_cyrl`/`en` keys the dialog never showed, because
 *      the backend replaces `name`/`description` whole rather than merging;
 *   4. a `null` description (deadwood, science — the landing never had copy
 *      for them) renders as a "not filled in" placeholder, never a crash and
 *      never an invented sentence;
 *   5. no "add" button anywhere — the catalog is fixed by law (#139);
 *   6. clearing both description fields on a row that had one sends an
 *      explicit `description: null`, so the clear actually reaches the
 *      backend instead of the save silently doing nothing;
 *   7. the optional `ru` key on `name`/`description` pins all three states a
 *      truthiness guard alone cannot tell apart: blanking a PRE-FILLED `ru`
 *      drops the key (haymaking's `name.ru`, grazing's `description.ru`);
 *      leaving an ABSENT `ru` blank keeps it absent (apiary carries neither);
 *      and a NEW value is written (apiary's `description.ru`, and the
 *      existing "adding a ru name" test below for `name.ru`).
 *
 * `SIX_ROWS[1]` (haymaking) is the only fixture with a pre-existing
 * `name.ru`; `SIX_ROWS[2]` (apiary) is the only one whose `description` has
 * no `ru` at all — both added so the "cleared" and "stays absent" states
 * above have a row to exercise.
 *
 * `getAllByRole('button', {name: /tahrirlash/i})[0]` stands in for the
 * brief's singular `getByRole` where it targets the edit action: six rows
 * each carry an edit button whose accessible name embeds the row's own name
 * (the `TemplatesPage.tsx` `aria-label={`${L.edit}: ${row.event_code}`}`
 * pattern), so a bare `/tahrirlash/i` matches all six by design — the same
 * per-row disambiguation the switch query below already relies on.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ActivityTypesPage } from './ActivityTypesPage';
import { DICTIONARIES, I18nContext } from '../../../i18n/context';
import type { ActivityTypeOut } from './api';

const SIX_ROWS: ActivityTypeOut[] = [
  {
    id: '0198f100-0001-7000-8000-000000000001',
    code: 'grazing',
    name: { en: 'Livestock grazing', uz_cyrl: 'Чорва молларини боқиш', uz_latn: 'Chorva mollarini boqish' },
    quantity_unit: 'head',
    status: 'active',
    description: {
      ru: 'Электронное разрешение на выпас скота на пастбищных угодьях лесного фонда.',
      uz_latn: 'Oʻrmon fondi yaylov hududlarida qoramol, qoʻy va echkilarni boqish uchun elektron ruxsatnoma.',
    },
    processing_days: 15,
  },
  {
    id: '0198f100-0001-7000-8000-000000000002',
    code: 'haymaking',
    // The only row with a pre-existing `name.ru` — everything else in this
    // fixture set has none, which is exactly why "the admin clears an
    // already-present `ru`" was never exercised before this file's own fix.
    name: { en: 'Haymaking', uz_cyrl: 'Пичан тайёрлаш', uz_latn: 'Pichan tayyorlash', ru: 'Сенокошение' },
    quantity_unit: 'ton',
    status: 'active',
    description: {
      ru: 'Пользование сенокосными угодьями в сезонный период.',
      uz_latn: 'Mavsumiy pichan oʻrish maydonlaridan foydalanish.',
    },
    processing_days: 15,
  },
  {
    id: '0198f100-0001-7000-8000-000000000003',
    code: 'apiary',
    name: { en: 'Apiary', uz_cyrl: 'Асаларичилик', uz_latn: 'Asalarichilik' },
    quantity_unit: 'hive',
    status: 'active',
    // No `ru` in the description — the fixture for "the field was empty and
    // stays empty", as opposed to grazing's description above, which
    // already carries one.
    description: {
      uz_latn: 'Asalari oilalarini oʻrmon yerlariga vaqtinchalik joylashtirish.',
    },
    processing_days: 15,
  },
  {
    id: '0198f100-0001-7000-8000-000000000004',
    code: 'recreation',
    name: { en: 'Recreation and tourism', uz_cyrl: 'Дам олиш ва туризм', uz_latn: 'Dam olish va turizm' },
    quantity_unit: 'ha',
    status: 'active',
    description: {
      ru: 'Возведение временных лёгких сооружений в сфере экологического туризма.',
      uz_latn: 'Vaqtinchalik yengil inshootlar qurish va ekologik turizm.',
    },
    processing_days: 15,
  },
  {
    id: '0198f100-0001-7000-8000-000000000005',
    code: 'deadwood',
    name: { en: 'Deadwood collection', uz_cyrl: 'Қуруқ шох-шабба йиғиш', uz_latn: 'Quruq shox-shabba yigʻish' },
    quantity_unit: 'ton',
    status: 'active',
    // The landing never had copy for this code — must render as "not filled
    // in", never invented (task-7-brief.md point 3).
    description: null,
    processing_days: 15,
  },
  {
    id: '0198f100-0001-7000-8000-000000000006',
    code: 'science',
    name: { en: 'Scientific research', uz_cyrl: 'Илмий тадқиқот', uz_latn: 'Ilmiy tadqiqot' },
    quantity_unit: 'ha',
    status: 'active',
    description: null,
    processing_days: 15,
  },
];

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function mockList(rows: ActivityTypeOut[] = SIX_ROWS) {
  server.use(http.get('*/api/v1/refs/activity-types', () => HttpResponse.json(rows)));
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
        <ActivityTypesPage />
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

test('renders all six rows with their name, description (or a not-filled placeholder), and the term', async () => {
  mockList();
  renderPage();

  expect(await screen.findByText(/chorva mollarini boqish/i)).toBeInTheDocument();
  expect(screen.getByText(/qoramol, qoʻy va echkilarni boqish uchun elektron ruxsatnoma/i)).toBeInTheDocument();
  expect(screen.getAllByText(/15 kun/i).length).toBe(6);

  // `deadwood` and `science` have `description: null` — a placeholder, not a
  // crash and not an invented sentence (task-7-brief.md point 3).
  expect(screen.getByText(/quruq shox-shabba yigʻish/i)).toBeInTheDocument();
  expect(screen.getAllByText(/tavsif kiritilmagan/i).length).toBe(2);
});

test('switches a service off and warns that this closes it everywhere', async () => {
  mockList();
  const patched: unknown[] = [];
  server.use(
    http.patch('*/api/v1/refs/activity-types/:id', async ({ request }) => {
      patched.push(await request.json());
      return HttpResponse.json({ ...SIX_ROWS[0], status: 'archived' });
    }),
  );
  const user = userEvent.setup();
  renderPage();

  await user.click(await screen.findByRole('switch', { name: /chorva mollarini boqish/i }));
  expect(await screen.findByText(/ariza berish ham yopiladi/i)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /tasdiqlash/i }));
  await waitFor(() => expect(patched).toEqual([{ status: 'archived' }]));
});

test('refuses to save a description with no uz_latn, and sends no request', async () => {
  mockList();
  const user = userEvent.setup();
  renderPage();

  const editButtons = await screen.findAllByRole('button', { name: /tahrirlash/i });
  await user.click(editButtons[0]);
  await user.clear(screen.getByLabelText(/tavsif \(uz\)/i));
  await user.type(screen.getByLabelText(/tavsif \(ru\)/i), 'Только по-русски');
  await user.click(screen.getByRole('button', { name: /saqlash/i }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/uz_latn/i);
});

test('saves a valid edit as a PATCH carrying only name, description and the term — and still carries uz_cyrl/en, which the dialog never showed', async () => {
  mockList();
  const patched: unknown[] = [];
  server.use(
    http.patch('*/api/v1/refs/activity-types/:id', async ({ request }) => {
      patched.push(await request.json());
      return HttpResponse.json({ ...SIX_ROWS[0], processing_days: 20 });
    }),
  );
  const user = userEvent.setup();
  renderPage();

  const editButtons = await screen.findAllByRole('button', { name: /tahrirlash/i });
  await user.click(editButtons[0]);
  const days = screen.getByLabelText(/muddat \(kun\)/i);
  await user.clear(days);
  await user.type(days, '20');
  await user.click(screen.getByRole('button', { name: /saqlash/i }));

  // Row 0's `name` carries `uz_cyrl` and `en` and no `ru` at all — the dialog
  // only ever showed `uz_latn`/`ru`. The backend REPLACES the JSONB column
  // whole, so a PATCH that dropped `uz_cyrl`/`en` here would silently erase
  // them from the database on this save, breaking the permit document
  // (`DOCUMENT_LANGUAGE = "uz_cyrl"`) for the very next citizen.
  await waitFor(() =>
    expect(patched).toEqual([
      {
        name: {
          en: 'Livestock grazing',
          uz_cyrl: 'Чорва молларини боқиш',
          uz_latn: 'Chorva mollarini boqish',
        },
        description: {
          uz_latn: 'Oʻrmon fondi yaylov hududlarida qoramol, qoʻy va echkilarni boqish uchun elektron ruxsatnoma.',
          ru: 'Электронное разрешение на выпас скота на пастбищных угодьях лесного фонда.',
        },
        processing_days: 20,
      },
    ]),
  );
});

test('adding a ru name still keeps the row\'s uz_cyrl and en untouched', async () => {
  mockList();
  const patched: unknown[] = [];
  server.use(
    http.patch('*/api/v1/refs/activity-types/:id', async ({ request }) => {
      patched.push(await request.json());
      return HttpResponse.json(SIX_ROWS[0]);
    }),
  );
  const user = userEvent.setup();
  renderPage();

  const editButtons = await screen.findAllByRole('button', { name: /tahrirlash/i });
  await user.click(editButtons[0]);
  await user.type(screen.getByLabelText(/nomi \(ru\)/i), 'Выпас скота');
  await user.click(screen.getByRole('button', { name: /saqlash/i }));

  await waitFor(() =>
    expect(patched).toEqual([
      {
        name: {
          en: 'Livestock grazing',
          uz_cyrl: 'Чорва молларини боқиш',
          uz_latn: 'Chorva mollarini boqish',
          ru: 'Выпас скота',
        },
        description: {
          uz_latn: 'Oʻrmon fondi yaylov hududlarida qoramol, qoʻy va echkilarni boqish uchun elektron ruxsatnoma.',
          ru: 'Электронное разрешение на выпас скота на пастбищных угодьях лесного фонда.',
        },
        processing_days: 15,
      },
    ]),
  );
});

test('clearing a pre-filled name ru drops the key, rather than resending the old value', async () => {
  mockList();
  const patched: unknown[] = [];
  server.use(
    http.patch('*/api/v1/refs/activity-types/:id', async ({ request }) => {
      patched.push(await request.json());
      return HttpResponse.json(SIX_ROWS[1]);
    }),
  );
  const user = userEvent.setup();
  renderPage();

  const editButtons = await screen.findAllByRole('button', { name: /tahrirlash/i });
  await user.click(editButtons[1]); // haymaking — the one row with a pre-existing name.ru
  await user.clear(screen.getByLabelText(/nomi \(ru\)/i));
  await user.click(screen.getByRole('button', { name: /saqlash/i }));

  // The dialog pre-filled `ru: 'Сенокошение'` from the row; blanking it must
  // remove the key rather than resend the stale value the spread put back —
  // the truthiness-guard defect this test pins down. `description` (which
  // does carry a `ru`) is untouched and must stay exactly as it was.
  await waitFor(() =>
    expect(patched).toEqual([
      {
        name: {
          en: 'Haymaking',
          uz_cyrl: 'Пичан тайёрлаш',
          uz_latn: 'Pichan tayyorlash',
        },
        description: {
          uz_latn: 'Mavsumiy pichan oʻrish maydonlaridan foydalanish.',
          ru: 'Пользование сенокосными угодьями в сезонный период.',
        },
        processing_days: 15,
      },
    ]),
  );
});

test('clearing a pre-filled description ru drops the key while uz stays', async () => {
  mockList();
  const patched: unknown[] = [];
  server.use(
    http.patch('*/api/v1/refs/activity-types/:id', async ({ request }) => {
      patched.push(await request.json());
      return HttpResponse.json(SIX_ROWS[0]);
    }),
  );
  const user = userEvent.setup();
  renderPage();

  const editButtons = await screen.findAllByRole('button', { name: /tahrirlash/i });
  await user.click(editButtons[0]); // grazing — description already carries a ru
  await user.clear(screen.getByLabelText(/tavsif \(ru\)/i));
  await user.click(screen.getByRole('button', { name: /saqlash/i }));

  await waitFor(() =>
    expect(patched).toEqual([
      {
        name: {
          en: 'Livestock grazing',
          uz_cyrl: 'Чорва молларини боқиш',
          uz_latn: 'Chorva mollarini boqish',
        },
        description: {
          uz_latn: 'Oʻrmon fondi yaylov hududlarida qoramol, qoʻy va echkilarni boqish uchun elektron ruxsatnoma.',
        },
        processing_days: 15,
      },
    ]),
  );
});

test('a row with neither name ru nor description ru sends neither key while both stay blank', async () => {
  mockList();
  const patched: unknown[] = [];
  server.use(
    http.patch('*/api/v1/refs/activity-types/:id', async ({ request }) => {
      patched.push(await request.json());
      return HttpResponse.json({ ...SIX_ROWS[2], processing_days: 20 });
    }),
  );
  const user = userEvent.setup();
  renderPage();

  const editButtons = await screen.findAllByRole('button', { name: /tahrirlash/i });
  await user.click(editButtons[2]); // apiary — no name.ru, no description.ru
  const days = screen.getByLabelText(/muddat \(kun\)/i);
  await user.clear(days);
  await user.type(days, '20');
  await user.click(screen.getByRole('button', { name: /saqlash/i }));

  await waitFor(() =>
    expect(patched).toEqual([
      {
        name: {
          en: 'Apiary',
          uz_cyrl: 'Асаларичилик',
          uz_latn: 'Asalarichilik',
        },
        description: {
          uz_latn: 'Asalari oilalarini oʻrmon yerlariga vaqtinchalik joylashtirish.',
        },
        processing_days: 20,
      },
    ]),
  );
});

test('adding a description ru where none existed writes it', async () => {
  mockList();
  const patched: unknown[] = [];
  server.use(
    http.patch('*/api/v1/refs/activity-types/:id', async ({ request }) => {
      patched.push(await request.json());
      return HttpResponse.json(SIX_ROWS[2]);
    }),
  );
  const user = userEvent.setup();
  renderPage();

  const editButtons = await screen.findAllByRole('button', { name: /tahrirlash/i });
  await user.click(editButtons[2]); // apiary — no description.ru yet
  await user.type(screen.getByLabelText(/tavsif \(ru\)/i), 'Пасека на землях лесного фонда.');
  await user.click(screen.getByRole('button', { name: /saqlash/i }));

  await waitFor(() =>
    expect(patched).toEqual([
      {
        name: {
          en: 'Apiary',
          uz_cyrl: 'Асаларичилик',
          uz_latn: 'Asalarichilik',
        },
        description: {
          uz_latn: 'Asalari oilalarini oʻrmon yerlariga vaqtinchalik joylashtirish.',
          ru: 'Пасека на землях лесного фонда.',
        },
        processing_days: 15,
      },
    ]),
  );
});

test('clearing both description fields sends an explicit null, so the clear actually reaches the backend', async () => {
  mockList();
  const patched: unknown[] = [];
  server.use(
    http.patch('*/api/v1/refs/activity-types/:id', async ({ request }) => {
      patched.push(await request.json());
      return HttpResponse.json({ ...SIX_ROWS[0], description: null });
    }),
  );
  const user = userEvent.setup();
  renderPage();

  const editButtons = await screen.findAllByRole('button', { name: /tahrirlash/i });
  await user.click(editButtons[0]);
  await user.clear(screen.getByLabelText(/tavsif \(uz\)/i));
  await user.clear(screen.getByLabelText(/tavsif \(ru\)/i));
  await user.click(screen.getByRole('button', { name: /saqlash/i }));

  await waitFor(() =>
    expect(patched).toEqual([
      {
        name: {
          en: 'Livestock grazing',
          uz_cyrl: 'Чорва молларини боқиш',
          uz_latn: 'Chorva mollarini boqish',
        },
        description: null,
        processing_days: 15,
      },
    ]),
  );
});

test('offers no way to add a new activity type — the catalog is fixed by law (#139)', async () => {
  mockList();
  renderPage();
  await screen.findByText(/chorva mollarini boqish/i);
  expect(screen.queryByRole('button', { name: /qoʻshish|add/i })).not.toBeInTheDocument();
});
