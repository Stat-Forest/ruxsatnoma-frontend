/**
 * Small display helpers for the applicant screens (B6/B7/B8). Deliberately
 * local to this track rather than a shared `src/lib/` module — the sprint
 * plan asks each track to duplicate a small helper rather than grow a shared
 * library every parallel session has to merge around.
 */

/** A `dict[str, Any]` name coming straight off the backend (activity types,
 * organizations, classifier items) — never a typed `LocalizedName` in every
 * response, so this reads it defensively. */
import { translateTerm } from '../../i18n/terms';

export type LocalizedNameLike = Record<string, unknown> | null | undefined;

const LANG_FALLBACKS = ['uz_latn', 'uz_cyrl', 'ru', 'en', 'kaa'];

export function pickName(name: LocalizedNameLike, lang: string = 'uz_latn'): string {
  if (!name) return '';
  const direct = name[lang];
  let raw = '';
  if (typeof direct === 'string' && direct) {
    raw = direct;
  } else {
    for (const key of LANG_FALLBACKS) {
      const value = name[key];
      if (typeof value === 'string' && value) {
        raw = value;
        break;
      }
    }
    if (!raw) {
      const first = Object.values(name).find((v) => typeof v === 'string' && v);
      raw = typeof first === 'string' ? first : '';
    }
  }
  return translateTerm(raw, lang);
}

export function formatUnit(
  unit: string | null | undefined,
  t?: (key: string) => string,
  lang: string = 'uz_latn',
): string {
  if (!unit) return '';
  const key = `norms.tariffs.quantityUnit.${unit}`;
  if (t) {
    const translated = t(key);
    if (translated && translated !== key) return translated;
  }
  return translateTerm(unit, lang);
}


/** `date` column (`YYYY-MM-DD`) as `DD.MM.YYYY` — never re-parsed through
 * `Date`, which would apply the browser's own timezone to a plain date. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-');
  if (!y || !m || !d) return value;
  return `${d}.${m}.${y}`;
}

/** `datetime` column (`timestamptz`, ISO) as `DD.MM.YYYY HH:MM`, in the
 * viewer's own local time — good enough for a demo audit trail. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${d}.${m}.${y} ${hh}:${mm}`;
}

/** A `NUMERIC` column the backend already trims to a plain decimal string —
 * only the thousands separator is added here, never a re-rounding. */
export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const [intPart, fracPart] = String(value).split('.');
  const withSeparators = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return fracPart ? `${withSeparators},${fracPart}` : withSeparators;
}

export function formatDecimal(value: string | number | null | undefined, unit?: string): string {
  if (value === null || value === undefined) return '—';
  return unit ? `${value} ${unit}` : String(value);
}
