#!/usr/bin/env bash
# Guards ONE silent failure mode, found on the dev server on 2026-09-05.
#
# MapLibre 6 runs geometry tiling in a separate worker file and builds its URL
# at run time. A bundler cannot see a path assembled that way, so if the app
# ever stops going through `?worker&url` + `setWorkerUrl`, Vite quietly emits
# no worker at all. The deployed page then requests a file nginx answers with
# the SPA fallback (index.html), the worker never starts, and — this is the
# part that makes a check worth more than a comment — THERE IS NO CONSOLE
# ERROR. Every GeoJSON source just hangs, `map.isStyleLoaded()` never turns
# true, and the map renders an empty rectangle with the geometry already in
# memory. Nothing in the test suite can see it: jsdom has no WebGL, no worker
# and no bundle.
#
# Run against a finished `dist/`.
set -euo pipefail

dist="${1:-dist}"

worker=$(find "$dist/assets" -name 'maplibre-gl-worker*.js' -print -quit 2>/dev/null || true)
if [ -z "$worker" ]; then
  echo "FAIL: no MapLibre worker asset in $dist/assets." >&2
  echo "      The contour map will render nothing, silently." >&2
  echo "      Expected ContourMapPreview.tsx to import" >&2
  echo "      'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url' and pass it to setWorkerUrl()." >&2
  exit 1
fi

# Emitted is not enough: it must also be referenced, or `setWorkerUrl` is gone
# and MapLibre is back to guessing a path of its own.
name=$(basename "$worker")
if ! grep -rqF "$name" "$dist/assets"/*.js --exclude="$name"; then
  echo "FAIL: $name is emitted but no bundle references it." >&2
  echo "      setWorkerUrl() is probably no longer called, so MapLibre will" >&2
  echo "      fall back to a runtime-built URL that 404s in production." >&2
  exit 1
fi

echo "OK: $name is emitted and referenced."
