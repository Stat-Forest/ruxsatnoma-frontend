import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { I18nContext } from '../../i18n/context';
import { MyApplicationsPage } from './MyApplicationsPage';
import type { ApplicationOut } from './api';

const APPLICATION_ID = 'a1000000-0000-4000-8000-000000000001';

function row(over: Partial<ApplicationOut> = {}): ApplicationOut {
  return {
    id: APPLICATION_ID,
    number: 'RX-2026-000001',
    status: 'IN_REVIEW',
    applicant_id: 'ap000000-0000-4000-8000-000000000001',
    submitted_by_user_id: 'u0000000-0000-4000-8000-000000000001',
    on_behalf: 'self',
    representation_id: null,
    activity_type_id: null,
    contour_id: null,
    contour_version_id: null,
    requested_area_ha: '12.5',
    period_from: '2026-01-01',
    period_to: '2026-12-31',
    quantity: null,
    channel: 'portal',
    kind: 'new',
    benefit_category_item_id: null,
    // Ruling #179 (stage 9): a benefit claim now carries its certificate and
    // the verification it is waiting on — required by the schema, so every
    // fixture states them rather than leaning on `undefined`.
    benefit_certificate_no: null,
    benefit_verification_status: 'not_required' as const,
    benefit_verified_by: null,
    benefit_verified_at: null,
    benefit_rejection_reason: null,
    rules_accepted_at: null,
    rejection_reason_item_id: null,
    assigned_org_id: null,
    assigned_user_id: null,
    parent_application_id: null,
    sla_deadline_at: null,
    submitted_at: '2026-09-01T10:00:00+05:00',
    decided_at: null,
    created_at: '2026-09-01T10:00:00+05:00',
    updated_at: '2026-09-01T10:00:00+05:00',
    ...over,
  };
}

const server = setupServer(
  http.get('*/api/v1/refs/activity-types', () => HttpResponse.json([])),
  http.get('*/api/v1/applications', () => HttpResponse.json({ items: [row()], total: 1, page: 1, page_size: 20 })),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-location">{location.pathname}</div>;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18n}>
          <MyApplicationsPage />
          <LocationProbe />
        </I18nContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

test('a click anywhere on a row opens the application, not only "Ochish"', async () => {
  renderPage();
  // The number is also on the mobile card; the desktop table's cell is the <td>.
  const cell = (await screen.findAllByText('RX-2026-000001')).find((el) => el.closest('td'))!;
  await userEvent.setup().click(cell);
  expect(screen.getByTestId('current-location')).toHaveTextContent(`/my/applications/${APPLICATION_ID}`);
});
