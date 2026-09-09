import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { I18nContext, type UiLanguage } from '../../../i18n/context';
import { UsersPage } from './UsersPage';
import { uz_latn as L, LABELS, labelsFor } from './labels';
import {
  DISTRICT_BOSTANLIQ,
  ORG_BURCHMULLA,
  REGION_TASHKENT,
  USER_KARIMOV,
  page,
  referenceHandlers,
  user as makeUser,
} from './fixtures';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderUsers(lang: UiLanguage = 'uz_latn') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const i18n = { lang, backendLang: lang, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <UsersPage />
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

/** Opens the card of the single fixture user and returns its scope. */
async function openCard(ui: ReturnType<typeof userEvent.setup>) {
  await screen.findByText('Karimov Alisher Baxtiyorovich');
  await ui.click(screen.getByRole('button', { name: L.openCard }));
  return within(await screen.findByTestId('user-card'));
}

test('the list resolves role and organization to names rather than ids', async () => {
  server.use(...referenceHandlers());
  renderUsers();

  const row = (await screen.findByText('Karimov Alisher Baxtiyorovich')).closest('tr')!;
  expect(within(row).getByText('a.karimov')).toBeInTheDocument();
  expect(within(row).getByText('Inspektor')).toBeInTheDocument();
  expect(within(row).getByText('Burchmulla oʻrmon xoʻjaligi')).toBeInTheDocument();
  expect(within(row).getByText(L.statusActive)).toBeInTheDocument();
  // The raw uuids must never reach the screen.
  expect(screen.queryByText(ORG_BURCHMULLA)).toBeNull();
  expect(screen.queryByText('inspector')).toBeNull();
});

test('the counters come from the stats route', async () => {
  server.use(...referenceHandlers());
  renderUsers();

  // `findByTestId` waits for the ELEMENT, and the tile is on screen from the
  // first render carrying a placeholder — so the wait has to be on the content.
  await waitFor(() => expect(screen.getByTestId('stat-total')).toHaveTextContent('34'));
  expect(screen.getByTestId('stat-active')).toHaveTextContent('30');
  expect(screen.getByTestId('stat-blocked')).toHaveTextContent('3');
  expect(screen.getByTestId('stat-sessions')).toHaveTextContent('7');
});

test('the search box is sent as the single q parameter', async () => {
  const urls: string[] = [];
  server.use(
    // Before `referenceHandlers()`, not after: MSW takes the FIRST matching
    // handler, so an override placed last never runs.
    http.get('*/api/v1/admin/users', ({ request }) => {
      urls.push(request.url);
      return HttpResponse.json(page([makeUser()]));
    }),
    ...referenceHandlers(),
  );
  const ui = userEvent.setup();
  renderUsers();

  await screen.findByText('Karimov Alisher Baxtiyorovich');
  await ui.type(screen.getByLabelText(L.filterQuery), '31234567890123');
  await ui.click(screen.getByRole('button', { name: L.apply }));

  await waitFor(() => {
    const last = new URL(urls[urls.length - 1]);
    expect(last.searchParams.get('q')).toBe('31234567890123');
  });
});

test('the role picker does not offer applicant', async () => {
  server.use(...referenceHandlers());
  const ui = userEvent.setup();
  renderUsers();

  await screen.findByText('Karimov Alisher Baxtiyorovich');
  await ui.click(screen.getByRole('button', { name: L.create }));

  const form = within(await screen.findByTestId('user-form'));
  const roleSelect = form.getByLabelText(L.formRole);
  expect(within(roleSelect).getByRole('option', { name: 'Inspektor' })).toBeInTheDocument();
  expect(within(roleSelect).queryByRole('option', { name: 'Fuqaro' })).toBeNull();
  expect(form.getByText(L.formRoleHint)).toBeInTheDocument();
});

test('creating sends the zone fields exactly as chosen', async () => {
  let body: Record<string, unknown> | null = null;
  server.use(
    ...referenceHandlers(),
    http.post('*/api/v1/admin/users', async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(
        { user: makeUser(), one_time_password: 'Xy7-p9Qm-2Rt', totp_uri: 'otpauth://totp/demo' },
        { status: 201 },
      );
    }),
  );
  const ui = userEvent.setup();
  renderUsers();

  await screen.findByText('Karimov Alisher Baxtiyorovich');
  await ui.click(screen.getByRole('button', { name: L.create }));
  const form = within(await screen.findByTestId('user-form'));

  await ui.type(form.getByLabelText(L.formLogin), 'n.sobirov');
  await ui.type(form.getByLabelText(L.formFullName), 'Sobirov Nodir');
  await ui.selectOptions(form.getByLabelText(L.formRole), 'inspector');
  await ui.type(form.getByLabelText(L.formPosition), 'Inspektor');
  await ui.selectOptions(form.getByLabelText(L.zoneOrganization), ORG_BURCHMULLA);
  await ui.selectOptions(form.getByLabelText(L.zoneRegion), REGION_TASHKENT);
  await ui.selectOptions(await form.findByLabelText(L.zoneDistrict), DISTRICT_BOSTANLIQ);
  await ui.click(form.getByRole('button', { name: L.save }));

  await waitFor(() => expect(body).not.toBeNull());
  expect(body).toEqual({
    login: 'n.sobirov',
    full_name: 'Sobirov Nodir',
    role_code: 'inspector',
    position: 'Inspektor',
    organization_id: ORG_BURCHMULLA,
    region_id: REGION_TASHKENT,
    district_id: DISTRICT_BOSTANLIQ,
  });
});

