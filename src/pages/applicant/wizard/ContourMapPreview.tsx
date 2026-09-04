import { useEffect, useRef } from 'react';
import { GeoJSONSource, LngLatBounds, Map as MaplibreMap, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// `maplibre-gl`'s own types reference the ambient `GeoJSON` global (from
// `@types/geojson`), but this project's `tsconfig` sets an explicit `types`
// list, which turns off TypeScript's automatic pickup of every installed
// `@types/*` package — so the ambient namespace never resolves here. The
// module import below is the same package's OTHER shape (`export as
// namespace GeoJSON` in `@types/geojson` doubles as a real ES module), and
// works regardless of that `types` list.
import type { Feature, Geometry } from 'geojson';

/** No tile source at all (decision #60.1 leaves the basemap itself open — a
 * hosting/licensing question, not a library one): a flat background is
 * enough to see the picked contour's own shape, which is all this preview
 * promises. */
const EMPTY_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#EAF3EC' } }],
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

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MaplibreMap({
      container: containerRef.current,
      style: EMPTY_STYLE,
      center: [69.2401, 41.2995], // Tashkent — a reasonable default before anything is picked
      zoom: 7,
      attributionControl: false,
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
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
          paint: { 'fill-color': '#2E7D4F', 'fill-opacity': 0.35 },
        });
        map.addLayer({
          id: 'contour-line',
          type: 'line',
          source: 'contour',
          paint: { 'line-color': '#23653F', 'line-width': 2 },
        });
      }
      const coords: [number, number][] = [];
      collectCoordinates(geometry, coords);
      if (coords.length > 0) {
        const bounds = coords.reduce((b, c) => b.extend(c), new LngLatBounds(coords[0], coords[0]));
        map.fitBounds(bounds, { padding: 40, maxZoom: 15, duration: 300 });
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [geometry]);

  return <div ref={containerRef} className="w-full h-64 rounded-xl border border-[#E4E7EA] overflow-hidden" />;
}
