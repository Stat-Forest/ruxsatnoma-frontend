/**
 * T2 (2026-09-10 demo review, item 3): "full screen is not a degraded map".
 * Before this, the map's own `FullscreenControl` always expanded its OWN
 * shell — the map canvas alone — so entering full screen from inside
 * `ContourPicker` left the leshoz filter, the search box and the list
 * behind on the page underneath. This file pins the mechanism that fixes
 * it: `fullscreenTarget` lets a caller hand this component an ANCESTOR
 * element to expand instead of the component's own div, with the button
 * still rendered on the map itself.
 *
 * `maplibre-gl` is mocked wholesale — jsdom has no WebGL context for the
 * real library to draw into (the same reason `ContourPicker.test.tsx` mocks
 * this component out entirely rather than exercising it). The fake `Map`
 * never touches the DOM or a canvas; only `FullscreenControl`'s constructor
 * argument and its `fullscreenstart`/`fullscreenend` events are real
 * observations about THIS component's own code.
 */
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRef, type ReactNode } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';

interface FakeFullscreenControl {
  container: HTMLElement;
  fire: (event: 'fullscreenstart' | 'fullscreenend') => void;
}

const createdControls: FakeFullscreenControl[] = [];

vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => ({ default: 'worker-url' }));

vi.mock('maplibre-gl', () => {
  class MapMock {
    constructor() {}
    addControl() {}
    // Never fires `load` — none of these tests need the map layers set up,
    // only the fullscreen wiring done synchronously in the mount effect.
    once() {}
    on() {}
    off() {}
    getZoom() {
      return 12;
    }
    getBounds() {
      return { getWest: () => 0, getSouth: () => 0, getEast: () => 0, getNorth: () => 0 };
    }
    getCanvas() {
      return { style: {} };
    }
    getSource() {
      return undefined;
    }
    getLayer() {
      return undefined;
    }
    addSource() {}
    addLayer() {}
    removeLayer() {}
    removeSource() {}
    setLayoutProperty() {}
    setPaintProperty() {}
    fitBounds() {}
    remove() {}
  }

  class FullscreenControlMock implements FakeFullscreenControl {
    container: HTMLElement;
    private handlers: Record<string, (() => void)[]> = {};
    constructor(opts: { container: HTMLElement; pseudo?: boolean }) {
      this.container = opts.container;
      createdControls.push(this);
    }
    on(event: string, cb: () => void) {
      (this.handlers[event] ??= []).push(cb);
      return { unsubscribe: () => {} };
    }
    fire(event: 'fullscreenstart' | 'fullscreenend') {
      for (const cb of this.handlers[event] ?? []) cb();
    }
  }

  class LngLatBoundsMock {
    extend() {
      return this;
    }
  }

  return {
    Map: MapMock,
    FullscreenControl: FullscreenControlMock,
    GeoJSONSource: class {},
    LngLatBounds: LngLatBoundsMock,
    setWorkerUrl: vi.fn(),
  };
});

// Imported AFTER the mocks above so the module under test picks them up.
const { ContourMapPreview } = await import('./ContourMapPreview');

afterEach(() => {
  createdControls.length = 0;
});

function withQueryClient(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('ContourMapPreview fullscreen target', () => {
  test('defaults to its own shell when no fullscreenTarget is given', () => {
    const { container } = render(withQueryClient(<ContourMapPreview geometry={null} />));

    expect(createdControls).toHaveLength(1);
    const ownShell = container.querySelector('.map-shell');
    expect(ownShell).not.toBeNull();
    expect(createdControls[0].container).toBe(ownShell);
  });

  test('expands the CALLER-supplied ancestor, not its own shell, when fullscreenTarget is given', () => {
    const outerRef = createRef<HTMLDivElement>();
    render(
      withQueryClient(
        <div ref={outerRef} data-testid="picker-shell">
          <ContourMapPreview geometry={null} fullscreenTarget={outerRef} />
        </div>,
      ),
    );

    expect(createdControls).toHaveLength(1);
    // The whole point of T2 item 3: the button still lives on the map (added
    // via `map.addControl`, unaffected by this), but the element that goes
    // fullscreen is the ANCESTOR the caller named — the one that also holds
    // the leshoz filter, the search box and the list in `ContourPicker`.
    expect(createdControls[0].container).toBe(outerRef.current);
  });

  test('mirrors fullscreenstart/fullscreenend back through onFullscreenChange', () => {
    const outerRef = createRef<HTMLDivElement>();
    const onFullscreenChange = vi.fn();
    render(
      withQueryClient(
        <div ref={outerRef}>
          <ContourMapPreview geometry={null} fullscreenTarget={outerRef} onFullscreenChange={onFullscreenChange} />
        </div>,
      ),
    );

    createdControls[0].fire('fullscreenstart');
    expect(onFullscreenChange).toHaveBeenCalledWith(true);

    createdControls[0].fire('fullscreenend');
    expect(onFullscreenChange).toHaveBeenCalledWith(false);
  });
});

/**
 * T12 (decision #178) — a contour is selected but carries no geometry
 * (its leshoz has no delivered GIS layer, or this particular version was
 * filed by requisites alone even under a leshoz that otherwise has one).
 * Before this the map rendered its basemap with nothing drawn on it and no
 * explanation — indistinguishable from a broken fetch.
 */
describe('ContourMapPreview with no geometry for the current pick', () => {
  test('shows a deliberate notice instead of a blank map when something is selected but has no geometry', () => {
    const { getByText, queryByText } = render(
      withQueryClient(<ContourMapPreview geometry={null} selectedId="c-1" />),
    );
    expect(
      getByText('Ushbu kontur uchun GIS xaritasi mavjud emas — u rekvizitlar boʻyicha roʻyxatga olingan.'),
    ).toBeInTheDocument();
    // The "N ta uchastka" viewport counter is for browsing, not for a pick —
    // both must never show at once.
    expect(queryByText(/ta uchastka/)).not.toBeInTheDocument();
  });

  test('shows no such notice once the pick actually has a geometry', () => {
    const { queryByText } = render(
      withQueryClient(
        <ContourMapPreview geometry={{ type: 'Polygon', coordinates: [] }} selectedId="c-1" />,
      ),
    );
    expect(
      queryByText('Ushbu kontur uchun GIS xaritasi mavjud emas — u rekvizitlar boʻyicha roʻyxatga olingan.'),
    ).not.toBeInTheDocument();
  });

  test('shows no such notice while nothing is selected at all', () => {
    const { queryByText } = render(withQueryClient(<ContourMapPreview geometry={null} />));
    expect(
      queryByText('Ushbu kontur uchun GIS xaritasi mavjud emas — u rekvizitlar boʻyicha roʻyxatga olingan.'),
    ).not.toBeInTheDocument();
  });
});
