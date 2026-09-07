import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthContext } from '../../../auth/AuthContext';
import type { AuthContextValue } from '../../../auth/AuthContext';
import { I18nContext } from '../../../i18n/context';
import { LayersTab } from './LayersTab';

const t = (key: string) => key;

vi.mock('../contours/DrawMap', () => ({
  DrawMap: (props: { geometryType: string; onDrawFinish: (g: unknown) => void }) => (
    <div data-testid="draw-map-mock" data-geometry-type={props.geometryType}>
      <button onClick={() => props.onDrawFinish({ type: props.geometryType, coordinates: [0, 0] })}>
        finish-draw
      </button>
    </div>
  ),
}));

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const FIRE_BANS = { id: 'l-fire', code: 'fire_bans', name: { uz_latn: 'Yong\'in taqiqi' }, geometry_type: 'GEOMETRY', is_public: false, style: {}, status: 'active' };
const RESTRICTIONS = { id: 'l-restrictions', code: 'restrictions', name: { uz_latn: 'Cheklovlar' }, geometry_type: 'POLYGON', is_public: true, style: {}, status: 'active' };

function renderTab(permissions: string[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const me = {
    user: { id: 'u-1', full_name: 'Test', login: 'test', language: 'uz_latn' },
    role: { code: 'central_admin', name: {} },
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
  return render(<LayersTab t={t} />, { wrapper });
}

test('selecting a layer lists its published features by default', async () => {
  server.use(
    http.get('*/api/v1/gis/layers', () => HttpResponse.json({ items: [RESTRICTIONS, FIRE_BANS] })),
    http.get('*/api/v1/gis/layers/restrictions/features', ({ request }) => {
      expect(new URL(request.url).searchParams.get('status')).toBe('published');
      return HttpResponse.json({
        type: 'FeatureCollection',
        truncated: false,
        features: [{ type: 'Feature', id: 'f-1', geometry: {}, properties: { name: { uz_latn: 'Shimoliy zona' }, props: {}, valid_from: '2026-01-01', valid_to: null } }],
      });
    }),
  );
  const ui = userEvent.setup();
  renderTab([]);

  await ui.click(await screen.findByTestId('layer-row-restrictions'));
  const row = await screen.findByTestId('feature-f-1');
  expect(within(row).getByText('Shimoliy zona')).toBeInTheDocument();
  expect(within(row)).toBeTruthy();
});

test('is_public/active toggles and the new-feature action are offered only to a layers.manage holder', async () => {
  server.use(
    http.get('*/api/v1/gis/layers', () => HttpResponse.json({ items: [RESTRICTIONS] })),
    http.get('*/api/v1/gis/layers/restrictions/features', () =>
      HttpResponse.json({ type: 'FeatureCollection', truncated: false, features: [] }),
    ),
  );
  const ui = userEvent.setup();
  renderTab([]);
  await ui.click(await screen.findByTestId('layer-row-restrictions'));
  await screen.findByText('gis.layers.empty');
  expect(screen.queryByText('gis.layers.isPublic')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'gis.layers.newFeature' })).not.toBeInTheDocument();
});

test('a draft feature offers Publish, a published one offers Archive, to a manager', async () => {
  server.use(
    http.get('*/api/v1/gis/layers', () => HttpResponse.json({ items: [RESTRICTIONS] })),
    http.get('*/api/v1/gis/layers/restrictions/features', ({ request }) => {
      const status = new URL(request.url).searchParams.get('status');
      return HttpResponse.json({
        type: 'FeatureCollection',
        truncated: false,
        features:
          status === 'draft'
            ? [{ type: 'Feature', id: 'f-draft', geometry: {}, properties: { name: null, props: {}, valid_from: null, valid_to: null } }]
            : [{ type: 'Feature', id: 'f-pub', geometry: {}, properties: { name: null, props: {}, valid_from: null, valid_to: null } }],
      });
    }),
    http.post('*/api/v1/gis/layers/restrictions/features/f-draft/publish', () =>
      HttpResponse.json({ id: 'f-draft', layer_id: 'l-restrictions', organization_id: null, name: null, props: {}, valid_from: null, valid_to: null, status: 'published' }),
    ),
  );
  const ui = userEvent.setup();
  renderTab(['gis.layers.manage']);
  await ui.click(await screen.findByTestId('layer-row-restrictions'));

  // Default tab is "published".
  const publishedRow = await screen.findByTestId('feature-f-pub');
  expect(within(publishedRow).getByRole('button', { name: 'gis.layers.actions.archive' })).toBeInTheDocument();

  await ui.click(screen.getByRole('button', { name: 'gis.layers.tabs.draft' }));
  const draftRow = await screen.findByTestId('feature-f-draft');
  const publishBtn = within(draftRow).getByRole('button', { name: 'gis.layers.actions.publish' });
  await ui.click(publishBtn);
});

