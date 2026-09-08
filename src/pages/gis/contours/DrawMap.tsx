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
import { computeGeometryBounds } from './geometryBounds';
import { useT } from '../../../i18n/useT';

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

/** The same two basemaps `ContourMapPreview.tsx` offers an applicant, carried
 * over to the operator's map (Oybek, 2026-09-08): the scheme answers "where
 * is this parcel", the imagery answers "what is actually on the ground" —
 * which is the question when an operator draws a contour's boundary or cuts
 * one in two, because the boundary they are drawing usually follows something
 * visible (a forest edge, a river, a track) and nothing on the OSM scheme
 * shows it.
 *
 * Neither provider is a production answer — OSM's tile policy covers a dev
 * server and a demo, not public traffic, and Esri's imagery is served for use
 * inside its own platform. Both REQUIRE the credit the attribution control
 * shows. Swapping the `tiles` arrays is the whole migration to our own tile
 * server, which is why they are declared here and nowhere else in this file. */
const BASEMAPS = [
  { id: 'osm', labelKey: 'gis.map.basemapScheme' },
  { id: 'satellite', labelKey: 'gis.map.basemapSatellite' },
] as const;

type BasemapId = (typeof BASEMAPS)[number]['id'];

/** Every fill on this map has to do opposite jobs on the two basemaps. Over
 * the flat scheme the fill IS the parcel — nothing else marks it. Over
 * imagery it hides the very thing the imagery was switched on to show, so it
 * thins to a tint and the outlines carry the shape. */
const BROWSABLE_FILL_OPACITY: Record<BasemapId, number> = { osm: 0.12, satellite: 0.08 };
const REFERENCE_FILL_OPACITY: Record<BasemapId, number> = { osm: 0.08, satellite: 0.05 };
const SELECTED_FILL_OPACITY: Record<BasemapId, number> = { osm: 0.28, satellite: 0.16 };

/** White halos under the two thin outlines, shown ONLY over imagery. A dark
 * line over dark-green vegetation is the one combination satellite mode is
 * guaranteed to produce, and a parcel whose edge cannot be seen is the whole
 * feature failing. The selected contour already carries its own casing on
 * both basemaps, so it is not in this list. */
