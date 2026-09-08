/**
 * Display helpers for the staff worklist and application card (Track 3).
 * Kept local to `src/pages/staff/` on purpose — the applicant track builds
 * its own card separately and duplicates rather than shares (sprint plan
 * ownership boundary), so nothing here is imported outside this folder.
 */
import type { components } from '../../api/schema';

export type ApplicationStatus = components['schemas']['ApplicationOut']['status'];
export type CheckResult = 'pass' | 'fail' | 'warning' | 'skipped';

/** `ApplicationStatus` labels, Uzbek Latin only. F16
 * (`docs/plans/07.3-findings.md`): every one of these used to carry a
 * Russian gloss in brackets — «Qoralama (Черновик)» — on every row of every
 * staff list, while the applicant's own timeline has always rendered the
 * same statuses cleanly, in one language. It read as a development aid that
 * shipped; it was never a real bilingual UI (nothing here honours the
 * account's own language the way `localizedName`, just below, now does; a
 * `ru` account still reads Uzbek here — a follow-up for whoever wires
 * `STATUS_LABELS` to `useLanguage()`, not a reason to keep printing both).
 *
 * Every literal `ApplicationOut.status` can carry (`app/modules/applications
 * /schemas.py::ApplicationStatus`), not only the ones 3.9a-flow can itself
 * produce — a filter or a stray row must never render as an unlabeled code. */
export const STATUS_LABELS_I18N: Record<string, Record<ApplicationStatus, string>> = {
  uz_latn: {
    DRAFT: 'Qoralama',
    SUBMITTED: 'Yuborilgan',
    IN_REVIEW: 'Koʻrib chiqilmoqda',
    PENDING_INFO: 'Maʼlumot kutilmoqda',
    RETURNED: 'Tuzatishga qaytarilgan',
    APPROVED: 'Tasdiqlangan',
    INVOICED: 'Hisob-faktura yuborilgan',
    PAID: 'Toʻlangan',
    PERMIT_ISSUED: 'Ruxsatnoma berilgan',
    REJECTED: 'Rad etilgan',
    CANCELLED: 'Bekor qilingan',
    EXPIRED_UNPAID: 'Toʻlanmay muddati oʻtgan',
    CLOSED: 'Yopilgan',
    ARCHIVED: 'Arxivlangan',
  },
  uz_cyrl: {
    DRAFT: 'Қоралама',
    SUBMITTED: 'Юборилган',
    IN_REVIEW: 'Кўриб чиқилмоқда',
    PENDING_INFO: 'Маълумот кутилмоқда',
    RETURNED: 'Тузатишга қайтарилган',
    APPROVED: 'Тасдиқланган',
    INVOICED: 'Ҳисоб-фактура юборилган',
    PAID: 'Тўланган',
    PERMIT_ISSUED: 'Рухсатнома берилган',
    REJECTED: 'Рад этилган',
    CANCELLED: 'Бекор қилинган',
    EXPIRED_UNPAID: 'Тўланмай муддати ўтган',
    CLOSED: 'Ёпилган',
    ARCHIVED: 'Архивланган',
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
    CLOSED: 'Закрыто',
    ARCHIVED: 'В архиве',
  },
  en: {
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted',
    IN_REVIEW: 'In review',
    PENDING_INFO: 'Pending information',
    RETURNED: 'Returned for correction',
    APPROVED: 'Approved',
    INVOICED: 'Invoiced',
    PAID: 'Paid',
    PERMIT_ISSUED: 'Permit issued',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
    EXPIRED_UNPAID: 'Expired (unpaid)',
    CLOSED: 'Closed',
    ARCHIVED: 'Archived',
  },
  kaa: {
    DRAFT: 'Dáslepki nusqa',
    SUBMITTED: 'Jiberilgen',
    IN_REVIEW: 'Kórip shıǵılmaqta',
    PENDING_INFO: 'Maǵlıwmat kútilmekte',
    RETURNED: 'Dúzetiwge qaytarılǵan',
    APPROVED: 'Tastıyıqlanǵan',
    INVOICED: 'Esap-faktura jiberilgen',
    PAID: 'Tólengen',
    PERMIT_ISSUED: 'Ruxsatnama berilgen',
    REJECTED: 'Biykarlanǵan',
    CANCELLED: 'Biykar etilgen',
    EXPIRED_UNPAID: 'Tólenbey múddeti ótken',
    CLOSED: 'Jabılǵan',
    ARCHIVED: 'Arxivlengen',
  },
};

