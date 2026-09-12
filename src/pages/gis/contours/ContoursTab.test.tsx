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
    browsableFeatures?: { features: { properties: { contour_id: string } }[] };
    onViewportChange?: (bbox: string | null) => void;
    onPickContour?: (contourId: string) => void;
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
      {/* Stands in for a pan/zoom settling on a viewport: the real map reports
          its bbox from `moveend`, and only then does the tab fetch the
          browsable layer. */}
      <button onClick={() => props.onViewportChange?.('69.0,41.0,70.0,42.0')}>settle-viewport</button>
      {/* One button per parcel the tab handed the map — clicking it is what a
          click on that polygon does in the real component. */}
      {props.browsableFeatures?.features.map((f) => (
        <button key={f.properties.contour_id} onClick={() => props.onPickContour?.(f.properties.contour_id)}>
          map-pick-{f.properties.contour_id}
        </button>
      ))}
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
  const orgSelect = await screen.findByRole('combobox', { name: /gis.contours.form.organization/ });
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

// T12 (decision #178) — a leshoz with no delivered GIS layer files and
// edits its contours by requisites alone: the map surfaces are absent, not
// broken, and a version needs only `declared_area_ha` since there is no
// `geom` for PostGIS to compute `area_ha` from.
const ORG_NO_GIS = {
  id: 'org-2',
  code: 'xorazm',
  name: { uz_latn: 'Xorazm LX' },
  kind: 'leshoz',
  parent_id: 'org-0',
  gis_enabled: false,
};

function referenceHandlersWithNoGisOrg() {
  return [
    http.get('*/api/v1/refs/organizations', ({ request }) => {
      const url = new URL(request.url);
      const parentId = url.searchParams.get('parent_id');
      if (!parentId) return HttpResponse.json({ items: [ROOT_ORG], total: 1 });
      if (parentId === ROOT_ORG.id) return HttpResponse.json({ items: [ORG_NO_GIS], total: 1 });
      return HttpResponse.json({ items: [], total: 0 });
    }),
    http.get('*/api/v1/gis/layers', () =>
      HttpResponse.json({
        items: [{ id: 'layer-contours', code: 'contours', name: { uz_latn: 'Konturlar' }, geometry_type: 'MULTIPOLYGON', is_public: true, style: {}, status: 'active' }],
      }),
    ),
  ];
}

test('creating a contour for a leshoz with no GIS layer skips the map and saves a version by declared area alone', async () => {
  let versionBody: Record<string, unknown> | null = null;
  server.use(
    ...referenceHandlersWithNoGisOrg(),
    http.get('*/api/v1/gis/contours', () => HttpResponse.json({ items: [], total: 0 })),
    http.post('*/api/v1/gis/contours', async ({ request }) => {
      const body = (await request.json()) as { number: string; organization_id: string };
      return HttpResponse.json(
        { id: 'c-nogis', layer_id: 'layer-contours', organization_id: body.organization_id, parent_id: null, kind: 'contour', number: body.number, status: 'active' },
        { status: 201 },
      );
    }),
    http.get('*/api/v1/gis/contours/c-nogis', () => HttpResponse.json({ error: { code: 'ERR-SYS-003', message: 'not found' } }, { status: 404 })),
    http.post('*/api/v1/gis/contours/c-nogis/versions', async ({ request }) => {
      versionBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(
        {
          id: 'v-nogis',
          contour_id: 'c-nogis',
          version_no: 1,
          status: 'draft',
          source: versionBody.source,
          area_ha: String(versionBody.declared_area_ha),
          declared_area_ha: versionBody.declared_area_ha,
          accuracy_m: null,
          survey_date: null,
          effective_from: null,
          approval_doc_id: null,
          approved_by: null,
          published_at: null,
        },
        { status: 201 },
      );
    }),
  );
  const ui = userEvent.setup();
  renderTab(['gis.contours.manage']);

  await ui.click(await screen.findByRole('button', { name: 'gis.contours.newContour' }));
  await ui.type(screen.getByPlaceholderText('K-001'), 'K-900');
  const orgSelect = await screen.findByRole('combobox', { name: /gis.contours.form.organization/ });
  await waitFor(() => expect(within(orgSelect).getByText('Xorazm LX')).toBeInTheDocument());
  await ui.selectOptions(orgSelect, 'org-2');
  await ui.click(screen.getByRole('button', { name: 'gis.contours.form.create' }));

  // No map surface at all — the requisites notice takes its place, and the
  // version-fields form appears right away, with no shape to draw first.
  await screen.findByTestId('no-gis-notice');
  expect(screen.queryByTestId('draw-map-mock')).not.toBeInTheDocument();
  const saveButton = await screen.findByRole('button', { name: 'gis.contours.form.saveVersion' });

  // Declared area is the only area of record here — Save stays disabled
  // until it is filled (the DB's own `geom_or_declared_area` CHECK, caught
  // here instead of round-tripped as a 422).
  expect(saveButton).toBeDisabled();
  await ui.type(screen.getByTestId('version-declared-area-input'), '3.5');
  expect(saveButton).not.toBeDisabled();
  await ui.click(saveButton);

  const panel = await screen.findByTestId('version-panel');
  expect(within(panel).getByTestId('version-status-badge')).toHaveTextContent('gis.versions.status.draft');
  expect(versionBody).not.toBeNull();
  expect(versionBody).not.toHaveProperty('geom');
  expect((versionBody as unknown as { declared_area_ha: string }).declared_area_ha).toBe('3.5');
});