test('the zone warning is next to the zone fields', async () => {
  server.use(...referenceHandlers());
  const ui = userEvent.setup();
  renderUsers();

  await screen.findByText('Karimov Alisher Baxtiyorovich');
  await ui.click(screen.getByRole('button', { name: L.create }));
  const zone = within(await screen.findByTestId('zone-fields'));
  expect(zone.getByText(L.zoneWarning)).toBeInTheDocument();
});

test('the one-time secret panel appears after create and closes only on the acknowledgement', async () => {
  server.use(
    ...referenceHandlers(),
    http.post('*/api/v1/admin/users', () =>
      HttpResponse.json(
        { user: makeUser(), one_time_password: 'Xy7-p9Qm-2Rt', totp_uri: 'otpauth://totp/Ruxsatnoma:n.sobirov?secret=ABC' },
        { status: 201 },
      ),
    ),
  );
  const ui = userEvent.setup();
  renderUsers();

  await screen.findByText('Karimov Alisher Baxtiyorovich');
  await ui.click(screen.getByRole('button', { name: L.create }));
  const form = within(await screen.findByTestId('user-form'));
  await ui.type(form.getByLabelText(L.formLogin), 'n.sobirov');
  await ui.type(form.getByLabelText(L.formFullName), 'Sobirov Nodir');
  await ui.selectOptions(form.getByLabelText(L.formRole), 'inspector');
  await ui.click(form.getByRole('button', { name: L.save }));

  const panel = within(await screen.findByTestId('secret-panel'));
  expect(panel.getByText('Xy7-p9Qm-2Rt')).toBeInTheDocument();
  expect(panel.getByText('otpauth://totp/Ruxsatnoma:n.sobirov?secret=ABC')).toBeInTheDocument();
  expect(panel.getByText(L.secretTitle)).toBeInTheDocument();
  // No escape hatch: no close button, and Escape does not dismiss it either.
  expect(panel.queryByRole('button', { name: L.close })).toBeNull();
  await ui.keyboard('{Escape}');
  expect(screen.getByTestId('secret-panel')).toBeInTheDocument();

  await ui.click(panel.getByRole('button', { name: L.secretAck }));
  await waitFor(() => expect(screen.queryByTestId('secret-panel')).toBeNull());
});

