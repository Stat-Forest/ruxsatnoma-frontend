import { Link, useNavigate } from 'react-router';
import { Stamp } from 'lucide-react';
import { useLanguage } from '../../../i18n/useT';
import { clickableRowProps } from '../../../lib/rowClick';
import { formatDate, formatDecimal, formatPermitNumber } from '../format';
import { PERMIT_STATUS_STYLE, getPermitStatusLabel } from '../statusMeta';
import { useActivityTypeName, useOrganizationName } from '../useRefsLookup';
import type { PermitOut } from '../queries';

const ROW_I18N = {
  uz_latn: { open: 'Ochish →' },
  uz_cyrl: { open: 'Очиш →' },
  ru: { open: 'Открыть →' },
  en: { open: 'Open →' },
  kaa: { open: 'Ashıw →' },
};

/**
 * One row of the staff registry (`PermitsPage`, gated on `permits.view_any`).
 * Names resolved the same way `PermitRequisitesPanel` resolves them — from
 * the permit's own frozen id columns, never by re-reading the application.
 */
export function PermitRow({ permit }: { permit: PermitOut }) {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const t = ROW_I18N[lang as keyof typeof ROW_I18N] || ROW_I18N.uz_latn;
  const activityName = useActivityTypeName(permit.activity_type_id, lang);
  const organizationName = useOrganizationName(permit.organization_id, lang);
  const area = formatDecimal(permit.area_ha);
  const rowProps = clickableRowProps(() => navigate(`/permits/${permit.id}`));

  return (
    <tr
      {...rowProps}
      className={`hover:bg-[#F8F9FA] transition-colors ${rowProps.className}`}
      data-testid={`permit-row-${permit.id}`}
    >
      <td className="p-3 font-mono font-bold whitespace-nowrap">
        <Link to={`/permits/${permit.id}`} className="text-[#2E7D4F] hover:underline flex items-center gap-1.5">
          <Stamp className="w-3.5 h-3.5" />
          {formatPermitNumber(permit.series, permit.number)}
        </Link>
      </td>
      <td className="p-3">
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold border ${
            PERMIT_STATUS_STYLE[permit.status] ?? PERMIT_STATUS_STYLE.pending_signatures
          }`}
        >
          {getPermitStatusLabel(permit.status, lang)}
        </span>
      </td>
      <td className="p-3 text-xs">{activityName ?? '—'}</td>
      <td className="p-3 text-xs">{organizationName ?? '—'}</td>
      <td className="p-3 text-xs whitespace-nowrap">
        {formatDate(permit.period_from)} — {formatDate(permit.period_to)}
      </td>
      <td className="p-3 text-right font-mono text-xs">{area ? `${area} ga` : '—'}</td>
      <td className="p-3 text-right whitespace-nowrap">
        <Link to={`/permits/${permit.id}`} className="text-xs font-bold text-[#2E7D4F] hover:underline">
          {t.open}
        </Link>
      </td>
    </tr>
  );
}
