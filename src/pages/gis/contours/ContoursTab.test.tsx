import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthContext } from '../../../auth/AuthContext';
import type { AuthContextValue } from '../../../auth/AuthContext';
import { I18nContext } from '../../../i18n/context';
import { ContoursTab } from './ContoursTab';

const t = (key: string) => key;

// The map is MapLibre + Terra Draw — not renderable in jsdom, and not this
// track's own coverage to fake (house rule: "do not fake a canvas to claim
// map coverage you do not have"). The mock exposes exactly the one thing
// every test below needs to drive: a button that finishes a draw with a
// canned geometry matching whatever shape the caller currently wants
// (`geometryType`), the same way `ApplicationWizardPage.test.tsx` mocks out
// `ContourPicker`'s own map.
vi.mock('./DrawMap', () => ({
  DrawMap: (props: {
    geometryType: string;
    active: boolean;
    referenceGeometry?: { type: string } | null;
    selectedGeometry?: { type: string } | null;
    onDrawFinish: (g: unknown) => void;
  }) => (
    <div
      data-testid="draw-map-mock"
      data-active={String(props.active)}
      data-geometry-type={props.geometryType}
      data-reference-geometry-type={props.referenceGeometry?.type ?? ''}
      data-selected-geometry-type={props.selectedGeometry?.type ?? ''}
    >
      <button
        onClick={() =>
          props.onDrawFinish(
            props.geometryType === 'LineString'
              ? { type: 'LineString', coordinates: [[0.005, -1], [0.005, 1]] }
              : { type: 'Polygon', coordinates: [[[0, 0], [0.01, 0], [0.01, 0.01], [0, 0.01], [0, 0]]] },
          )
        }
      >
        finish-draw
      </button>
    </div>
  ),
}));

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());

// `listOrganizations()` (`../api.ts`) walks a two-level tree: roots first
// (no `parent_id`), then one call per root's own id — mirroring the real
// `/refs/organizations` contract, where `parent_id` is a STRICT filter, not
// "everything".
const ROOT_ORG = { id: 'org-0', code: 'agency', name: { uz_latn: 'Agentlik' }, kind: 'agency', parent_id: null };
const ORG = { id: 'org-1', code: 'burchmulla', name: { uz_latn: 'Burchmulla LX' }, kind: 'leshoz', parent_id: 'org-0' };

function referenceHandlers() {
  return [
    http.get('*/api/v1/refs/organizations', ({ request }) => {
      const url = new URL(request.url);
      const parentId = url.searchParams.get('parent_id');
      if (!parentId) return HttpResponse.json({ items: [ROOT_ORG], total: 1 });
      if (parentId === ROOT_ORG.id) return HttpResponse.json({ items: [ORG], total: 1 });
      return HttpResponse.json({ items: [], total: 0 });
    }),
    http.get('*/api/v1/gis/layers', () =>
      HttpResponse.json({
        items: [{ id: 'layer-contours', code: 'contours', name: { uz_latn: 'Konturlar' }, geometry_type: 'MULTIPOLYGON', is_public: true, style: {}, status: 'active' }],
      }),
    ),
  ];
}

function renderTab(permissions: string[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const me = {
    user: { id: 'u-1', full_name: 'Test', login: 'test', language: 'uz_latn' },
    role: { code: 'gis_specialist', name: {} },
    permissions,
    zone: {},
    csrf_token: 'tok',
    is_superuser: false,
    applicant: null,
    representations: [],
    registration_complete: true,
  };
  const authValue = { me, loading: false, authError: null } as unknown as AuthContextValue;
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t, setLanguage: async () => {} };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
      </I18nContext.Provider>
    </QueryClientProvider>
  );
  return render(<ContoursTab t={t} />, { wrapper });
}

test('the list resolves an organization id to its name and shows the available area', async () => {
  server.use(
    ...referenceHandlers(),
    http.get('*/api/v1/gis/contours', () =>
      HttpResponse.json({ items: [{ id: 'c-1', number: 'K-042', organization_id: 'org-1', area_ha: '10.0000', occupied_ha: '2.0000', s_available_ha: '8.0000', occupancy_source: 'none' }], total: 1 }),
    ),
  );
  renderTab(['gis.contours.manage']);

  const row = await screen.findByTestId('contour-row-c-1');
  expect(within(row).getByText('K-042')).toBeInTheDocument();
  await waitFor(() => expect(within(row).getByText('Burchmulla LX')).toBeInTheDocument());
  expect(within(row).getByText(/8,0000 ga/)).toBeInTheDocument();
});

test('"new contour" is offered only to a contours.manage holder', async () => {
  server.use(...referenceHandlers(), http.get('*/api/v1/gis/contours', () => HttpResponse.json({ items: [], total: 0 })));
  renderTab([]);
  await screen.findByText('gis.contours.empty');
  expect(screen.queryByRole('button', { name: 'gis.contours.newContour' })).not.toBeInTheDocument();
});

