/**
 * React Query layer for the accountant's workspace (G1–G5), in the style of
 * `src/pages/admin/integrations/queries.ts`: hooks here, route wrappers in
 * `./api.ts`, paged lists keep `placeholderData` so a filter change or a
 * page turn does not blank the table between renders.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveRefund,
  confirmManualConfirmation,
  createBankStatement,
  fileManualConfirmation,
  findOrganizationName,
  getBankStatement,
  getInvoice,
  listAllocationsForInvoice,
  listDistricts,
  listInvoices,
  listManualConfirmations,
  listReconciliations,
  listRefunds,
  listRegions,
  rejectManualConfirmation,
  requestRefund,
  resolveReconciliation,
  submitRefundDecision,
  type CreateBankStatementParams,
  type FileManualConfirmationInput,
  type ListInvoicesParams,
  type ListManualConfirmationsParams,
  type ListRefundsParams,
  type ListReconciliationsParams,
} from './api';

const INVOICE_KEY = ['accountant', 'invoice'] as const;
const INVOICES_LIST_KEY = ['accountant', 'invoices-list'] as const;
const ALLOCATIONS_KEY = ['accountant', 'allocations'] as const;
const MANUAL_CONFIRMATIONS_KEY = ['accountant', 'manual-confirmations'] as const;
const STATEMENT_KEY = ['accountant', 'statement'] as const;
const RECONCILIATIONS_KEY = ['accountant', 'reconciliations'] as const;
const REFUNDS_KEY = ['accountant', 'refunds'] as const;
const ORG_NAME_KEY = ['accountant', 'zone-organization'] as const;
const REGIONS_KEY = ['accountant', 'zone-regions'] as const;
const DISTRICTS_KEY = ['accountant', 'zone-districts'] as const;

// ── G1 ────────────────────────────────────────────────────────────────────

export function useInvoice(invoiceId: string | null) {
  return useQuery({
    queryKey: [...INVOICE_KEY, invoiceId],
    queryFn: () => getInvoice(invoiceId!),
    enabled: invoiceId !== null,
    retry: false,
  });
}

/** F12a — the register, not a lookup: fires unconditionally (no `enabled`
 *  gate), because an empty `ListInvoicesParams` is itself a real, valid
 *  request — "this zone's invoices, unfiltered" — not a disabled state the
 *  way `useInvoice`/`useInvoicesByApplication` (a single id) used to be.
 *  `placeholderData` keeps the table from blanking between a status change
 *  or a page turn, the same convention every other paged list in this file
 *  already follows. */
export function useInvoicesList(params: ListInvoicesParams) {
  return useQuery({
    queryKey: [...INVOICES_LIST_KEY, params],
    queryFn: () => listInvoices(params),
    placeholderData: (previous) => previous,
  });
}

// ── G2 ────────────────────────────────────────────────────────────────────

export function useAllocationsForInvoice(invoiceId: string | null) {
  return useQuery({
    queryKey: [...ALLOCATIONS_KEY, invoiceId],
    queryFn: () => listAllocationsForInvoice(invoiceId!),
    enabled: invoiceId !== null,
  });
}

// ── G4 (filing half — lives beside the invoice it pays) ─────────────────

export function useFileManualConfirmation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: FileManualConfirmationInput) => fileManualConfirmation(body),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: [...INVOICE_KEY, variables.invoice_id] });
    },
  });
}

// ── G3 ────────────────────────────────────────────────────────────────────

export function useCreateBankStatement() {
  return useMutation({
    mutationFn: (params: CreateBankStatementParams) => createBankStatement(params),
  });
}

export function useBankStatement(statementId: string | null, paging: { limit?: number; offset?: number } = {}) {
  return useQuery({
    queryKey: [...STATEMENT_KEY, statementId, paging],
    queryFn: () => getBankStatement(statementId!, paging),
    enabled: statementId !== null,
    // Parsing is async (a worker job) — poll while the status has not
    // settled yet, so the accountant does not have to refresh by hand.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending' || status === 'parsing' ? 2000 : false;
    },
  });
}

// ── G4 ────────────────────────────────────────────────────────────────────

export function useReconciliations(params: ListReconciliationsParams) {
  return useQuery({
    queryKey: [...RECONCILIATIONS_KEY, params],
    queryFn: () => listReconciliations(params),
    placeholderData: (previous) => previous,
  });
}

export function useResolveReconciliation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment, resolutionDocId }: { id: string; comment: string; resolutionDocId?: string | null }) =>
      resolveReconciliation(id, { comment, resolution_doc_id: resolutionDocId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: RECONCILIATIONS_KEY });
    },
  });
}

/** F12b — the checker's own worklist, rendered instead of demanding an id
 *  handed over out of band. `placeholderData` matches every other paged list
 *  in this file. */
export function useManualConfirmations(params: ListManualConfirmationsParams) {
  return useQuery({
    queryKey: [...MANUAL_CONFIRMATIONS_KEY, params],
    queryFn: () => listManualConfirmations(params),
    placeholderData: (previous) => previous,
  });
}

export function useConfirmManualConfirmation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (confirmationId: string) => confirmManualConfirmation(confirmationId),
    // F12b: a confirmed row leaves the default `pending_check` worklist.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MANUAL_CONFIRMATIONS_KEY });
    },
  });
}

export function useRejectManualConfirmation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectManualConfirmation(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MANUAL_CONFIRMATIONS_KEY });
    },
  });
}

// ── G5 ────────────────────────────────────────────────────────────────────

export function useRefunds(params: ListRefundsParams) {
  return useQuery({
    queryKey: [...REFUNDS_KEY, params],
    queryFn: () => listRefunds(params),
    placeholderData: (previous) => previous,
  });
}

export function useRequestRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { application_id: string; basis_item_id: string; comment?: string | null }) =>
      requestRefund(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: REFUNDS_KEY });
    },
  });
}

export function useSubmitRefundDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      final_amount: string;
      budget_amount: string;
      recipient_amount: string;
      other_amount: string;
      comment?: string | null;
    }) => submitRefundDecision(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: REFUNDS_KEY });
    },
  });
}

export function useApproveRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolution, comment }: { id: string; resolution: 'returned' | 'rejected'; comment?: string | null }) =>
      approveRefund(id, { resolution, comment }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: REFUNDS_KEY });
    },
  });
}

// ── Zone banner (R5) ──────────────────────────────────────────────────────

export function useZoneOrganizationName(organizationId: string | null) {
  return useQuery({
    queryKey: [...ORG_NAME_KEY, organizationId],
    queryFn: () => findOrganizationName(organizationId!),
    enabled: organizationId !== null,
    staleTime: Infinity,
  });
}

export function useZoneRegionName(regionId: string | null) {
  return useQuery({
    queryKey: REGIONS_KEY,
    queryFn: listRegions,
    enabled: regionId !== null,
    staleTime: Infinity,
    select: (regions) => regions.find((region) => region.id === regionId) ?? null,
  });
}

export function useZoneDistrictName(districtId: string | null) {
  return useQuery({
    queryKey: DISTRICTS_KEY,
    queryFn: () => listDistricts(),
    enabled: districtId !== null,
    staleTime: Infinity,
    select: (districts) => districts.find((district) => district.id === districtId) ?? null,
  });
}
