/**
 * The plot-on-a-map panel the four cards mount (Odilxon, 2026-09-13). Three
 * things it must not get wrong:
 *   1. with geometry, the map is drawn for THAT contour and the KMZ button
 *      is there, fetching `GET /gis/contours/{id}/export.kmz` with the
 *      session and the UI language;
 *   2. decision #178 — with `geometry: null` the panel says the boundary is
 *      not drawn and shows NO button (the server would 404 that download);
 *   3. a failed download surfaces the server's own message as an alert
 *      rather than vanishing.
 */
import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ContourBoundaryPanel } from './ContourBoundaryPanel';
import { DICTIONARIES, I18nContext } from '../../i18n/context';
import type { I18nContextValue, UiLanguage } from '../../i18n/context';

// The map draws through maplibre-gl, which needs a real canvas/WebGL context
// jsdom does not have. What the panel passes it is what matters here.
const mapProps: unknown[] = [];
vi.mock('../applicant/wizard/ContourMapPreview', () => ({
  ContourMapPreview: (props: unknown) => {
    mapProps.push(props);
    return <div data-testid="map-preview" />;
  },
}));

const CONTOUR_ID = 'c1000000-0000-4000-8000-000000000001';
const SQUARE = {
  type: 'MultiPolygon',
  coordinates: [[[[69.9, 41.5], [69.9, 41.51], [69.91, 41.51], [69.91, 41.5], [69.9, 41.5]]]],
};

function card(geometry: unknown) {
  return {
    id: CONTOUR_ID,
    number: '10517қ',
    organization_id: 'o1000000-0000-4000-8000-000000000001',
    kind: 'contour',
    version_id: 'v1000000-0000-4000-8000-000000000001',
    area_ha: '92',
    geometry,
    occupied_ha: '0.0000',
    s_available_ha: '92',
    over_allocated: false,
    occupancy_source: 'permits',
  };
}

function i18nValue(lang: UiLanguage): I18nContextValue {
  return {
    lang,
    backendLang: lang,
    t: (key: string) => (DICTIONARIES[lang] as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
}

function renderPanel(ui: ReactElement, lang: UiLanguage = 'uz_latn') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18nValue(lang)}>{ui}</I18nContext.Provider>
    </QueryClientProvider>,
  );
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  mapProps.length = 0;
  // jsdom has neither; `downloadAttachment` needs both to hand the blob over.
  URL.createObjectURL = vi.fn(() => 'blob:kmz');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('draws the contour and downloads its KMZ', async () => {
  const requested: string[] = [];
  server.use(
    http.get(`*/api/v1/gis/contours/${CONTOUR_ID}`, () => HttpResponse.json(card(SQUARE))),
    http.get(`*/api/v1/gis/contours/${CONTOUR_ID}/export.kmz`, ({ request }) => {
      requested.push(request.url);
      return new HttpResponse(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), {
        headers: {
          'Content-Type': 'application/vnd.google-earth.kmz',
          'Content-Disposition': "attachment; filename=\"kontur-10517.kmz\"; filename*=UTF-8''kontur-10517%D2%9B.kmz",
        },
      });
    }),
  );
  const clicked: string[] = [];
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push(this.download);
  });

  renderPanel(<ContourBoundaryPanel contourId={CONTOUR_ID} />, 'ru');

  expect(await screen.findByTestId('map-preview')).toBeInTheDocument();
  expect(mapProps[0]).toMatchObject({ geometry: SQUARE, selectedId: CONTOUR_ID });
  expect(screen.getByText(/№ 10517қ/)).toBeInTheDocument();
  expect(screen.queryByTestId('contour-boundary-empty')).not.toBeInTheDocument();

  await userEvent.click(screen.getByTestId('contour-kmz-download'));
  await waitFor(() => expect(clicked).toEqual(['kontur-10517қ.kmz']));
  expect(requested).toHaveLength(1);
  expect(new URL(requested[0]).searchParams.get('lang')).toBe('ru');
  click.mockRestore();
});

test('says the boundary is not drawn and offers no download without geometry', async () => {
  server.use(http.get(`*/api/v1/gis/contours/${CONTOUR_ID}`, () => HttpResponse.json(card(null))));

  renderPanel(<ContourBoundaryPanel contourId={CONTOUR_ID} />);

  expect(await screen.findByTestId('contour-boundary-empty')).toHaveTextContent('chegara chizilmagan');
  expect(screen.queryByTestId('map-preview')).not.toBeInTheDocument();
  expect(screen.queryByTestId('contour-kmz-download')).not.toBeInTheDocument();
  expect(mapProps).toHaveLength(0);
});

test('shows the server message when the download is refused', async () => {
  server.use(
    http.get(`*/api/v1/gis/contours/${CONTOUR_ID}`, () => HttpResponse.json(card(SQUARE))),
    http.get(`*/api/v1/gis/contours/${CONTOUR_ID}/export.kmz`, () =>
      HttpResponse.json(
        { error: { code: 'ERR-GIS-007', message: 'У контура нет геометрии', correlation_id: 'x' } },
        { status: 404 },
      ),
    ),
  );

  renderPanel(<ContourBoundaryPanel contourId={CONTOUR_ID} />);
  await userEvent.click(await screen.findByTestId('contour-kmz-download'));

  expect(await screen.findByRole('alert')).toHaveTextContent('У контура нет геометрии');
});

test('renders nothing without a contour id', () => {
  const { container } = renderPanel(<ContourBoundaryPanel contourId={null} />);
  expect(container).toBeEmptyDOMElement();
});
