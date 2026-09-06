/**
 * Formatting helpers for the inspector screens (J1). A small, self-contained
 * copy of `permits/format.ts`'s relevant pieces — never imported from that
 * module, the same module-boundary convention `permits/format.ts`'s own
 * comment and `staff/format.ts`'s duplicate copy already establish: each
 * page track keeps its own copy of a small formatting helper rather than
 * reaching across into another track's folder.
 */

/** `"2026-08-01"` -> `"01.08.2026"`. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const [y, m, d] = value.split('-');
  if (!y || !m || !d) return value;
  return `${d}.${m}.${y}`;
}

/** `"2026-08-01T14:32:07.123Z"` -> `"01.08.2026, 14:32"`. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}, ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** A `LocalizedName`-shaped map (`{uz_cyrl, ru, ...}`) picked for the UI
 *  language in use — the same fallback chain `permits/format.ts`'s own
 *  `pickLocalizedName` (in turn copied from `AppShell.tsx`) uses: the
 *  logic only ever distinguishes `'ru'` from "not ru", so widening the
 *  accepted `lang` union to the app's full five-language set costs nothing
 *  and lets a caller pass `I18nContext`'s `lang` (`'uz_latn' | 'ru'`)
 *  without a cast. */
export function pickLocalizedName(
  name: Record<string, unknown> | undefined,
  lang: 'uz_latn' | 'uz_cyrl' | 'ru' | 'en',
): string {
  if (!name) return '';
  const preferred = lang === 'ru' ? name.ru : name.uz_cyrl;
  const candidate = preferred ?? name.ru ?? name.uz_cyrl ?? Object.values(name)[0];
  return typeof candidate === 'string' ? candidate : '';
}

/** A GPS coordinate for human reading — 5 decimal places is ~1m precision,
 *  enough to eyeball on an act card. Not a backend-mirrored format (the API
 *  itself hands back `GpsPoint.lon`/`lat` as plain numbers); this is purely
 *  this module's own display choice. */
export function formatCoord(value: number): string {
  return value.toFixed(5);
}

/** `CaseOut.damage_amount` — the same house convention `permits/format.ts`'s
 *  own `formatMoney` uses (space-separated thousands, fractional so'm
 *  dropped unless non-zero), copied rather than imported — this module's
 *  own small self-contained copy, per this file's own header comment. */
export function formatMoney(value: string | null | undefined): string {
  if (value == null) return '—';
  const [whole, fraction] = value.split('.');
  const withSeparators = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  if (fraction && Number(fraction) !== 0) {
    return `${withSeparators},${fraction.slice(0, 2)}`;
  }
  return withSeparators;
}
