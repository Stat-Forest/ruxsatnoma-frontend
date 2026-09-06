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

const ORG_OPTIONS = [{ id: 'org-1', label: 'Burchmulla' }];

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
          organizationOptions={ORG_OPTIONS}
          defaultOrganizationId="org-1"
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

test('a good cut proposes two numbers and confirming creates two subcontours, each with its own version', async () => {
  const createdContours: { number: string; kind: string; parent_id: string }[] = [];
  const createdVersions: { contourId: string; source: string }[] = [];
  server.use(
    http.get('*/api/v1/gis/layers', () =>
      HttpResponse.json({ items: [{ id: 'layer-contours', code: 'contours', name: {}, geometry_type: 'MULTIPOLYGON', is_public: true, style: {}, status: 'active' }] }),
    ),
    http.post('*/api/v1/gis/contours', async ({ request }) => {
      const body = (await request.json()) as { number: string; kind: string; parent_id: string };
      createdContours.push(body);
      return HttpResponse.json(
        { id: `child-${createdContours.length}`, layer_id: 'layer-contours', organization_id: 'org-1', parent_id: body.parent_id, kind: body.kind, number: body.number, status: 'active' },
        { status: 201 },
      );
    }),
    http.post('*/api/v1/gis/contours/:contourId/versions', async ({ request, params }) => {
      const body = (await request.json()) as { source: string };
      createdVersions.push({ contourId: params.contourId as string, source: body.source });
      return HttpResponse.json(
        {
          id: `version-${createdVersions.length}`,
          contour_id: params.contourId,
          version_no: 1,
          status: 'draft',
          source: body.source,
          area_ha: '5.0000',
          declared_area_ha: null,
          accuracy_m: null,
          survey_date: null,
          effective_from: null,
          approval_doc_id: null,
          approved_by: null,
          published_at: null,
        },
        { status: 201 },
      );
    }),
  );

  const onDone = vi.fn();
  const ui = userEvent.setup();
  renderPanel(CUT_LINE, { onDone });

  const numberAInput = screen.getByDisplayValue('K-042/1');
  const numberBInput = screen.getByDisplayValue('K-042/2');
  expect(numberAInput).toBeInTheDocument();
  expect(numberBInput).toBeInTheDocument();

  await ui.click(screen.getByRole('button', { name: 'gis.contours.split.confirm' }));

  await waitFor(() => expect(onDone).toHaveBeenCalled());
  expect(createdContours).toHaveLength(2);
  expect(createdContours.every((c) => c.kind === 'subcontour' && c.parent_id === 'parent-1')).toBe(true);
  expect(createdContours.map((c) => c.number)).toEqual(['K-042/1', 'K-042/2']);
  expect(createdVersions).toHaveLength(2);
});

test('redrawing the line is always offered, even after a successful split proposal', () => {
  renderPanel(MISS_LINE);
  expect(screen.getByRole('button', { name: 'gis.contours.split.retry' })).toBeInTheDocument();
});
