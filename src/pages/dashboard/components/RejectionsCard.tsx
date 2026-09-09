import { XCircle } from 'lucide-react';
import { DashboardCard, EmptyPanel } from './DashboardCard';

export interface RejectionRow {
  /** `RejectionRowOut.reason_item_id` — kept even when `label` had to fall
   *  back to it, so a row is never dropped for want of a name. */
  id: string;
  /** The resolved classifier item's own name, or the raw id string when the
   *  item was not found in `useRejectionReasonItems()` — never dropped
   *  silently either way. */
  label: string;
  count: number;
}

/**
 * `KpiOut.rejections`, ranked — resolved against the reason classifier by
 * the page (`LeadershipDashboardPage.tsx`, via `useRejectionReasonItems()`)
 * before reaching this component, which only renders the ranked list.
 */
export function RejectionsCard({ rows, t }: { rows: RejectionRow[]; t: (key: string) => string }) {
  const sorted = [...rows].sort((a, b) => b.count - a.count);
  const maxCount = Math.max(...sorted.map((r) => r.count), 1);

  return (
    <DashboardCard title={t('leadership.dash.rejections.title')} icon={XCircle}>
      {sorted.length === 0 ? (
        <EmptyPanel testId="rejections-empty">{t('leadership.dash.rejections.empty')}</EmptyPanel>
      ) : (
        <ul data-testid="rejections-list" className="space-y-2.5">
          {sorted.map((row) => (
            <li key={row.id} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[#1A1F24] min-w-0 truncate" title={row.label}>
                  {row.label}
                </span>
                <span className="font-mono font-bold tabular-nums text-[#1A1F24] shrink-0">{row.count}</span>
              </div>
              <div className="w-full bg-[#F1F3F5] rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-[#DC2626] h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.round((row.count / maxCount) * 100))}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
