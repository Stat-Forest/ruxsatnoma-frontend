/**
 * Display helpers for the benefit-verification office (stage 9, T11,
 * decisions.md #179). Kept local to `src/pages/benefits/` on purpose — the
 * same per-track duplication this codebase already uses (`refs.ts`'s own
 * header comment, `pages/staff/format.ts`'s own header comment) — nothing
 * here is imported outside this folder.
 */
import type { UiLanguage } from '../../i18n/context';
import type { ApplicationOut } from './api';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** A localized `{lang: text}` map, picked for the caller's own UI language —
 *  duplicated from `pages/staff/format.ts::localizedName`'s exact logic
 *  (decision #90: `uz_latn` is the required field of every `LocalizedName`,
 *  so it is always there to fall back to). */
export function localizedName(name: Record<string, unknown> | null | undefined, lang: string = 'uz_latn'): string {
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

/** No route resolves an arbitrary applicant id to a name for a general staff
 *  (or, here, central) caller — `pages/staff/components/GeneralInfoPanel.tsx`
 *  already shows `applicant_id` the same way, for the same reason. A trailing
 *  slice (not a leading one, `pages/staff/format.ts::shortId`'s own comment):
 *  seeded ids are uuid7, whose LEADING hex characters are a millisecond
 *  timestamp, so two rows created moments apart would otherwise show the
 *  identical "eight characters". */
export function shortId(id: string): string {
  return id.slice(-8);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * How long a claim has been waiting, in whole days.
 *
 * The clock starts at `submitted_at` — the moment `applications.service.
 * submit` actually opens the verification (`benefit_verification.py`'s own
 * integration note: `benefit_verification_status` never leaves its
 * `not_required` default before submission) — falling back to `created_at`
 * only for a row that somehow carries no `submitted_at` at all.
 *
 * For a still-`pending` claim the clock runs to NOW — this is the queue's
 * own "how long has nobody looked at this" figure. For an already-decided
 * one it stops at `benefit_verified_at`, the moment it WAS decided — an old
 * verified claim must not read as "waiting 40 days" forever after the fact.
 */
export function waitingDays(row: Pick<ApplicationOut, 'submitted_at' | 'created_at' | 'benefit_verification_status' | 'benefit_verified_at'>): number {
  const start = row.submitted_at ?? row.created_at;
  const startMs = new Date(start).getTime();
  const endMs =
    row.benefit_verification_status === 'pending' || !row.benefit_verified_at
      ? Date.now()
      : new Date(row.benefit_verified_at).getTime();
  return Math.max(0, Math.floor((endMs - startMs) / MS_PER_DAY));
}

/** No formal Russian genitive-plural declension attempted — the same
 *  simplification `applicant/wizard/ContourMapPreview.tsx` already makes for
 *  a day/plot count ("участков" for every count) rather than a full
 *  one/few/many table this codebase has no precedent for. */
export function formatWaitingDays(days: number, lang: UiLanguage): string {
  switch (lang) {
    case 'ru':
      return `${days} ${days === 1 ? 'день' : 'дней'}`;
    case 'en':
      return `${days} ${days === 1 ? 'day' : 'days'}`;
    case 'uz_cyrl':
      return `${days} кун`;
    case 'kaa':
      return `${days} kún`;
    case 'uz_latn':
    default:
      return `${days} kun`;
  }
}

/**
 * Queue order: PENDING claims first — "a claim nobody has looked at is the
 * only thing this role exists for" (the task brief) — oldest-waiting first
 * within that group, so the claim that has sat longest surfaces at the very
 * top (a FIFO queue, not last-in-first-out). Decided claims (`verified`/
 * `rejected`) sort after every pending one, most-recently-decided first —
 * "verified/rejected are its own history"
 * (`benefit_verification_router.py`'s own docstring for this office's list).
 *
 * Applied client-side because the backend orders `id DESC` (recency) only —
 * see `repo.list_certificate_claims`'s own docstring — with no status-aware
 * sort of its own.
 */
export function compareForQueue(a: ApplicationOut, b: ApplicationOut): number {
  const rank = (row: ApplicationOut) => (row.benefit_verification_status === 'pending' ? 0 : 1);
  const rankDiff = rank(a) - rank(b);
  if (rankDiff !== 0) return rankDiff;

  if (a.benefit_verification_status === 'pending') {
    const aStart = new Date(a.submitted_at ?? a.created_at).getTime();
    const bStart = new Date(b.submitted_at ?? b.created_at).getTime();
    return aStart - bStart;
  }

  const aDecided = new Date(a.benefit_verified_at ?? a.updated_at).getTime();
  const bDecided = new Date(b.benefit_verified_at ?? b.updated_at).getTime();
  return bDecided - aDecided;
}
