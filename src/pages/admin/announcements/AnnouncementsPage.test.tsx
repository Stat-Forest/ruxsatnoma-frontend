import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AnnouncementsPage } from './AnnouncementsPage';
import { DICTIONARIES, I18nContext, type UiLanguage } from '../../../i18n/context';
import { LABELS } from './labels';
import type { AnnouncementAdminOut } from './api';
import type { RegionOut, RoleAdminOut } from '../api';

const DRAFT = 'd0000000-0000-4000-8000-000000000001';
const PUBLISHED = 'd0000000-0000-4000-8000-000000000002';
const ARCHIVED = 'd0000000-0000-4000-8000-000000000003';
const AUTHOR = 'u0000000-0000-4000-8000-000000000001';
const TASHKENT = 'r0000000-0000-4000-8000-000000000001';
const SAMARKAND = 'r0000000-0000-4000-8000-000000000002';

function announcement(
  overrides: Partial<AnnouncementAdminOut> & Pick<AnnouncementAdminOut, 'id'>,
): AnnouncementAdminOut {
  return {
    title: { uz_latn: 'Sarlavha' },
    body: { uz_latn: 'Matn' },
    audience: null,
    status: 'draft',
    publish_from: null,
    publish_to: null,
    files: [],
    created_by: AUTHOR,
    created_at: '2026-09-01T09:00:00+05:00',
    ...overrides,
  };
}

function role(code: string, name: Record<string, string>): RoleAdminOut {
  return {
    id: `role-${code}`,
    code,
    name,
    description: null,
    is_system: true,
    status: 'active',
    max_approve_amount: null,
    max_approve_area: null,
    permission_codes: [],
    holders: 3,
  };
}

const ROLES: RoleAdminOut[] = [
  role('executor', { uz_latn: 'Ijrochi', ru: 'Исполнитель' }),
  role('applicant', { uz_latn: 'Ariza beruvchi', ru: 'Заявитель' }),
  role('inspector', { uz_latn: 'Inspektor', ru: 'Инспектор' }),
];

const REGIONS: RegionOut[] = [
  { id: TASHKENT, code: '26', soato_code: '1726', name: { uz_latn: 'Toshkent viloyati', ru: 'Ташкентская область' } },
  { id: SAMARKAND, code: '30', soato_code: '1730', name: { uz_latn: 'Samarqand viloyati', ru: 'Самаркандская область' } },
];

const LIST: AnnouncementAdminOut[] = [
  announcement({
    id: DRAFT,
    status: 'draft',
    title: { uz_latn: 'Qishki yem-xashak tartibi', ru: 'Порядок зимнего выпаса' },
    audience: { role_codes: ['executor'], region_ids: [TASHKENT] },
    publish_from: '2026-10-01',
    publish_to: '2026-12-31',
  }),
  announcement({
    id: PUBLISHED,
    status: 'published',
    title: { uz_latn: 'Tizim yangilanishi' },
    audience: null,
    publish_from: '2026-09-01',
  }),
  announcement({
    id: ARCHIVED,
    status: 'archived',
    title: { uz_latn: 'Eski eʼlon' },
  }),
];

