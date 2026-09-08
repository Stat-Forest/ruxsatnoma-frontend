/**
 * Small display helpers, duplicated from `applicant/format.ts` rather than
 * imported — the same cross-track reasoning that file itself documents: two
 * tracks editing one shared module is the merge-conflict risk the fleet asks
 * each track to avoid by keeping a small helper local.
 */
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

/** `date` column (`YYYY-MM-DD`) as `DD.MM.YYYY` — never re-parsed through
 * `Date`, which would apply the browser's own timezone to a plain date. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-');
  if (!y || !m || !d) return value;
  return `${d}.${m}.${y}`;
}

/** `timestamptz` (ISO) as `DD.MM.YYYY HH:MM`, in the viewer's own local time. */
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

/** A NUMERIC column the backend already trims to a plain decimal string —
 * only the thousands separator is added, never a re-rounding. Renders a
 * negative value as-is: `s_available_ha` can be negative today (occupancy
 * has no floor at zero, a known backend defect, not fixed here) and hiding
 * the sign would misrepresent what the server actually said. */
export function formatDecimal(value: string | number | null | undefined, unit?: string): string {
  if (value === null || value === undefined) return '—';
  const [sign, rest] = String(value).startsWith('-') ? ['-', String(value).slice(1)] : ['', String(value)];
  const [intPart, fracPart] = rest.split('.');
  const withSeparators = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const num = `${sign}${withSeparators}${fracPart ? `,${fracPart}` : ''}`;
  return unit ? `${num} ${unit}` : num;
}
