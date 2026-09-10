/**
 * Label/style maps for every enum G1–G5 render, mirrored from
 * `backend/app/modules/payments/models.py` (checked 2026-09-05). Invoice
 * status itself is NOT duplicated here — `../permits/statusMeta.ts` already
 * declares `INVOICE_STATUS_LABEL`/`_STYLE` for `MyInvoicePage.tsx`, and this
 * module re-exports it so the accountant's screens read the exact same
 * badge a citizen sees on their own invoice, never a second copy that could
 * drift from it.
 */
export {
  INVOICE_STATUS_LABEL_I18N,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_STYLE,
  getInvoiceStatusLabel,
} from '../permits/statusMeta';

/** `bank_statement_lines.match_status` (`LINE_MATCH_STATUSES`). */
export const MATCH_STATUS_LABEL_I18N: Record<string, Record<string, string>> = {
  uz_latn: {
    unmatched: 'Solishtirilmagan',
    matched: 'Mos keldi',
    unknown_payment: "Noma'lum toʻlov",
    discrepancy: 'Nomuvofiqlik',
    provider_settlement: 'Provayder hisob-kitobi',
  },
  uz_cyrl: {
    unmatched: 'Солиштирилмаган',
    matched: 'Мос келди',
    unknown_payment: 'Номаълум тўлов',
    discrepancy: 'Номувофиқлик',
    provider_settlement: 'Провайдер ҳисоб-китоби',
  },
  ru: {
    unmatched: 'Не сопоставлено',
    matched: 'Сопоставлено',
    unknown_payment: 'Неизвестный платеж',
    discrepancy: 'Расхождение',
    provider_settlement: 'Расчет провайдера',
  },
  en: {
    unmatched: 'Unmatched',
    matched: 'Matched',
    unknown_payment: 'Unknown payment',
    discrepancy: 'Discrepancy',
    provider_settlement: 'Provider settlement',
  },
  kaa: {
    unmatched: 'Salıstırılmaǵan',
    matched: 'Múwapıq keldi',
    unknown_payment: 'Belgisiz tólem',
    discrepancy: 'Kelispewshilik',
    provider_settlement: 'Provayder esap-kitabı',
  },
};

export const MATCH_STATUS_LABEL: Record<string, string> = MATCH_STATUS_LABEL_I18N.uz_latn;

export function getMatchStatusLabel(status: string, lang: string = 'uz_latn'): string {
  const table = MATCH_STATUS_LABEL_I18N[lang] || MATCH_STATUS_LABEL_I18N.uz_latn;
  return table[status] || MATCH_STATUS_LABEL[status] || status;
}

export const MATCH_STATUS_STYLE: Record<string, string> = {
  unmatched: 'bg-[#F8F9FA] text-[#5A646D] border-[#E4E7EA]',
  matched: 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]',
  unknown_payment: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
  discrepancy: 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]',
  provider_settlement: 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]',
};

/** `bank_statements.status` (`BANK_STATEMENT_STATUSES`). */
export const STATEMENT_STATUS_LABEL_I18N: Record<string, Record<string, string>> = {
  uz_latn: {
    pending: 'Navbatda',
    parsing: 'Qayta ishlanmoqda',
    parsed: 'Qayta ishlandi',
    failed: 'Xatolik',
  },
  uz_cyrl: {
    pending: 'Навбатда',
    parsing: 'Қайта ишланмоқда',
    parsed: 'Қайта ишланди',
    failed: 'Хатолик',
  },
  ru: {
    pending: 'В очереди',
    parsing: 'Обрабатывается',
    parsed: 'Обработано',
    failed: 'Ошибка',
  },
  en: {
    pending: 'Pending',
    parsing: 'Processing',
    parsed: 'Processed',
    failed: 'Failed',
  },
  kaa: {
    pending: 'Gezektesin',
    parsing: 'Qayta islenbekte',
    parsed: 'Qayta islendi',
    failed: 'Qátelik',
  },
};

export const STATEMENT_STATUS_LABEL: Record<string, string> = STATEMENT_STATUS_LABEL_I18N.uz_latn;

export function getStatementStatusLabel(status: string, lang: string = 'uz_latn'): string {
  const table = STATEMENT_STATUS_LABEL_I18N[lang] || STATEMENT_STATUS_LABEL_I18N.uz_latn;
  return table[status] || STATEMENT_STATUS_LABEL[status] || status;
}

export const STATEMENT_STATUS_STYLE: Record<string, string> = {
  pending: 'bg-[#F8F9FA] text-[#5A646D] border-[#E4E7EA]',
  parsing: 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]',
  parsed: 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]',
  failed: 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]',
};

