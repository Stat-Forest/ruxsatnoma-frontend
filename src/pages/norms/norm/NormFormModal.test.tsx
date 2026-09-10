/**
 * The write form's own client-side checks, mirroring
 * `tariffs/TariffFormModal.test.tsx`'s structure: identity fields
 * (`contour_id`/`activity_type_id`) render read-only in edit mode, and the
 * three shapes unique to a norm — `yield_c_per_ha`, `season` (a list of
 * MM-DD windows) and `rotation` (a list of rest years) — are validated and
 * converted before the request ever leaves the form.
 */
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { NormFormModal } from './NormFormModal';
import { I18nContext } from '../../../i18n/context';
import type { NormOut } from './api';

const ACTIVITY_TYPE_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const CONTOUR_ID = 'cccccccc-0000-4000-8000-000000000001';

const server = setupServer(
  http.get('*/api/v1/refs/activity-types', () =>
    HttpResponse.json([{ id: ACTIVITY_TYPE_ID, code: 'grazing', name: { ru: 'Выпас' }, quantity_unit: 'head', status: 'active' }]),
  ),
  http.get('*/api/v1/gis/contours', () =>
    HttpResponse.json({
      items: [{ id: CONTOUR_ID, number: '001-042', organization_id: 'o-1', area_ha: '12.5', occupied_ha: '0', s_available_ha: '12.5', occupancy_source: 'none' }],
      total: 1,
      page: 1,
      page_size: 100,
    }),
  ),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const ROW: NormOut = {
  id: 'bbbbbbbb-0000-4000-8000-000000000001',
  contour_id: CONTOUR_ID,
  activity_type_id: ACTIVITY_TYPE_ID,
  yield_c_per_ha: '12.5000',
    // Ruling #176 (stage 9): capacity for every activity but grazing.
  capacity: null,
  season: { windows: [{ from: '05-01', to: '09-30' }] },
  rotation: { rest_years: [2027] },
  max_sb: null,
  geobotanic_doc_id: null,
  approval_doc_id: null,
  effective_from: '2026-01-01',
  effective_to: null,
  status: 'draft',
  created_by: 'u-1',
  approved_by: null,
  published_at: null,
  created_at: '2026-01-01T00:00:00+05:00',
};

function renderModal(mode: 'create' | 'edit', row?: NormOut) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'ru' as const, backendLang: 'ru' as const, t: (key: string) => key, setLanguage: async () => {} };
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>{children}</I18nContext.Provider>
    </QueryClientProvider>
  );
  render(
    <NormFormModal mode={mode} row={row} contourNumber={row ? '001-042' : undefined} onClose={onClose} onSaved={onSaved} />,
    { wrapper },
  );
  return { onClose, onSaved };
}

test('create mode shows a contour search field and an activity-type select', async () => {
  renderModal('create');
  await screen.findByText('Выпас');
  expect(screen.getByTestId('norm-contour-search')).toBeInTheDocument();
  expect(screen.getByTestId('norm-activity-type')).toBeInTheDocument();
  expect(screen.queryByTestId('norm-contour-readonly')).not.toBeInTheDocument();
});

test('edit mode shows the identity fields read-only', () => {
  renderModal('edit', ROW);
  expect(screen.getByTestId('norm-contour-readonly')).toHaveTextContent('001-042');
  expect(screen.getByTestId('norm-activity-type-readonly')).toBeInTheDocument();
  expect(screen.queryByTestId('norm-contour-search')).not.toBeInTheDocument();
  expect(screen.queryByTestId('norm-activity-type')).not.toBeInTheDocument();
  // Prefilled from the row.
  expect(screen.getByTestId('norm-yield')).toHaveValue('12.5000');
  expect(screen.getByTestId('norm-season-from-0')).toHaveValue('05-01');
  expect(screen.getByTestId('norm-season-to-0')).toHaveValue('09-30');
  expect(screen.getByTestId('norm-rotation')).toHaveValue('2027');
});

test('an untouched create is refused locally on the required fields, without calling the API', async () => {
  const user = userEvent.setup();
  let called = false;
  server.use(http.post('*/api/v1/norms', () => {
    called = true;
    return HttpResponse.json(ROW, { status: 201 });
  }));
  const { onSaved } = renderModal('create');
  await screen.findByText('Выпас');

  await user.click(screen.getByText('norms.norms.form.save'));

  expect(screen.getByText('norms.norms.form.contourRequired')).toBeInTheDocument();
  expect(screen.getByText('norms.norms.form.activityTypeRequired')).toBeInTheDocument();
  expect(screen.getByText('norms.norms.form.effectiveFromRequired')).toBeInTheDocument();
  expect(called).toBe(false);
  expect(onSaved).not.toHaveBeenCalled();
});

test('a malformed season window (not MM-DD) blocks submit', async () => {
  const user = userEvent.setup();
  renderModal('create');
  await screen.findByText('Выпас');

  await user.click(screen.getByTestId('norm-contour-search'));
  fireEvent.change(screen.getByTestId('norm-contour-search'), { target: { value: '001-042' } });
  await user.click(await screen.findByTestId(`norm-contour-option-${CONTOUR_ID}`));
  await user.selectOptions(screen.getByTestId('norm-activity-type'), ACTIVITY_TYPE_ID);
  fireEvent.change(screen.getByTestId('norm-effective-from'), { target: { value: '2026-02-01' } });

  await user.click(screen.getByTestId('norm-season-add'));
  fireEvent.change(screen.getByTestId('norm-season-from-0'), { target: { value: '2026-05-01' } });
  fireEvent.change(screen.getByTestId('norm-season-to-0'), { target: { value: '09-30' } });
  await user.click(screen.getByText('norms.norms.form.save'));

  expect(screen.getByText('norms.norms.form.seasonInvalid')).toBeInTheDocument();
});

