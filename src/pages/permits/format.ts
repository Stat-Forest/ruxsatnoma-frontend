/**
 * Formatting helpers shared by the three permit/invoice screens (B9, B10, and
 * the staff permit document). Deliberately local to `src/pages/permits/` —
 * Track 4's own scope, not a cross-track shared component library.
 */

/** `"8940400.00"` -> `"8 940 400"`. Money arrives from the API as a fixed-scale
 *  NUMERIC string (never a float, per backend convention) — this only adds
 *  thousands separators for display, it never does arithmetic on the value. */
export function formatMoney(value: string | null | undefined): string {
  if (value == null) return '—';
  const [whole, fraction] = value.split('.');
  const withSeparators = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  // Fractional so'm (tiyin) is never shown on a legal document's summary line
  // in the reference either — drop it unless it is non-zero.
  if (fraction && Number(fraction) !== 0) {
    return `${withSeparators},${fraction.slice(0, 2)}`;
  }
  return withSeparators;
}

/** A decimal quantity (area, SB load) — trims trailing zeros the same way the
 *  backend's own `_trim_decimal` does, so `"42.6000"` reads as `"42,6"`. */
export function formatDecimal(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value;
  return (trimmed || '0').replace('.', ',');
}

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

/** The permit's own display number: `"А"` + `4182` -> `"А № 004182"`. */
export function formatPermitNumber(series: string, number: number): string {
  return `${series} № ${String(number).padStart(6, '0')}`;
}

const LANG_FALLBACKS = ['uz_latn', 'uz_cyrl', 'ru', 'en', 'kaa'];

/** A `LocalizedName`-shaped map (`{uz_latn, uz_cyrl, ru, ...}`) picked for
 *  the desired UI language with term translation fallback. */
export function pickLocalizedName(name: Record<string, unknown> | null | undefined, uiLang: string = 'uz_latn'): string {
  if (!name) return '';
  const direct = name[uiLang];
  if (typeof direct === 'string' && direct) return direct;
  for (const key of LANG_FALLBACKS) {
    const value = name[key];
    if (typeof value === 'string' && value) return value;
  }
  const first = Object.values(name).find((v) => typeof v === 'string' && v);
  return typeof first === 'string' ? first : '';
}

/** A UUID, shortened for display where the full value only adds noise —
 *  never used where the value must be copied verbatim (the sha256 hash and
 *  full ids stay in a `title` attribute for that).
 *
 *  F15 (`docs/plans/07.3-findings.md`): the seeded ids are uuid7, whose
 *  LEADING hex characters are a millisecond timestamp, so slicing from the
 *  front showed two different applicants/organizations, created moments
 *  apart in the same seed run, as the identical "eight characters". The
 *  TRAILING characters are the random tail (RFC 9562), not derived from the
 *  clock — a distinct fingerprint rather than a colliding one. */
export function shortId(value: string | null | undefined): string {
  if (!value) return '—';
  return value.slice(-8);
}