/** `reconciliations.result` (`RECONCILIATION_RESULTS`). */
export const RECONCILIATION_RESULT_LABEL_I18N: Record<string, Record<string, string>> = {
  uz_latn: {
    matched: 'Mos keldi',
    discrepancy: 'Nomuvofiqlik',
    unknown: "Noma'lum",
  },
  uz_cyrl: {
    matched: 'Мос келди',
    discrepancy: 'Номувофиқлик',
    unknown: 'Номаълум',
  },
  ru: {
    matched: 'Сопоставлено',
    discrepancy: 'Расхождение',
    unknown: 'Неизвестно',
  },
  en: {
    matched: 'Matched',
    discrepancy: 'Discrepancy',
    unknown: 'Unknown',
  },
  kaa: {
    matched: 'Múwapıq keldi',
    discrepancy: 'Kelispewshilik',
    unknown: 'Belgisiz',
  },
};

export const RECONCILIATION_RESULT_LABEL: Record<string, string> = RECONCILIATION_RESULT_LABEL_I18N.uz_latn;

export function getReconciliationResultLabel(result: string, lang: string = 'uz_latn'): string {
  const table = RECONCILIATION_RESULT_LABEL_I18N[lang] || RECONCILIATION_RESULT_LABEL_I18N.uz_latn;
  return table[result] || RECONCILIATION_RESULT_LABEL[result] || result;
}

/** `reconciliations.status` (`RECONCILIATION_STATUSES`). */
export const RECONCILIATION_STATUS_LABEL_I18N: Record<string, Record<string, string>> = {
  uz_latn: {
    open: 'Ochiq',
    resolved: 'Yopildi',
  },
  uz_cyrl: {
    open: 'Очиқ',
    resolved: 'Ёпилди',
  },
  ru: {
    open: 'Открыто',
    resolved: 'Закрыто',
  },
  en: {
    open: 'Open',
    resolved: 'Resolved',
  },
  kaa: {
    open: 'Ashıq',
    resolved: 'Jabıldı',
  },
};

export const RECONCILIATION_STATUS_LABEL: Record<string, string> = RECONCILIATION_STATUS_LABEL_I18N.uz_latn;

export function getReconciliationStatusLabel(status: string, lang: string = 'uz_latn'): string {
  const table = RECONCILIATION_STATUS_LABEL_I18N[lang] || RECONCILIATION_STATUS_LABEL_I18N.uz_latn;
  return table[status] || RECONCILIATION_STATUS_LABEL[status] || status;
}

export const RECONCILIATION_STATUS_STYLE: Record<string, string> = {
  open: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
  resolved: 'bg-[#F8F9FA] text-[#5A646D] border-[#E4E7EA]',
};

/** `manual_payment_confirmations.status` (`MANUAL_CONFIRMATION_STATUSES`). */
export const MANUAL_CONFIRMATION_STATUS_LABEL_I18N: Record<string, Record<string, string>> = {
  uz_latn: {
    pending_check: 'Tekshiruv kutilmoqda',
    confirmed: 'Tasdiqlandi',
    rejected: 'Rad etildi',
  },
  uz_cyrl: {
    pending_check: 'Текширув кутилмоқда',
    confirmed: 'Тасдиқланди',
    rejected: 'Рад этилди',
  },
  ru: {
    pending_check: 'Ожидает проверки',
    confirmed: 'Подтверждено',
    rejected: 'Отклонено',
  },
  en: {
    pending_check: 'Pending check',
    confirmed: 'Confirmed',
    rejected: 'Rejected',
  },
  kaa: {
    pending_check: 'Tekseriw kútilmekte',
    confirmed: 'Tastıyıqlandı',
    rejected: 'Biykar etildi',
  },
};

export const MANUAL_CONFIRMATION_STATUS_LABEL: Record<string, string> =
  MANUAL_CONFIRMATION_STATUS_LABEL_I18N.uz_latn;

export function getManualConfirmationStatusLabel(status: string, lang: string = 'uz_latn'): string {
  const table = MANUAL_CONFIRMATION_STATUS_LABEL_I18N[lang] || MANUAL_CONFIRMATION_STATUS_LABEL_I18N.uz_latn;
  return table[status] || MANUAL_CONFIRMATION_STATUS_LABEL[status] || status;
}

export const MANUAL_CONFIRMATION_STATUS_STYLE: Record<string, string> = {
  pending_check: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
  confirmed: 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]',
  rejected: 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]',
};

