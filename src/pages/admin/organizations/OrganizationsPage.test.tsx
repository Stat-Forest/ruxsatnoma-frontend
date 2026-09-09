/**
 * H5 — the organization hierarchy.
 *
 * The MSW handler for `GET /refs/organizations` below deliberately reproduces
 * the backend's STRICT `parent_id` filter (`admin/repo.py::_organizations_query`:
 * "No filter at all -> the root only"). An implementation that tries to flatten
 * the tree in one unfiltered call gets back the agency and nothing else, and
 * every child assertion here fails — which is the point.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { OrganizationsPage } from './OrganizationsPage';
import { DICTIONARIES, I18nContext, type UiLanguage } from '../../../i18n/context';
import { ru, uz_latn, uz_cyrl, en, kaa } from './labels';

const AGENCY = '00000000-0000-4000-8000-000000000001';
const TERRITORIAL = '00000000-0000-4000-8000-000000000002';
const LESHOZ_A = '00000000-0000-4000-8000-000000000003';
const LESHOZ_B = '00000000-0000-4000-8000-000000000004';
const BOLIM = '00000000-0000-4000-8000-000000000005';

const REGION_TASHKENT = 'r0000000-0000-4000-8000-000000000001';
const REGION_SAMARKAND = 'r0000000-0000-4000-8000-000000000002';
const DISTRICT_BOSTANLIQ = 'd0000000-0000-4000-8000-000000000001';
const DISTRICT_ZANGIOTA = 'd0000000-0000-4000-8000-000000000002';
const DISTRICT_URGUT = 'd0000000-0000-4000-8000-000000000003';

interface OrgRow {
  id: string;
  parent_id: string | null;
  kind: string;
  code: string;
  name: Record<string, string>;
  stir: string | null;
  region_id: string | null;
  district_id: string | null;
  status: string;
}

const ORGS: OrgRow[] = [
  {
    id: AGENCY,
    parent_id: null,
    kind: 'agency',
    code: 'agency',
    name: { uz_cyrl: 'Ўрмон хўжалиги агентлиги', uz_latn: 'Oʻrmon xoʻjaligi agentligi', ru: 'Агентство лесного хозяйства' },
    stir: null,
    region_id: null,
    district_id: null,
    status: 'active',
  },
  {
    id: TERRITORIAL,
    parent_id: AGENCY,
    kind: 'territorial',
    code: 'toshkent-hb',
    name: { uz_cyrl: 'Тошкент ҳудудий бошқармаси', uz_latn: 'Toshkent hududiy boshqarmasi', ru: 'Ташкентское территориальное управление' },
    stir: null,
    region_id: REGION_TASHKENT,
    district_id: null,
    status: 'active',
  },
  {
    id: LESHOZ_A,
    parent_id: TERRITORIAL,
    kind: 'leshoz',
    code: 'burchmulla',
    name: {
      uz_cyrl: 'Бурчмулла ўрмон хўжалиги',
      uz_latn: 'Burchmulla oʻrmon xoʻjaligi',
      ru: 'Бурчмуллинский лесхоз',
      en: 'Burchmulla Forestry Enterprise',
      kaa: 'Burchmulla toǵay xojalıǵı',
    },
    stir: '301234567',
    region_id: REGION_TASHKENT,
    district_id: DISTRICT_BOSTANLIQ,
    status: 'active',
  },
  {
    id: LESHOZ_B,
    parent_id: AGENCY,
    kind: 'leshoz',
    code: 'urgut',
    name: { uz_cyrl: 'Ургут ўрмон хўжалиги', uz_latn: 'Urgut oʻrmon xoʻjaligi', ru: 'Ургутский лесхоз' },
    stir: null,
    region_id: REGION_SAMARKAND,
    district_id: DISTRICT_URGUT,
    status: 'active',
  },
  {
    id: BOLIM,
    parent_id: LESHOZ_A,
    kind: 'bolim',
    code: 'burchmulla-1',
    name: { uz_cyrl: 'Бурчмулла 1-бўлими', uz_latn: 'Burchmulla 1-boʻlimi', ru: '1-е отделение Бурчмуллы' },
    stir: null,
    region_id: REGION_TASHKENT,
    district_id: DISTRICT_BOSTANLIQ,
    status: 'active',
  },
];

const REGIONS = [
  { id: REGION_TASHKENT, code: 'toshkent', soato_code: null, name: { uz_latn: 'Toshkent viloyati', ru: 'Ташкентская область' } },
  { id: REGION_SAMARKAND, code: 'samarqand', soato_code: null, name: { uz_latn: 'Samarqand viloyati', ru: 'Самаркандская область' } },
];

const DISTRICTS = [
  { id: DISTRICT_BOSTANLIQ, code: 'bostonliq', soato_code: null, region_id: REGION_TASHKENT, name: { uz_latn: 'Bostonliq tumani', ru: 'Бостанлыкский район' } },
  { id: DISTRICT_ZANGIOTA, code: 'zangiota', soato_code: null, region_id: REGION_TASHKENT, name: { uz_latn: 'Zangiota tumani', ru: 'Зангиатинский район' } },
  { id: DISTRICT_URGUT, code: 'urgut', soato_code: null, region_id: REGION_SAMARKAND, name: { uz_latn: 'Urgut tumani', ru: 'Ургутский район' } },
];

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let createdBody: unknown = null;
let patchedBody: unknown = null;
let patchedId: string | null = null;
let archivedIds: string[] = [];

beforeEach(() => {
  createdBody = null;
  patchedBody = null;
  patchedId = null;
  archivedIds = [];
});

/** The reference route, with the backend's own strict `parent_id` semantics. */
function refsHandlers(rows: OrgRow[] = ORGS) {
  return [
    http.get('*/api/v1/refs/organizations', ({ request }) => {
      const url = new URL(request.url);
      const parentId = url.searchParams.get('parent_id');
      const status = url.searchParams.get('status') ?? 'active';
      const items = rows.filter(
        (o) => (parentId ? o.parent_id === parentId : o.parent_id === null) && o.status === status,
      );
      return HttpResponse.json({ items, total: items.length, page: 1, page_size: 100 });
    }),
    http.get('*/api/v1/refs/regions', () => HttpResponse.json(REGIONS)),
    http.get('*/api/v1/refs/districts', ({ request }) => {
      const regionId = new URL(request.url).searchParams.get('region_id');
      return HttpResponse.json(DISTRICTS.filter((d) => !regionId || d.region_id === regionId));
    }),
  ];
}

