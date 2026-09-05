import area from '@turf/area';
import { polygon as turfPolygon } from '@turf/helpers';
import type { LineString } from 'geojson';
import { splitPolygonWithLine } from './splitContour';

/** ~1km square near the equator, where a degree is close enough to 111km
 * that the numbers below are easy to reason about. */
const SQUARE = turfPolygon([
  [
    [0, 0],
    [0.01, 0],
    [0.01, 0.01],
    [0, 0.01],
    [0, 0],
  ],
]).geometry;

function verticalCut(x: number): LineString {
  return { type: 'LineString', coordinates: [[x, -0.01], [x, 0.02]] };
}

test('a line straight through the middle produces two pieces of roughly equal area', () => {
  const result = splitPolygonWithLine(SQUARE, verticalCut(0.005));
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.pieces).toHaveLength(2);
  const [a, b] = result.pieces.map((p) => area(turfPolygon(p.coordinates)));
  const total = a + b;
  // Neither half swallows the whole square, and together they roughly
  // reconstruct it (the blade itself removes a sliver, so "roughly", not
  // exactly).
  expect(a).toBeGreaterThan(total * 0.4);
  expect(b).toBeGreaterThan(total * 0.4);
});

test('an off-centre cut produces two pieces of different area', () => {
  const result = splitPolygonWithLine(SQUARE, verticalCut(0.002));
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const [a, b] = result.pieces.map((p) => area(turfPolygon(p.coordinates)));
  expect(Math.min(a, b)).toBeLessThan(Math.max(a, b) * 0.6);
});

test('a line that does not cross the polygon at all is refused', () => {
  const missLine: LineString = {
    type: 'LineString',
    coordinates: [
      [1, 1],
      [2, 2],
    ],
  };
  const result = splitPolygonWithLine(SQUARE, missLine);
  expect(result).toEqual({ ok: false, reason: 'line_does_not_cross' });
});

test('a line entirely inside the polygon, touching no edge, is refused rather than treated as a cut', () => {
  // Never reaches the boundary on either end, so subtracting its buffer only
  // notches the polygon — it stays one connected piece.
  const interiorLine: LineString = {
    type: 'LineString',
    coordinates: [
      [0.003, 0.005],
      [0.007, 0.005],
    ],
  };
  const result = splitPolygonWithLine(SQUARE, interiorLine);
  expect(result).toEqual({ ok: false, reason: 'line_does_not_cross' });
});

test('a line crossing the polygon more than once is refused as the wrong shape of cut', () => {
  // Two horizontal cuts (a Z shape running outside the square between them)
  // divide the square into three bands, not two pieces.
  const zigzag: LineString = {
    type: 'LineString',
    coordinates: [
      [-0.01, 0.003],
      [0.02, 0.003],
      [0.02, 0.007],
      [-0.01, 0.007],
    ],
  };
  const result = splitPolygonWithLine(SQUARE, zigzag);
  expect(result).toEqual({ ok: false, reason: 'unexpected_piece_count' });
});

test('a degenerate single-point line is refused before any geometry math runs', () => {
  const point: LineString = { type: 'LineString', coordinates: [[0.005, 0.005]] };
  const result = splitPolygonWithLine(SQUARE, point);
  expect(result).toEqual({ ok: false, reason: 'line_too_short' });
});
