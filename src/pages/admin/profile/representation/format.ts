/** `date` column (`YYYY-MM-DD`) as `DD.MM.YYYY` — never re-parsed through
 * `Date`, which would apply the browser's own timezone to a plain date.
 * Duplicated from `applicant/format.ts` per this fleet's own convention
 * (small display helpers stay local to their own track/screen). */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-');
  if (!y || !m || !d) return value;
  return `${d}.${m}.${y}`;
}
