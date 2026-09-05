/** `datetime` column (`timestamptz`, ISO) as `DD.MM.YYYY HH:MM`, in the
 * viewer's own local time. Duplicated from `applicant/format.ts` per this
 * fleet's own convention (small display helpers stay local to their own
 * track/screen). */
export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
