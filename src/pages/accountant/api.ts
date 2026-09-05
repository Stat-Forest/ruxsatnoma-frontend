/**
 * Typed wrappers around every `/invoices`, `/payments/*` and `/refunds`
 * route the accountant's workspace (G1–G5) calls, in the shape
 * `admin/integrations/api.ts` established: one thin `async` function per
 * route, every type read out of the generated `src/api/schema.d.ts`
 * (verified against `backend/app/modules/payments/` source, 2026-09-05),
 * every failure turned into an `ApiError` at the call site.
 *
 * Kept local to `src/pages/accountant/` rather than folded into
 * `src/pages/applicant/api.ts` (which already has its own
 * `listInvoicesForApplication`/`uploadFile`): that file is another track's
 * scope, and the accountant's own upload targets (`bank_doc_file_id`,
 * `resolution_doc_id`) are a payments-module concern, not an applicant one.
 *
 * MONEY: every amount on the wire is a fixed-scale-NUMERIC STRING
 * (`InvoiceOut.amount`, `AllocationOut.amount`, …) — never parsed through
 * `Number()`, only ever displayed with `formatMoney` (`../permits/format`)
 * and, on write, sent back as the string the operator typed. The one
 * exception the schema itself allows is `ManualConfirmationIn.amount` and
 * `RefundSubmitDecisionIn`'s four fields, typed `number | string` — this
 * module always sends the string form, never a parsed float.
 */
import { api } from '../../api/client';
import { apiError } from '../../api/errors';
import type { components } from '../../api/schema';

export type InvoiceOut = components['schemas']['InvoiceOut'];
export type AllocationOut = components['schemas']['AllocationOut'];
export type StatementAccepted = components['schemas']['StatementAccepted'];
export type StatementOut = components['schemas']['StatementOut'];
export type StatementLineOut = components['schemas']['StatementLineOut'];
export type ReconciliationOut = components['schemas']['ReconciliationOut'];
export type ManualConfirmationOut = components['schemas']['ManualConfirmationOut'];
export type FiledManualConfirmationOut = components['schemas']['FiledManualConfirmationOut'];
export type RefundOut = components['schemas']['RefundOut'];
export type FileOut = components['schemas']['FileOut'];
export type OrganizationOut = components['schemas']['OrganizationOut'];
export type RegionOut = components['schemas']['RegionOut'];
export type DistrictOut = components['schemas']['DistrictOut'];

// ── G1 — invoices ────────────────────────────────────────────────────────

export async function getInvoice(invoiceId: string): Promise<InvoiceOut> {
  const { data, error } = await api.GET('/api/v1/invoices/{invoice_id}', {
    params: { path: { invoice_id: invoiceId } },
  });
  if (error) throw apiError(error);
  return data;
}

/** `GET /invoices` has no route that lists without a filter — `application_id`
 *  is REQUIRED (`06.5-accountant.md` ruling R1). There is no "browse every
 *  invoice" screen behind this function because no such route exists. */
export async function listInvoicesByApplication(applicationId: string): Promise<InvoiceOut[]> {
  const { data, error } = await api.GET('/api/v1/invoices', {
    params: { query: { application_id: applicationId, limit: 200, offset: 0 } },
  });
  if (error) throw apiError(error);
  return data.items;
}

// ── G2 — the 50/50 allocation ledger ────────────────────────────────────

export async function listAllocationsForInvoice(invoiceId: string): Promise<AllocationOut[]> {
  const { data, error } = await api.GET('/api/v1/payments/allocations', {
    params: { query: { invoice_id: invoiceId, limit: 200, offset: 0 } },
  });
  if (error) throw apiError(error);
  return data.items;
}

// ── Shared: uploading the document a filing/resolution needs ───────────

/** `POST /files` is multipart; the generated body type degrades every
 *  binary field to `string` (openapi-typescript's own limitation) —
 *  openapi-fetch's `defaultBodySerializer` special-cases a real `FormData`
 *  instance and sends it through untouched, so this cast is the documented
 *  way through a typed client (mirrors `applicant/api.ts::uploadFile`). */
export async function uploadFile(file: File): Promise<FileOut> {
  const form = new FormData();
  form.append('file', file);
  const { data, error } = await api.POST('/api/v1/files', {
    body: form as unknown as { file: string },
  });
  if (error) throw apiError(error);
  return data;
}

// ── G3 — bank statements ────────────────────────────────────────────────

export interface CreateBankStatementParams {
  file: File;
  statementDate: string; // YYYY-MM-DD
  columnMap: Record<string, string>;
  idempotencyKey: string;
}

/** `Idempotency-Key` is MANDATORY here (router docstring) — a replay
 *  returns the ORIGINAL statement id, never a second queued parse. */
export async function createBankStatement(params: CreateBankStatementParams): Promise<StatementAccepted> {
  const form = new FormData();
  form.append('file', params.file);
  form.append('statement_date', params.statementDate);
  form.append('column_map', JSON.stringify(params.columnMap));
  const { data, error } = await api.POST('/api/v1/payments/bank-statements', {
    body: form as unknown as { file: string; statement_date: string; column_map: string },
    headers: { 'Idempotency-Key': params.idempotencyKey },
  });
  if (error) throw apiError(error);
  return data;
}