test('creating a contour, drawing its first version, and holding it through to a draft VersionPanel', async () => {
  server.use(
    ...referenceHandlers(),
    http.get('*/api/v1/gis/contours', () => HttpResponse.json({ items: [], total: 0 })),
    http.post('*/api/v1/gis/contours', async ({ request }) => {
      const body = (await request.json()) as { number: string; organization_id: string };
      return HttpResponse.json(
        { id: 'c-new', layer_id: 'layer-contours', organization_id: body.organization_id, parent_id: null, kind: 'contour', number: body.number, status: 'active' },
        { status: 201 },
      );
    }),
    http.get('*/api/v1/gis/contours/c-new', () => HttpResponse.json({ error: { code: 'ERR-SYS-003', message: 'not found' } }, { status: 404 })),
    http.post('*/api/v1/gis/contours/c-new/versions', async ({ request }) => {
      const body = (await request.json()) as { source: string };
      return HttpResponse.json(
        { id: 'v-new', contour_id: 'c-new', version_no: 1, status: 'draft', source: body.source, area_ha: '1.0000', declared_area_ha: null, accuracy_m: null, survey_date: null, effective_from: null, approval_doc_id: null, approved_by: null, published_at: null },
        { status: 201 },
      );
    }),
  );
  const ui = userEvent.setup();
  renderTab(['gis.contours.manage']);

  await ui.click(await screen.findByRole('button', { name: 'gis.contours.newContour' }));
  await ui.type(screen.getByPlaceholderText('K-001'), 'K-777');
  const orgSelect = await screen.findByRole('combobox');
  await waitFor(() => expect(within(orgSelect).getByText('Burchmulla LX')).toBeInTheDocument());
  await ui.selectOptions(orgSelect, 'org-1');
  await ui.click(screen.getByRole('button', { name: 'gis.contours.form.create' }));

  // The map is now armed to draw the new contour's first version.
  await waitFor(() => expect(screen.getByTestId('draw-map-mock')).toHaveAttribute('data-active', 'true'));
  await ui.click(screen.getByText('finish-draw'));

  // Drawing produced a shape — the version-fields form appears next.
  await ui.click(await screen.findByRole('button', { name: 'gis.contours.form.saveVersion' }));

  const panel = await screen.findByTestId('version-panel');
  expect(within(panel).getByTestId('version-status-badge')).toHaveTextContent('gis.versions.status.draft');

  // Back in browse mode with a held draft: its geometry now reaches the map
  // as the selection, not the edit reference (no editing is in progress).
  const map = screen.getByTestId('draw-map-mock');
  expect(map).toHaveAttribute('data-selected-geometry-type', 'Polygon');
  expect(map).toHaveAttribute('data-reference-geometry-type', '');

  // "Redraw" enters edit-draft mode — the SAME geometry now moves to the
  // edit reference, and the selection highlight (redundant with the draw
  // guide, and drawn over it) drops.
  await ui.click(screen.getByRole('button', { name: 'gis.contours.redraw' }));
  expect(map).toHaveAttribute('data-reference-geometry-type', 'Polygon');
  expect(map).toHaveAttribute('data-selected-geometry-type', '');
});

test('a published contour with no held draft shows its card and, for an approver, an archive action', async () => {
  server.use(
    ...referenceHandlers(),
    http.get('*/api/v1/gis/contours', () =>
      HttpResponse.json({ items: [{ id: 'c-pub', number: 'K-050', organization_id: 'org-1', area_ha: '5.0000', occupied_ha: '0.0000', s_available_ha: '5.0000', occupancy_source: 'none' }], total: 1 }),
    ),
    http.get('*/api/v1/gis/contours/c-pub', () =>
      HttpResponse.json({ id: 'c-pub', number: 'K-050', organization_id: 'org-1', kind: 'contour', version_id: 'v-pub', area_ha: '5.0000', geometry: { type: 'Polygon', coordinates: [] }, occupied_ha: '0.0000', s_available_ha: '5.0000', occupancy_source: 'none' }),
    ),
  );
  const ui = userEvent.setup();
  renderTab(['gis.contours.approve']);

  await ui.click(await screen.findByTestId('contour-row-c-pub'));
  await screen.findAllByText('K-050');
  // No held (unpublished) version in this browser and no manage right — the
  // "draw first version" prompt must not appear.
  expect(screen.queryByRole('button', { name: 'gis.contours.drawFirstVersion' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'gis.versions.actions.archive' })).toBeInTheDocument();
});

