import type { StatusType } from '../../components/ui/StatusBadge';
import type { ApplicationStatus } from './api';

/** `StatusBadge` (the shared design-system component) only ships six visual
 * kinds; `ApplicationStatus` (tz/05) has fourteen. This maps every one of
 * them onto a badge kind plus the Uzbek label this track's screens show —
 * kept here, once, so B6's list and B8's card never disagree about what a
 * status looks like. */
export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT: "Qoralama",
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
};

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
