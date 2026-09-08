import type { StatusType } from '../../components/ui/StatusBadge';
import type { ApplicationStatus } from './api';

/** `StatusBadge` (the shared design-system component) only ships six visual
 * kinds; `ApplicationStatus` (tz/05) has fourteen. This maps every one of
 * them onto a badge kind plus the Uzbek label this track's screens show —
 * kept here, once, so B6's list and B8's card never disagree about what a
 * status looks like. */
export const STATUS_LABELS_I18N: Record<string, Record<ApplicationStatus, string>> = {
  uz_latn: {
    DRAFT: 'Qoralama',
    SUBMITTED: 'Yuborildi',
    IN_REVIEW: "Ko'rib chiqilmoqda",
    PENDING_INFO: "Ma'lumot so'ralmoqda",
    RETURNED: 'Tuzatishga qaytarildi',
    APPROVED: 'Tasdiqlandi',
    INVOICED: 'Hisob-faktura chiqarildi',
    PAID: "To'landi",
    PERMIT_ISSUED: 'Ruxsatnoma berildi',
    REJECTED: 'Rad etildi',
    CANCELLED: 'Bekor qilindi',
    EXPIRED_UNPAID: "Muddati o'tdi (to'lanmagan)",
    CLOSED: 'Yakunlandi',
    ARCHIVED: 'Arxivlandi',
  },
  uz_cyrl: {
    DRAFT: 'Қоралама',
    SUBMITTED: 'Юборилди',
    IN_REVIEW: 'Кўриб чиқилмоқда',
    PENDING_INFO: 'Маълумот сўралмоқда',
    RETURNED: 'Тузатишга қайтарилди',
    APPROVED: 'Тасдиқланди',
    INVOICED: 'Ҳисоб-фактура чиқарилди',
    PAID: 'Тўланди',
    PERMIT_ISSUED: 'Рухсатнома берилди',
    REJECTED: 'Рад этилди',
    CANCELLED: 'Бекор қилинди',
    EXPIRED_UNPAID: 'Муддати ўтди (тўланмаган)',
    CLOSED: 'Якунланди',
    ARCHIVED: 'Архивланди',
  },
  ru: {
    DRAFT: 'Черновик',
    SUBMITTED: 'Отправлено',
    IN_REVIEW: 'На рассмотрении',
    PENDING_INFO: 'Запрос информации',
    RETURNED: 'Возвращено на доработку',
    APPROVED: 'Одобрено',
    INVOICED: 'Выставлен счет-фактура',
    PAID: 'Оплачено',
    PERMIT_ISSUED: 'Разрешение выдано',
    REJECTED: 'Отклонено',
    CANCELLED: 'Отменено',
    EXPIRED_UNPAID: 'Просрочено (не оплачено)',
    CLOSED: 'Завершено',
    ARCHIVED: 'В архиве',
  },
  en: {
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted',
    IN_REVIEW: 'Under review',
    PENDING_INFO: 'Information requested',
    RETURNED: 'Returned for revision',
    APPROVED: 'Approved',
    INVOICED: 'Invoiced',
    PAID: 'Paid',
    PERMIT_ISSUED: 'Permit issued',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
    EXPIRED_UNPAID: 'Expired (unpaid)',
    CLOSED: 'Completed',
    ARCHIVED: 'Archived',
  },
  kaa: {
    DRAFT: 'Dáslepki nusqa',
    SUBMITTED: 'Jiberildi',
    IN_REVIEW: 'Kórip shıǵılmaqta',
    PENDING_INFO: 'Maǵlıwmat soralmaqta',
    RETURNED: 'Dúzetiwge qaytarıldı',
    APPROVED: 'Tastıyıqlandı',
    INVOICED: 'Esap-faktura shıǵarıldı',
    PAID: 'Tólendi',
    PERMIT_ISSUED: 'Ruxsatnama berildi',
    REJECTED: 'Biykar etildi',
    CANCELLED: 'Biykar etildi',
    EXPIRED_UNPAID: 'Múddeti ótti (tólenbegen)',
    CLOSED: 'Juwmaqlandı',
    ARCHIVED: 'Arxivlendi',
  },
};

export const STATUS_LABELS: Record<ApplicationStatus, string> = STATUS_LABELS_I18N.uz_latn;

export function getStatusLabel(status: ApplicationStatus, lang: string = 'uz_latn'): string {
  const table = STATUS_LABELS_I18N[lang] || STATUS_LABELS_I18N.uz_latn;
  return table[status] || STATUS_LABELS[status] || status;
}

export const STATUS_BADGE_KIND: Record<ApplicationStatus, StatusType> = {
  DRAFT: 'draft',
  SUBMITTED: 'pending',
  IN_REVIEW: 'pending',
  PENDING_INFO: 'warning',
  RETURNED: 'warning',
  APPROVED: 'approved',
  INVOICED: 'info',
  PAID: 'approved',
  PERMIT_ISSUED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'rejected',
  EXPIRED_UNPAID: 'rejected',
  CLOSED: 'info',
  ARCHIVED: 'info',
};

export const ALL_STATUSES: ApplicationStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'IN_REVIEW',
  'PENDING_INFO',
  'RETURNED',
  'APPROVED',
  'INVOICED',
  'PAID',
  'PERMIT_ISSUED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED_UNPAID',
  'CLOSED',
  'ARCHIVED',
];
