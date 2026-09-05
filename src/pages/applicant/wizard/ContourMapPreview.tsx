import { useEffect, useRef, useState } from 'react';
import {
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
import type { Feature, Geometry } from 'geojson';

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

/** Renders exactly one contour's own geometry — the picker's list is the
 * primary way an applicant finds a plot (see `ContourPicker.tsx`); this is
 * the visual confirmation of what was found, per decision #60.1 (MapLibre GL
 * JS). There is no bulk-geometry endpoint for contours (`GET /gis/contours`
 * carries attributes only — `ContourListItem`'s own docstring), so browsing
 * every published polygon by clicking the map is out of reach without a new
 * backend route; this preview draws the SELECTED one only. */
export function ContourMapPreview({ geometry }: { geometry: Record<string, unknown> | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
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
    map.once('load', () => setMapReady(true));
    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

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
    <div className="relative w-full h-64 rounded-xl border border-[#E4E7EA] overflow-hidden">
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