// F5 (`docs/plans/07.3-findings.md`): occupied > total (free area floored at
// 0) is a real state, not an arithmetic bug — the backend's own explicit
// `over_allocated` flag must be rendered, not silently dropped.
test('an over-allocated contour explains why the free area cannot be negative', async () => {
  server.use(
    ...referenceHandlers(),
    http.get('*/api/v1/gis/contours', () =>
      HttpResponse.json({
        items: [
          {
            id: 'c-over',
            number: 'K-070',
            organization_id: 'org-1',
            area_ha: '65.0694',
            occupied_ha: '130.1388',
            s_available_ha: '0',
            over_allocated: true,
            occupancy_source: 'permits',
          },
        ],
        total: 1,
      }),
    ),
    http.get('*/api/v1/gis/contours/c-over', () =>
      HttpResponse.json({
        id: 'c-over',
        number: 'K-070',
        organization_id: 'org-1',
        kind: 'contour',
        version_id: 'v-over',
        area_ha: '65.0694',
        geometry: { type: 'Polygon', coordinates: [] },
        occupied_ha: '130.1388',
        s_available_ha: '0',
        over_allocated: true,
        occupancy_source: 'permits',
      }),
    ),
  );
  const ui = userEvent.setup();
  renderTab([]);

  await ui.click(await screen.findByTestId('contour-row-c-over'));
  await screen.findByText('gis.contours.overAllocated');
});

test('a normal, not-over-allocated contour shows no over-allocation warning', async () => {
  server.use(
    ...referenceHandlers(),
    http.get('*/api/v1/gis/contours', () =>
      HttpResponse.json({ items: [{ id: 'c-pub', number: 'K-050', organization_id: 'org-1', area_ha: '5.0000', occupied_ha: '0.0000', s_available_ha: '5.0000', over_allocated: false, occupancy_source: 'none' }], total: 1 }),
    ),
    http.get('*/api/v1/gis/contours/c-pub', () =>
      HttpResponse.json({ id: 'c-pub', number: 'K-050', organization_id: 'org-1', kind: 'contour', version_id: 'v-pub', area_ha: '5.0000', geometry: { type: 'Polygon', coordinates: [] }, occupied_ha: '0.0000', s_available_ha: '5.0000', over_allocated: false, occupancy_source: 'none' }),
    ),
  );
  const ui = userEvent.setup();
  renderTab([]);

  await ui.click(await screen.findByTestId('contour-row-c-pub'));
  await screen.findAllByText('K-050');
  expect(screen.queryByText('gis.contours.overAllocated')).not.toBeInTheDocument();
});

test('selecting a published contour in browse mode hands its geometry to the map as the selection, not the edit reference — and clearing it drops both', async () => {
  server.use(
    ...referenceHandlers(),
    http.get('*/api/v1/gis/contours', () =>
      HttpResponse.json({ items: [{ id: 'c-pub', number: 'K-050', organization_id: 'org-1', area_ha: '5.0000', occupied_ha: '0.0000', s_available_ha: '5.0000', occupancy_source: 'none' }], total: 1 }),
    ),
    http.get('*/api/v1/gis/contours/c-pub', () =>
      HttpResponse.json({
        id: 'c-pub',
        number: 'K-050',
        organization_id: 'org-1',
        kind: 'contour',
        version_id: 'v-pub',
        area_ha: '5.0000',
        geometry: { type: 'Polygon', coordinates: [[[69.1, 41.2], [69.2, 41.2], [69.2, 41.3], [69.1, 41.2]]] },
        occupied_ha: '0.0000',
        s_available_ha: '5.0000',
        occupancy_source: 'none',
      }),
    ),
  );
  const ui = userEvent.setup();
  renderTab(['gis.contours.manage', 'gis.contours.approve']);

  // Nothing selected yet — the map holds neither a selection nor a reference.
  const map = await screen.findByTestId('draw-map-mock');
  expect(map).toHaveAttribute('data-selected-geometry-type', '');
  expect(map).toHaveAttribute('data-reference-geometry-type', '');

  await ui.click(await screen.findByTestId('contour-row-c-pub'));
  await screen.findAllByText('K-050');

  // Browse mode (the default after picking a row): the geometry reaches the
  // map as the selection highlight, never as the edit/split reference.
  await waitFor(() => expect(map).toHaveAttribute('data-selected-geometry-type', 'Polygon'));
  expect(map).toHaveAttribute('data-reference-geometry-type', '');

  // "New contour" clears `selectedContourId` — the highlight must not linger.
  await ui.click(await screen.findByRole('button', { name: 'gis.contours.newContour' }));
  expect(map).toHaveAttribute('data-selected-geometry-type', '');
});

test('a contour with neither a published card nor a held draft offers "draw first version" to a specialist', async () => {
  server.use(
    ...referenceHandlers(),
    http.get('*/api/v1/gis/contours', () =>
      HttpResponse.json({ items: [{ id: 'c-empty', number: 'K-060', organization_id: 'org-1', area_ha: '3.0000', occupied_ha: '0.0000', s_available_ha: '3.0000', occupancy_source: 'none' }], total: 1 }),
    ),
    http.get('*/api/v1/gis/contours/c-empty', () => HttpResponse.json({ error: { code: 'ERR-SYS-003', message: 'not found' } }, { status: 404 })),
  );
  const ui = userEvent.setup();
  renderTab(['gis.contours.manage']);

  await ui.click(await screen.findByTestId('contour-row-c-empty'));
  expect(await screen.findByRole('button', { name: 'gis.contours.drawFirstVersion' })).toBeInTheDocument();
});
