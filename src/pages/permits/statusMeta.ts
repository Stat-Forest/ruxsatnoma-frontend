export const PERMIT_STATUS_LABEL_I18N: Record<string, Record<string, string>> = {
  uz_latn: {
    pending_signatures: 'Imzolar kutilmoqda',
    active: 'Amalda',
    suspended: 'Toʻxtatilgan',
    revoked: 'Bekor qilingan',
    expired: 'Muddati tugagan',
    archived: 'Arxivlangan',
  },
  uz_cyrl: {
    pending_signatures: 'Имзолар кутилмоқда',
    active: 'Амалда',
    suspended: 'Тўхтатилган',
    revoked: 'Бекор қилинган',
    expired: 'Муддати тугаган',
    archived: 'Архивланган',
  },
  ru: {
    pending_signatures: 'Ожидаются подписи',
    active: 'Действует',
    suspended: 'Приостановлено',
    revoked: 'Аннулировано',
    expired: 'Истек срок',
    archived: 'В архиве',
  },
  en: {
    pending_signatures: 'Pending signatures',
    active: 'Active',
    suspended: 'Suspended',
    revoked: 'Revoked',
    expired: 'Expired',
    archived: 'Archived',
  },
  kaa: {
    pending_signatures: 'Qol qoyıw kútilmekte',
    active: 'Ámelde',
    suspended: 'Toqtatılǵan',
    revoked: 'Biykar etilgen',
    expired: 'Múddeti pitken',
    archived: 'Arxivlengen',
  },
};

export const PERMIT_STATUS_LABEL: Record<string, string> = PERMIT_STATUS_LABEL_I18N.uz_latn;

export function getPermitStatusLabel(status: string, lang: string = 'uz_latn'): string {
  const table = PERMIT_STATUS_LABEL_I18N[lang] || PERMIT_STATUS_LABEL_I18N.uz_latn;
  return table[status] || PERMIT_STATUS_LABEL[status] || status;
}

export const PERMIT_STATUS_STYLE: Record<string, string> = {
  pending_signatures: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
  active: 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]',
  suspended: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]',
  revoked: 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]',
  expired: 'bg-[#F8F9FA] text-[#5A646D] border-[#E4E7EA]',
  archived: 'bg-[#F8F9FA] text-[#5A646D] border-[#E4E7EA]',
};

export const INVOICE_STATUS_LABEL_I18N: Record<string, Record<string, string>> = {
  uz_latn: {
    pending: 'Toʻlov kutilmoqda',
    paid: 'Toʻlangan',
    expired: 'Muddati tugagan',
    cancelled: 'Bekor qilingan',
  },
  uz_cyrl: {
    pending: 'Тўлов кутилмоқда',
    paid: 'Тўланган',
    expired: 'Муддати тугаган',
    cancelled: 'Бекор қилинган',
  },
  ru: {
    pending: 'Ожидает оплаты',
    paid: 'Оплачено',
    expired: 'Истек срок',
    cancelled: 'Отменено',
  },
  en: {
    pending: 'Pending payment',
    paid: 'Paid',
    expired: 'Expired',
    cancelled: 'Cancelled',
  },
  kaa: {
    pending: 'Tólew kútilmekte',
    paid: 'Tólengen',
    expired: 'Múddeti pitken',
    cancelled: 'Biykar etilgen',
  },
};

export const INVOICE_STATUS_LABEL: Record<string, string> = INVOICE_STATUS_LABEL_I18N.uz_latn;

export function getInvoiceStatusLabel(status: string, lang: string = 'uz_latn'): string {
  const table = INVOICE_STATUS_LABEL_I18N[lang] || INVOICE_STATUS_LABEL_I18N.uz_latn;
  return table[status] || INVOICE_STATUS_LABEL[status] || status;
}

export const INVOICE_STATUS_STYLE: Record<string, string> = {
  pending: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
  paid: 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]',
  expired: 'bg-[#F8F9FA] text-[#5A646D] border-[#E4E7EA]',
  cancelled: 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]',
};

