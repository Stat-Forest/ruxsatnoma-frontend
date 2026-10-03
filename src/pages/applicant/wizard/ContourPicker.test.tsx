/**
 * F5 (`docs/plans/07.3-findings.md`) — a contour whose issued permits exceed
 * its own area reports `Boʻsh qism 0 ga` next to a `Band qism` that is
 * visibly larger than `Umumiy maydon`, with nothing on screen explaining why
 * — even though the backend already carries an explicit `over_allocated`
 * flag beside the floored `s_available_ha` for exactly this case.
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { RefObject } from 'react';
import { ContourPicker, type PickedContour } from './ContourPicker';

// The map draws through maplibre-gl, which needs a real canvas/WebGL context
// jsdom does not provide — mocked the same way `ApplicationWizardPage.test.tsx`
// mocks `ContourPicker` itself: this test owns the list/card panel, not the map.
// The mock renders nothing but keeps the two fullscreen props the real map
// would drive, so a test can do to this picker exactly what MapLibre's
// `FullscreenControl` does: toggle `maplibregl-pseudo-fullscreen` on the
// `fullscreenTarget` element, THEN report the change (`lastMapProps`,
// `toggleFullscreen`).
type MapPreviewFullscreenProps = {
  fullscreenTarget?: RefObject<HTMLDivElement | null>;
  onFullscreenChange?: (isFullscreen: boolean) => void;
};
let lastMapProps: MapPreviewFullscreenProps = {};
vi.mock('./ContourMapPreview', () => ({
  ContourMapPreview: (props: MapPreviewFullscreenProps) => {
    lastMapProps = props;
    return null;
  },
}));

/** MapLibre's `_togglePseudoFullScreen`, in its real order: the class first,
 * the event second. */
function toggleFullscreen() {
  const target = lastMapProps.fullscreenTarget?.current;
  if (!target) throw new Error('the map was not handed a fullscreenTarget');
  target.classList.toggle('maplibregl-pseudo-fullscreen');
  act(() => lastMapProps.onFullscreenChange?.(target.classList.contains('maplibregl-pseudo-fullscreen')));
  return target;
}

function contourListItem(over: Record<string, unknown> = {}) {
  return {
    id: 'c1000000-0000-4000-8000-000000000001',
    number: '10517қ',
    organization_id: 'org00000-0000-4000-8000-000000000001',
    area_ha: '65.0694',
    occupied_ha: '130.1388',
    s_available_ha: '0',
    over_allocated: true,
    occupancy_source: 'permits',
    ...over,
  };
}

