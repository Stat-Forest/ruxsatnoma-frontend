import { History } from 'lucide-react';
import type { components } from '../../api/schema';
import { formatDateTime, shortId } from './format';
import { PERMIT_STATUS_LABEL } from './statusMeta';

type PermitHistoryRow = components['schemas']['PermitHistoryRow'];

/**
 * `permit_status_history`, read back verbatim — real data, not the
 * suspend/resume/revoke ACTIONS the reference's `PermitLifecyclePanel` also
 * draws. Those routes are 3.11b's (explicitly out of this sprint's scope,
 * `docs/plans/06-demo-sprint.md`); this panel shows only what
 * `GET /permits/{id}` actually answers today — every row 3.11a itself
 * writes: the initial `pending_signatures` and, once the last signature
 * lands, the move to `active`.
 */
export function PermitTimelinePanel({ history }: { history: PermitHistoryRow[] }) {
  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-5 shadow-xs space-y-3 font-sans">
      <div className="flex items-center gap-2 border-b border-[#E4E7EA] pb-3">
        <History className="w-5 h-5 text-[#2E7D4F]" />
        <h3 className="text-sm font-bold text-[#1A1F24]">Holat tarixi</h3>
      </div>
      {history.length === 0 ? (
        <p className="text-xs text-[#5A646D]">Tarix boʻsh.</p>
      ) : (
        <div className="space-y-1.5">
          {history.map((row, i) => (
            <div key={i} className="p-2.5 bg-[#F8F9FA] border border-[#E4E7EA] rounded-xl text-xs">
              <div className="text-[#1A1F24] font-semibold">
                {row.from_status ? `${PERMIT_STATUS_LABEL[row.from_status]} → ` : ''}
                {PERMIT_STATUS_LABEL[row.to_status] ?? row.to_status}
              </div>
              <div className="text-[11px] text-[#767F87] font-mono mt-0.5">
                {formatDateTime(row.occurred_at)}
                {row.changed_by ? ` · foydalanuvchi ID ${shortId(row.changed_by)}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
