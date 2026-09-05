/**
 * Label/style maps for every enum G1–G5 render, mirrored from
 * `backend/app/modules/payments/models.py` (checked 2026-09-05). Invoice
 * status itself is NOT duplicated here — `../permits/statusMeta.ts` already
 * declares `INVOICE_STATUS_LABEL`/`_STYLE` for `MyInvoicePage.tsx`, and this
 * module re-exports it so the accountant's screens read the exact same
 * badge a citizen sees on their own invoice, never a second copy that could
 * drift from it.
 */
export { INVOICE_STATUS_LABEL, INVOICE_STATUS_STYLE } from '../permits/statusMeta';

/** `bank_statement_lines.match_status` (`LINE_MATCH_STATUSES`). */
export const MATCH_STATUS_LABEL: Record<string, string> = {
  unmatched: 'Solishtirilmagan',
  matched: 'Mos keldi',
  unknown_payment: "Noma'lum toʻlov",
  discrepancy: 'Nomuvofiqlik',
  provider_settlement: "Provayder hisob-kitobi",
};

export const MATCH_STATUS_STYLE: Record<string, string> = {
  unmatched: 'bg-[#F8F9FA] text-[#5A646D] border-[#E4E7EA]',
  matched: 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]',
  unknown_payment: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
  discrepancy: 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]',
  provider_settlement: 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]',
};

/** `bank_statements.status` (`BANK_STATEMENT_STATUSES`). */
export const STATEMENT_STATUS_LABEL: Record<string, string> = {
  pending: 'Navbatda',
  parsing: "Qayta ishlanmoqda",
  parsed: "Qayta ishlandi",
  failed: 'Xatolik',
};

export const STATEMENT_STATUS_STYLE: Record<string, string> = {
  pending: 'bg-[#F8F9FA] text-[#5A646D] border-[#E4E7EA]',
  parsing: 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]',
  parsed: 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]',
  failed: 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]',
};

/** `reconciliations.result` (`RECONCILIATION_RESULTS`). */
export const RECONCILIATION_RESULT_LABEL: Record<string, string> = {
  matched: 'Mos keldi',
  discrepancy: 'Nomuvofiqlik',
  unknown: "Noma'lum",
};

/** `reconciliations.status` (`RECONCILIATION_STATUSES`). */
export const RECONCILIATION_STATUS_LABEL: Record<string, string> = {
  open: 'Ochiq',
  resolved: 'Yopildi',
};

export const RECONCILIATION_STATUS_STYLE: Record<string, string> = {
  open: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
  resolved: 'bg-[#F8F9FA] text-[#5A646D] border-[#E4E7EA]',
};

/** `manual_payment_confirmations.status` (`MANUAL_CONFIRMATION_STATUSES`). */
export const MANUAL_CONFIRMATION_STATUS_LABEL: Record<string, string> = {
  pending_check: 'Tekshiruv kutilmoqda',
  confirmed: 'Tasdiqlandi',
  rejected: 'Rad etildi',
};

export const MANUAL_CONFIRMATION_STATUS_STYLE: Record<string, string> = {
  pending_check: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
  confirmed: 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]',
  rejected: 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]',
};

/** `refunds.status` (`REFUND_STATUSES`). */
export const REFUND_STATUS_LABEL: Record<string, string> = {
  requested: "So'ralgan",
  in_review: 'Koʻrib chiqilmoqda',
  returned: 'Qaytarildi',
  rejected: 'Rad etildi',
};

export const REFUND_STATUS_STYLE: Record<string, string> = {
  requested: 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]',
  in_review: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
  returned: 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]',
  rejected: 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]',
};

/** `allocations.entry_type` (`ALLOCATION_ENTRY_TYPES`) — a ledger row is a
 *  payment, a refund's negative entry, or a reversal's correction. */
export const ENTRY_TYPE_LABEL: Record<string, string> = {
  payment: "To'lov",
  refund: 'Qaytarish',
  correction: 'Tuzatish (bekor qilish)',
};

/** `allocations.target` (`ALLOCATION_TARGETS`) — the 50/50 split's own two
 *  named halves, plus `other` for a refund's third bucket. */
export const ALLOCATION_TARGET_LABEL: Record<string, string> = {
  recipient: 'Ijrochi (leshoz)',
  budget: 'Davlat byudjeti',
  other: 'Boshqa',
};
