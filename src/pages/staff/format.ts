/**
 * Display helpers for the staff worklist and application card (Track 3).
 * Kept local to `src/pages/staff/` on purpose — the applicant track builds
 * its own card separately and duplicates rather than shares (sprint plan
 * ownership boundary), so nothing here is imported outside this folder.
 */
import type { components } from '../../api/schema';

export type ApplicationStatus = components['schemas']['ApplicationOut']['status'];
export type CheckResult = 'pass' | 'fail' | 'warning' | 'skipped';

/** `ApplicationStatus` labels, Uzbek Latin with a Russian gloss — the
 * reference's own convention (`StatusBadge`, `WorklistApplicationsTable`).
 * Every literal `ApplicationOut.status` can carry (`app/modules/applications
 * /schemas.py::ApplicationStatus`), not only the ones 3.9a-flow can itself
 * produce — a filter or a stray row must never render as an unlabeled code. */
export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT: "Qoralama (Черновик)",
  SUBMITTED: "Yuborilgan (Отправлена)",
  IN_REVIEW: "Koʻrib chiqilmoqda (На рассмотрении)",
  PENDING_INFO: "Maʼlumot kutilmoqda (Ожидает информации)",
  RETURNED: "Tuzatishga qaytarilgan (Возвращена)",
  APPROVED: "Tasdiqlangan (Одобрена)",
  INVOICED: "Hisob-faktura yuborilgan (Выставлен счёт)",
  PAID: "Toʻlangan (Оплачена)",
  PERMIT_ISSUED: "Ruxsatnoma berilgan (Разрешение выдано)",
  REJECTED: "Rad etilgan (Отклонена)",
  CANCELLED: "Bekor qilingan (Отменена)",
  EXPIRED_UNPAID: "Toʻlanmay muddati oʻtgan (Не оплачена, срок истёк)",
  CLOSED: "Yopilgan (Закрыта)",
  ARCHIVED: "Arxivlangan (В архиве)",
};

export function statusLabel(status: ApplicationStatus): string {
  return STATUS_LABELS[status] ?? status;
}

/** `application_checks.check_type` labels — the nine values `applications
 * /checks.py`'s ruling 21 vocabulary actually produces (`vet`/`cadastre` are
 * 3.9b's and never appear in a 3.9a-flow row, but are named here too so an
 * unexpected row still reads as words, not a raw code). */
export const CHECK_TYPE_LABELS: Record<string, string> = {
  gis_validity: "GIS: geometriya yaroqliligi",
  gis_within_fund: "GIS: oʻrmon fondi chegarasida",
  gis_overlap: "GIS: boshqa ruxsatnoma bilan kesishuv",
  norm_available: "Meʼyor: mavjudligi",
  norm_season: "Meʼyor: mavsum",
  norm_rotation: "Meʼyor: almashlab foydalanish",
  norm_fire_ban: "Meʼyor: yong'in xavfi taqiqi",
  norm_restrictions: "Meʼyor: cheklov qatlamlari (maslahat xarakterida)",
  norm_limit: "Meʼyor: sigʻim limiti (MaxSB)",
  vet: "Veterinariya",
  cadastre: "Kadastr",
};

export function checkTypeLabel(checkType: string): string {
  return CHECK_TYPE_LABELS[checkType] ?? checkType;
}

/** `application_checks.result` visual treatment. `skipped` is its own state
 * on purpose (task brief): it is the common case for `gis_within_fund` today
 * because the forest-fund boundary layer is still empty, and must never read
 * as either a pass or a failure. */
export const CHECK_RESULT_STYLE: Record<
  CheckResult,
  { label: string; badgeClass: string; dotClass: string }
> = {
  pass: {
    label: "Oʻtdi (Пройдено)",
    badgeClass: 'bg-[#F0F7F1] border-[#D9EBDC] text-[#123522]',
    dotClass: 'bg-[#15803D]',
  },
  fail: {
    label: "Oʻtmadi (Не пройдено)",
    badgeClass: 'bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]',
    dotClass: 'bg-[#B91C1C]',
  },
  warning: {
    label: "Ogohlantirish (Предупреждение)",
    badgeClass: 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]',
    dotClass: 'bg-[#B45309]',
  },
  skipped: {
    label: "Oʻtkazib yuborilgan (Пропущена)",
    badgeClass: 'bg-[#F8F9FA] border-[#E4E7EA] text-[#5A646D]',
    dotClass: 'bg-[#9AA3AB]',
  },
};

export function checkResultStyle(result: string) {
  return CHECK_RESULT_STYLE[result as CheckResult] ?? CHECK_RESULT_STYLE.skipped;
}

/** A localized `{lang: text}` map (`ActivityTypeOut.name`,
 * `ClassifierItemOut.name`, `OrganizationOut.name`, `RoleOut.name`) as one
 * best-effort string. The seeded reference data carries `uz_cyrl`/`en` only
 * (migration 0005) — no `ru` key exists yet — so this reads whatever is
 * actually there rather than assuming a key the seed does not write. */
export function localizedName(name: Record<string, unknown> | null | undefined): string {
  if (!name) return '';
  const candidate = name.en ?? name.uz_cyrl ?? name.ru ?? name.uz_latn ?? Object.values(name)[0];
  return typeof candidate === 'string' ? candidate : '';
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** `ApplicationOut`/`ApplicationCalculationOut` render every decimal as a
 * string already trimmed by the backend (`_trim_decimal`) — this only adds
 * thousands separators, never re-parses through a float (a `Decimal` money
 * value must round-trip exactly). */
export function formatAmount(value: string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const [intPart, fracPart] = value.split('.');
  const withSeparators = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return fracPart ? `${withSeparators},${fracPart}` : withSeparators;
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}

// --- D3 (3.9b task 4): the SLA clock, honestly ------------------------------
//
// `docs/status.md`'s own fact: "the SLA clock PAUSES on an information
// request, and a forwarded application keeps its ORIGINAL deadline rather
// than starting a new one" (decision #67, ruling 9). `PENDING_INFO` is the
// one status that means the clock is paused right now — nothing else in
// `application_status_history` writes it — so a client that keeps comparing
// the stored `sla_deadline_at` to the wall clock while PENDING_INFO would
// show a countdown for a clock that has stopped, or worse, report the
// application overdue for a delay it caused itself.

export type SlaState = 'paused' | 'overdue' | 'soon' | 'normal' | null;

/**
 * `overdueFromServer`, when supplied, is `ApplicationCardOut.sla_overdue`
 * (`sla.is_overdue`) — computed server-side with the same PENDING_INFO
 * short-circuit this function applies client-side, plus knowledge this
 * function does not have (today's business calendar). Preferred over the
 * client's own `Date.now()` comparison whenever it is available; the list
 * row (`ApplicationOut`) carries no such field, so `WorklistRow` calls this
 * with it omitted and falls back to comparing the stored deadline itself.
 */
export function slaStatus(
  status: ApplicationStatus,
  slaDeadlineAt: string | null,
  overdueFromServer?: boolean,
): SlaState {
  if (status === 'PENDING_INFO') return 'paused';
  if (!slaDeadlineAt) return null;
  if (overdueFromServer !== undefined) return overdueFromServer ? 'overdue' : 'normal';
  const deadline = new Date(slaDeadlineAt).getTime();
  const now = Date.now();
  if (deadline < now) return 'overdue';
  if (deadline - now < 24 * 60 * 60 * 1000) return 'soon';
  return 'normal';
}
