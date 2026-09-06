import { Info } from 'lucide-react';

/**
 * `KpiOut.omitted` is itself an API field naming tiles the backend could not
 * build (`"inspections_count: the 4.1 inspections module is not merged into
 * dev yet"`) — the honest alternative to leaving a gap unexplained or filling
 * it with a fake number. Each entry is matched on the text before its first
 * `:` against a small lookup of recognized prefixes and rendered as one
 * localized sentence; an entry this lookup does not recognize (the field is
 * a genuine `list[str]`, so a future backend addition is possible) still
 * renders — as its own raw string — rather than being silently dropped.
 */
export function OmittedNotice({ omitted, t }: { omitted: string[]; t: (key: string) => string }) {
  if (omitted.length === 0) return null;

  const labelFor = (entry: string): string => {
    const prefix = entry.split(':', 1)[0];
    if (prefix === 'inspections_count') return t('leadership.dash.omitted.inspections');
    if (prefix === 'violations_count') return t('leadership.dash.omitted.violations');
    return entry;
  };

  return (
    <div
      data-testid="omitted-notice"
      className="p-4 bg-[#F8F9FA] border border-[#E4E7EA] rounded-2xl flex items-start gap-3"
    >
      <Info className="w-5 h-5 text-[#767F87] shrink-0 mt-0.5" />
      <ul className="text-sm text-[#5A646D] leading-relaxed space-y-1">
        {omitted.map((entry) => (
          <li key={entry}>{labelFor(entry)}</li>
        ))}
      </ul>
    </div>
  );
}