/** `refunds.status` (`REFUND_STATUSES`). */
export const REFUND_STATUS_LABEL_I18N: Record<string, Record<string, string>> = {
  uz_latn: {
    requested: "So'ralgan",
    in_review: 'Koʻrib chiqilmoqda',
    returned: 'Qaytarildi',
    rejected: 'Rad etildi',
  },
  uz_cyrl: {
    requested: 'Сўралган',
    in_review: 'Кўриб чиқилмоқда',
    returned: 'Қайтарилди',
    rejected: 'Рад этилди',
  },
  ru: {
    requested: 'Запрошено',
    in_review: 'На рассмотрении',
    returned: 'Возвращено',
    rejected: 'Отклонено',
  },
  en: {
    requested: 'Requested',
    in_review: 'In review',
    returned: 'Refunded',
    rejected: 'Rejected',
  },
  kaa: {
    requested: 'Soralǵan',
    in_review: 'Kórip shıǵılmaqta',
    returned: 'Qaytarıldı',
    rejected: 'Biykar etildi',
  },
};

export const REFUND_STATUS_LABEL: Record<string, string> = REFUND_STATUS_LABEL_I18N.uz_latn;

export function getRefundStatusLabel(status: string, lang: string = 'uz_latn'): string {
  const table = REFUND_STATUS_LABEL_I18N[lang] || REFUND_STATUS_LABEL_I18N.uz_latn;
  return table[status] || REFUND_STATUS_LABEL[status] || status;
}

export const REFUND_STATUS_STYLE: Record<string, string> = {
  requested: 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]',
  in_review: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
  returned: 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]',
  rejected: 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]',
};

/** `allocations.entry_type` (`ALLOCATION_ENTRY_TYPES`) — a ledger row is a
 *  payment, a refund's negative entry, or a reversal's correction. */
export const ENTRY_TYPE_LABEL_I18N: Record<string, Record<string, string>> = {
  uz_latn: {
    payment: "To'lov",
    refund: 'Qaytarish',
    correction: 'Tuzatish (bekor qilish)',
  },
  uz_cyrl: {
    payment: 'Тўлов',
    refund: 'Қайтариш',
    correction: 'Тузатиш (бекор қилиш)',
  },
  ru: {
    payment: 'Платеж',
    refund: 'Возврат',
    correction: 'Корректировка (отмена)',
  },
  en: {
    payment: 'Payment',
    refund: 'Refund',
    correction: 'Correction (reversal)',
  },
  kaa: {
    payment: 'Tólem',
    refund: 'Qaytarıw',
    correction: 'Dúzetiw (biykar etiw)',
  },
};

export const ENTRY_TYPE_LABEL: Record<string, string> = ENTRY_TYPE_LABEL_I18N.uz_latn;

export function getEntryTypeLabel(entryType: string, lang: string = 'uz_latn'): string {
  const table = ENTRY_TYPE_LABEL_I18N[lang] || ENTRY_TYPE_LABEL_I18N.uz_latn;
  return table[entryType] || ENTRY_TYPE_LABEL[entryType] || entryType;
}

/** `allocations.target` (`ALLOCATION_TARGETS`, now `recipient`/`other`/
 *  `receiver` — the old hard-coded 50/50 `budget` half is retired, and the
 *  migration that removed it rewrote every historical row that carried it,
 *  so it can never appear again). `recipient` is the leshoz's own remainder
 *  row; `receiver` is a configured `payment_recipients` row — this generic
 *  label is only the FALLBACK for one, `InvoiceDetailDrawer.tsx`'s
 *  `LedgerSection` prefers that row's own `recipient_name` so three
 *  different receivers render as three distinguishable rows, not three
 *  identical "receiver" ones; `other` is a refund's third bucket. */
export const ALLOCATION_TARGET_LABEL_I18N: Record<string, Record<string, string>> = {
  uz_latn: {
    recipient: 'Ijrochi (leshoz)',
    receiver: 'Qabul qiluvchi',
    budget: 'Davlat byudjeti',
    other: 'Boshqa',
  },
  uz_cyrl: {
    recipient: 'Ижрочи (лесхоз)',
    receiver: 'Қабул қилувчи',
    budget: 'Давлат бюджети',
    other: 'Бошқа',
  },
  ru: {
    recipient: 'Исполнитель (лесхоз)',
    receiver: 'Получатель',
    budget: 'Государственный бюджет',
    other: 'Другое',
  },
  en: {
    recipient: 'Executor (forestry)',
    receiver: 'Recipient',
    budget: 'State budget',
    other: 'Other',
  },
  kaa: {
    recipient: 'Atqarıwshı (lesxoz)',
    receiver: 'Qabıllawshı',
    budget: 'Mámleketlik byudjet',
    other: 'Basqa',
  },
};

export const ALLOCATION_TARGET_LABEL: Record<string, string> = ALLOCATION_TARGET_LABEL_I18N.uz_latn;

export function getAllocationTargetLabel(target: string, lang: string = 'uz_latn'): string {
  const table = ALLOCATION_TARGET_LABEL_I18N[lang] || ALLOCATION_TARGET_LABEL_I18N.uz_latn;
  return table[target] || ALLOCATION_TARGET_LABEL[target] || target;
}
