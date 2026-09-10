import { formatUnit } from '../format';

/**
 * Pure helpers behind `OccupancyCalendar.tsx` — split into their own module
 * (rather than exported alongside the component) because a `.tsx` file that
 * exports anything besides components trips `react-refresh/only-export-
 * components`; a plain `.ts` file has no such constraint and is also the
 * more natural home for logic worth unit-testing on its own, no rendering
 * involved (`seasonCalendar.test.ts`).
 *
 * T10 (`docs/plans/09-odilxon-demo-fixes.md`), decision #177.
 */

export interface SeasonWindow {
  from: string; // "MM-DD"
  to: string; // "MM-DD"
}

/**
 * `EffectiveSeasonOut.windows` is the raw JSONB list, untyped
 * (`{[key: string]: unknown}[]`) — deliberately, per its own docstring: a
 * contour's norm may predate the backend's own window validation, and that
 * read endpoint must never 500 on a pre-existing malformed row. A malformed
 * entry is dropped here rather than crashing the picker; if every entry
 * turns out malformed the effective list is empty, which this module treats
 * the same as "no restriction" (`isIsoDateInWindows` below) — the same
 * fail-open-on-garbage-data reading `season_source: "none"` already has.
 */
export function parseWindows(raw: unknown): SeasonWindow[] {
  if (!Array.isArray(raw)) return [];
  const out: SeasonWindow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const from = (item as Record<string, unknown>).from;
    const to = (item as Record<string, unknown>).to;
    if (typeof from === 'string' && typeof to === 'string' && /^\d{2}-\d{2}$/.test(from) && /^\d{2}-\d{2}$/.test(to)) {
      out.push({ from, to });
    }
  }
  return out;
}

/** One window, wrap-aware: `from <= to` (e.g. "03-01"–"03-31") is the plain
 *  case; `from > to` (e.g. "11-01"–"03-31") means the window crosses the new
 *  year, so a date belongs to it when it is on either side of the wrap —
 *  `mmdd >= from` (Nov/Dec) OR `mmdd <= to` (Jan–Mar). Fixed-width
 *  zero-padded `MM-DD` strings compare correctly with plain `<=`/`>=`. */
function isMmddInWindow(mmdd: string, from: string, to: string): boolean {
  return from <= to ? mmdd >= from && mmdd <= to : mmdd >= from || mmdd <= to;
}

/** No windows at all means no restriction — the unchanged meaning
 *  `season_source: "none"` already carries (ruling #177: "no dictionary row
 *  and no norm windows keeps today's meaning"). */
export function isIsoDateInWindows(iso: string, windows: SeasonWindow[]): boolean {
  if (windows.length === 0) return true;
  const mmdd = iso.slice(5, 10);
  return windows.some((w) => isMmddInWindow(mmdd, w.from, w.to));
}

/** Whole calendar days between two `YYYY-MM-DD` values, in UTC — the exact
 *  quantity `ApplicationWizardPage.tsx`'s own `isoDaySpan` computes, and the
 *  one the minimum-term check almost certainly mirrors server-side
 *  (`(period_to - period_from).days`, the same shape `MAX_PERIOD_DAYS`
 *  already uses). Duplicated rather than imported across the two files —
 *  three lines, the same idiom `trimSbNumber` already repeats across this
 *  module and `ChecksList.tsx`. */
export function isoDaySpan(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Monday-first weekday index (0=Mon..6=Sun) of the 1st of `monthKey`. */
export function firstWeekdayMon0(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // 0=Sun..6=Sat
  return (jsDay + 6) % 7;
}

export function addMonths(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

/** A `Decimal` quantity the backend serializes as a numeric string, trimmed
 *  of a trailing-zero tail — same idiom as `ChecksList.tsx`'s own
 *  `trimSbNumber`, duplicated here for the same cross-module reason. */
export function trimDecimal(value: string): string {
  const trimmed = value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value;
  return (trimmed || '0').replace('.', ',');
}

/** The task brief's own contract: `sb` is grazing's "conditional head" (no
 *  `quantityUnit.sb` key exists — that term lives under
 *  `wizard.step3.conditionalHead`), `ha`/`hive`/`m3`/`person_day` already
 *  have a real translated label (`formatUnit`, `norms.tariffs.quantityUnit.*`).
 *  Anything else — unknown or absent — renders as a BARE NUMBER: no raw code
 *  guessed at as a word. */
export function unitLabel(unit: string | null | undefined, t: (key: string) => string, lang: string): string | null {
  if (unit === 'sb') return t('wizard.step3.conditionalHead');
  if (unit === 'ha' || unit === 'hive' || unit === 'm3' || unit === 'person_day') {
    return formatUnit(unit, t, lang);
  }
  return null;
}

export function formatQuantity(
  value: string,
  unit: string | null | undefined,
  t: (key: string) => string,
  lang: string,
): string {
  const label = unitLabel(unit, t, lang);
  const num = trimDecimal(value);
  return label ? `${num} ${label}` : num;
}