export const STATUS_LABELS: Record<ApplicationStatus, string> = STATUS_LABELS_I18N.uz_latn;

export function statusLabel(status: ApplicationStatus, lang: string = 'uz_latn'): string {
  const table = STATUS_LABELS_I18N[lang] || STATUS_LABELS_I18N.uz_latn;
  return table[status] ?? STATUS_LABELS[status] ?? status;
}

export const CHECK_TYPE_LABELS_I18N: Record<string, Record<string, string>> = {
  uz_latn: {
    gis_validity: 'GIS: geometriya yaroqliligi',
    gis_within_fund: 'GIS: oʻrmon fondi chegarasida',
    gis_overlap: 'GIS: boshqa ruxsatnoma bilan kesishuv',
    norm_available: 'Meʼyor: mavjudligi',
    norm_season: 'Meʼyor: mavsum',
    norm_rotation: 'Meʼyor: almashlab foydalanish',
    norm_fire_ban: 'Meʼyor: yong\'in xavfi taqiqi',
    norm_restrictions: 'Meʼyor: cheklov qatlamlari (maslahat xarakterida)',
    norm_limit: 'Meʼyor: sigʻim limiti (MaxSB)',
    vet: 'Veterinariya',
    cadastre: 'Kadastr',
  },
  uz_cyrl: {
    gis_validity: 'ГИС: геометрия яроқлилиги',
    gis_within_fund: 'ГИС: ўрмон фонди чегарасида',
    gis_overlap: 'ГИС: бошқа рухсатнома билан кесишув',
    norm_available: 'Меъёр: мавжудлиги',
    norm_season: 'Меъёр: мавсум',
    norm_rotation: 'Меъёр: алмашлаб фойдаланиш',
    norm_fire_ban: 'Меъёр: ёнғин хавфи тақиқи',
    norm_restrictions: 'Меъёр: чеклов қатламлари (маслаҳат характерида)',
    norm_limit: 'Меъёр: сиғим лимити (MaxSB)',
    vet: 'Ветеринария',
    cadastre: 'Кадастр',
  },
  ru: {
    gis_validity: 'ГИС: валидность геометрии',
    gis_within_fund: 'ГИС: в границах лесного фонда',
    gis_overlap: 'ГИС: пересечение с другим разрешением',
    norm_available: 'Норма: доступность',
    norm_season: 'Норма: сезон',
    norm_rotation: 'Норма: ротация',
    norm_fire_ban: 'Норма: запрет пожарной опасности',
    norm_restrictions: 'Норма: слои ограничений (рекомендательные)',
    norm_limit: 'Норма: лимит вместимости (MaxSB)',
    vet: 'Ветеринария',
    cadastre: 'Кадастр',
  },
  en: {
    gis_validity: 'GIS: geometry validity',
    gis_within_fund: 'GIS: within forest fund boundary',
    gis_overlap: 'GIS: overlap with another permit',
    norm_available: 'Norm: availability',
    norm_season: 'Norm: season',
    norm_rotation: 'Norm: rotation',
    norm_fire_ban: 'Norm: fire hazard ban',
    norm_restrictions: 'Norm: restriction layers (advisory)',
    norm_limit: 'Norm: capacity limit (MaxSB)',
    vet: 'Veterinary',
    cadastre: 'Cadastre',
  },
  kaa: {
    gis_validity: 'GIS: geometriya jaramlılıǵı',
    gis_within_fund: 'GIS: toǵay fondı shegarasında',
    gis_overlap: 'GIS: basqa ruxsatnama menen kesilisiw',
    norm_available: 'Norma: barlıǵı',
    norm_season: 'Norma: máwsim',
    norm_rotation: 'Norma: almastırıp paydalanıw',
    norm_fire_ban: 'Norma: órt qáwipi qadaǵanı',
    norm_restrictions: 'Norma: sheklew qatlamları (maslahát sıpatında)',
    norm_limit: 'Norma: sıyımlılıq limiti (MaxSB)',
    vet: 'Veterinariya',
    cadastre: 'Kadastr',
  },
};

