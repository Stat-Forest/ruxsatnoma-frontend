/**
 * "Split" (F1) has no backend endpoint — `gis/router.py` has no `/split`
 * route at all. It is composed client-side, from primitives that DO exist
 * (plan `06.5-gis-screens.md` ruling 3): the operator draws a line across the
 * contour's current geometry, this module cuts it into two polygon pieces,
 * and the caller then creates two brand-new `kind: subcontour` contours
 * (`POST /gis/contours`, `parent_id` = the original) each with its own first
 * version carrying one piece — never a rewrite of the original.
 *
 * The cut itself is the standard turf technique for slicing a polygon with a
 * line, since the turf toolkit ships no dedicated "split polygon by line"
 * function: buffer the line into a very thin "blade" polygon, then subtract
 * it from the target with `@turf/difference`. When the line fully crosses the
 * polygon this leaves exactly two disjoint pieces; anything else (a line that
 * only grazes an edge, stops short, or a polygon already invalid) is reported
 * as a named failure rather than guessed at.
 */
import buffer from '@turf/buffer';
import difference from '@turf/difference';
import flatten from '@turf/flatten';
import { featureCollection, lineString, polygon as turfPolygon } from '@turf/helpers';
import type { LineString, MultiPolygon, Polygon, Position } from 'geojson';

export type SplitFailureReason =
  | 'line_too_short'
  | 'line_does_not_cross'
  | 'unexpected_piece_count'
  | 'geometry_error';

export interface SplitFailure {
  ok: false;
  reason: SplitFailureReason;
}

export interface SplitSuccess {
  ok: true;
  pieces: [Polygon, Polygon];
}

/** Blade width in meters — only needs to be small relative to any real
 * contour (surveyed to metre accuracy at best per `accuracy_m`); its only
 * job is giving `difference` a polygon with interior area to subtract, since
 * an actual `LineString` has none. */
const DEFAULT_BLADE_WIDTH_M = 0.2;

function coordinateCount(line: LineString): number {
  return line.coordinates.length;
}

export function splitPolygonWithLine(
  polygon: Polygon | MultiPolygon,
  line: LineString,
  bladeWidthMeters: number = DEFAULT_BLADE_WIDTH_M,
): SplitSuccess | SplitFailure {
  if (coordinateCount(line) < 2) {
    return { ok: false, reason: 'line_too_short' };
  }

  let bladeFeature;
  try {
    bladeFeature = buffer(lineString(line.coordinates), bladeWidthMeters, { units: 'meters' });
  } catch {
    return { ok: false, reason: 'geometry_error' };
  }
  if (!bladeFeature) return { ok: false, reason: 'geometry_error' };

  const targetFeature =
    polygon.type === 'Polygon'
      ? turfPolygon(polygon.coordinates as Position[][])
      : { type: 'Feature' as const, properties: {}, geometry: polygon };

  let result;
  try {
    result = difference(featureCollection([targetFeature, bladeFeature]));
  } catch {
    return { ok: false, reason: 'geometry_error' };
  }
  // `difference` returns the FIRST feature unchanged (never `null`) whenever
  // the blade does not actually remove any area from it — a line that misses
  // the polygon entirely, or one that stays inside it without ever reaching
  // the boundary, both land here as a single, still-whole piece.
  if (!result) return { ok: false, reason: 'line_does_not_cross' };

  const pieces = flatten(result.geometry).features.map((f) => f.geometry);
  if (pieces.length < 2) {
    // The line did not fully separate the polygon — it missed entirely, or
    // it touched only one edge, or it stayed interior. Every one of those is
    // the same instruction back to the operator: draw a line that crosses
    // clean through both sides.
    return { ok: false, reason: 'line_does_not_cross' };
  }
  if (pieces.length > 2) {
    // The blade crossed the polygon more than once — a valid line
    // geometrically, but not the "cut into two" operation this screen
    // offers; the operator redraws a single, straighter crossing instead.
    return { ok: false, reason: 'unexpected_piece_count' };
  }
  return { ok: true, pieces: [pieces[0] as Polygon, pieces[1] as Polygon] };
}
