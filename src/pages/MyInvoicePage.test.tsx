/**
 * Stage 10, F1 — ruling #185: a benefit-settled invoice (`settled_by_benefit`)
 * is `paid` with nothing collected, and the citizen sees WHY instead of a
 * bare "paid" badge or the Payme button.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { components } from '../api/schema';
import { DICTIONARIES, I18nContext } from '../i18n/context';
import { MyInvoicePage } from './MyInvoicePage';

type InvoiceOut = components['schemas']['InvoiceOut'];
type ApplicationCardOut = components['schemas']['ApplicationCardOut'];

const INVOICE_ID = 'inv00000-0000-4000-8000-000000000001';
const APPLICATION_ID = 'a1000000-0000-4000-8000-000000000001';

function invoice(over: Partial<InvoiceOut> = {}): InvoiceOut {
  return {
    id: INVOICE_ID,
    number: 'INV-1',
    application_id: APPLICATION_ID,
    calculation_id: null,
    amount: '0.00',
    status: 'paid',
    issued_at: '2026-09-10T10:00:00Z',
    due_at: '2026-09-17T10:00:00Z',
    paid_at: '2026-09-10T10:00:00Z',
    recipients: null,
    settled_by_benefit: true,
    ...over,
  } as InvoiceOut;
}

function applicationCard(over: Partial<ApplicationCardOut> = {}): ApplicationCardOut {
  return {
    id: APPLICATION_ID,
    number: 'A-1',
    status: 'PAID',
    applicant_id: 'ap000000-0000-4000-8000-000000000001',
    submitted_by_user_id: 'u1',
    on_behalf: 'self',
    representation_id: null,
    activity_type_id: 'act00000-0000-4000-8000-000000000001',
    contour_id: 'c0000000-0000-4000-8000-000000000001',
    contour_version_id: 'cv000000-0000-4000-8000-000000000001',
    requested_area_ha: null,
    period_from: '2026-05-01',
    period_to: '2026-07-31',
    quantity: null,
    channel: 'portal',
    kind: 'new',
    benefit_category_item_id: null,
    benefit_certificate_no: null,
    benefit_verification_status: 'not_required',
    benefit_verified_by: null,
    benefit_verified_at: null,
    benefit_rejection_reason: null,
    rejection_reason_item_id: null,
    assigned_org_id: null,
    assigned_user_id: null,
    parent_application_id: null,
    sla_deadline_at: null,
    submitted_at: '2026-09-01T09:00:00Z',
    decided_at: '2026-09-01T09:30:00Z',
    rules_accepted_at: '2026-09-01T09:00:00Z',
    created_at: '2026-09-01T08:00:00Z',
    documents: [],
    items: [],
    ...over,
  } as unknown as ApplicationCardOut;
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderInvoicePage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const lang = 'uz_latn' as const;
  const i18n = {
    lang,
    backendLang: lang,
    t: (key: string) => (DICTIONARIES[lang] as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
  const router = createMemoryRouter([{ path: '/my/invoices/:id', element: <MyInvoicePage /> }], {
    initialEntries: [`/my/invoices/${INVOICE_ID}`],
  });
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <RouterProvider router={router} />
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

test('a benefit-settled invoice shows "nothing to pay" with the category name, and no Payme button', async () => {
  server.use(
    http.get('*/api/v1/invoices/:id', () => HttpResponse.json(invoice({ settled_by_benefit: true, status: 'paid' }))),
    http.get('*/api/v1/applications/:id', () =>
      HttpResponse.json(applicationCard({ benefit_category_item_id: 'benefit-1' })),
    ),
    http.get('*/api/v1/refs/classifiers/:code/items', () =>
      HttpResponse.json([
        {
          id: 'benefit-1',
          code: 'war_veterans',
          name: { uz_latn: 'Urush faxriylari' },
          props: {},
          valid_from: '2020-01-01',
          valid_to: null,
          status: 'active',
        },
      ]),
    ),
  );
  renderInvoicePage();

  expect(await screen.findByText("Toʻlov talab qilinmaydi — imtiyoz")).toBeInTheDocument();
  expect(
    await screen.findByText(
      'Ushbu hisob-faktura «Urush faxriylari» imtiyoz toifasi asosida toʻliq bepul rasmiylashtirildi — toʻlov talab qilinmaydi.',
    ),
  ).toBeInTheDocument();
  expect(screen.queryByText('Payme orqali toʻlash')).not.toBeInTheDocument();
});

test('a benefit-settled invoice with no benefit category on the application still reads "nothing to pay"', async () => {
  server.use(
    http.get('*/api/v1/invoices/:id', () => HttpResponse.json(invoice({ settled_by_benefit: true, status: 'paid' }))),
    http.get('*/api/v1/applications/:id', () => HttpResponse.json(applicationCard({ benefit_category_item_id: null }))),
  );
  renderInvoicePage();

  expect(await screen.findByText("Toʻlov talab qilinmaydi — imtiyoz")).toBeInTheDocument();
  expect(
    await screen.findByText("Ushbu hisob-faktura imtiyoz asosida toʻliq bepul rasmiylashtirildi — toʻlov talab qilinmaydi."),
  ).toBeInTheDocument();
});

test('a normal pending invoice (not benefit-settled) still offers the Payme button', async () => {
  server.use(
    http.get('*/api/v1/invoices/:id', () =>
      HttpResponse.json(invoice({ settled_by_benefit: false, status: 'pending', paid_at: null, amount: '2200000.00' })),
    ),
  );
  renderInvoicePage();

  expect(await screen.findByText('Payme orqali toʻlash')).toBeInTheDocument();
  expect(screen.queryByText("Toʻlov talab qilinmaydi — imtiyoz")).not.toBeInTheDocument();
});