test('a leshoz WITH a GIS layer still draws on the map, unaffected by the switch', async () => {
  server.use(
    ...referenceHandlers(),
    http.get('*/api/v1/gis/contours', () => HttpResponse.json({ items: [], total: 0 })),
    http.post('*/api/v1/gis/contours', async ({ request }) => {
      const body = (await request.json()) as { number: string; organization_id: string };
      return HttpResponse.json(
        { id: 'c-gis', layer_id: 'layer-contours', organization_id: body.organization_id, parent_id: null, kind: 'contour', number: body.number, status: 'active' },
        { status: 201 },
      );
    }),
    http.get('*/api/v1/gis/contours/c-gis', () => HttpResponse.json({ error: { code: 'ERR-SYS-003', message: 'not found' } }, { status: 404 })),
  );
  const ui = userEvent.setup();
  renderTab(['gis.contours.manage']);

  await ui.click(await screen.findByRole('button', { name: 'gis.contours.newContour' }));
  await ui.type(screen.getByPlaceholderText('K-001'), 'K-901');
  const orgSelect = await screen.findByRole('combobox', { name: /gis.contours.form.organization/ });
  await waitFor(() => expect(within(orgSelect).getByText('Burchmulla LX')).toBeInTheDocument());
  await ui.selectOptions(orgSelect, 'org-1');
  await ui.click(screen.getByRole('button', { name: 'gis.contours.form.create' }));

  expect(screen.queryByTestId('no-gis-notice')).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId('draw-map-mock')).toHaveAttribute('data-active', 'true'));
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

const CONTOUR_ROW = { id: 'c-1', number: 'K-042', organization_id: 'org-1', area_ha: '10.0000', occupied_ha: '2.0000', s_available_ha: '8.0000', occupancy_source: 'none' };
const CONTOUR_CARD = { ...CONTOUR_ROW, version_id: 'v-1', geometry: { type: 'Polygon', coordinates: [[[69.1, 41.1], [69.2, 41.1], [69.2, 41.2], [69.1, 41.1]]] }, over_allocated: false };
const CONTOUR_FEATURE = { type: 'Feature', id: 'v-1', geometry: CONTOUR_CARD.geometry, properties: { contour_id: 'c-1', number: 'K-042', organization_id: 'org-1', area_ha: '10.0000' } };

test('clicking a parcel on the map selects it like its list row does, and a second click clears it', async () => {
  server.use(
    ...referenceHandlers(),
    http.get('*/api/v1/gis/contours', () => HttpResponse.json({ items: [CONTOUR_ROW], total: 1 })),
    http.get('*/api/v1/gis/contours/features', () =>
      HttpResponse.json({ type: 'FeatureCollection', features: [CONTOUR_FEATURE], truncated: false }),
    ),
    http.get('*/api/v1/gis/contours/c-1', () => HttpResponse.json(CONTOUR_CARD)),
  );
  const ui = userEvent.setup();
  renderTab(['gis.contours.manage']);

  await screen.findByTestId('contour-row-c-1');
  await ui.click(screen.getByText('settle-viewport'));
  await ui.click(await screen.findByText('map-pick-c-1'));

  // Same outcome as clicking the row: the card loads and the row highlights.
  expect(await screen.findByText('gis.versions.status.published')).toBeInTheDocument();
  expect(screen.getByTestId('contour-row-c-1').className).toContain('bg-[#F0F7F1]');
  expect(screen.getByTestId('draw-map-mock')).toHaveAttribute('data-selected-geometry-type', 'Polygon');

  await ui.click(screen.getByText('map-pick-c-1'));
  await waitFor(() => expect(screen.queryByText('gis.versions.status.published')).not.toBeInTheDocument());
  expect(screen.getByTestId('contour-row-c-1').className).not.toContain('bg-[#F0F7F1]');
  expect(screen.getByTestId('draw-map-mock')).toHaveAttribute('data-selected-geometry-type', '');
});