export const CHECK_TYPE_LABELS: Record<string, string> = CHECK_TYPE_LABELS_I18N.uz_latn;

export function checkTypeLabel(checkType: string, lang: string = 'uz_latn'): string {
  const table = CHECK_TYPE_LABELS_I18N[lang] || CHECK_TYPE_LABELS_I18N.uz_latn;
  return table[checkType] ?? CHECK_TYPE_LABELS[checkType] ?? checkType;
}

const CHECK_RESULT_LABELS_I18N: Record<string, Record<CheckResult, string>> = {
  uz_latn: {
    pass: 'Oʻtdi',
    fail: 'Oʻtmadi',
    warning: 'Ogohlantirish',
    skipped: 'Oʻtkazib yuborilgan',
  },
  uz_cyrl: {
    pass: 'Ўтди',
    fail: 'Ўтмади',
    warning: 'Огоҳлантириш',
    skipped: 'Ўтказиб юборилган',
  },
  ru: {
    pass: 'Пройдено',
    fail: 'Не пройдено',
    warning: 'Предупреждение',
    skipped: 'Пропущено',
  },
  en: {
    pass: 'Passed',
    fail: 'Failed',
    warning: 'Warning',
    skipped: 'Skipped',
  },
  kaa: {
    pass: 'Ótti',
    fail: 'Ótpedi',
    warning: 'Eskertiw',
    skipped: 'Ótkizip jiberilgen',
  },
};

export const CHECK_RESULT_STYLE: Record<
  CheckResult,
  { label: string; badgeClass: string; dotClass: string }
> = {
  pass: {
    label: "Oʻtdi",
    badgeClass: 'bg-[#F0F7F1] border-[#D9EBDC] text-[#123522]',
    dotClass: 'bg-[#15803D]',
  },
  fail: {
    label: "Oʻtmadi",
    badgeClass: 'bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]',
    dotClass: 'bg-[#B91C1C]',
  },
  warning: {
    label: "Ogohlantirish",
    badgeClass: 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]',
    dotClass: 'bg-[#B45309]',
  },
  skipped: {
    label: "Oʻtkazib yuborilgan",
    badgeClass: 'bg-[#F8F9FA] border-[#E4E7EA] text-[#5A646D]',
    dotClass: 'bg-[#9AA3AB]',
  },
};

export function checkResultStyle(result: string, lang: string = 'uz_latn') {
  const base = CHECK_RESULT_STYLE[result as CheckResult] ?? CHECK_RESULT_STYLE.skipped;
  const table = CHECK_RESULT_LABELS_I18N[lang] || CHECK_RESULT_LABELS_I18N.uz_latn;
  const label = table[result as CheckResult] ?? base.label;
  return { ...base, label };
}

/** A localized `{lang: text}` map (`ActivityTypeOut.name`,
 * `ClassifierItemOut.name`, `OrganizationOut.name`, `RoleOut.name`) picked
 * for the caller's own UI language — never a fixed key order. F14
 * (`docs/plans/07.3-findings.md`): this used to try `en` before anything
 * else, regardless of who was looking at the screen, which is exactly why
 * the applications filter and the staff card once showed reference data in
 * English on an Uzbek-Latin interface. Decision #90 made `uz_latn` the
 * REQUIRED field of every `LocalizedName` (backfilled before the flip), so
 * it is always there to fall back to — the seed no longer lacks it the way
 * this function's old comment assumed. */