test('toggling is_public patches the layer', async () => {
  let patched: { is_public?: boolean } | null = null;
  server.use(
    http.get('*/api/v1/gis/layers', () => HttpResponse.json({ items: [RESTRICTIONS] })),
    http.get('*/api/v1/gis/layers/restrictions/features', () =>
      HttpResponse.json({ type: 'FeatureCollection', truncated: false, features: [] }),
    ),
    http.patch('*/api/v1/gis/layers/restrictions', async ({ request }) => {
      patched = (await request.json()) as { is_public?: boolean };
      return HttpResponse.json({ ...RESTRICTIONS, is_public: patched.is_public ?? RESTRICTIONS.is_public });
    }),
  );
  const ui = userEvent.setup();
  renderTab(['gis.layers.manage']);
  await ui.click(await screen.findByTestId('layer-row-restrictions'));

  const publicToggle = await screen.findByRole('checkbox', { name: 'gis.layers.isPublic' });
  expect(publicToggle).toBeChecked();
  await ui.click(publicToggle);
  await waitFor(() => expect(patched).toEqual({ is_public: false }));
});

test('a GEOMETRY-typed layer lets the operator pick a shape before drawing', async () => {
  server.use(
    http.get('*/api/v1/gis/layers', () => HttpResponse.json({ items: [FIRE_BANS] })),
    http.get('*/api/v1/gis/layers/fire_bans/features', () =>
      HttpResponse.json({ type: 'FeatureCollection', truncated: false, features: [] }),
    ),
  );
  const ui = userEvent.setup();
  renderTab(['gis.layers.manage']);
  await ui.click(await screen.findByTestId('layer-row-fire_bans'));
  await ui.click(await screen.findByRole('button', { name: 'gis.layers.newFeature' }));

  expect(screen.getByText('gis.layers.form.shapeType')).toBeInTheDocument();
  expect(screen.getByTestId('draw-map-mock')).toHaveAttribute('data-geometry-type', 'Polygon');
});

test('creating a feature: draw, fill the form, submit', async () => {
  server.use(
    http.get('*/api/v1/gis/layers', () => HttpResponse.json({ items: [RESTRICTIONS] })),
    http.get('*/api/v1/gis/layers/restrictions/features', () =>
      HttpResponse.json({ type: 'FeatureCollection', truncated: false, features: [] }),
    ),
    http.post('*/api/v1/gis/layers/restrictions/features', async ({ request }) => {
      const body = (await request.json()) as { name: Record<string, string> | null };
      expect(body.name).toEqual({ uz_latn: 'Yangi zona' });
      return HttpResponse.json(
        { id: 'f-new', layer_id: 'l-restrictions', organization_id: null, name: body.name, props: {}, valid_from: null, valid_to: null, status: 'draft' },
        { status: 201 },
      );
    }),
  );
  const ui = userEvent.setup();
  renderTab(['gis.layers.manage']);
  await ui.click(await screen.findByTestId('layer-row-restrictions'));
  await ui.click(await screen.findByRole('button', { name: 'gis.layers.newFeature' }));
  await ui.click(screen.getByText('finish-draw'));

  await ui.type(screen.getByRole('textbox'), 'Yangi zona');
  await ui.click(screen.getByRole('button', { name: 'gis.layers.form.create' }));

  await waitFor(() => expect(screen.queryByTestId('draw-map-mock')).not.toBeInTheDocument());
});