function adminHandlers() {
  return [
    http.post('*/api/v1/admin/organizations', async ({ request }) => {
      createdBody = await request.json();
      return HttpResponse.json({ ...ORGS[3], id: 'created', requisites: {} }, { status: 201 });
    }),
    http.get('*/api/v1/admin/organizations/:orgId', ({ params }) => {
      const row = ORGS.find((o) => o.id === params.orgId);
      if (!row) return HttpResponse.json({ error: { code: 'ERR-SYS-003', message: 'not found' } }, { status: 404 });
      return HttpResponse.json({ ...row, requisites: { bank_account: '20208000000000000001' } });
    }),
    http.patch('*/api/v1/admin/organizations/:orgId', async ({ request, params }) => {
      patchedId = params.orgId as string;
      patchedBody = await request.json();
      const row = ORGS.find((o) => o.id === params.orgId)!;
      return HttpResponse.json({ ...row, requisites: {} });
    }),
    http.post('*/api/v1/admin/organizations/:orgId/archive', ({ params }) => {
      archivedIds.push(params.orgId as string);
      const row = ORGS.find((o) => o.id === params.orgId)!;
      return HttpResponse.json({ ...row, status: 'archived', requisites: {} });
    }),
  ];
}

function renderPage(lang: UiLanguage = 'uz_latn') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = {
    lang,
    backendLang: lang,
    t: (key: string) => (DICTIONARIES[lang] as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>
          <OrganizationsPage />
        </I18nContext.Provider>
      </QueryClientProvider>,
    ),
  };
}

// ── 1. the tree ────────────────────────────────────────────────────────────