test('an invalid rotation token blocks submit', async () => {
  const user = userEvent.setup();
  renderModal('create');
  await screen.findByText('Выпас');

  fireEvent.change(screen.getByTestId('norm-contour-search'), { target: { value: '001-042' } });
  await user.click(await screen.findByTestId(`norm-contour-option-${CONTOUR_ID}`));
  await user.selectOptions(screen.getByTestId('norm-activity-type'), ACTIVITY_TYPE_ID);
  fireEvent.change(screen.getByTestId('norm-effective-from'), { target: { value: '2026-02-01' } });
  fireEvent.change(screen.getByTestId('norm-rotation'), { target: { value: '2027a' } });
  await user.click(screen.getByText('norms.norms.form.save'));

  expect(screen.getByText('norms.norms.form.rotationInvalid')).toBeInTheDocument();
});

test('a valid create submits contour_id/activity_type_id plus the converted season/rotation/yield', async () => {
  const user = userEvent.setup();
  let body: Record<string, unknown> | null = null;
  server.use(
    http.post('*/api/v1/norms', async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ ...ROW, ...body }, { status: 201 });
    }),
  );
  const { onSaved } = renderModal('create');
  await screen.findByText('Выпас');

  fireEvent.change(screen.getByTestId('norm-contour-search'), { target: { value: '001-042' } });
  await user.click(await screen.findByTestId(`norm-contour-option-${CONTOUR_ID}`));
  await user.selectOptions(screen.getByTestId('norm-activity-type'), ACTIVITY_TYPE_ID);
  fireEvent.change(screen.getByTestId('norm-yield'), { target: { value: '12.5' } });
  await user.click(screen.getByTestId('norm-season-add'));
  fireEvent.change(screen.getByTestId('norm-season-from-0'), { target: { value: '05-01' } });
  fireEvent.change(screen.getByTestId('norm-season-to-0'), { target: { value: '09-30' } });
  fireEvent.change(screen.getByTestId('norm-rotation'), { target: { value: '2027, 2029' } });
  fireEvent.change(screen.getByTestId('norm-effective-from'), { target: { value: '2026-02-01' } });
  await user.click(screen.getByText('norms.norms.form.save'));

  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(body).toMatchObject({
    contour_id: CONTOUR_ID,
    activity_type_id: ACTIVITY_TYPE_ID,
    yield_c_per_ha: '12.5',
    season: { windows: [{ from: '05-01', to: '09-30' }] },
    rotation: { rest_years: [2027, 2029] },
    effective_from: '2026-02-01',
    geobotanic_doc_id: null,
  });
});

test('editing sends a NormPatch with no contour_id/activity_type_id at all', async () => {
  const user = userEvent.setup();
  let body: Record<string, unknown> | null = null;
  server.use(
    http.patch('*/api/v1/norms/:id', async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ ...ROW, ...body });
    }),
  );
  const { onSaved } = renderModal('edit', ROW);

  await user.click(screen.getByText('norms.norms.form.save'));

  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(body).not.toBeNull();
  expect(body).not.toHaveProperty('contour_id');
  expect(body).not.toHaveProperty('activity_type_id');
  expect(body).toMatchObject({ yield_c_per_ha: '12.5000', effective_from: '2026-01-01' });
});

test('uploading a geobotanic document sets geobotanic_doc_id on the request', async () => {
  const user = userEvent.setup();
  server.use(
    http.post('*/api/v1/files', () =>
      HttpResponse.json({ id: 'file-1', filename: 'survey.pdf', content_type: 'application/pdf', size_bytes: 10, sha256: 'x', created_at: '2026-01-01T00:00:00+05:00' }, { status: 201 }),
    ),
  );
  let body: Record<string, unknown> | null = null;
  server.use(
    http.post('*/api/v1/norms', async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ ...ROW, ...body }, { status: 201 });
    }),
  );
  const { onSaved } = renderModal('create');
  await screen.findByText('Выпас');

  fireEvent.change(screen.getByTestId('norm-contour-search'), { target: { value: '001-042' } });
  await user.click(await screen.findByTestId(`norm-contour-option-${CONTOUR_ID}`));
  await user.selectOptions(screen.getByTestId('norm-activity-type'), ACTIVITY_TYPE_ID);
  fireEvent.change(screen.getByTestId('norm-effective-from'), { target: { value: '2026-02-01' } });

  const file = new File(['data'], 'survey.pdf', { type: 'application/pdf' });
  const input = screen.getByTestId('norm-geobotanic-doc-upload') as HTMLInputElement;
  await user.upload(input, file);
  await screen.findByTestId('norm-geobotanic-doc-link');

  await user.click(screen.getByText('norms.norms.form.save'));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(body).toMatchObject({ geobotanic_doc_id: 'file-1' });
});
