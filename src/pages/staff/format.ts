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
export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT: "Qoralama",
  SUBMITTED: "Yuborilgan",
  IN_REVIEW: "Koʻrib chiqilmoqda",
  PENDING_INFO: "Maʼlumot kutilmoqda",
  RETURNED: "Tuzatishga qaytarilgan",
  APPROVED: "Tasdiqlangan",
  INVOICED: "Hisob-faktura yuborilgan",
  PAID: "Toʻlangan",
  PERMIT_ISSUED: "Ruxsatnoma berilgan",
  REJECTED: "Rad etilgan",
  CANCELLED: "Bekor qilingan",
  EXPIRED_UNPAID: "Toʻlanmay muddati oʻtgan",
  CLOSED: "Yopilgan",
  ARCHIVED: "Arxivlangan",
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
 * as either a pass or a failure. F16: the Russian gloss is gone from `label`
 * for the same reason `STATUS_LABELS` above lost its own. */
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

export function checkResultStyle(result: string) {
  return CHECK_RESULT_STYLE[result as CheckResult] ?? CHECK_RESULT_STYLE.skipped;
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