test('the organization filter narrows the list and the map\'s parcels together', async () => {
  const listUrls: string[] = [];
  const featureUrls: string[] = [];
  server.use(
    ...referenceHandlers(),
    http.get('*/api/v1/gis/contours', ({ request }) => {
      listUrls.push(request.url);
      return HttpResponse.json({ items: [CONTOUR_ROW], total: 1 });
    }),
    http.get('*/api/v1/gis/contours/features', ({ request }) => {
      featureUrls.push(request.url);
      return HttpResponse.json({ type: 'FeatureCollection', features: [CONTOUR_FEATURE], truncated: false });
    }),
  );
  const ui = userEvent.setup();
  renderTab(['gis.contours.manage']);

  await screen.findByTestId('contour-row-c-1');
  await ui.click(screen.getByText('settle-viewport'));
  await screen.findByText('map-pick-c-1');
  expect(new URL(listUrls[0]).searchParams.get('organization_id')).toBeNull();
  expect(new URL(featureUrls[0]).searchParams.get('organization_id')).toBeNull();

  const filter = await screen.findByRole('combobox', { name: 'gis.contours.filterOrganization' });
  await waitFor(() => expect(within(filter).getByText('Burchmulla LX')).toBeInTheDocument());
  await ui.selectOptions(filter, 'org-1');

  await waitFor(() => expect(listUrls.length).toBe(2));
  await waitFor(() => expect(featureUrls.length).toBe(2));
  const listQuery = new URL(listUrls[1]).searchParams;
  expect(listQuery.get('organization_id')).toBe('org-1');
  expect(listQuery.get('page')).toBe('1');
  expect(new URL(featureUrls[1]).searchParams.get('organization_id')).toBe('org-1');
});

test('the Excel button asks the server for the export with the applied organization filter, never paging the list itself', async () => {
  let listCalls = 0;
  let exportUrl: URL | null = null;
  let exportCalls = 0;
  server.use(
    ...referenceHandlers(),
    http.get('*/api/v1/gis/contours', () => {
      listCalls += 1;
      return HttpResponse.json({ items: [], total: 0 });
    }),
    http.get('*/api/v1/gis/contours/export.xlsx', ({ request }) => {
      exportCalls += 1;
      exportUrl = new URL(request.url);
      return HttpResponse.text('xlsx-bytes', {
        headers: {
          'Content-Disposition': 'attachment; filename="konturlar-2026-09-11.xlsx"',
          'X-Export-Total': '0',
          'X-Export-Rows': '0',
          'X-Export-Truncated': 'false',
        },
      });
    }),
  );

  const createObjectURL = vi.fn().mockReturnValue('blob:mock');
  const revokeObjectURL = vi.fn();
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  const ui = userEvent.setup();
  renderTab(['gis.contours.manage']);
  await screen.findByText('gis.contours.empty');

  const filter = await screen.findByRole('combobox', { name: 'gis.contours.filterOrganization' });
  await waitFor(() => expect(within(filter).getByText('Burchmulla LX')).toBeInTheDocument());
  await ui.selectOptions(filter, 'org-1');
  await waitFor(() => expect(listCalls).toBe(2));
  const listCallsBefore = listCalls;

  await ui.click(screen.getByTestId('export-xlsx'));

  await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  expect(clickSpy).toHaveBeenCalled();
  expect(exportCalls).toBe(1);
  expect(listCalls).toBe(listCallsBefore); // the export never re-fetches the list
  expect(exportUrl!.searchParams.get('organization_id')).toBe('org-1');
  expect(exportUrl!.searchParams.get('lang')).toBe('uz_latn');
  // The client-only `number` search box narrows nothing server-side — no
  // `number`/`bbox` parameter reaches the export at all.
  expect(exportUrl!.searchParams.has('number')).toBe(false);
  expect(exportUrl!.searchParams.has('bbox')).toBe(false);
  expect(exportUrl!.searchParams.has('page')).toBe(false);
  expect(exportUrl!.searchParams.has('page_size')).toBe(false);
});
