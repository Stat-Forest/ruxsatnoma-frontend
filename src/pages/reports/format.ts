/** Small local duplicates, per this codebase's own per-track convention
 *  (`pages/norms/refs.ts`'s file header, `pages/staff/format.ts`'s own
 *  comment): each track keeps its own copy rather than importing across
 *  page folders. */
export function pickLocalizedName(name: Record<string, unknown> | null | undefined, lang: string = 'uz_latn'): string {
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

/** `YYYY-MM-DD` -> `DD.MM.YYYY`, by string slicing only (TZ=Asia/Tashkent is
 *  pinned in `vite.config.ts` — never `new Date(dateString)` here). */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-');
  if (!y || !m || !d) return value;
  return `${d}.${m}.${y}`;
}