test('blocking without a reason does not fire the request', async () => {
  const bodies: unknown[] = [];
  server.use(
    ...referenceHandlers(),
    http.post('*/api/v1/admin/users/:userId/block', async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json(makeUser({ status: 'blocked' }));
    }),
  );
  const ui = userEvent.setup();
  renderUsers();

  const card = await openCard(ui);
  await ui.click(card.getByRole('button', { name: L.actionBlock }));
  const dialog = within(await screen.findByTestId('block-dialog'));

  await ui.click(dialog.getByRole('button', { name: L.blockConfirm }));
  expect(await dialog.findByText(L.blockReasonRequired)).toBeInTheDocument();
  expect(bodies).toHaveLength(0);

  await ui.type(dialog.getByLabelText(L.blockReason), 'Xizmat vazifasidan chetlashtirildi');
  await ui.click(dialog.getByRole('button', { name: L.blockConfirm }));
  await waitFor(() => expect(bodies).toHaveLength(1));
  expect(bodies[0]).toEqual({ reason: 'Xizmat vazifasidan chetlashtirildi' });
});

test('editing sends only the fields that actually changed', async () => {
  let body: Record<string, unknown> | null = null;
  let patchedId: string | null = null;
  server.use(
    ...referenceHandlers(),
    http.patch('*/api/v1/admin/users/:userId', async ({ request, params }) => {
      patchedId = params.userId as string;
      body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(makeUser({ position: 'Yetakchi mutaxassis' }));
    }),
  );
  const ui = userEvent.setup();
  renderUsers();

  const card = await openCard(ui);
  await ui.click(card.getByRole('button', { name: L.actionEdit }));
  const form = within(await screen.findByTestId('user-form'));

  const position = form.getByLabelText(L.formPosition);
  await ui.clear(position);
  await ui.type(position, 'Yetakchi mutaxassis');
  await ui.click(form.getByRole('button', { name: L.save }));

  await waitFor(() => expect(body).not.toBeNull());
  expect(patchedId).toBe(USER_KARIMOV);
  expect(body).toEqual({ position: 'Yetakchi mutaxassis' });
});

test('an empty zone field is cleared explicitly, not silently kept', async () => {
  let body: Record<string, unknown> | null = null;
  server.use(
    ...referenceHandlers(),
    http.patch('*/api/v1/admin/users/:userId', async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(makeUser({ organization_id: null }));
    }),
  );
  const ui = userEvent.setup();
  renderUsers();

  const card = await openCard(ui);
  await ui.click(card.getByRole('button', { name: L.actionEdit }));
  const form = within(await screen.findByTestId('user-form'));

  await ui.selectOptions(form.getByLabelText(L.zoneOrganization), '');
  await ui.click(form.getByRole('button', { name: L.save }));

  await waitFor(() => expect(body).not.toBeNull());
  expect(body).toEqual({ organization_id: null });
});

test('all 5 language dictionaries have complete key parity and non-empty strings', () => {
  const baseKeys = Object.keys(LABELS.uz_latn).sort();
  const languages: UiLanguage[] = ['uz_latn', 'uz_cyrl', 'ru', 'en', 'kaa'];

  for (const lang of languages) {
    const dict = LABELS[lang];
    expect(dict).toBeDefined();
    const dictKeys = Object.keys(dict).sort();
    expect(dictKeys).toEqual(baseKeys);
    for (const key of baseKeys) {
      expect(dict[key as keyof typeof dict]).toBeTruthy();
      expect(typeof dict[key as keyof typeof dict]).toBe('string');
    }
  }
});

