import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { I18nContext } from '../../../i18n/context';
import { PermitRow } from './PermitRow';
import type { PermitOut } from '../queries';

const PERMIT_ID = 'p1000000-0000-4000-8000-000000000001';

const PERMIT: PermitOut = {
  id: PERMIT_ID,
  series: 'А',
  number: 42,
  status: 'active',
  application_id: 'a1000000-0000-4000-8000-000000000001',
  applicant_id: 'ap000000-0000-4000-8000-000000000001',
  activity_type_id: 'act00000-0000-4000-8000-000000000001',
  organization_id: 'org00000-0000-4000-8000-000000000001',
  contour_id: 'c1000000-0000-4000-8000-000000000001',
  contour_version_id: 'cv000000-0000-4000-8000-000000000001',
  area_ha: '12.5',
  period_from: '2026-01-01',
  period_to: '2026-12-31',
  amount: '2060000.00',
  sb_load: null,
  pdf_file_id: null,
  doc_hash: null,
  template_id: null,
  issued_at: '2026-08-01T10:00:00+05:00',
  created_at: '2026-08-01T10:00:00+05:00',
};

const server = setupServer(
  http.get('*/api/v1/refs/activity-types', () => HttpResponse.json([])),
  http.get('*/api/v1/refs/organizations', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 100 })),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-location">{location.pathname}</div>;
}

function renderRow() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>
          <table>
            <tbody>
              <PermitRow permit={PERMIT} />
            </tbody>
          </table>
          <LocationProbe />
        </I18nContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

test('a click anywhere on a registry row opens the permit', async () => {
  renderRow();
  await userEvent.setup().click(screen.getByText(/ga$/));
  expect(screen.getByTestId('current-location')).toHaveTextContent(`/permits/${PERMIT_ID}`);
});

test('the number link is still a real link (middle-click, new tab)', () => {
  renderRow();
  expect(screen.getByRole('link', { name: /42/ })).toHaveAttribute('href', `/permits/${PERMIT_ID}`);
});
