/**
 * Task 8 (stage 15) — the citizen's own application card must SHOW the
 * deadwood and recreation blank lines their filing collected
 * (`deadwood_product`, `removal_deadline`, `recreation_purpose`, `event_at`
 * — decision #215 R6), the same lines the staff card
 * (`GeneralInfoPanel.test.tsx`) now shows an executor. A field the citizen
 * fills that they themselves cannot see again is the "hiding direction"
 * this project keeps finding (`docs/status.md`). The product/purpose CODES
 * render through the wizard's own dictionary keys
 * (`wizard.step3.deadwoodProduct.<code>`) so the two screens cannot drift —
 * the test i18n stub returns the raw key, so asserting the key text IS
 * asserting the lookup happened.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { I18nContext } from '../../i18n/context';
import { MyApplicationCardPage } from './MyApplicationCardPage';
import type { ApplicationCardOut } from './api';
import { formatDate, formatDateTime } from './format';

const APPLICATION_ID = 'a1000000-0000-4000-8000-000000000001';

function card(over: Partial<ApplicationCardOut> = {}): ApplicationCardOut {
  return {
    id: APPLICATION_ID,
    number: 'RX-2026-000123',
    status: 'IN_REVIEW',
    applicant_id: 'ap000000-0000-4000-8000-000000000001',
    submitted_by_user_id: 'u0000000-0000-4000-8000-000000000001',
    on_behalf: 'self',
    representation_id: null,
    activity_type_id: null,
    contour_id: null,
    contour_version_id: null,
    requested_area_ha: null,
    period_from: null,
    period_to: null,
    quantity: null,
    // Decision #215 R6: the deadwood and recreation blanks' own lines —
    // required by the schema (nullable), null for every other activity.
    deadwood_product: null,
    removal_deadline: null,
    recreation_purpose: null,
    event_at: null,
    channel: 'portal',
    kind: 'new',
    benefit_category_item_id: null,
    benefit_certificate_no: null,
    benefit_verification_status: 'not_required' as const,
    benefit_verified_by: null,
    benefit_verified_at: null,
    benefit_rejection_reason: null,
    rejection_reason_item_id: null,
    assigned_org_id: null,
    assigned_user_id: null,
    parent_application_id: null,
    sla_deadline_at: null,
    submitted_at: '2026-09-01T10:00:00+05:00',
    decided_at: null,
    rules_accepted_at: null,
    created_at: '2026-09-01T10:00:00+05:00',
    updated_at: '2026-09-01T10:00:00+05:00',
    items: [],
    documents: [],
    checks: [],
    calculation: null,
    sla_overdue: false,
    conclusions: [],
    printouts: [],
    ...over,
  };
}

const server = setupServer(
  http.get('*/api/v1/applications/:id/timeline', () =>
    HttpResponse.json({ status_history: [], assignments: [], signatures: [], info_requests: [] }),
  ),
  http.get('*/api/v1/refs/activity-types', () => HttpResponse.json([])),
  http.get('*/api/v1/refs/livestock-types', () => HttpResponse.json([])),
  http.get('*/api/v1/refs/classifiers/:code/items', () => HttpResponse.json([])),
  http.get('*/api/v1/invoices', () => HttpResponse.json({ items: [], total: 0 })),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPage(cardOver: Partial<ApplicationCardOut> = {}) {
  server.use(http.get('*/api/v1/applications/:id', () => HttpResponse.json(card(cardOver))));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <MemoryRouter initialEntries={[`/my/applications/${APPLICATION_ID}`]}>
          <Routes>
            <Route path="/my/applications/:id" element={<MyApplicationCardPage />} />
          </Routes>
        </MemoryRouter>
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

test('a deadwood card shows the product label, the translated code, and the removal deadline', async () => {
  renderPage({ deadwood_product: 'firewood', removal_deadline: '2027-06-15' });

  expect(await screen.findByText('Mahsulot turi:')).toBeInTheDocument();
  expect(screen.getByText('wizard.step3.deadwoodProduct.firewood')).toBeInTheDocument();
  expect(screen.getByText('Olib chiqish muddati:')).toBeInTheDocument();
  expect(screen.getByText(formatDate('2027-06-15'))).toBeInTheDocument();

  // The recreation lines have nothing to show on a deadwood card.
  expect(screen.queryByText('Foydalanish maqsadi:')).not.toBeInTheDocument();
  expect(screen.queryByText('Tadbir sanasi va vaqti:')).not.toBeInTheDocument();
});

test('a recreation card shows the purpose label, the translated code, and the event time', async () => {
  renderPage({ recreation_purpose: 'health', event_at: '2026-05-09T10:30:00+05:00' });

  expect(await screen.findByText('Foydalanish maqsadi:')).toBeInTheDocument();
  expect(screen.getByText('wizard.step3.recreationPurpose.health')).toBeInTheDocument();
  expect(screen.getByText('Tadbir sanasi va vaqti:')).toBeInTheDocument();
  expect(screen.getByText(formatDateTime('2026-05-09T10:30:00+05:00'))).toBeInTheDocument();

  // The deadwood lines have nothing to show on a recreation card.
  expect(screen.queryByText('Mahsulot turi:')).not.toBeInTheDocument();
  expect(screen.queryByText('Olib chiqish muddati:')).not.toBeInTheDocument();
});

test('a haymaking card (all four null) shows none of the four labels', async () => {
  renderPage();

  // Wait for the card to finish loading before asserting an absence.
  expect(await screen.findByText('RX-2026-000123')).toBeInTheDocument();
  expect(screen.queryByText('Mahsulot turi:')).not.toBeInTheDocument();
  expect(screen.queryByText('Olib chiqish muddati:')).not.toBeInTheDocument();
  expect(screen.queryByText('Foydalanish maqsadi:')).not.toBeInTheDocument();
  expect(screen.queryByText('Tadbir sanasi va vaqti:')).not.toBeInTheDocument();
});

test('the price is explained line by line, and the rule version is not shown', async () => {
  server.use(
    http.get('*/api/v1/refs/livestock-types', () =>
      HttpResponse.json([{ id: 'lt-1', code: 'sheep_goat_6m', name: { uz_latn: 'Qoʻy va echki' }, status: 'active' }]),
    ),
    http.get('*/api/v1/refs/classifiers/:code/items', ({ params }) =>
      HttpResponse.json(
        params.code === 'benefit_categories' ? [{ id: 'b-1', code: 'veteran', name: { uz_latn: 'Faxriy' } }] : [],
      ),
    ),
  );
  renderPage({
    calculation: {
      id: 'c1000000-0000-4000-8000-000000000001',
      amount: '880000',
      rule_version: 'norms-1.0.0',
      used_sb: '40',
      max_sb: null,
      remaining_sb: null,
      bhm: '440000',
      lines: [
        {
          livestock_code: 'sheep_goat_6m',
          quantity: '40',
          quantity_unit: 'head',
          coefficient: '0.1',
          benefit_code: 'veteran',
          benefit_modifier: '0.5',
          amount: '880000',
          exempt: false,
        },
      ],
      created_at: '2026-09-01T10:00:00+05:00',
    },
  });

  const breakdown = await screen.findByTestId('calculation-breakdown');
  const text = () => breakdown.textContent?.replace(/\s+/g, ' ') ?? '';
  expect(breakdown).toHaveTextContent('Qanday hisoblandi');
  await screen.findByText(/Qoʻy va echki/);
  expect(text()).toContain('Qoʻy va echki: 40 bosh × 0,1 BHM × 440 000 soʻm × 0,5 = 880 000 soʻm');
  await screen.findByText(/Faxriy/);
  expect(text()).toContain('Imtiyoz «Faxriy»: toʻlov 50% ga kamaytirilgan.');
  expect(text()).toContain('BHM — bazaviy hisoblash miqdori, hisob-kitob kunida 440 000 soʻm.');
  // One line needs no «Jami» of its own, and nothing here was rounded.
  expect(text()).not.toContain('Jami');
  expect(screen.queryByText(/rule_version|norms-1\.0\.0/)).not.toBeInTheDocument();
});
