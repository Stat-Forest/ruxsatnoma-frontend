/** `permits.status` (`app/modules/permits/models.py::PERMIT_STATUSES`), the
 *  whole six-row state machine from day one even though this stage only ever
 *  produces the first three (`design/02`; 3.11b writes the rest). */
export const PERMIT_STATUS_LABEL: Record<string, string> = {
  pending_signatures: 'Imzolar kutilmoqda',
  active: 'Amalda',
  suspended: "Toʻxtatilgan",
  revoked: 'Bekor qilingan',
  expired: 'Muddati tugagan',
  archived: 'Arxivlangan',
};

export const PERMIT_STATUS_STYLE: Record<string, string> = {
  pending_signatures: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
  active: 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]',
  suspended: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]',
  revoked: 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]',
  expired: 'bg-[#F8F9FA] text-[#5A646D] border-[#E4E7EA]',
  archived: 'bg-[#F8F9FA] text-[#5A646D] border-[#E4E7EA]',
};

/** `invoices.status` (`app/modules/payments/models.py::INVOICE_STATUSES`). */
export const INVOICE_STATUS_LABEL: Record<string, string> = {
  pending: "Toʻlov kutilmoqda",
  paid: "Toʻlangan",
  expired: "Muddati tugagan",
  cancelled: 'Bekor qilingan',
};

export const INVOICE_STATUS_STYLE: Record<string, string> = {
  pending: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
  paid: 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]',
  expired: 'bg-[#F8F9FA] text-[#5A646D] border-[#E4E7EA]',
  cancelled: 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]',
};