export function localizedName(
  name: Record<string, unknown> | null | undefined,
  lang: 'uz_latn' | 'ru' = 'uz_latn',
): string {
  if (!name) return '';
  const direct = name[lang];
  if (typeof direct === 'string' && direct) return direct;
  for (const key of ['uz_latn', 'uz_cyrl', 'ru', 'en', 'kaa']) {
    const value = name[key];
    if (typeof value === 'string' && value) return value;
  }
  const first = Object.values(name).find((v) => typeof v === 'string' && v);
  return typeof first === 'string' ? first : '';
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

/** F15 (`docs/plans/07.3-findings.md`): the seeded ids are uuid7
 * (`ffffffff-ffff-7fff-...`), whose LEADING hex characters are a millisecond
 * timestamp — records created moments apart in the same seed run share that
 * prefix, so slicing from the front once showed two different actors, or an
 * actor and an organization, as the identical "eight characters". The
 * TRAILING characters are the random tail (`rand_a`/`rand_b`, RFC 9562), not
 * derived from the clock, so they are what actually tells two rows apart.
 * Still not a name — no route resolves an arbitrary user id to one for a
 * general staff caller (`HistoryPanel.tsx`'s own comment) — only a distinct
 * fingerprint instead of a colliding one. */
export function shortId(id: string): string {
  return id.slice(-8);
}

// --- D3 (3.9b task 4): the SLA clock, honestly ------------------------------
//
// `docs/status.md`'s own fact: "the SLA clock PAUSES on an information
// request, and a forwarded application keeps its ORIGINAL deadline rather
// than starting a new one" (decision #67, ruling 9). Mirrors
// `app/modules/applications/sla.py` exactly: `SLA_ACTIVE_STATUSES =
// ("SUBMITTED", "IN_REVIEW")` are the only two where the clock is actually
// running; `is_overdue()` checks `status in SLA_ACTIVE_STATUSES` BEFORE it
// ever compares `now` to the deadline, so PENDING_INFO (an open pause),
// RETURNED (`submit()` deliberately keeps the existing deadline on a
// resubmission rather than resetting it, ruling 16.1) and every decided or
// terminal status are never "overdue" however stale their stored deadline
// looks. A client that keeps comparing the stored `sla_deadline_at` to the
// wall clock regardless of status would show a countdown for a clock that
// has stopped, or worse, report the application overdue for a delay it did
// not cause.

export type SlaState = 'paused' | 'overdue' | 'soon' | 'normal' | null;

const SLA_ACTIVE_STATUSES: ReadonlySet<ApplicationStatus> = new Set(['SUBMITTED', 'IN_REVIEW']);

/**
 * `overdueFromServer`, when supplied, is `ApplicationCardOut.sla_overdue`
 * (`sla.is_overdue`) — the authoritative answer, computed with the SAME
 * `SLA_ACTIVE_STATUSES` rule this function mirrors client-side, plus
 * knowledge this function does not have (today's business calendar).
 * Preferred whenever it is available; the list row (`ApplicationOut`)
 * carries no such field, so `WorklistRow` calls this with it omitted and
 * falls back to comparing the stored deadline itself — but only for the two
 * statuses where that comparison means anything.
 */
export function slaStatus(
  status: ApplicationStatus,
  slaDeadlineAt: string | null,
  overdueFromServer?: boolean,
): SlaState {
  // PENDING_INFO gets its own, more informative label — it is the one
  // status an officer can act on right now (nudge the applicant), unlike a
  // merely-inactive one.
  if (status === 'PENDING_INFO') return 'paused';
  if (!slaDeadlineAt) return null;
  if (overdueFromServer !== undefined) return overdueFromServer ? 'overdue' : 'normal';
  if (!SLA_ACTIVE_STATUSES.has(status)) return 'normal';
  const deadline = new Date(slaDeadlineAt).getTime();
  const now = Date.now();
  if (deadline < now) return 'overdue';
  if (deadline - now < 24 * 60 * 60 * 1000) return 'soon';
  return 'normal';
}