test('the users page and create modal render correctly in English', async () => {
  server.use(...referenceHandlers());
  const ui = userEvent.setup();
  const enLabels = labelsFor('en');
  renderUsers('en');

  // Header & stats
  expect(await screen.findByRole('heading', { name: enLabels.pageTitle })).toBeInTheDocument();
  expect(screen.getByText(enLabels.pageSubtitle)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: enLabels.create })).toBeInTheDocument();
  expect(screen.getByText(enLabels.statTotal)).toBeInTheDocument();
  expect(within(screen.getByTestId('stat-active')).getByText(enLabels.statActive)).toBeInTheDocument();

  // Filters
  expect(screen.getByLabelText(enLabels.filterQuery)).toBeInTheDocument();
  expect(screen.getByLabelText(enLabels.filterRole)).toBeInTheDocument();
  expect(screen.getByLabelText(enLabels.filterStatus)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: enLabels.apply })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: enLabels.reset })).toBeInTheDocument();

  // Wait for table to load
  const row = (await screen.findByText('Karimov Alisher Baxtiyorovich')).closest('tr')!;
  expect(within(row).getByText(enLabels.statusActive)).toBeInTheDocument();

  // Table columns
  expect(screen.getByRole('columnheader', { name: enLabels.colFullName })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: enLabels.colRole })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: enLabels.colOrganization })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: enLabels.colActions })).toBeInTheDocument();

  // Open create modal
  await ui.click(screen.getByRole('button', { name: enLabels.create }));
  const form = within(await screen.findByTestId('user-form'));
  expect(screen.getByRole('heading', { name: enLabels.createTitle })).toBeInTheDocument();
  expect(screen.getByText(enLabels.createSubtitle)).toBeInTheDocument();
  expect(form.getByLabelText(enLabels.formLogin)).toBeInTheDocument();
  expect(form.getByLabelText(enLabels.formFullName)).toBeInTheDocument();
  expect(form.getByLabelText(enLabels.formRole)).toBeInTheDocument();
  expect(form.getByText(enLabels.zoneTitle)).toBeInTheDocument();
  expect(form.getByText(enLabels.zoneWarning)).toBeInTheDocument();
  expect(form.getByRole('button', { name: enLabels.save })).toBeInTheDocument();
  expect(form.getByRole('button', { name: enLabels.cancel })).toBeInTheDocument();
});

test('the users page and create modal render correctly in Karakalpak', async () => {
  server.use(...referenceHandlers());
  const ui = userEvent.setup();
  const kaaLabels = labelsFor('kaa');
  renderUsers('kaa');

  expect(await screen.findByRole('heading', { name: kaaLabels.pageTitle })).toBeInTheDocument();
  expect(screen.getByText(kaaLabels.pageSubtitle)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: kaaLabels.create })).toBeInTheDocument();
  expect(screen.getByText(kaaLabels.statTotal)).toBeInTheDocument();

  // Wait for table to load
  await screen.findByText('Karimov Alisher Baxtiyorovich');
  expect(screen.getByText(kaaLabels.colActions)).toBeInTheDocument();

  // Open create modal
  await ui.click(screen.getByRole('button', { name: kaaLabels.create }));
  const form = within(await screen.findByTestId('user-form'));
  expect(screen.getByRole('heading', { name: kaaLabels.createTitle })).toBeInTheDocument();
  expect(screen.getByText(kaaLabels.createSubtitle)).toBeInTheDocument();
  expect(form.getByRole('button', { name: kaaLabels.save })).toBeInTheDocument();
  expect(form.getByRole('button', { name: kaaLabels.cancel })).toBeInTheDocument();
});

test('the users page and create modal render correctly in Uzbek Cyrillic', async () => {
  server.use(...referenceHandlers());
  const ui = userEvent.setup();
  const cyrlLabels = labelsFor('uz_cyrl');
  renderUsers('uz_cyrl');

  expect(await screen.findByRole('heading', { name: cyrlLabels.pageTitle })).toBeInTheDocument();
  expect(screen.getByText(cyrlLabels.pageSubtitle)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: cyrlLabels.create })).toBeInTheDocument();
  expect(screen.getByText(cyrlLabels.statTotal)).toBeInTheDocument();

  // Wait for table to load
  await screen.findByText('Karimov Alisher Baxtiyorovich');
  expect(screen.getByText(cyrlLabels.colActions)).toBeInTheDocument();

  // Open create modal
  await ui.click(screen.getByRole('button', { name: cyrlLabels.create }));
  const form = within(await screen.findByTestId('user-form'));
  expect(screen.getByRole('heading', { name: cyrlLabels.createTitle })).toBeInTheDocument();
  expect(screen.getByText(cyrlLabels.createSubtitle)).toBeInTheDocument();
  expect(form.getByRole('button', { name: cyrlLabels.save })).toBeInTheDocument();
  expect(form.getByRole('button', { name: cyrlLabels.cancel })).toBeInTheDocument();
});
