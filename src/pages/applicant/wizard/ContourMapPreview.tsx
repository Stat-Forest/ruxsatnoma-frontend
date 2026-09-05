import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FullscreenControl,
  GeoJSONSource,
  LngLatBounds,
  Map as MaplibreMap,
  setWorkerUrl,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre 6 runs its geometry tiling in a SEPARATE worker file whose URL it
// builds at run time (`new URL('./maplibre-gl-worker.mjs', import.meta.url)`).
// A bundler cannot see a path assembled like that, so Vite never emitted the
// file: the deployed build requested /assets/maplibre-gl-worker.mjs, got
// nginx's SPA fallback (index.html) with a 404, and the worker silently never
// started. There is no console error — but every GeoJSON source then stays
// `_isUpdatingWorker: true` forever, `map.isStyleLoaded()` never turns true,
// and NOTHING is ever drawn: the map showed a blank background even with a
// contour selected and its geometry fetched. `?worker&url` makes Vite bundle
// the worker together with the `maplibre-gl-shared.mjs` it imports and hand
// back the URL it actually emitted, in dev and in the production build alike.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
// `maplibre-gl`'s own types reference the ambient `GeoJSON` global (from
// `@types/geojson`), but this project's `tsconfig` sets an explicit `types`
// list, which turns off TypeScript's automatic pickup of every installed
// `@types/*` package — so the ambient namespace never resolves here. The
// module import below is the same package's OTHER shape (`export as
// namespace GeoJSON` in `@types/geojson` doubles as a real ES module), and
// works regardless of that `types` list.
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { listContourFeatures } from '../api';

setWorkerUrl(workerUrl);

/** Two basemaps, one shown at a time (Oybek, 2026-09-05 — decision #60.1 had
 * left the basemap open as a hosting/licensing question, not a library one).
 * Without any of them the preview drew the picked contour alone on a flat
 * field: correct in shape and size, but impossible to place — a viewer could
 * not tell that a plot is in Burchmulla, next to which river, up which slope.
 * The scheme answers "where is it"; the imagery answers "what is actually
 * growing there", which for a grazing or haymaking permit is the question.
 * The flat fill stays underneath as the `bg` layer, so a tile that fails to
 * load leaves the project's own green rather than a black hole.
 *
 * Both providers serve without a key and both REQUIRE the credit the
 * attribution control now shows. Neither is a production answer: OSM's tile
 * policy covers a dev server and a demo, not public traffic, and Esri's
 * imagery is served for use inside its own platform. Before real users, this
 * moves to our own tile server or a licensed provider — swapping the `tiles`
 * arrays is the whole change, which is why both are declared here and
 * nowhere else. */
const BASEMAPS = [
  { id: 'osm', label: 'Xarita' },
  { id: 'satellite', label: 'Sputnik' },
] as const;

type BasemapId = (typeof BASEMAPS)[number]['id'];

/** In basemap order: fill first, then the casing, then the outline on top. */
const CONTOUR_LAYERS = ['contour-fill', 'contour-casing', 'contour-line'] as const;

/** The fill has to do opposite jobs on the two basemaps. Over the flat scheme
 * it IS the parcel — nothing else marks it. Over imagery it hides the very
 * thing the imagery was switched on to show (what grows there), so it thins
 * to a tint and the outline carries the shape. */
const FILL_OPACITY: Record<BasemapId, number> = { osm: 0.45, satellite: 0.15 };

/** The browsable layer sits a step quieter than the selected one — several
 * parcels at once, none of them chosen yet, so the fill marks territory
 * without claiming attention. Same reasoning per basemap: over a photo it
 * thins out so the ground stays readable. */
const BROWSE_FILL_OPACITY: Record<BasemapId, number> = { osm: 0.3, satellite: 0.12 };

/** The map is locked to Uzbekistan (Oybek, 2026-09-05): every forest-fund
 * parcel this system will ever issue a permit for is inside these bounds, so
 * panning beyond them can only ever be a viewer getting lost. Roughly the
 * country's extent — Ustyurt in the west, the Ferghana valley in the east,
 * Termez in the south, Karakalpakstan in the north — with a small margin so a
 * contour touching a national border still has context around it.
 *
 * **What this does NOT do:** it stops the map being *moved* off Uzbekistan; it
 * cannot stop neighbouring territory being *seen*. Tiles are square and the
 * providers draw whatever falls in them, so near a border a strip of Kazakh,
 * Kyrgyz, Tajik, Afghan or Turkmen ground stays visible. Hiding that needs a
 * mask polygon of the national boundary drawn over the basemap — a separate
 * change, and one that needs boundary geometry we do not have yet. */
