import { useEffect, useRef, useState } from 'react';
import {
  FullscreenControl,
  GeoJSONSource,
  Map as MaplibreMap,
  setWorkerUrl,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// Same fix as `applicant/wizard/ContourMapPreview.tsx`, duplicated rather
// than imported (cross-track file-sharing risk, see this module's own
// header): MapLibre 6 builds its worker's URL at runtime from
// `import.meta.url`, which a bundler cannot see, so without `?worker&url`
// Vite never emits the file — the deployed build 404s behind the SPA
// fallback and every source silently never finishes loading, no console
// error. Do not remove the `?worker&url` suffix.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { TerraDraw } from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import { createDrawModes } from './drawModes';

setWorkerUrl(workerUrl);

/** Same national bounds and zoom limits as `ContourMapPreview.tsx` — every
 * forest-fund parcel this system will ever draw sits inside them. Duplicated
 * rather than imported for the same cross-track reason as the worker fix
 * above. */
const UZBEKISTAN_BOUNDS: [[number, number], [number, number]] = [
  [55.6, 36.9],
  [73.4, 45.8],
];
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
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#EAF3EC' } },
    { id: 'osm', type: 'raster', source: 'osm' },
  ],
};

const EMPTY_COLLECTION: FeatureCollection = { type: 'FeatureCollection', features: [] };

export type DrawGeometryType = 'Polygon' | 'LineString' | 'Point';

export interface DrawMapProps {
  /** What a completed draw produces. */
  geometryType: DrawGeometryType;
  /** Armed = terra-draw is live and waiting for the operator to draw; not
   * armed = the map is a plain viewer (`draw.stop()`). Editing a version's
   * geometry always redraws it from scratch as a NEW version (`VersionPatch`
   * carries no `geom` — a changed shape is a new version by design), so this
   * component never offers in-place vertex dragging of an existing feature:
   * only ever "view" and "draw one fresh". */
  active: boolean;
  /** A read-only guide, drawn dashed and never interactive — the shape being
   * replaced (an edit) or cut (a split), so the operator can see what they
   * are re-drawing or slicing without it being part of the new geometry. */
  referenceGeometry?: Geometry | null;
  /** Read-only context, e.g. every published contour in the viewport. */
  browsableFeatures?: FeatureCollection;
  onViewportChange?: (bbox: string) => void;
  /** Fired once, when the operator finishes one shape (a polygon's closing
   * click, a line's double-click, a point's single click). The drawn feature
   * is then cleared from terra-draw's own store — this component never
   * accumulates more than one in-progress shape. */
  onDrawFinish: (geometry: Geometry) => void;
  height?: string;
}

/**
 * The shared map surface for F1 (draw a contour version, draw a split's cut
 * line) and F4 (draw a layer feature) — MapLibre GL for the basemap and
 * context layers, Terra Draw (decision #60.1) for the one interactive shape.
 * Extends the pattern `applicant/wizard/ContourMapPreview.tsx` established
 * (basemap, national bounds, worker fix, `pseudo` fullscreen) rather than
 * importing it — see this file's own header on why it is a fresh component,
 * not a shared one.
 */
export function DrawMap({
  geometryType,
  active,
  referenceGeometry,
  browsableFeatures,
  onViewportChange,
  onDrawFinish,
  height = '420px',
}: DrawMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const onDrawFinishRef = useRef(onDrawFinish);
  const onViewportChangeRef = useRef(onViewportChange);
  useEffect(() => {
    onDrawFinishRef.current = onDrawFinish;
    onViewportChangeRef.current = onViewportChange;
  }, [onDrawFinish, onViewportChange]);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MaplibreMap({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: [69.2401, 41.2995],
      zoom: 7,
      maxBounds: UZBEKISTAN_BOUNDS,
      minZoom: MIN_ZOOM,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    if (shellRef.current) {
      // `pseudo: true` — CSS expansion, not the native Fullscreen API, which
      // is refused ("Permissions check failed") wherever the page is framed
      // without `allow="fullscreen"`. Same trap `ContourMapPreview.tsx`
      // documents; the fix carries over unchanged.
      map.addControl(
        new FullscreenControl({ container: shellRef.current, pseudo: true }),
        'top-right',
      );
    }

    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map }),
      modes: createDrawModes(),
    });
    drawRef.current = draw;

    draw.on('finish', (id) => {
      const feature = draw.getSnapshotFeature(id);
      if (feature) onDrawFinishRef.current(feature.geometry as Geometry);
      // One shape at a time — clear the store so the next draw starts clean
      // rather than accumulating every past attempt on the map.
      draw.clear();
    });

    const readViewport = () => {
      const b = map.getBounds();
      onViewportChangeRef.current?.(
        [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => n.toFixed(5)).join(','),
      );
    };

    map.once('load', () => {
      map.addSource('browsable', { type: 'geojson', data: EMPTY_COLLECTION });
      map.addLayer({
        id: 'browsable-fill',
        type: 'fill',
        source: 'browsable',
        paint: { 'fill-color': '#2E7D4F', 'fill-opacity': 0.12 },
      });
      map.addLayer({
        id: 'browsable-line',
        type: 'line',
        source: 'browsable',
        paint: { 'line-color': '#123522', 'line-width': 1 },
      });

      map.addSource('reference', { type: 'geojson', data: EMPTY_COLLECTION });
      map.addLayer({
        id: 'reference-fill',
        type: 'fill',
        source: 'reference',
        paint: { 'fill-color': '#0369A1', 'fill-opacity': 0.08 },
      });
      map.addLayer({
        id: 'reference-line',
        type: 'line',
        source: 'reference',
        paint: { 'line-color': '#0369A1', 'line-width': 2, 'line-dasharray': [2, 2] },
      });

      draw.start();
      readViewport();
      setMapReady(true);
    });
    map.on('moveend', readViewport);

    return () => {
      if (draw.enabled) draw.stop();
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
      setMapReady(false);
    };
    // Mounted once; every prop that can change afterwards (mode, geometries)
    // is applied by its own effect below, reading the live refs.
  }, []);

  useEffect(() => {
    const draw = drawRef.current;
    if (!draw || !mapReady) return;
    if (active) {
      const modeName =
        geometryType === 'Polygon' ? 'polygon' : geometryType === 'LineString' ? 'linestring' : 'point';
      draw.setMode(modeName);
    } else {
      draw.clear();
      draw.setMode('render');
    }
  }, [active, geometryType, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const source = map.getSource('browsable') as GeoJSONSource | undefined;
    source?.setData(browsableFeatures ?? EMPTY_COLLECTION);
  }, [browsableFeatures, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const source = map.getSource('reference') as GeoJSONSource | undefined;
    const data: FeatureCollection = referenceGeometry
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: referenceGeometry } as Feature] }
      : EMPTY_COLLECTION;
    source?.setData(data);
  }, [referenceGeometry, mapReady]);

  return (
    <div ref={shellRef} className="relative bg-white border border-[#E4E7EA] rounded-2xl overflow-hidden">
      <div ref={containerRef} style={{ height }} data-testid="draw-map-canvas" />
    </div>
  );
}