test('the tree renders the agency with everything under it, four levels deep', async () => {
  server.use(...refsHandlers(), ...adminHandlers());
  renderPage();

  const agency = await screen.findByTestId(`org-row-${AGENCY}`);
  expect(agency).toHaveTextContent('Oʻrmon xoʻjaligi agentligi');
  expect(agency).toHaveTextContent('agency');
  expect(agency).toHaveAttribute('data-depth', '0');

  // `../api`'s two-level `listOrganizationTree` would stop at the territorial
  // administration and the republic-subordinated leshoz; the bolim only
  // appears if the walk recurses.
  expect(screen.getByTestId(`org-row-${TERRITORIAL}`)).toHaveAttribute('data-depth', '1');
  expect(screen.getByTestId(`org-row-${LESHOZ_A}`)).toHaveAttribute('data-depth', '2');
  expect(screen.getByTestId(`org-row-${BOLIM}`)).toHaveAttribute('data-depth', '3');

  // A republic-subordinated leshoz hangs off the agency directly.
  expect(screen.getByTestId(`org-row-${LESHOZ_B}`)).toHaveAttribute('data-depth', '1');
});

test('a leshoz is named as one, and the header counts them', async () => {
  server.use(...refsHandlers(), ...adminHandlers());
  renderPage();

  const leshoz = await screen.findByTestId(`org-row-${LESHOZ_A}`);
  expect(within(leshoz).getByTestId('org-kind')).toHaveTextContent(uz_latn['kind.leshoz']);
  expect(within(leshoz).getByTestId('org-status')).toHaveTextContent(uz_latn['status.active']);

  const summary = screen.getByTestId('org-summary');
  expect(summary).toHaveTextContent('5');
  expect(summary).toHaveTextContent('2');
});

test('collapsing a branch hides its subtree', async () => {
  server.use(...refsHandlers(), ...adminHandlers());
  const { user } = renderPage();

  await screen.findByTestId(`org-row-${BOLIM}`);
  await user.click(screen.getByTestId(`org-toggle-${TERRITORIAL}`));

  expect(screen.queryByTestId(`org-row-${LESHOZ_A}`)).not.toBeInTheDocument();
  expect(screen.queryByTestId(`org-row-${BOLIM}`)).not.toBeInTheDocument();
  expect(screen.getByTestId(`org-row-${LESHOZ_B}`)).toBeInTheDocument();
});

// ── 2. create ──────────────────────────────────────────────────────────────

test('creating an organization sends the parent, kind, code and localized name the backend requires', async () => {
  server.use(...refsHandlers(), ...adminHandlers());
  const { user } = renderPage();

  await screen.findByTestId(`org-row-${AGENCY}`);
  await user.click(screen.getByTestId('org-create'));

  await user.selectOptions(screen.getByTestId('field-kind'), 'leshoz');
  await user.selectOptions(screen.getByTestId('field-parent'), TERRITORIAL);
  await user.type(screen.getByTestId('field-code'), 'chorvoq');
  await user.type(screen.getByTestId('field-name-uz_cyrl'), 'Чорвоқ ўрмон хўжалиги');
  await user.type(screen.getByTestId('field-name-uz_latn'), 'Chorvoq oʻrmon xoʻjaligi');
  await user.type(screen.getByTestId('field-name-ru'), 'Чарвакский лесхоз');
  await user.type(screen.getByTestId('field-stir'), '301234567');
  await user.selectOptions(screen.getByTestId('field-region'), REGION_TASHKENT);
  await user.selectOptions(screen.getByTestId('field-district'), DISTRICT_ZANGIOTA);

  await user.click(screen.getByTestId('org-form-submit'));

  await vi.waitFor(() => expect(createdBody).not.toBeNull());
  expect(createdBody).toEqual({
    parent_id: TERRITORIAL,
    kind: 'leshoz',
    code: 'chorvoq',
    name: {
      uz_cyrl: 'Чорвоқ ўрмон хўжалиги',
      uz_latn: 'Chorvoq oʻrmon xoʻjaligi',
      ru: 'Чарвакский лесхоз',
    },
    stir: '301234567',
    region_id: REGION_TASHKENT,
    district_id: DISTRICT_ZANGIOTA,
    requisites: {},
  });
});