const SATELLITE_ONLY_LAYERS = ['browsable-casing', 'reference-casing'] as const;

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
      // error. `maxzoom` caps requests at the deepest level the imagery
      // actually has, so a closer zoom upscales the last real tile instead of
      // asking for one that does not exist.
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
  /** The contour picked in the list, while merely browsing (not editing or
   * splitting — those already get their own guide via `referenceGeometry`).
   * Drawn in its own solid, high-contrast style so it stands out among
   * `browsableFeatures`'s many quieter parcels, and the map fits itself to
   * its bounds whenever this prop changes to a new geometry. `null`/`undefined`
   * clears both the highlight and any pending fit — it does NOT recentre the
   * map, so clearing a selection leaves the operator wherever they were
   * looking, just without a stale highlight left behind. */
  selectedGeometry?: Geometry | null;
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
  selectedGeometry,
  onViewportChange,
  onDrawFinish,
  height = '420px',
}: DrawMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [basemap, setBasemap] = useState<BasemapId>('osm');
  const t = useT();
  const onDrawFinishRef = useRef(onDrawFinish);
  const onViewportChangeRef = useRef(onViewportChange);
  const heightRef = useRef(height);
  useEffect(() => {
    onDrawFinishRef.current = onDrawFinish;
    onViewportChangeRef.current = onViewportChange;
    heightRef.current = height;
  }, [onDrawFinish, onViewportChange, height]);

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
    // Subscriptions from the fullscreen listeners below, torn down on
    // unmount alongside everything else this effect owns.
    const fullscreenSubscriptions: { unsubscribe: () => void }[] = [];
    if (shellRef.current) {
      // `pseudo: true` — CSS expansion, not the native Fullscreen API, which
      // is refused ("Permissions check failed") wherever the page is framed
      // without `allow="fullscreen"`. Same trap `ContourMapPreview.tsx`
      // documents; the fix carries over unchanged.
      const fullscreenControl = new FullscreenControl({ container: shellRef.current, pseudo: true });
      map.addControl(fullscreenControl, 'top-right');
      // `.maplibregl-pseudo-fullscreen` (added to `shellRef`, the control's
      // own `container`) makes the SHELL fill the viewport, but this
      // component's map container carries its own inline `height` (the
      // `height` prop, `'420px'` by default) — CSS never touches that, so
      // without this the shell grows to the window's full size while the
      // map inside stays exactly as tall as the prop said, widening but
      // never growing taller. `fullscreenstart`/`fullscreenend` fire
      // synchronously from `_togglePseudoFullScreen`, BEFORE it calls
      // `map.resize()` — so flipping the container's own height here always
      // lands before MapLibre re-measures it, with no extra resize step of
      // our own and no viewport number hard-coded on either side.
      fullscreenSubscriptions.push(
        fullscreenControl.on('fullscreenstart', () => {
          if (containerRef.current) containerRef.current.style.height = '100%';
        }),
        fullscreenControl.on('fullscreenend', () => {
          if (containerRef.current) containerRef.current.style.height = heightRef.current;
        }),
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
        id: 'browsable-casing',
        type: 'line',
        source: 'browsable',
        layout: { visibility: 'none' },
        paint: { 'line-color': '#FFFFFF', 'line-width': 3, 'line-opacity': 0.85 },
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
        id: 'reference-casing',
        type: 'line',
        source: 'reference',
        layout: { visibility: 'none' },
        // Same dash pattern as the line above it, one step wider: the halo
        // has to follow the dashes, or the guide reads as a solid white line
        // with a blue pattern painted on it.
        paint: {
          'line-color': '#FFFFFF',
          'line-width': 4,
          'line-opacity': 0.85,
          'line-dasharray': [1, 1],
        },
      });
      map.addLayer({
        id: 'reference-line',
        type: 'line',
        source: 'reference',
        paint: { 'line-color': '#0369A1', 'line-width': 2, 'line-dasharray': [2, 2] },
      });

      // The list selection, drawn ON TOP of `browsable` and in a deliberately
      // different register from `reference`'s muted dashed guide: this is not
      // "here is what you are replacing", it is "this is the one you picked"
      // — solid fill, a white casing so the outline reads against
      // `browsable-fill`'s own green, and an amber line color that appears
      // nowhere else on this map.
      map.addSource('selected', { type: 'geojson', data: EMPTY_COLLECTION });
      map.addLayer({
        id: 'selected-fill',
        type: 'fill',
        source: 'selected',
        paint: { 'fill-color': '#F59E0B', 'fill-opacity': 0.28 },
      });
      map.addLayer({
        id: 'selected-casing',
        type: 'line',
        source: 'selected',
        paint: { 'line-color': '#FFFFFF', 'line-width': 5, 'line-opacity': 0.9 },
      });
      map.addLayer({
        id: 'selected-line',
        type: 'line',
        source: 'selected',
        paint: { 'line-color': '#B45309', 'line-width': 2.5 },
      });

      draw.start();
      readViewport();
      setMapReady(true);
    });
    map.on('moveend', readViewport);

    return () => {
      for (const subscription of fullscreenSubscriptions) subscription.unsubscribe();
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
    const map = mapRef.current;
    // Every layer touched below is created in the `load` handler that sets
    // `mapReady`, so past this guard they all exist — including when the
    // operator switches basemap before the map has finished loading, because
    // `mapReady` is itself a dependency and re-runs this effect afterwards.
    if (!map || !mapReady) return;
    for (const { id } of BASEMAPS) {
      map.setLayoutProperty(id, 'visibility', id === basemap ? 'visible' : 'none');
    }
    for (const id of SATELLITE_ONLY_LAYERS) {
      map.setLayoutProperty(id, 'visibility', basemap === 'satellite' ? 'visible' : 'none');
    }
    map.setPaintProperty('browsable-fill', 'fill-opacity', BROWSABLE_FILL_OPACITY[basemap]);
    map.setPaintProperty('reference-fill', 'fill-opacity', REFERENCE_FILL_OPACITY[basemap]);
    map.setPaintProperty('selected-fill', 'fill-opacity', SELECTED_FILL_OPACITY[basemap]);
  }, [basemap, mapReady]);

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const source = map.getSource('selected') as GeoJSONSource | undefined;
    if (!selectedGeometry) {
      // Clears the highlight and leaves the viewport exactly where it was —
      // no fit here, so deselecting never yanks the map back out to wherever
      // it happened to be before something was picked.
      source?.setData(EMPTY_COLLECTION);
      return;
    }
    source?.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: selectedGeometry } as Feature] });
    const bounds = computeGeometryBounds(selectedGeometry);
    if (bounds) {
      // `maxZoom` is a floor under how far a degenerate (single-point or
      // near-zero-area) geometry could zoom in, NOT a fixed zoom for the
      // normal case — a real parcel's zoom still comes entirely out of its
      // own bounds plus this padding.
      map.fitBounds(bounds, { padding: 48, maxZoom: 17, duration: 300 });
    }
  }, [selectedGeometry, mapReady]);

  return (
    <div ref={shellRef} className="relative bg-white border border-[#E4E7EA] rounded-2xl overflow-hidden">
      <div ref={containerRef} style={{ height }} data-testid="draw-map-canvas" />
      {/* Top-LEFT: the fullscreen control sits top-right, and the attribution
          — the one thing on this map that may not be covered — bottom-right.
          A child of the shell, not of the map container, so it survives the
          pseudo-fullscreen expansion the shell (not the canvas) undergoes. */}
      <div className="absolute top-2 left-2 z-10 flex rounded-lg overflow-hidden border border-[#E4E7EA] shadow-xs bg-white">
        {BASEMAPS.map(({ id, labelKey }) => (
          <button
            key={id}
            type="button"
            aria-pressed={basemap === id}
            data-testid={`basemap-${id}`}
            onClick={() => setBasemap(id)}
            className={`px-3 py-1 text-[11px] font-semibold cursor-pointer transition-colors ${
              basemap === id ? 'bg-[#2E7D4F] text-white' : 'text-[#5A646D] hover:bg-[#F0F7F1]'
            }`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