const UZBEKISTAN_BOUNDS: [[number, number], [number, number]] = [
  [55.6, 36.9],
  [73.4, 45.8],
];

/** Fits the whole country in the preview's own 360×256 frame and no further:
 * zooming out to a world map has nothing to offer here. */
const MIN_ZOOM = 4.5;

/** Below this the viewport covers more ground than a browsable layer: the
 * request would ask for thousands of polygons, the server would clip the
 * answer at its own cap, and the map would draw a partial layer as if it were
 * the whole one. So nothing is fetched, and the map says why instead. */
const MIN_FETCH_ZOOM = 10;

/** The browsable layer — every published contour in view. Drawn UNDER the
 * selected-contour layers, which are added later and therefore land on top.
 * Same three-layer treatment as the selected one, one step quieter: a fill, a
 * white casing and a dark outline. The casing is not decoration — a thin line
 * over a satellite photo of forest is invisible, and a parcel nobody can see
 * is a parcel nobody can click. */
const ALL_LAYERS = ['contours-fill', 'contours-casing', 'contours-line'] as const;

const EMPTY_COLLECTION: FeatureCollection = { type: 'FeatureCollection', features: [] };

const BASEMAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap',
    },
    satellite: {
      type: 'raster',
      // {y}/{x}, not {x}/{y} — ArcGIS orders the path row-then-column, and
      // getting it backwards yields tiles of the wrong place rather than an
      // error. Imagery over Burchmulla runs to z18; `maxzoom` caps requests
      // there so a deeper zoom upscales the last real tile instead of asking
      // for one that does not exist.
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 18,
      attribution: '© Esri, Maxar, Earthstar Geographics',
    },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#EAF3EC' } },
    { id: 'osm', type: 'raster', source: 'osm' },
    // Declared hidden rather than added on demand: MapLibre requests no tiles
    // for an invisible layer, so the unused provider costs nothing until it is
    // switched to, and switching is then a visibility flip with no reload.
    { id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } },
  ],
};

function collectCoordinates(geometry: unknown, out: [number, number][]): void {
  if (!geometry || typeof geometry !== 'object') return;
  const geom = geometry as { type?: string; coordinates?: unknown; geometries?: unknown[] };
  if (geom.type === 'GeometryCollection' && Array.isArray(geom.geometries)) {
    for (const g of geom.geometries) collectCoordinates(g, out);
    return;
  }
  const walk = (value: unknown): void => {
    if (Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number') {
      out.push([value[0] as number, value[1] as number]);
      return;
    }
    if (Array.isArray(value)) for (const item of value) walk(item);
  };
  walk(geom.coordinates);
}

/** The map an applicant browses. With nothing picked it draws EVERY published
 * contour in view (`GET /gis/contours/features`, added for this — the paged
 * list carries no geometry and could never feed a map); clicking one narrows
 * the map to that parcel alone, and clicking it again brings the rest back.
 *
 * The two states are drawn from two different sources on purpose. The
 * browsable layer is whatever the last viewport returned, while the selected
 * contour comes from its own card — so a parcel picked in the list stays
 * drawn after the map is panned somewhere else entirely, which it would not
 * if the selection were merely a filter over the viewport's features. */