function page(items: AnnouncementAdminOut[]) {
  return { items, total: items.length, page: 1, page_size: 20 };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function mockBackend(items: AnnouncementAdminOut[] = LIST) {
  server.use(
    http.get('*/api/v1/admin/announcements', () => HttpResponse.json(page(items))),
    http.get('*/api/v1/admin/roles', () => HttpResponse.json(ROLES)),
    http.get('*/api/v1/refs/regions', () => HttpResponse.json(REGIONS)),
  );
}

function renderPage(lang: UiLanguage = 'uz_latn') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const i18n = {
    lang,
    backendLang: lang,
    t: (key: string) => (DICTIONARIES[lang] as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <AnnouncementsPage />
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

test('a draft and a published announcement are told apart at a glance', async () => {
  mockBackend();
  renderPage();

  const draftRow = await screen.findByTestId(`announcement-row-${DRAFT}`);
  const publishedRow = screen.getByTestId(`announcement-row-${PUBLISHED}`);
  const archivedRow = screen.getByTestId(`announcement-row-${ARCHIVED}`);

  // The status itself, spelled out — not a colour a screenshot test would
  // catch and a reader would not.
  expect(within(draftRow).getByTestId('announcement-status')).toHaveTextContent('Qoralama');
  expect(within(publishedRow).getByTestId('announcement-status')).toHaveTextContent('Chop etilgan');
  expect(within(archivedRow).getByTestId('announcement-status')).toHaveTextContent('Arxivlangan');

  // …and the row itself carries the distinction, so the marker survives a
  // reader who is scanning the left edge rather than reading the column.
  expect(draftRow).toHaveAttribute('data-status', 'draft');
  expect(publishedRow).toHaveAttribute('data-status', 'published');

  // Titles, audience and dates are all on the row.
  expect(draftRow).toHaveTextContent('Qishki yem-xashak tartibi');
  expect(draftRow).toHaveTextContent('Ijrochi');
  expect(draftRow).toHaveTextContent('Toshkent viloyati');
  expect(draftRow).toHaveTextContent('01.10.2026');
  expect(publishedRow).toHaveTextContent('Barcha foydalanuvchilar');

  // Only a draft can still be published; an archived one offers neither.
  expect(within(draftRow).getByRole('button', { name: 'Chop etish' })).toBeInTheDocument();
  expect(within(publishedRow).queryByRole('button', { name: 'Chop etish' })).not.toBeInTheDocument();
  expect(within(archivedRow).queryByRole('button', { name: 'Arxivlash' })).not.toBeInTheDocument();
});

test('creating an announcement sends every language that was filled, and no empty one', async () => {
  mockBackend([]);
  let body: Record<string, unknown> | null = null;
  server.use(
    http.post('*/api/v1/admin/announcements', async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(announcement({ id: DRAFT }), { status: 201 });
    }),
  );

  const user = userEvent.setup();
  renderPage();

  await user.click(await screen.findByRole('button', { name: 'Yangi eʼlon' }));

  await user.type(screen.getByTestId('field-title-uz_latn'), 'Qishki tartib');
  await user.type(screen.getByTestId('field-body-uz_latn'), 'Qish davrida yem-xashak tayyorlash tartibi');
  await user.type(screen.getByTestId('field-title-ru'), 'Зимний порядок');
  await user.type(screen.getByTestId('field-body-ru'), 'Порядок заготовки кормов зимой');
  // `uz_cyrl`, `kaa` and `en` are offered and deliberately left blank.

  await user.click(screen.getByLabelText('Ijrochi'));
  await user.click(screen.getByLabelText('Toshkent viloyati'));

  await user.click(screen.getByRole('button', { name: 'Saqlash' }));

  await waitFor(() => expect(body).not.toBeNull());
  expect(body).toEqual({
    title: { uz_latn: 'Qishki tartib', ru: 'Зимний порядок' },
    body: { uz_latn: 'Qish davrida yem-xashak tayyorlash tartibi', ru: 'Порядок заготовки кормов зимой' },
    audience: { role_codes: ['executor'], region_ids: [TASHKENT] },
    publish_from: null,
    publish_to: null,
  });
});

test('a form with no Latin-script Uzbek title is refused before it reaches the backend', async () => {
  mockBackend([]);
  let posted = 0;
  server.use(
    http.post('*/api/v1/admin/announcements', () => {
      posted += 1;
      return HttpResponse.json(announcement({ id: DRAFT }), { status: 201 });
    }),
  );

  const user = userEvent.setup();
  renderPage();

  await user.click(await screen.findByRole('button', { name: 'Yangi eʼlon' }));
  await user.type(screen.getByTestId('field-title-ru'), 'Только по-русски');
  await user.click(screen.getByRole('button', { name: 'Saqlash' }));

  expect(await screen.findByTestId('form-error')).toBeInTheDocument();
  expect(posted).toBe(0);
});

test('publishing asks first, and names the audience it is about to reach', async () => {
  mockBackend();
  let published = 0;
  server.use(
    http.post('*/api/v1/admin/announcements/:id/publish', () => {
      published += 1;
      return HttpResponse.json(announcement({ id: DRAFT, status: 'published' }));
    }),
  );

  const user = userEvent.setup();
  renderPage();

  const draftRow = await screen.findByTestId(`announcement-row-${DRAFT}`);
  await user.click(within(draftRow).getByRole('button', { name: 'Chop etish' }));

  const audience = await screen.findByTestId('publish-audience');
  expect(audience).toHaveTextContent('Ijrochi');
  expect(audience).toHaveTextContent('Toshkent viloyati');
  // The roles it is NOT going to are not named — that is the whole point of
  // spelling the audience out.
  expect(audience).not.toHaveTextContent('Inspektor');
  expect(screen.getByTestId('publish-confirm')).toHaveTextContent('Qishki yem-xashak tartibi');

  // Dismissed: nothing reaches anybody.
  await user.click(screen.getByRole('button', { name: 'Bekor qilish' }));
  await waitFor(() => expect(screen.queryByTestId('publish-confirm')).not.toBeInTheDocument());
  expect(published).toBe(0);
});

test('an untargeted announcement is confirmed as going to everybody, and confirming publishes it', async () => {
  mockBackend([announcement({ id: DRAFT, status: 'draft', audience: {} })]);
  let published = 0;
  server.use(
    http.post('*/api/v1/admin/announcements/:id/publish', ({ params }) => {
      expect(params.id).toBe(DRAFT);
      published += 1;
      return HttpResponse.json(announcement({ id: DRAFT, status: 'published' }));
    }),
  );

  const user = userEvent.setup();
  renderPage();

  const row = await screen.findByTestId(`announcement-row-${DRAFT}`);
  await user.click(within(row).getByRole('button', { name: 'Chop etish' }));

  expect(await screen.findByTestId('publish-audience')).toHaveTextContent('Barcha foydalanuvchilar');

  await user.click(screen.getByRole('button', { name: 'Ha, chop etish' }));

  await waitFor(() => expect(published).toBe(1));
  await waitFor(() => expect(screen.queryByTestId('publish-confirm')).not.toBeInTheDocument());
});

test('a refused publish says so instead of closing as if it had worked', async () => {
  mockBackend();
  server.use(
    http.post('*/api/v1/admin/announcements/:id/publish', () =>
      HttpResponse.json(
        { error: { code: 'ERR-ANN-002', message: 'Announcement already published' } },
        { status: 409 },
      ),
    ),
  );

  const user = userEvent.setup();
  renderPage();

  const draftRow = await screen.findByTestId(`announcement-row-${DRAFT}`);
  await user.click(within(draftRow).getByRole('button', { name: 'Chop etish' }));
  await user.click(await screen.findByRole('button', { name: 'Ha, chop etish' }));

  const error = await screen.findByTestId('publish-error');
  // Localized copy for a code this map does not know yet falls back to the
  // server's own message (F4, `docs/plans/07.3-findings.md`) — never the raw
  // code, and never a blank.
  expect(error).toHaveTextContent('Announcement already published');
  expect(error).not.toHaveTextContent('ERR-ANN-002');
  // Still open — an operator has to see what happened and decide.
  expect(screen.getByTestId('publish-confirm')).toBeInTheDocument();
});

test('archiving is confirmed too, and only fires once agreed', async () => {
  mockBackend();
  let archived = 0;
  server.use(
    http.post('*/api/v1/admin/announcements/:id/archive', () => {
      archived += 1;
      return HttpResponse.json(announcement({ id: PUBLISHED, status: 'archived' }));
    }),
  );

  const user = userEvent.setup();
  renderPage();

  const row = await screen.findByTestId(`announcement-row-${PUBLISHED}`);
  await user.click(within(row).getByRole('button', { name: 'Arxivlash' }));
  expect(await screen.findByTestId('archive-confirm')).toBeInTheDocument();
  expect(archived).toBe(0);

  await user.click(screen.getByRole('button', { name: 'Ha, arxivlash' }));
  await waitFor(() => expect(archived).toBe(1));
});

test('editing loads the announcement itself and patches only what the form holds', async () => {
  mockBackend();
  let patched: Record<string, unknown> | null = null;
  server.use(
    http.get('*/api/v1/admin/announcements/:id', () =>
      HttpResponse.json(
        announcement({
          id: DRAFT,
          title: { uz_latn: 'Qishki yem-xashak tartibi', ru: 'Порядок зимнего выпаса' },
          body: { uz_latn: 'Eski matn' },
          audience: { role_codes: ['executor'], region_ids: [TASHKENT] },
        }),
      ),
    ),
    http.patch('*/api/v1/admin/announcements/:id', async ({ request }) => {
      patched = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(announcement({ id: DRAFT }));
    }),
  );

  const user = userEvent.setup();
  renderPage();

  const draftRow = await screen.findByTestId(`announcement-row-${DRAFT}`);
  await user.click(within(draftRow).getByRole('button', { name: 'Tahrirlash' }));

  const titleUz = await screen.findByTestId('field-title-uz_latn');
  await waitFor(() => expect(titleUz).toHaveValue('Qishki yem-xashak tartibi'));
  expect(screen.getByTestId('field-title-ru')).toHaveValue('Порядок зимнего выпаса');
  expect(screen.getByLabelText('Ijrochi')).toBeChecked();
  expect(screen.getByLabelText('Inspektor')).not.toBeChecked();

  await user.clear(screen.getByTestId('field-body-uz_latn'));
  await user.type(screen.getByTestId('field-body-uz_latn'), 'Yangilangan matn');
  await user.click(screen.getByRole('button', { name: 'Saqlash' }));

  await waitFor(() => expect(patched).not.toBeNull());
  expect(patched).toEqual({
    title: { uz_latn: 'Qishki yem-xashak tartibi', ru: 'Порядок зимнего выпаса' },
    body: { uz_latn: 'Yangilangan matn' },
    audience: { role_codes: ['executor'], region_ids: [TASHKENT] },
    publish_from: null,
    publish_to: null,
  });
  // `file_ids` is never sent: present-and-null would wipe the attachments.
  expect(patched).not.toHaveProperty('file_ids');
});

test('a list that fails to load says so rather than showing an empty register', async () => {
  server.use(
    http.get('*/api/v1/admin/announcements', () =>
      HttpResponse.json({ error: { code: 'ERR-SYS-000', message: 'boom' } }, { status: 500 }),
    ),
    http.get('*/api/v1/admin/roles', () => HttpResponse.json(ROLES)),
    http.get('*/api/v1/refs/regions', () => HttpResponse.json(REGIONS)),
  );

  renderPage();

  expect(await screen.findByTestId('announcements-error')).toHaveTextContent(
    'Kutilmagan xatolik yuz berdi. Qaytadan urining.',
  );
});

test('the screen speaks Russian when the shell does', async () => {
  mockBackend();
  renderPage('ru');

  const draftRow = await screen.findByTestId(`announcement-row-${DRAFT}`);
  expect(within(draftRow).getByTestId('announcement-status')).toHaveTextContent('Черновик');
  expect(draftRow).toHaveTextContent('Порядок зимнего выпаса');
  expect(draftRow).toHaveTextContent('Исполнитель');
  expect(screen.getByRole('button', { name: 'Новое объявление' })).toBeInTheDocument();
});

test.each(['uz_latn', 'uz_cyrl', 'ru', 'en', 'kaa'] as const)(
  'ensures 100%% 5-language localization in AnnouncementsPage for %s',
  async (lang) => {
    mockBackend();
    const L = LABELS[lang];
    const user = userEvent.setup();
    const { unmount } = renderPage(lang);

    // Page Title, Subtitle, Create button
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(L.pageTitle);
    expect(screen.getByText(L.pageSubtitle)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: L.create })).toBeInTheDocument();

    // Filter label
    expect(screen.getByLabelText(L.filterStatus)).toBeInTheDocument();

    // Table Column Headers
    expect(screen.getByRole('columnheader', { name: L.colTitle })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: L.colAudience })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: L.colStatus })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: L.colPeriod })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: L.colCreated })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: L.colActions })).toBeInTheDocument();

    // Status Badges on Rows (wait for data to load)
    const draftRow = await screen.findByTestId(`announcement-row-${DRAFT}`);
    const publishedRow = screen.getByTestId(`announcement-row-${PUBLISHED}`);
    const archivedRow = screen.getByTestId(`announcement-row-${ARCHIVED}`);
    expect(within(draftRow).getByTestId('announcement-status')).toHaveTextContent(L.statusDraft);
    expect(within(publishedRow).getByTestId('announcement-status')).toHaveTextContent(L.statusPublished);
    expect(within(archivedRow).getByTestId('announcement-status')).toHaveTextContent(L.statusArchived);

    // Row Action Buttons
    expect(within(draftRow).getByRole('button', { name: L.actionEdit })).toBeInTheDocument();
    expect(within(draftRow).getByRole('button', { name: L.actionPublish })).toBeInTheDocument();
    expect(within(draftRow).getByRole('button', { name: L.actionArchive })).toBeInTheDocument();

    // Modal localization
    await user.click(screen.getByRole('button', { name: L.create }));
    expect(await screen.findByRole('heading', { name: L.formCreateTitle })).toBeInTheDocument();
    expect(screen.getByText(L.formLanguagesHint)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: L.cancel })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: L.save })).toBeInTheDocument();

    // Close modal
    await user.click(screen.getByRole('button', { name: L.cancel }));
    unmount();

    // Verify empty state localization
    mockBackend([]);
    renderPage(lang);
    expect(await screen.findByText(L.empty)).toBeInTheDocument();
  },
);

