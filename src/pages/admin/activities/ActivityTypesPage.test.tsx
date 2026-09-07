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
 *      backend instead of the save silently doing nothing.
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
    name: { en: 'Haymaking', uz_cyrl: 'Пичан тайёрлаш', uz_latn: 'Pichan tayyorlash' },
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
    description: {
      ru: 'Временное размещение пчелиных семей на землях лесного фонда.',
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
