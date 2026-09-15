/**
 * Task 8 (stage 15) — the staff card must SHOW the deadwood and recreation
 * blank lines an application collected (`deadwood_product`,
 * `removal_deadline`, `recreation_purpose`, `event_at` — decision #215 R6).
 * A field the citizen fills that an executor never sees is the "hiding
 * direction" this project keeps finding (`docs/status.md`), so this pins:
 * the two lines a deadwood filing carries, the two a recreation filing
 * carries, and that a haymaking card (all four null) shows none of them.
 * The product/purpose CODES render through the wizard's own dictionary keys
 * (`wizard.step3.deadwoodProduct.<code>`) so the two screens cannot drift —
 * the test i18n stub returns the raw key, so asserting the key text IS
 * asserting the lookup happened.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { I18nContext } from '../../../i18n/context';
import { GeneralInfoPanel } from './GeneralInfoPanel';
import type { ApplicationCardOut } from '../queries';
import { formatDate, formatDateTime } from '../format';

function card(over: Partial<ApplicationCardOut> = {}): ApplicationCardOut {
  return {
    id: 'a1000000-0000-4000-8000-000000000001',
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
    items: [],
    documents: [],
    checks: [],
    calculation: null,
    sla_overdue: false,
    conclusions: [],
    ...over,
  };
}

const server = setupServer(
  http.get('*/api/v1/refs/activity-types', () => HttpResponse.json([])),
  http.get('*/api/v1/refs/livestock-types', () => HttpResponse.json([])),
  http.get('*/api/v1/refs/classifiers/:code/items', () => HttpResponse.json([])),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPanel(cardOver: Partial<ApplicationCardOut> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <GeneralInfoPanel card={card(cardOver)} />
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

test('a deadwood card shows the product label, the translated code, and the removal deadline', () => {
  renderPanel({ deadwood_product: 'firewood', removal_deadline: '2027-06-15' });

  expect(screen.getByText('Mahsulot turi:')).toBeInTheDocument();
  expect(screen.getByText('wizard.step3.deadwoodProduct.firewood')).toBeInTheDocument();
  expect(screen.getByText('Olib chiqish muddati:')).toBeInTheDocument();
  expect(screen.getByText(formatDate('2027-06-15'))).toBeInTheDocument();

  // The recreation lines have nothing to show on a deadwood card.
  expect(screen.queryByText('Foydalanish maqsadi:')).not.toBeInTheDocument();
  expect(screen.queryByText('Tadbir sanasi va vaqti:')).not.toBeInTheDocument();
});

test('a recreation card shows the purpose label, the translated code, and the event time', () => {
  renderPanel({ recreation_purpose: 'health', event_at: '2026-05-09T10:30:00+05:00' });

  expect(screen.getByText('Foydalanish maqsadi:')).toBeInTheDocument();
  expect(screen.getByText('wizard.step3.recreationPurpose.health')).toBeInTheDocument();
  expect(screen.getByText('Tadbir sanasi va vaqti:')).toBeInTheDocument();
  expect(screen.getByText(formatDateTime('2026-05-09T10:30:00+05:00'))).toBeInTheDocument();

  // The deadwood lines have nothing to show on a recreation card.
  expect(screen.queryByText('Mahsulot turi:')).not.toBeInTheDocument();
  expect(screen.queryByText('Olib chiqish muddati:')).not.toBeInTheDocument();
});

test('a haymaking card (all four null) shows none of the four labels', () => {
  renderPanel();

  expect(screen.queryByText('Mahsulot turi:')).not.toBeInTheDocument();
  expect(screen.queryByText('Olib chiqish muddati:')).not.toBeInTheDocument();
  expect(screen.queryByText('Foydalanish maqsadi:')).not.toBeInTheDocument();
  expect(screen.queryByText('Tadbir sanasi va vaqti:')).not.toBeInTheDocument();
});
