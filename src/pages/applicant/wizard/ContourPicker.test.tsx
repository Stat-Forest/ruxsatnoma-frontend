/**
 * F5 (`docs/plans/07.3-findings.md`) — a contour whose issued permits exceed
 * its own area reports `Boʻsh qism 0 ga` next to a `Band qism` that is
 * visibly larger than `Umumiy maydon`, with nothing on screen explaining why
 * — even though the backend already carries an explicit `over_allocated`
 * flag beside the floored `s_available_ha` for exactly this case.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ContourPicker } from './ContourPicker';

// The map draws through maplibre-gl, which needs a real canvas/WebGL context
// jsdom does not provide — mocked the same way `ApplicationWizardPage.test.tsx`
// mocks `ContourPicker` itself: this test owns the list/card panel, not the map.
vi.mock('./ContourMapPreview', () => ({ ContourMapPreview: () => null }));

function contourListItem(over: Record<string, unknown> = {}) {
  return {
    id: 'c1000000-0000-4000-8000-000000000001',
    number: '10517қ',
    organization_id: 'org00000-0000-4000-8000-000000000001',
    area_ha: '65.0694',
    occupied_ha: '130.1388',
    s_available_ha: '0',
    over_allocated: true,
    occupancy_source: 'permits',
    ...over,
  };
}

const server = setupServer(
  http.get('*/api/v1/refs/organizations', () => HttpResponse.json({ items: [], total: 0 })),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPicker() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ContourPicker value={null} onChange={() => {}} />
    </QueryClientProvider>,
  );
}

test('an over-allocated contour explains why the free area cannot be negative', async () => {
  const user = userEvent.setup();
  server.use(
    http.get('*/api/v1/gis/contours', () =>
      HttpResponse.json({ items: [contourListItem()], total: 1, page: 1, page_size: 100 }),
    ),
    http.get('*/api/v1/gis/contours/:id', () =>
      HttpResponse.json({
        ...contourListItem(),
        kind: 'contour',
        version_id: 'v1000000-0000-4000-8000-000000000001',
        geometry: { type: 'Polygon', coordinates: [] },
      }),
    ),
  );

  renderPicker();
  await user.click(await screen.findByText('10517қ'));

  await screen.findByText(/umumiy maydonidan koʻproq ruxsatnoma berilgan/i);
  expect(screen.getByText('0 ga')).toBeInTheDocument();
});

test('a normal, not-over-allocated contour shows no over-allocation warning', async () => {
  const user = userEvent.setup();
  server.use(
    http.get('*/api/v1/gis/contours', () =>
      HttpResponse.json({
        items: [contourListItem({ occupied_ha: '10', s_available_ha: '55.0694', over_allocated: false })],
        total: 1,
        page: 1,
        page_size: 100,
      }),
    ),
    http.get('*/api/v1/gis/contours/:id', () =>
      HttpResponse.json({
        ...contourListItem({ occupied_ha: '10', s_available_ha: '55.0694', over_allocated: false }),
        kind: 'contour',
        version_id: 'v1000000-0000-4000-8000-000000000001',
        geometry: { type: 'Polygon', coordinates: [] },
      }),
    ),
  );

  renderPicker();
  await user.click(await screen.findByText('10517қ'));

  await screen.findByText('55.0694 ga');
  expect(screen.queryByText(/umumiy maydonidan koʻproq/i)).not.toBeInTheDocument();
});
