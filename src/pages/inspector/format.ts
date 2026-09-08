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

/** A `LocalizedName`-shaped map (`{uz_latn, uz_cyrl, ru, ...}`) picked for
 *  the UI language in use. F14 (`docs/plans/07.3-findings.md`): this used to
 *  return `uz_cyrl` for every `lang` other than `'ru'`, `permits/format.ts`'s
 *  own stale preference copied verbatim — wrong since decision #90 made
 *  `uz_latn` the REQUIRED field of every `LocalizedName` (backfilled first),
 *  so a `uz_latn` caller is owed their own field. */
export function pickLocalizedName(
  name: Record<string, unknown> | undefined,
  lang: string = 'uz_latn',
): string {
  if (!name) return '';
  const direct = name[lang];
  if (typeof direct === 'string' && direct) return direct;
  const preferred = lang === 'ru' ? name.ru : lang === 'uz_cyrl' ? name.uz_cyrl : lang === 'en' ? name.en : lang === 'kaa' ? name.kaa : name.uz_latn;
  const candidate = preferred ?? name.uz_latn ?? name.uz_cyrl ?? name.ru ?? Object.values(name)[0];
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

/** A decimal quantity (area, SB load) — trims trailing zeros the same way
 *  the backend's own `_trim_decimal` does, so `"42.6000"` reads as `"42,6"`.
 *  Copied from `permits/format.ts::formatDecimal` (F17, this file's own
 *  header). */
export function formatDecimal(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value;
  return (trimmed || '0').replace('.', ',');
}

/** The permit's own display number: `"А"` + `4182` -> `"А № 004182"`. Copied
 *  from `permits/format.ts::formatPermitNumber` (F17). */
export function formatPermitNumber(series: string, number: number): string {
  return `${series} № ${String(number).padStart(6, '0')}`;
}

/** A UUID, shortened for display where the full value only adds noise.
 *  Copied from `permits/format.ts::shortId` (F17). */
export function shortId(value: string | null | undefined): string {
  if (!value) return '—';
  return value.slice(0, 8);
}
