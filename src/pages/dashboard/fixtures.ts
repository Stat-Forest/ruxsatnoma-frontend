/**
 * Builders for the three response shapes the applicant dashboard reads. Test
 * only — every field the generated schema declares is filled, so a fixture is
 * a real `PermitOut`/`ApplicationOut`/`InvoiceOut` rather than a structural
 * lookalike that would keep compiling after the backend's contract moved.
 */
import type { ApplicationOut, InvoiceOut, KpiOut, PermitOut } from './queries';

let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

export function permit(overrides: Partial<PermitOut> = {}): PermitOut {
  const id = uuid();
  return {
    id,
    series: 'A',
    number: seq,
    status: 'active',
    application_id: uuid(),
    applicant_id: 'applicant-1',
    activity_type_id: 'activity-grazing',
    organization_id: 'org-1',
    contour_id: 'contour-1',
    contour_version_id: uuid(),
    area_ha: '10.0000',
    period_from: '2026-04-01',
    period_to: '2026-10-01',
    amount: '1000000.00',
    sb_load: null,
    pdf_file_id: uuid(),
    doc_hash: 'a'.repeat(64),
    template_id: uuid(),
    issued_at: '2026-04-15T10:00:00+05:00',
    created_at: '2026-04-15T09:00:00+05:00',
    ...overrides,
  };
}

export function application(overrides: Partial<ApplicationOut> = {}): ApplicationOut {
  return {
    id: uuid(),
    number: 'AR-000001',
    status: 'SUBMITTED',
    applicant_id: 'applicant-1',
    submitted_by_user_id: 'user-1',
    on_behalf: 'self',
    representation_id: null,
    activity_type_id: 'activity-grazing',
    contour_id: 'contour-1',
    contour_version_id: uuid(),
    requested_area_ha: '10.0000',
    period_from: '2026-04-01',
    period_to: '2026-10-01',
    quantity: '20',
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
    submitted_at: '2026-04-01T10:00:00+05:00',
    decided_at: null,
    created_at: '2026-04-01T09:00:00+05:00',
    updated_at: '2026-04-01T09:00:00+05:00',
    ...overrides,
  };
}

export function kpi(overrides: Partial<KpiOut> = {}): KpiOut {
  return {
    period: { period_from: '2026-09-01', period_to: '2026-09-05' },
    permits: { issued_count: 0, active_count: 0, previous_issued_count: null },
    applications: { total_count: 0, by_status: {}, previous_total_count: null },
    occupancy: { contour_count: 0, avg_occupied_pct: null },
    sb_load_total: '0',
    payments: {
      invoiced_amount: '0',
      paid_amount: '0',
      budget_share_amount: '0',
      recipient_share_amount: '0',
    },
    sla: { active_count: 0, overdue_count: 0 },
    rejections: [],
    risk_indicators: { by_code: {}, by_level: {} },
    inspections: { inspections_count: 0, violations_count: 0 },
    satisfaction: { avg_score: null, count: 0 },
    omitted: [],
    ...overrides,
  };
}

export function invoice(overrides: Partial<InvoiceOut> = {}): InvoiceOut {
  return {
    id: uuid(),
    number: 'INV-000001',
    application_id: uuid(),
    calculation_id: uuid(),
    amount: '1000000.00',
    status: 'paid',
    issued_at: '2026-04-10T10:00:00+05:00',
    due_at: '2026-04-20T10:00:00+05:00',
    settled_by_benefit: false,
    paid_at: '2026-04-12T10:00:00+05:00',
    ...overrides,
  };
}