const server = setupServer(
  http.get('*/api/v1/refs/organizations', () => HttpResponse.json({ items: [], total: 0 })),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPicker(onChange: (c: PickedContour) => void = () => {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ContourPicker value={null} onChange={onChange} />
    </QueryClientProvider>,
  );
}

function organization(over: Record<string, unknown> = {}) {
  return {
    id: 'org-1',
    parent_id: 'agency-1',
    kind: 'leshoz',
    code: 'burchmulla',
    name: { uz_latn: 'Burchmulla LX' },
    stir: null,
    region_id: null,
    district_id: null,
    status: 'active',
    ...over,
  };
}

test('an over-allocated contour explains why the free area cannot be negative', async () => {
  const user = userEvent.setup();
  server.use(
    http.get('*/api/v1/gis/contours', () =>
      HttpResponse.json({ items: [contourListItem()], total: 1, page: 1, page_size: 100 }),
    ),
    http.get('*/api/v1/gis/contours/:id', () =>
      HttpResponse.json({
        ...contourListItem(),
        kind: 'contour',
        version_id: 'v1000000-0000-4000-8000-000000000001',
        geometry: { type: 'Polygon', coordinates: [] },
      }),
    ),
  );

  renderPicker();
  await user.click(await screen.findByText('10517қ'));

  await screen.findByText(/umumiy maydonidan koʻproq ruxsatnoma berilgan/i);
  expect(screen.getByText('0 ga')).toBeInTheDocument();
});

test('a normal, not-over-allocated contour shows no over-allocation warning', async () => {
  const user = userEvent.setup();
  server.use(
    http.get('*/api/v1/gis/contours', () =>
      HttpResponse.json({
        items: [contourListItem({ occupied_ha: '10', s_available_ha: '55.0694', over_allocated: false })],
        total: 1,
        page: 1,
        page_size: 100,
      }),
    ),
    http.get('*/api/v1/gis/contours/:id', () =>
      HttpResponse.json({
        ...contourListItem({ occupied_ha: '10', s_available_ha: '55.0694', over_allocated: false }),
        kind: 'contour',
        version_id: 'v1000000-0000-4000-8000-000000000001',
        geometry: { type: 'Polygon', coordinates: [] },
      }),
    ),
  );

  renderPicker();
  await user.click(await screen.findByText('10517қ'));

  await screen.findByText('55.0694 ga');
  expect(screen.queryByText(/umumiy maydonidan koʻproq/i)).not.toBeInTheDocument();
});

/**
 * T2 (demo remark 2026-09-10, item 1): the only filter used to be a
 * substring match on the contour number — useless to an applicant who
 * knows their leshoz, not a contour number. `GET /gis/contours` already
 * accepts `organization_id` (`listContours`'s own params); this pins that
 * the picker actually sends it, server-side, rather than filtering a page
 * it already has.
 */
test('picking a leshoz asks the server for it and narrows the list', async () => {
  const user = userEvent.setup();
  const requestedOrgIds: (string | null)[] = [];
  server.use(
    http.get('*/api/v1/refs/organizations', ({ request }) => {
      const url = new URL(request.url);
      if (!url.searchParams.get('parent_id')) {
        return HttpResponse.json({
          items: [{ id: 'agency-1', parent_id: null, kind: 'agency', code: 'agency', name: { uz_latn: 'Agentlik' }, stir: null, region_id: null, district_id: null, status: 'active' }],
          total: 1,
        });
      }
      return HttpResponse.json({
        items: [
          organization({ id: 'org-1', code: 'burchmulla', name: { uz_latn: 'Burchmulla LX' } }),
          organization({ id: 'org-2', code: 'chimyon', name: { uz_latn: 'Chimyon LX' } }),
        ],
        total: 2,
      });
    }),
    http.get('*/api/v1/gis/contours', ({ request }) => {
      const url = new URL(request.url);
      const organizationId = url.searchParams.get('organization_id');
      requestedOrgIds.push(organizationId);
      const items =
        organizationId === 'org-1'
          ? [contourListItem({ organization_id: 'org-1' })]
          : [
              contourListItem({ organization_id: 'org-1' }),
              contourListItem({ id: 'c2000000-0000-4000-8000-000000000002', number: '20900қ', organization_id: 'org-2' }),
            ];
      return HttpResponse.json({ items, total: items.length, page: 1, page_size: 100 });
    }),
  );

  renderPicker();
  await screen.findByText('10517қ');
  await screen.findByText('20900қ');

  const leshozSelect = await screen.findByRole('combobox');
  await waitFor(() => expect(within(leshozSelect).getByText('Burchmulla LX')).toBeInTheDocument());
  await user.selectOptions(leshozSelect, 'org-1');

  await waitFor(() => expect(screen.queryByText('20900қ')).not.toBeInTheDocument());
  expect(screen.getByText('10517қ')).toBeInTheDocument();
  expect(requestedOrgIds).toContain('org-1');
});

/**
 * T2 item 2: the «Ushbu konturni tanlash» confirm button goes away —
 * clicking a contour, in the list, selects it immediately and reports the
 * pick through the same `onChange` callback the wizard already reads.
 */
test('a click selects the contour immediately, with no separate confirm button', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  server.use(
    http.get('*/api/v1/gis/contours', () =>
      HttpResponse.json({ items: [contourListItem()], total: 1, page: 1, page_size: 100 }),
    ),
    http.get('*/api/v1/gis/contours/:id', () =>
      HttpResponse.json({
        ...contourListItem(),
        kind: 'contour',
        version_id: 'v1000000-0000-4000-8000-000000000001',
        geometry: { type: 'Polygon', coordinates: [] },
      }),
    ),
  );

  renderPicker(onChange);
  const row = await screen.findByText('10517қ');

  // No confirm button anywhere in the picker any more.
  expect(screen.queryByRole('button', { name: /tanlash/i })).not.toBeInTheDocument();

  await user.click(row);

  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith({ id: 'c1000000-0000-4000-8000-000000000001', number: '10517қ', areaHa: '65.0694' });
  await screen.findByText('Tanlandi'); // the selected badge — visually obvious selection

  // Clicking the SAME contour again toggles back to browsing (map preview),
  // but that is a local view state, not a second, different pick — the
  // callback contract has no way to say "nothing is selected any more".
  await user.click(row);
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Tanlandi')).not.toBeInTheDocument();
});

