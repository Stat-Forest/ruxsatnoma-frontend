import type { Geometry } from 'geojson';

/** Walks every nested coordinate array in `geometry`, including a
 * `GeometryCollection`'s own members, and pushes each `[lng, lat]` pair onto
 * `out`. Same approach as `applicant/wizard/ContourMapPreview.tsx`'s
 * `collectCoordinates` (duplicated rather than imported — that component and
 * this one are on different tracks and share no module today), generic
 * enough to cover every geometry type this screen's contours can carry
 * (Polygon, MultiPolygon in practice) without silently dropping a stray
 * LineString or Point.
 */
function collectCoordinates(geometry: Geometry | null | undefined, out: [number, number][]): void {
  if (!geometry) return;
  if (geometry.type === 'GeometryCollection') {
    for (const g of geometry.geometries) collectCoordinates(g, out);
    return;
  }
  const walk = (value: unknown): void => {
    if (Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number') {
      out.push([value[0] as number, value[1] as number]);
      return;
    }
    if (Array.isArray(value)) for (const item of value) walk(item);
  };
  walk((geometry as { coordinates?: unknown }).coordinates);
}

/** `[[west, south], [east, north]]` — directly usable as MapLibre's own
 * `LngLatBoundsLike`, so the caller never needs to import the `LngLat`/
 * `LngLatBounds` classes just to fit a map to a geometry. */
export type LngLatBoundsTuple = [[number, number], [number, number]];

/** The bounding box of every coordinate in `geometry`. `null` for a geometry
 * with no coordinates at all (missing, or an empty `Polygon`/`GeometryCollection`
 * such as `contour_card` can return before a version's geometry has loaded) —
 * so a caller can tell "nothing to fit yet" from "fit to a single point",
 * rather than being handed `[[0,0],[0,0]]` and zooming to the middle of the
 * Gulf of Guinea.
 */
export function computeGeometryBounds(geometry: Geometry | null | undefined): LngLatBoundsTuple | null {
  const coords: [number, number][] = [];
  collectCoordinates(geometry, coords);
  if (coords.length === 0) return null;

  let west = coords[0][0];
  let east = coords[0][0];
  let south = coords[0][1];
  let north = coords[0][1];
  for (const [lng, lat] of coords) {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return [
    [west, south],
    [east, north],
  ];
}