test('the form refuses to submit without the Cyrillic name the backend makes mandatory', async () => {
  server.use(...refsHandlers(), ...adminHandlers());
  const { user } = renderPage();

  await screen.findByTestId(`org-row-${AGENCY}`);
  await user.click(screen.getByTestId('org-create'));

  await user.selectOptions(screen.getByTestId('field-kind'), 'leshoz');
  await user.selectOptions(screen.getByTestId('field-parent'), AGENCY);
  await user.type(screen.getByTestId('field-code'), 'chorvoq');
  await user.type(screen.getByTestId('field-name-uz_latn'), 'Chorvoq oʻrmon xoʻjaligi');
  await user.click(screen.getByTestId('org-form-submit'));

  expect(await screen.findByTestId('error-name-uz_cyrl')).toBeInTheDocument();
  expect(createdBody).toBeNull();
});

test('the agency is a root: choosing it empties and disables the parent picker', async () => {
  server.use(...refsHandlers(), ...adminHandlers());
  const { user } = renderPage();

  await screen.findByTestId(`org-row-${AGENCY}`);
  await user.click(screen.getByTestId('org-create'));
  await user.selectOptions(screen.getByTestId('field-kind'), 'agency');

  expect(screen.getByTestId('field-parent')).toBeDisabled();
  expect((screen.getByTestId('field-parent') as HTMLSelectElement).value).toBe('');
});

// ── 3. region narrows district ─────────────────────────────────────────────

test('picking a region narrows the district options to that region', async () => {
  server.use(...refsHandlers(), ...adminHandlers());
  const { user } = renderPage();

  await screen.findByTestId(`org-row-${AGENCY}`);
  await user.click(screen.getByTestId('org-create'));

  const district = screen.getByTestId('field-district') as HTMLSelectElement;
  expect(district).toBeDisabled();

  await user.selectOptions(screen.getByTestId('field-region'), REGION_TASHKENT);
  await vi.waitFor(() => expect(within(district).getAllByRole('option').length).toBe(3));
  expect(district).toBeEnabled();
  expect(within(district).getByRole('option', { name: 'Bostonliq tumani' })).toBeInTheDocument();
  expect(within(district).getByRole('option', { name: 'Zangiota tumani' })).toBeInTheDocument();
  expect(within(district).queryByRole('option', { name: 'Urgut tumani' })).not.toBeInTheDocument();

  await user.selectOptions(district, DISTRICT_ZANGIOTA);
  await user.selectOptions(screen.getByTestId('field-region'), REGION_SAMARKAND);

  // The stale district must not survive the region change.
  await vi.waitFor(() => expect(within(district).queryByRole('option', { name: 'Zangiota tumani' })).not.toBeInTheDocument());
  expect(within(district).getByRole('option', { name: 'Urgut tumani' })).toBeInTheDocument();
  expect(district.value).toBe('');
});

// ── 4. edit ────────────────────────────────────────────────────────────────

test('editing locks the immutable columns and patches only what OrganizationPatch accepts', async () => {
  server.use(...refsHandlers(), ...adminHandlers());
  const { user } = renderPage();

  await screen.findByTestId(`org-row-${LESHOZ_A}`);
  await user.click(screen.getByTestId(`org-edit-${LESHOZ_A}`));

  const latin = (await screen.findByTestId('field-name-uz_latn')) as HTMLInputElement;
  expect(latin.value).toBe('Burchmulla oʻrmon xoʻjaligi');
  // `OrganizationPatch` carries neither `kind` nor `code` — the UI must not
  // pretend they are editable.
  expect(screen.getByTestId('field-kind')).toBeDisabled();
  expect(screen.getByTestId('field-code')).toBeDisabled();

  await user.clear(latin);
  await user.type(latin, 'Burchmulla OX');
  await user.click(screen.getByTestId('org-form-submit'));

  await vi.waitFor(() => expect(patchedBody).not.toBeNull());
  expect(patchedId).toBe(LESHOZ_A);
  expect(patchedBody).toEqual({
    parent_id: TERRITORIAL,
    name: {
      uz_cyrl: 'Бурчмулла ўрмон хўжалиги',
      uz_latn: 'Burchmulla OX',
      ru: 'Бурчмуллинский лесхоз',
    },
    stir: '301234567',
    region_id: REGION_TASHKENT,
    district_id: DISTRICT_BOSTANLIQ,
  });
});

// ── 5. archive ─────────────────────────────────────────────────────────────