/**
 * T12 (decision #178) — a leshoz with no delivered GIS layer files contours
 * by requisites, and the picker must not show a dead map frame for it: no
 * empty grey rectangle, a deliberate notice in its place. The list itself
 * (number, forestry, area) already IS the requisites view — it keeps
 * working exactly as it did before.
 */
test('a leshoz with no GIS layer shows a requisites notice instead of the map, and the list still lets you pick', async () => {
  const user = userEvent.setup();
  server.use(
    http.get('*/api/v1/refs/organizations', ({ request }) => {
      const url = new URL(request.url);
      if (!url.searchParams.get('parent_id')) {
        return HttpResponse.json({
          items: [
            { id: 'agency-1', parent_id: null, kind: 'agency', code: 'agency', name: { uz_latn: 'Agentlik' }, stir: null, region_id: null, district_id: null, status: 'active', gis_enabled: true },
          ],
          total: 1,
        });
      }
      return HttpResponse.json({ items: [organization({ gis_enabled: false })], total: 1 });
    }),
    http.get('*/api/v1/gis/contours', () =>
      HttpResponse.json({ items: [contourListItem()], total: 1, page: 1, page_size: 100 }),
    ),
  );

  renderPicker();
  const leshozSelect = await screen.findByRole('combobox');
  await waitFor(() => expect(within(leshozSelect).getByText('Burchmulla LX')).toBeInTheDocument());
  await user.selectOptions(leshozSelect, 'org-1');

  await screen.findByTestId('no-map-notice');
  // The requisites list — number, area — is unaffected by the switch.
  expect(screen.getByText('10517қ')).toBeInTheDocument();
  expect(screen.getByText(/65\.0694/)).toBeInTheDocument();
});

test('a leshoz WITH a GIS layer shows no such notice', async () => {
  const user = userEvent.setup();
  server.use(
    http.get('*/api/v1/refs/organizations', ({ request }) => {
      const url = new URL(request.url);
      if (!url.searchParams.get('parent_id')) {
        return HttpResponse.json({
          items: [
            { id: 'agency-1', parent_id: null, kind: 'agency', code: 'agency', name: { uz_latn: 'Agentlik' }, stir: null, region_id: null, district_id: null, status: 'active', gis_enabled: true },
          ],
          total: 1,
        });
      }
      return HttpResponse.json({ items: [organization({ gis_enabled: true })], total: 1 });
    }),
    http.get('*/api/v1/gis/contours', () =>
      HttpResponse.json({ items: [contourListItem()], total: 1, page: 1, page_size: 100 }),
    ),
  );

  renderPicker();
  const leshozSelect = await screen.findByRole('combobox');
  await waitFor(() => expect(within(leshozSelect).getByText('Burchmulla LX')).toBeInTheDocument());
  await user.selectOptions(leshozSelect, 'org-1');

  await screen.findByText('10517қ');
  expect(screen.queryByTestId('no-map-notice')).not.toBeInTheDocument();
});

/**
 * 2026-09-13, dev stand: pressing the map's fullscreen button flipped its
 * icon and gave this grid its full-screen padding, but nothing expanded.
 * MapLibre toggles `maplibregl-pseudo-fullscreen` (the class that pins the
 * target to the viewport) on the target and then fires `fullscreenstart`;
 * the picker's listener set state, React re-rendered the grid, and because
 * the grid's `className` depended on that state React rewrote the `class`
 * attribute wholesale — dropping the class MapLibre had just added. The
 * target's className must be one React never changes.
 */
test("the fullscreen target keeps MapLibre's class across the re-render its own event causes", async () => {
  server.use(
    http.get('*/api/v1/gis/contours', () =>
      HttpResponse.json({ items: [contourListItem()], total: 1, page: 1, page_size: 100 }),
    ),
  );
  renderPicker();
  await screen.findByText('10517қ');

  const target = toggleFullscreen();
  expect(target.classList.contains('maplibregl-pseudo-fullscreen')).toBe(true);

  toggleFullscreen();
  expect(target.classList.contains('maplibregl-pseudo-fullscreen')).toBe(false);
});
