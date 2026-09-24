import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  Award,
  Ban,
  CircleCheck,
  CircleX,
  Eye,
  Flag,
  MessageCircleQuestion,
  Receipt,
  Send,
  TimerOff,
  Undo2,
  Wallet,
} from 'lucide-react';
import type { ApplicationStatus } from './api';

/** Every `ApplicationStatus` (tz/05) the applicant's and the staff's screens
 * can show, with the Uzbek (and other) labels the applicant's screens use and
 * the one palette every screen draws a status in — kept here, once, so the
 * list, the card, the staff worklist and the notification chips never
 * disagree about what a status looks like. `DRAFT` left the vocabulary in
 * stage 12 (plan 12, R1/R11): an application exists only from the moment it
 * is filed. */
export const STATUS_LABELS_I18N: Record<string, Record<ApplicationStatus, string>> = {
  uz_latn: {
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

export interface StatusStyle {
  className: string;
  icon: LucideIcon;
}

/** Also what a code this table does not know is drawn in. */
export const GREY = 'bg-[#F8F9FA] text-[#5A646D] border-[#E4E7EA]';
const AMBER = 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]';
const RED = 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]';

/** The ONE palette an application status is drawn in, for the applicant's
 * screens and the staff's alike. Two palettes lived side by side before —
 * `StatusBadge`'s six kinds on the applicant side, where "Yuborildi",
 * "Ko'rib chiqilmoqda" and "Hisob-faktura chiqarildi" all came out the same
 * blue, and a hand-kept class table in the staff worklist that coloured the
 * same statuses differently again.
 *
 * Colour says what the status asks of whom: blue and indigo — the Agency is
 * working; amber — the applicant has to answer; teal — approved; orange — the
 * applicant has to pay; green — paid, and solid green once the permit is
 * issued; red — refused or lapsed; grey — over and done with. Statuses that
 * share a colour are told apart by the icon. */
export const APPLICATION_STATUS_STYLE: Record<ApplicationStatus, StatusStyle> = {
  SUBMITTED: { className: 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]', icon: Send },
  IN_REVIEW: { className: 'bg-[#EEF2FF] text-[#4338CA] border-[#C7D2FE]', icon: Eye },
  PENDING_INFO: { className: AMBER, icon: MessageCircleQuestion },
  RETURNED: { className: AMBER, icon: Undo2 },
  APPROVED: { className: 'bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4]', icon: CircleCheck },
  INVOICED: { className: 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]', icon: Receipt },
  PAID: { className: 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]', icon: Wallet },
  PERMIT_ISSUED: { className: 'bg-[#15803D] text-white border-[#15803D]', icon: Award },
  REJECTED: { className: RED, icon: CircleX },
  EXPIRED_UNPAID: { className: RED, icon: TimerOff },
  CANCELLED: { className: GREY, icon: Ban },
  CLOSED: { className: GREY, icon: Flag },
  ARCHIVED: { className: GREY, icon: Archive },
};

export const ALL_STATUSES: ApplicationStatus[] = [
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
