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

/** OpenStreetMap raster tiles as the basemap (Oybek, 2026-09-05 — decision
 * #60.1 had left the basemap open as a hosting/licensing question, not a
 * library one). Without it the preview drew the picked contour alone on a
 * flat field: correct in shape and size, but impossible to place — a viewer
 * could not tell that a plot is in Burchmulla, next to which river, up which
 * slope. The flat fill stays underneath as the `bg` layer, so a tile that
 * fails to load leaves the project's own green rather than a black hole.
 *
 * OSM's tile policy is fine for a dev server and a demo, and requires the
 * attribution below — which is why `attributionControl` is now on. Heavy or
 * production traffic belongs on our own tile server or a paid provider;
 * swapping this source is the only change that needs. */
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
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#EAF3EC' } },
    { id: 'osm', type: 'raster', source: 'osm' },
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

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MaplibreMap({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: [69.2401, 41.2995], // Tashkent — a reasonable default before anything is picked
      zoom: 7,
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

    if (!geometry) {
      if (map.getLayer('contour-fill')) map.removeLayer('contour-fill');
      if (map.getLayer('contour-line')) map.removeLayer('contour-line');
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
        paint: { 'fill-color': '#2E7D4F', 'fill-opacity': 0.45 },
      });
      map.addLayer({
        id: 'contour-line',
        type: 'line',
        source: 'contour',
        paint: { 'line-color': '#123522', 'line-width': 2.5 },
      });
    }

    const coords: [number, number][] = [];
    collectCoordinates(geometry, coords);
    if (coords.length > 0) {
      const bounds = coords.reduce((b, c) => b.extend(c), new LngLatBounds(coords[0], coords[0]));
      map.fitBounds(bounds, { padding: 40, maxZoom: 15, duration: 300 });
    }
  }, [geometry, mapReady]);

  return <div ref={containerRef} className="w-full h-64 rounded-xl border border-[#E4E7EA] overflow-hidden" />;
}
