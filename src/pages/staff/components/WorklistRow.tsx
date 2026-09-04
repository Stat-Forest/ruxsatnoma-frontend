import { Link } from 'react-router';
import { FileText, Inbox } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useContour, useStartReviewRow, type ApplicationOut } from '../queries';
import { formatAmount, formatDate, formatDateTime, statusLabel } from '../format';

const STATUS_BADGE_CLASS: Record<string, string> = {
  SUBMITTED: 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]',
  IN_REVIEW: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]',
  INVOICED: 'bg-[#F0F7F1] text-[#123522] border-[#D9EBDC]',
  PAID: 'bg-[#F0F7F1] text-[#123522] border-[#D9EBDC]',
  PERMIT_ISSUED: 'bg-[#F0F7F1] text-[#123522] border-[#D9EBDC]',
  REJECTED: 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]',
  CANCELLED: 'bg-[#F8F9FA] text-[#5A646D] border-[#E4E7EA]',
};

function slaState(slaDeadlineAt: string | null): 'overdue' | 'soon' | 'normal' | null {
  if (!slaDeadlineAt) return null;
  const deadline = new Date(slaDeadlineAt).getTime();
  const now = Date.now();
  if (deadline < now) return 'overdue';
  if (deadline - now < 24 * 60 * 60 * 1000) return 'soon';
  return 'normal';
}

/** One worklist row — a real `ApplicationOut` (no name is resolved here that
 * the API does not itself supply: applicants have no display-name route
 * reachable by staff, so `applicant_id` is shown as-is, truncated). */
export function WorklistRow({ row, canReview }: { row: ApplicationOut; canReview: boolean }) {
  const contour = useContour(row.contour_id);
  const startReview = useStartReviewRow();
  const sla = slaState(row.sla_deadline_at);

  return (
    <tr className="hover:bg-[#F8F9FA] transition-colors">
      <td className="p-3 font-mono font-bold whitespace-nowrap">
        <Link
          to={`/applications/${row.id}`}
          className="text-[#2E7D4F] hover:underline flex items-center gap-1"
        >
          <FileText className="w-3.5 h-3.5" />
          {row.number ?? row.id.slice(0, 8)}
        </Link>
      </td>
      <td className="p-3">
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold border ${
            STATUS_BADGE_CLASS[row.status] ?? 'bg-[#F8F9FA] text-[#5A646D] border-[#E4E7EA]'
          }`}
        >
          {statusLabel(row.status)}
        </span>
      </td>
      <td className="p-3 font-mono text-xs">
        {contour.data ? `№ ${contour.data.number}` : row.contour_id ? row.contour_id.slice(0, 8) : '—'}
      </td>
      <td className="p-3 text-xs whitespace-nowrap">
        {row.period_from && row.period_to ? `${formatDate(row.period_from)} — ${formatDate(row.period_to)}` : '—'}
      </td>
      <td className="p-3 text-right font-mono text-xs">
        {row.requested_area_ha ? `${formatAmount(row.requested_area_ha)} ga` : '—'}
      </td>
      <td className="p-3 text-xs">
        {row.sla_deadline_at ? (
          <span
            className={
              sla === 'overdue'
                ? 'text-[#B91C1C] font-bold'
                : sla === 'soon'
                  ? 'text-[#B45309] font-bold'
                  : 'text-[#5A646D]'
            }
          >
            {formatDateTime(row.sla_deadline_at)}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className="p-3 text-right">
        {row.status === 'SUBMITTED' && canReview && (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Inbox className="w-3.5 h-3.5" />}
            isLoading={startReview.isPending}
            onClick={() => startReview.mutate(row.id)}
            className="whitespace-nowrap"
          >
            Ishga olish
          </Button>
        )}
      </td>
    </tr>
  );
}
