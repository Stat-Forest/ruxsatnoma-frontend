import { describe, expect, test } from 'vitest';
import type { Geometry } from 'geojson';
import { computeGeometryBounds } from './geometryBounds';

describe('computeGeometryBounds', () => {
  test('a Polygon collapses to the bounding box of its ring', () => {
    const polygon: Geometry = {
      type: 'Polygon',
      coordinates: [
        [
          [69.1, 41.2],
          [69.3, 41.2],
          [69.3, 41.4],
          [69.1, 41.4],
          [69.1, 41.2],
        ],
      ],
    };
    expect(computeGeometryBounds(polygon)).toEqual([
      [69.1, 41.2],
      [69.3, 41.4],
    ]);
  });

  test('a MultiPolygon spans across every one of its polygons', () => {
    const multi: Geometry = {
      type: 'MultiPolygon',
      coordinates: [
        [[[69.0, 41.0], [69.1, 41.0], [69.1, 41.1], [69.0, 41.1], [69.0, 41.0]]],
        [[[70.0, 42.0], [70.2, 42.0], [70.2, 42.2], [70.0, 42.2], [70.0, 42.0]]],
      ],
    };
    expect(computeGeometryBounds(multi)).toEqual([
      [69.0, 41.0],
      [70.2, 42.2],
    ]);
  });

  test('a GeometryCollection combines the bounds of every member', () => {
    const collection: Geometry = {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Point', coordinates: [69.0, 41.0] },
        { type: 'Point', coordinates: [70.0, 42.0] },
      ],
    };
    expect(computeGeometryBounds(collection)).toEqual([
      [69.0, 41.0],
      [70.0, 42.0],
    ]);
  });

  test('a single point collapses to a degenerate box (fitBounds still accepts it)', () => {
    const point: Geometry = { type: 'Point', coordinates: [69.24, 41.3] };
    expect(computeGeometryBounds(point)).toEqual([
      [69.24, 41.3],
      [69.24, 41.3],
    ]);
  });

  test('null, undefined and an empty-coordinates geometry all yield null', () => {
    expect(computeGeometryBounds(null)).toBeNull();
    expect(computeGeometryBounds(undefined)).toBeNull();
    expect(computeGeometryBounds({ type: 'Polygon', coordinates: [] })).toBeNull();
    expect(computeGeometryBounds({ type: 'GeometryCollection', geometries: [] })).toBeNull();
  });
});
