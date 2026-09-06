import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { LineString, Polygon } from 'geojson';
import { I18nContext } from '../../../i18n/context';
import { SplitPanel } from './SplitPanel';

const t = (key: string) => key;

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** A ~1km square near the equator — same fixture shape `splitContour.test.ts`
 * uses, so a vertical cut through the middle reliably yields two pieces. */
const SQUARE: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [0.01, 0],
      [0.01, 0.01],
      [0, 0.01],
      [0, 0],
    ],
  ],
};
const CUT_LINE: LineString = { type: 'LineString', coordinates: [[0.005, -0.01], [0.005, 0.02]] };
const MISS_LINE: LineString = { type: 'LineString', coordinates: [[1, 1], [2, 2]] };

function renderPanel(line: LineString | null, overrides: Partial<Parameters<typeof SplitPanel>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t, setLanguage: async () => {} };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <SplitPanel
          contourId="parent-1"
          parentGeometry={SQUARE}
          line={line}
          parentNumber="K-042"
          onRetryLine={vi.fn()}
          onDone={vi.fn()}
          onCancel={vi.fn()}
          t={t}
          {...overrides}
        />
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

test('with no line yet, only the drawing hint is shown', () => {
  renderPanel(null);
  expect(screen.getByText('gis.contours.split.drawLineHint')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'gis.contours.split.confirm' })).not.toBeInTheDocument();
});

test('a line that misses the polygon is refused with a named reason, not silently accepted', () => {
  renderPanel(MISS_LINE);
  expect(screen.getByText('gis.contours.split.errors.doesNotCross')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'gis.contours.split.confirm' })).not.toBeInTheDocument();
});

test('a good cut issues exactly one request to the atomic split route, and the result names the parent plus both children', async () => {
  const splitRequests: { parentId: string; body: { piece_a: { number: string }; piece_b: { number: string } } }[] = [];
  server.use(
    http.post('*/api/v1/gis/contours/:parentId/split', async ({ request, params }) => {
      const body = (await request.json()) as {
        piece_a: { number: string; geom: unknown };
        piece_b: { number: string; geom: unknown };
        source: string;
      };
      splitRequests.push({ parentId: params.parentId as string, body });
      return HttpResponse.json(
        {
          parent_id: params.parentId,
          piece_a: {
            contour: {
              id: 'child-a',
              layer_id: 'layer-contours',
              organization_id: 'org-1',
              parent_id: params.parentId,
              kind: 'subcontour',
              number: body.piece_a.number,
              status: 'active',
            },
            version: {
              id: 'version-a',
              contour_id: 'child-a',
              version_no: 1,
              status: 'draft',
              source: body.source,
              area_ha: '2.5000',
              declared_area_ha: null,
              accuracy_m: null,
              survey_date: null,
              effective_from: null,
              approval_doc_id: null,
              approved_by: null,
              published_at: null,
            },
          },
          piece_b: {
            contour: {
              id: 'child-b',
              layer_id: 'layer-contours',
              organization_id: 'org-1',
              parent_id: params.parentId,
              kind: 'subcontour',
              number: body.piece_b.number,
              status: 'active',
            },
            version: {
              id: 'version-b',
              contour_id: 'child-b',
              version_no: 1,
              status: 'draft',
              source: body.source,
              area_ha: '2.5000',
              declared_area_ha: null,
              accuracy_m: null,
              survey_date: null,
              effective_from: null,
              approval_doc_id: null,
              approved_by: null,
              published_at: null,
            },
          },
        },
        { status: 201 },
      );
    }),
  );

  const ui = userEvent.setup();
  renderPanel(CUT_LINE);

  const numberAInput = screen.getByDisplayValue('K-042/1');
  const numberBInput = screen.getByDisplayValue('K-042/2');
  expect(numberAInput).toBeInTheDocument();
  expect(numberBInput).toBeInTheDocument();

  await ui.click(screen.getByRole('button', { name: 'gis.contours.split.confirm' }));

  await waitFor(() => expect(screen.getByTestId('split-result')).toBeInTheDocument());

  // Exactly ONE request to the atomic route — no separate createContour/
  // createVersion round trips composing the split on the client.
  expect(splitRequests).toHaveLength(1);
  expect(splitRequests[0].parentId).toBe('parent-1');
  expect(splitRequests[0].body.piece_a.number).toBe('K-042/1');
  expect(splitRequests[0].body.piece_b.number).toBe('K-042/2');

  // Post-split state names the parent AND both new children — a split
  // produces three contours, not two (decision #91: the parent stays).
  const result = screen.getByTestId('split-result');
  expect(result).toHaveTextContent('K-042');
  expect(result).toHaveTextContent('K-042/1');
  expect(result).toHaveTextContent('K-042/2');

  // The publish constraint is explained, not left to fail opaquely later.
  expect(screen.getByText('gis.contours.split.publishHint')).toBeInTheDocument();
});

test('the backend refusing the split (e.g. the parent already has children) is shown by code and message, not silently retried', async () => {
  server.use(
    http.post('*/api/v1/gis/contours/:parentId/split', () =>
      HttpResponse.json(
        { error: { code: 'ERR-GIS-005', message: 'parent already split', details: { reason: 'already_split' } } },
        { status: 409 },
      ),
    ),
  );

  const ui = userEvent.setup();
  renderPanel(CUT_LINE);
  await ui.click(screen.getByRole('button', { name: 'gis.contours.split.confirm' }));

  await waitFor(() =>
    expect(screen.getByText(/GIS obyekti holati bo'yicha ziddiyat/)).toBeInTheDocument(),
  );
  expect(screen.queryByText(/ERR-GIS-005/)).not.toBeInTheDocument();
  expect(screen.queryByTestId('split-result')).not.toBeInTheDocument();
});

test('redrawing the line is always offered, even after a successful split proposal', () => {
  renderPanel(MISS_LINE);
  expect(screen.getByRole('button', { name: 'gis.contours.split.retry' })).toBeInTheDocument();
});
