import {
  TerraDraw,
  TerraDrawLineStringMode,
  TerraDrawPointMode,
  TerraDrawPolygonMode,
  TerraDrawRenderMode,
} from 'terra-draw';

/**
 * The Terra Draw modes `DrawMap` registers — `render` first and with no
 * drawing behaviour of its own, the idle mode the map sits in whenever
 * `active` is false, so the map is a plain viewer without ever calling
 * `draw.stop()` (which detaches the adapter's own listeners entirely and
 * made re-arming a second draw unreliable across a mode switch).
 *
 * Pulled out of `DrawMap.tsx` into its own module (not a component, so
 * `react-refresh/only-export-components` disallows exporting it alongside
 * `DrawMap`) so a plain unit test can construct these without mounting
 * MapLibre (untestable in jsdom, see `DrawMap.tsx`'s own header): terra-draw
 * 1.33's `TerraDrawRenderMode` throws "Mode name is required for
 * TerraDrawRenderMode" at construction time without an explicit `modeName`
 * — the type declares it optional on the shared `BaseModeOptions`, but the
 * render mode's own constructor requires it. It is also the key this mode
 * registers under, so it must match the `'render'` name `DrawMap` switches
 * to when idling.
 */
export function createDrawModes(): ConstructorParameters<typeof TerraDraw>[0]['modes'] {
  return [
    new TerraDrawRenderMode({ modeName: 'render', styles: {} }),
    new TerraDrawPolygonMode(),
    new TerraDrawLineStringMode(),
    new TerraDrawPointMode(),
  ];
}
