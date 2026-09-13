import { Link, useNavigate } from 'react-router';
import { useReturnHereState } from '../../../lib/returnTo';
import { FileText, Inbox, PauseCircle } from 'lucide-react';
import { useLanguage, useT } from '../../../i18n/useT';
import { Button } from '../../../components/ui/button';
import { clickableRowProps } from '../../../lib/rowClick';
import { useContour, type ApplicationOut } from '../queries';
import { formatAmount, formatDate, formatDateTime, slaStatus, statusLabel } from '../format';

const STATUS_BADGE_CLASS: Record<string, string> = {
  SUBMITTED: 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]',
  IN_REVIEW: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]',
  PENDING_INFO: 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]',
  RETURNED: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]',
  APPROVED: 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]',
  INVOICED: 'bg-[#F0F7F1] text-[#123522] border-[#D9EBDC]',
  PAID: 'bg-[#F0F7F1] text-[#123522] border-[#D9EBDC]',
  PERMIT_ISSUED: 'bg-[#F0F7F1] text-[#123522] border-[#D9EBDC]',
  REJECTED: 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]',
  CANCELLED: 'bg-[#F8F9FA] text-[#5A646D] border-[#E4E7EA]',
  EXPIRED_UNPAID: 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]',
  CLOSED: 'bg-[#F8F9FA] text-[#5A646D] border-[#E4E7EA]',
  ARCHIVED: 'bg-[#F8F9FA] text-[#5A646D] border-[#E4E7EA]',
};

const WORKLIST_ROW_I18N = {
  uz_latn: { takeReview: 'Ishga olish' },
  uz_cyrl: { takeReview: 'Ишга олиш' },
  ru: { takeReview: 'Взять в работу' },
  en: { takeReview: 'Take for review' },
  kaa: { takeReview: 'Iske alıw' },
};

/** One worklist row — a real `ApplicationOut`. "Ishga olish" only asks the
 *  page to confirm (`onTakeReview`): the confirmation modal has to live
 *  outside this clickable row, see `StartReviewConfirmModal`. */
export function WorklistRow({
  row,
  canReview,
  onTakeReview,
}: {
  row: ApplicationOut;
  canReview: boolean;
  onTakeReview: (row: ApplicationOut) => void;
}) {
  const t = useT();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const lt = WORKLIST_ROW_I18N[lang as keyof typeof WORKLIST_ROW_I18N] || WORKLIST_ROW_I18N.uz_latn;
  const contour = useContour(row.contour_id);
  const sla = slaStatus(row.status, row.sla_deadline_at);
  const areaUnit = lang === 'en' ? 'ha' : lang === 'ru' || lang === 'uz_cyrl' ? 'га' : 'ga';
  // The card's "back to list" returns to this URL, filters and page intact.
  const returnHere = useReturnHereState();
  const rowProps = clickableRowProps(() => navigate(`/applications/${row.id}`, { state: returnHere }));

  return (
    <tr
      {...rowProps}
      className={`hover:bg-[#F8F9FA] transition-colors ${rowProps.className}`}
      data-testid={`application-row-${row.id}`}
    >
      <td className="p-3 font-mono font-bold whitespace-nowrap">
        <Link
          to={`/applications/${row.id}`}
          state={returnHere}
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
          {statusLabel(row.status, lang)}
        </span>
      </td>
      <td className="p-3 font-mono text-xs">
        {contour.data ? `№ ${contour.data.number}` : row.contour_id ? row.contour_id.slice(0, 8) : '—'}
      </td>
      <td className="p-3 text-xs whitespace-nowrap">
        {row.period_from && row.period_to ? `${formatDate(row.period_from)} — ${formatDate(row.period_to)}` : '—'}
      </td>
      <td className="p-3 text-right font-mono text-xs">
        {row.requested_area_ha ? `${formatAmount(row.requested_area_ha)} ${areaUnit}` : '—'}
      </td>
      <td className="p-3 text-xs">
        {sla === 'paused' ? (
          <span className="inline-flex items-center gap-1 text-[#0369A1] font-bold whitespace-nowrap">
            <PauseCircle className="w-3.5 h-3.5" /> {t('staff.infoRequest.slaPausedShort')}
          </span>
        ) : row.sla_deadline_at ? (
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
            onClick={() => onTakeReview(row)}
            className="whitespace-nowrap"
          >
            {lt.takeReview}
          </Button>
        )}
      </td>
    </tr>
  );
}
