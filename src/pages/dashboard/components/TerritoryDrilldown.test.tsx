import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { TerritoryDrilldown } from './TerritoryDrilldown';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function Providers({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderDrilldown() {
  return render(
    <Providers>
      <TerritoryDrilldown periodFrom="2026-09-01" periodTo="2026-09-05" t={(key) => key} />
    </Providers>,
  );
}

test('drilling from region to district to organization asks for the right filter id each time', async () => {
  const user = userEvent.setup();
  const requestedQueries: string[] = [];
  server.use(
    http.get('*/api/v1/dashboard/territory-slice', ({ request }) => {
      const url = new URL(request.url);
      requestedQueries.push(url.search);
      if (url.searchParams.get('organization_id')) {
        return HttpResponse.json({
          level: 'contour',
          k_anonymity_threshold: 5,
          cells: [
            {
              level: 'contour',
              key: 'con-1',
              label: 'Contour A',
              applications_count: 1,
              permits_count: 1,
              applicant_count: 1,
              suppressed: false,
            },
          ],
        });
      }
      if (url.searchParams.get('district_id')) {
        return HttpResponse.json({
          level: 'organization',
          k_anonymity_threshold: 5,
          cells: [
            {
              level: 'organization',
              key: 'org-1',
              label: 'Org A',
              applications_count: 3,
              permits_count: 2,
              applicant_count: 2,
              suppressed: false,
            },
          ],
        });
      }
      if (url.searchParams.get('region_id')) {
        return HttpResponse.json({
          level: 'district',
          k_anonymity_threshold: 5,
          cells: [
            {
              level: 'district',
              key: 'dist-1',
              label: 'District A',
              applications_count: 4,
              permits_count: 3,
              applicant_count: 3,
              suppressed: false,
            },
          ],
        });
      }
      return HttpResponse.json({
        level: 'region',
        k_anonymity_threshold: 5,
        cells: [
          {
            level: 'region',
            key: 'reg-1',
            label: 'Region A',
            applications_count: 10,
            permits_count: 8,
            applicant_count: 6,
            suppressed: false,
          },
        ],
      });
    }),
  );

  renderDrilldown();

  await user.click(await screen.findByText('Region A'));
  await screen.findByText('District A');
  expect(requestedQueries.some((q) => q.includes('region_id=reg-1'))).toBe(true);

  await user.click(screen.getByText('District A'));
  await screen.findByText('Org A');
  expect(requestedQueries.some((q) => q.includes('district_id=dist-1'))).toBe(true);

  await user.click(screen.getByText('Org A'));
  await screen.findByText('Contour A');
  expect(requestedQueries.some((q) => q.includes('organization_id=org-1'))).toBe(true);
});

test('a suppressed cell renders no button — drilling into it is not a real next step', async () => {
  server.use(
    http.get('*/api/v1/dashboard/territory-slice', () =>
      HttpResponse.json({
        level: 'region',
        k_anonymity_threshold: 5,
        cells: [
          {
            level: 'region',
            key: 'reg-2',
            label: 'Tiny Region',
            applications_count: null,
            permits_count: null,
            applicant_count: null,
            suppressed: true,
          },
        ],
      }),
    ),
  );

  renderDrilldown();

  await screen.findByText('Tiny Region');
  expect(screen.queryByRole('button', { name: 'Tiny Region' })).not.toBeInTheDocument();
});

test('the terminal contour level renders no clickable rows at all', async () => {
  const user = userEvent.setup();
  server.use(
    http.get('*/api/v1/dashboard/territory-slice', ({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.get('organization_id')) {
        return HttpResponse.json({
          level: 'contour',
          k_anonymity_threshold: 5,
          cells: [
            {
              level: 'contour',
              key: 'con-9',
              label: 'Contour Z',
              applications_count: 1,
              permits_count: 1,
              applicant_count: 1,
              suppressed: false,
            },
          ],
        });
      }
      return HttpResponse.json({
        level: 'organization',
        k_anonymity_threshold: 5,
        cells: [
          {
            level: 'organization',
            key: 'org-9',
            label: 'Org Z',
            applications_count: 2,
            permits_count: 2,
            applicant_count: 2,
            suppressed: false,
          },
        ],
      });
    }),
  );

  renderDrilldown();

  await user.click(await screen.findByText('Org Z'));
  await screen.findByText('Contour Z');

  expect(screen.queryByRole('button', { name: 'Contour Z' })).not.toBeInTheDocument();
});