test('archiving asks for confirmation before it fires', async () => {
  server.use(...refsHandlers(), ...adminHandlers());
  const { user } = renderPage();

  await screen.findByTestId(`org-row-${LESHOZ_B}`);
  await user.click(screen.getByTestId(`org-archive-${LESHOZ_B}`));

  expect(archivedIds).toEqual([]);
  const dialog = await screen.findByTestId('archive-confirm');
  expect(dialog).toHaveTextContent('Urgut oʻrmon xoʻjaligi');

  await user.click(screen.getByTestId('archive-confirm-submit'));
  await vi.waitFor(() => expect(archivedIds).toEqual([LESHOZ_B]));
});

test('dismissing the confirmation archives nothing', async () => {
  server.use(...refsHandlers(), ...adminHandlers());
  const { user } = renderPage();

  await screen.findByTestId(`org-row-${LESHOZ_B}`);
  await user.click(screen.getByTestId(`org-archive-${LESHOZ_B}`));
  await user.click(await screen.findByTestId('archive-confirm-cancel'));

  expect(screen.queryByTestId('archive-confirm')).not.toBeInTheDocument();
  expect(archivedIds).toEqual([]);
});

test('a branch that still has active children explains the refusal', async () => {
  server.use(
    // First match wins in MSW, so the refusal has to precede the happy-path
    // archive handler `adminHandlers()` registers.
    http.post('*/api/v1/admin/organizations/:orgId/archive', () =>
      HttpResponse.json(
        { error: { code: 'ERR-VAL-001', message: 'refused', details: { reason: 'active children', count: 1 } } },
        { status: 400 },
      ),
    ),
    ...refsHandlers(),
    ...adminHandlers(),
  );
  const { user } = renderPage();

  await screen.findByTestId(`org-row-${TERRITORIAL}`);
  await user.click(screen.getByTestId(`org-archive-${TERRITORIAL}`));
  await user.click(await screen.findByTestId('archive-confirm-submit'));

  expect(await screen.findByTestId('archive-error')).toHaveTextContent(uz_latn['archive.error.children']);
});

// ── 6. failure and copy ────────────────────────────────────────────────────

test('a failed load says so instead of showing an empty hierarchy', async () => {
  server.use(
    http.get('*/api/v1/refs/organizations', () =>
      HttpResponse.json({ error: { code: 'ERR-SYS-000', message: 'boom' } }, { status: 500 }),
    ),
    ...refsHandlers().slice(1),
    ...adminHandlers(),
  );
  renderPage();

  expect(await screen.findByTestId('org-tree-error')).toBeInTheDocument();
});

test('all five label dictionaries carry identical keys and non-empty values', () => {
  const baseKeys = Object.keys(uz_latn).sort();
  expect(baseKeys.length).toBeGreaterThan(0);

  const dicts: Record<UiLanguage, Record<string, string>> = {
    uz_latn,
    ru,
    uz_cyrl,
    en,
    kaa,
  };

  for (const [lang, dict] of Object.entries(dicts)) {
    expect(Object.keys(dict).sort(), `Keys mismatch in ${lang}`).toEqual(baseKeys);
    expect(Object.values(dict).every((v) => typeof v === 'string' && v.length > 0), `Empty string in ${lang}`).toBe(true);
  }
});

test.each([
  ['uz_latn', uz_latn, 'Burchmulla oʻrmon xoʻjaligi'],
  ['ru', ru, 'Бурчмуллинский лесхоз'],
  ['uz_cyrl', uz_cyrl, 'Бурчмулла ўрмон хўжалиги'],
  ['en', en, 'Burchmulla Forestry Enterprise'],
  ['kaa', kaa, 'Burchmulla toǵay xojalıǵı'],
] as const)('the screen speaks %s when selected', async (lang, labels, expectedName) => {
  server.use(...refsHandlers(), ...adminHandlers());
  renderPage(lang);

  const leshoz = await screen.findByTestId(`org-row-${LESHOZ_A}`);
  expect(within(leshoz).getByTestId('org-kind')).toHaveTextContent(labels['kind.leshoz']);
  expect(leshoz).toHaveTextContent(expectedName);
  expect(screen.getByRole('heading', { level: 1, name: labels['page.title'] })).toBeInTheDocument();
});