export async function getBankStatement(
  statementId: string,
  paging: { limit?: number; offset?: number } = {},
): Promise<StatementOut> {
  const { data, error } = await api.GET('/api/v1/payments/bank-statements/{statement_id}', {
    params: { path: { statement_id: statementId }, query: paging },
  });
  if (error) throw apiError(error);
  return data;
}

// ── G4 — reconciliations (the discrepancy register) ─────────────────────

export interface ListReconciliationsParams {
  status?: 'open' | 'resolved';
  limit?: number;
  offset?: number;
}

export async function listReconciliations(params: ListReconciliationsParams) {
  const { data, error } = await api.GET('/api/v1/payments/reconciliations', {
    params: { query: params },
  });
  if (error) throw apiError(error);
  return data;
}

export async function resolveReconciliation(
  reconciliationId: string,
  body: { comment: string; resolution_doc_id?: string | null },
): Promise<ReconciliationOut> {
  const { data, error } = await api.POST('/api/v1/payments/reconciliations/{reconciliation_id}/resolve', {
    params: { path: { reconciliation_id: reconciliationId } },
    body,
  });
  if (error) throw apiError(error);
  return data;
}

// ── G4 — manual PAID, maker-checker ──────────────────────────────────────

export interface FileManualConfirmationInput {
  invoice_id: string;
  amount: string;
  paid_at: string;
  bank_doc_file_id: string;
}

export async function fileManualConfirmation(
  body: FileManualConfirmationInput,
): Promise<FiledManualConfirmationOut> {
  const { data, error } = await api.POST('/api/v1/payments/manual-confirmations', { body });
  if (error) throw apiError(error);
  return data;
}

export async function confirmManualConfirmation(confirmationId: string): Promise<ManualConfirmationOut> {
  const { data, error } = await api.POST('/api/v1/payments/manual-confirmations/{confirmation_id}/confirm', {
    params: { path: { confirmation_id: confirmationId } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function rejectManualConfirmation(
  confirmationId: string,
  reason: string,
): Promise<ManualConfirmationOut> {
  const { data, error } = await api.POST('/api/v1/payments/manual-confirmations/{confirmation_id}/reject', {
    params: { path: { confirmation_id: confirmationId } },
    body: { reason },
  });
  if (error) throw apiError(error);
  return data;
}

// ── G5 — refunds ─────────────────────────────────────────────────────────

export interface ListRefundsParams {
  application_id?: string;
  status?: 'requested' | 'in_review' | 'returned' | 'rejected';
  limit?: number;
  offset?: number;
}

export async function listRefunds(params: ListRefundsParams) {
  const { data, error } = await api.GET('/api/v1/refunds', { params: { query: params } });
  if (error) throw apiError(error);
  return data;
}

export async function requestRefund(body: {
  application_id: string;
  basis_item_id: string;
  comment?: string | null;
}): Promise<RefundOut> {
  const { data, error } = await api.POST('/api/v1/refunds', { body });
  if (error) throw apiError(error);
  return data;
}

export async function submitRefundDecision(
  refundId: string,
  body: { final_amount: string; budget_amount: string; recipient_amount: string; other_amount: string; comment?: string | null },
): Promise<RefundOut> {
  const { data, error } = await api.POST('/api/v1/refunds/{refund_id}/submit-decision', {
    params: { path: { refund_id: refundId } },
    body,
  });
  if (error) throw apiError(error);
  return data;
}

export async function approveRefund(
  refundId: string,
  body: { resolution: 'returned' | 'rejected'; comment?: string | null },
): Promise<RefundOut> {
  const { data, error } = await api.POST('/api/v1/refunds/{refund_id}/approve', {
    params: { path: { refund_id: refundId } },
    body,
  });
  if (error) throw apiError(error);
  return data;
}

// ── Zone banner support (decision #70's consequence, rendered — R5) ─────

async function listOrganizationsUnder(parentId: string | undefined): Promise<OrganizationOut[]> {
  const { data, error } = await api.GET('/api/v1/refs/organizations', {
    params: { query: { page_size: 100, parent_id: parentId } },
  });
  if (error) throw apiError(error);
  return data.items;
}

/** Same two-level walk `applicant/api.ts::listOrganizations` uses, kept as
 *  its own copy here (see this file's own header) rather than imported
 *  across tracks. Only called to resolve ONE id for the zone banner, never
 *  to build a picker. */
export async function findOrganizationName(organizationId: string): Promise<OrganizationOut | null> {
  const roots = await listOrganizationsUnder(undefined);
  const direct = roots.find((org) => org.id === organizationId);
  if (direct) return direct;
  const children = await Promise.all(roots.map((root) => listOrganizationsUnder(root.id)));
  return children.flat().find((org) => org.id === organizationId) ?? null;
}

export async function listRegions(): Promise<RegionOut[]> {
  const { data, error } = await api.GET('/api/v1/refs/regions', {});
  if (error) throw apiError(error);
  return data;
}

/** `region_id` is an optional filter on this route — omitted, it returns
 *  every district in the country, which is exactly what the zone banner
 *  needs when the zone names a `district_id` with no `region_id` beside it
 *  (`ZoneOut`'s three axes are independently nullable). */
export async function listDistricts(regionId?: string): Promise<DistrictOut[]> {
  const { data, error } = await api.GET('/api/v1/refs/districts', {
    params: { query: { region_id: regionId } },
  });
  if (error) throw apiError(error);
  return data;
}