export function ContourMapPreview({
  geometry,
  selectedId,
  onPick,
}: {
  geometry: Record<string, unknown> | null;
  selectedId?: string | null;
  onPick?: (contourId: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  // Whether the map has fired `load` ONCE, remembered rather than re-asked.
  // The obvious `map.isStyleLoaded()` is not the same question: it also goes
  // FALSE again whenever a source is mid-load, which a raster basemap is on
  // every pan and zoom. Asking it at the moment geometry arrives and falling
  // back to `map.once('load', …)` would then register a handler for an event
  // that already fired and never fires again — and the contour would never
  // be drawn at all.
  const [mapReady, setMapReady] = useState(false);
  const [basemap, setBasemap] = useState<BasemapId>('osm');
  /** The viewport of the last settled move, as the API's `bbox` string. Set
   * from `moveend`, which is its own debounce: it fires once the pan or zoom
   * stops, not on every frame of it. */
  const [bbox, setBbox] = useState<string | null>(null);
  const [zoomedOut, setZoomedOut] = useState(false);
  /** MapLibre's click handler is registered once and closes over whatever
   * `selectedId` was at that moment. A ref is what makes the toggle work: the
   * handler has to compare against the CURRENT selection to know whether this
   * click is picking a parcel or clearing the one already picked. */
  const selectedIdRef = useRef<string | null>(selectedId ?? null);
  const onPickRef = useRef(onPick);
  // Kept current in an effect, not during render: writing a ref while
  // rendering is what `react-hooks/refs` forbids, and the click handler only
  // ever reads these after a commit anyway.
  useEffect(() => {
    selectedIdRef.current = selectedId ?? null;
    onPickRef.current = onPick;
  }, [selectedId, onPick]);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MaplibreMap({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: [69.2401, 41.2995], // Tashkent — a reasonable default before anything is picked
      zoom: 7,
      maxBounds: UZBEKISTAN_BOUNDS,
      minZoom: MIN_ZOOM,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    // Expands the SHELL, not the canvas: the basemap switch, the parcel count
    // and the attribution are siblings of the map div, and expanding the map
    // alone would leave all three behind on the page underneath.
    //
    // `pseudo` — CSS expansion to the viewport — rather than the native
    // Fullscreen API, which is refused outright ("Permissions check failed")
    // wherever the page is framed without `allow="fullscreen"`. The refusal
    // is silent from the user's side: the button is there, it is pressed, and
    // nothing happens. Pseudo mode needs no permission and cannot fail that
    // way; what it gives up is hiding the browser's own chrome, which in a
    // cabinet people navigate with is arguably the better trade anyway.
    if (shellRef.current) {
      map.addControl(
        new FullscreenControl({ container: shellRef.current, pseudo: true }),
        'top-right',
      );
    }

    const readViewport = () => {
      if (map.getZoom() < MIN_FETCH_ZOOM) {
        setZoomedOut(true);
        setBbox(null);
        return;
      }
      setZoomedOut(false);
      const b = map.getBounds();
      setBbox(
        [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
          .map((n) => n.toFixed(5))
          .join(','),
      );
    };

    const pick = (event: { features?: { properties?: Record<string, unknown> }[] }) => {
      const id = event.features?.[0]?.properties?.contour_id;
      if (typeof id !== 'string') return;
      // The toggle the whole interaction is built on: clicking the parcel that
      // is already selected clears the selection rather than re-selecting it.
      onPickRef.current?.(selectedIdRef.current === id ? null : id);
    };
    const clearOnSelected = () => onPickRef.current?.(null);

    map.once('load', () => {
      map.addSource('contours', { type: 'geojson', data: EMPTY_COLLECTION });
      map.addLayer({
        id: 'contours-fill',
        type: 'fill',
        source: 'contours',
        paint: { 'fill-color': '#2E7D4F', 'fill-opacity': BROWSE_FILL_OPACITY.osm },
      });
      map.addLayer({
        id: 'contours-casing',
        type: 'line',
        source: 'contours',
        paint: { 'line-color': '#FFFFFF', 'line-width': 3, 'line-opacity': 0.9 },
      });
      map.addLayer({
        id: 'contours-line',
        type: 'line',
        source: 'contours',
        paint: { 'line-color': '#123522', 'line-width': 1.4 },
      });
      map.on('click', 'contours-fill', pick);
      // The selected parcel is drawn from the OTHER source, so clearing it
      // needs its own handler — without this the only way back to the full
      // layer would be a control the interaction does not have.
      map.on('click', 'contour-fill', clearOnSelected);
      for (const layer of ['contours-fill', 'contour-fill']) {
        map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
        map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
      }
      readViewport();
      setMapReady(true);
    });
    map.on('moveend', readViewport);

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  const featuresQuery = useQuery({
    queryKey: ['contour-features', bbox],
    queryFn: () => listContourFeatures(bbox!),
    // Only while nothing is picked: a selected parcel hides this layer, and
    // fetching a viewport nobody can see is bandwidth spent on nothing.
    enabled: !!bbox && !selectedId,
    staleTime: 60_000,
  });

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const source = map.getSource('contours') as GeoJSONSource | undefined;
    if (!source) return;
    source.setData(
      (featuresQuery.data as unknown as FeatureCollection | undefined) ?? EMPTY_COLLECTION,
    );
  }, [featuresQuery.data, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    // One parcel picked means one parcel drawn — the browsable layer would
    // otherwise keep every neighbour on screen underneath it.
    for (const id of ALL_LAYERS) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', selectedId ? 'none' : 'visible');
      }
    }
  }, [selectedId, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    for (const { id } of BASEMAPS) {
      map.setLayoutProperty(id, 'visibility', id === basemap ? 'visible' : 'none');
    }
    // Guarded: the contour layers exist only once something is picked, and the
    // basemap can be switched before that.
    if (map.getLayer('contour-fill')) {
      map.setPaintProperty('contour-fill', 'fill-opacity', FILL_OPACITY[basemap]);
    }
    if (map.getLayer('contours-fill')) {
      map.setPaintProperty('contours-fill', 'fill-opacity', BROWSE_FILL_OPACITY[basemap]);
    }
  }, [basemap, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (!geometry) {
      for (const id of CONTOUR_LAYERS) if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource('contour')) map.removeSource('contour');
      return;
    }

    const feature: Feature = { type: 'Feature', properties: {}, geometry: geometry as unknown as Geometry };
    const source = map.getSource('contour') as GeoJSONSource | undefined;
    if (source) {
      source.setData(feature);
    } else {
      map.addSource('contour', { type: 'geojson', data: feature });
      map.addLayer({
        id: 'contour-fill',
        type: 'fill',
        source: 'contour',
        paint: { 'fill-color': '#2E7D4F', 'fill-opacity': FILL_OPACITY[basemap] },
      });
      // A white casing UNDER the dark outline. Without it the boundary was
      // invisible on imagery: a dark-green line over dark-green vegetation is
      // the one combination satellite mode is guaranteed to produce, and a
      // parcel you cannot find is the whole feature failing. The halo reads
      // against both a dark photo and the pale scheme, so one styling serves
      // both basemaps instead of two that can drift apart.
      map.addLayer({
        id: 'contour-casing',
        type: 'line',
        source: 'contour',
        paint: { 'line-color': '#FFFFFF', 'line-width': 5, 'line-opacity': 0.9 },
      });
      map.addLayer({
        id: 'contour-line',
        type: 'line',
        source: 'contour',
        paint: { 'line-color': '#123522', 'line-width': 2 },
      });
    }

    const coords: [number, number][] = [];
    collectCoordinates(geometry, coords);
    if (coords.length > 0) {
      const bounds = coords.reduce((b, c) => b.extend(c), new LngLatBounds(coords[0], coords[0]));
      map.fitBounds(bounds, { padding: 40, maxZoom: 15, duration: 300 });
    }
  }, [geometry, mapReady, basemap]);

  return (
    <div
      ref={shellRef}
      className="map-shell relative w-full h-80 lg:h-[560px] rounded-xl border border-[#E4E7EA] overflow-hidden"
    >
      {/* `h-full`, NOT `absolute inset-0`: maplibre-gl.css declares
          `.maplibregl-map { position: relative }` and adds that class to this
          very div at run time. Tailwind's `absolute` is one class too, so
          source order decides and MapLibre wins — `inset-0` then has nothing
          to anchor to, the container collapses to 0px tall, and the map
          renders as a white band outside its own frame. Sizing it against the
          parent's height sidesteps the fight entirely. */}
      <div ref={containerRef} className="w-full h-full" />
      {/* Top-LEFT: MapLibre's own attribution control sits bottom-right, and
          the credit is the one thing on this map that may not be covered. */}
      {/* Says what the map is showing, because "no polygons" has two very
          different causes: zoomed out past the fetch threshold, or zoomed in
          on ground that simply has no published contours. Silence would look
          identical in both cases — and identical to a broken layer. */}
      {!selectedId && (
        <div className="absolute bottom-2 left-2 z-10 rounded-md bg-white/90 border border-[#E4E7EA] px-2 py-1 text-[11px] text-[#5A646D] shadow-xs">
          {/* `!mapReady` comes FIRST: before the map has loaded there is no
              viewport to have read, so the count is not zero — it is not yet
              known, and printing "0 ta uchastka" there says the ground is
              empty when nothing has been asked yet. */}
          {!mapReady
            ? 'Yuklanmoqda...'
            : zoomedOut
              ? 'Uchastkalarni koʻrish uchun kattalashtiring'
              : featuresQuery.isFetching
                ? 'Yuklanmoqda...'
                : `${featuresQuery.data?.features.length ?? 0} ta uchastka`}
        </div>
      )}
      <div className="absolute top-2 left-2 z-10 flex rounded-lg overflow-hidden border border-[#E4E7EA] shadow-xs bg-white">
        {BASEMAPS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={basemap === id}
            onClick={() => setBasemap(id)}
            className={`px-3 py-1 text-[11px] font-semibold cursor-pointer transition-colors ${
              basemap === id ? 'bg-[#2E7D4F] text-white' : 'text-[#5A646D] hover:bg-[#F0F7F1]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
