import { describe, expect, it } from 'vitest';
import { createDrawModes } from './drawModes';

// `DrawMap` itself renders MapLibre and Terra Draw, which do not run in
// jsdom (see the component's own header), so it has no render test. But the
// bug this guards against — terra-draw 1.33's `TerraDrawRenderMode` throwing
// "Mode name is required for TerraDrawRenderMode" when constructed without
// an explicit `modeName` — is a plain constructor call with no map or DOM
// involved, so it is unit-testable directly.
describe('createDrawModes', () => {
  it('constructs every mode without throwing', () => {
    expect(() => createDrawModes()).not.toThrow();
  });

  it('registers a render mode named "render", matching the setMode idle switch', () => {
    const [renderMode] = createDrawModes();
    // `DrawMap` idles the map with `draw.setMode('render')`; `TerraDraw`
    // registers each mode under its own `.mode` property, so a mismatch
    // here would silently break the idle switch even though construction
    // succeeds.
    expect(renderMode.mode).toBe('render');
  });

  it('registers the polygon, linestring and point modes DrawMap switches to', () => {
    const modes = createDrawModes();
    expect(modes.map((m) => m.mode)).toEqual(['render', 'polygon', 'linestring', 'point']);
  });
});
