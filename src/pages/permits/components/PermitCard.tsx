import { Link, useNavigate } from 'react-router';
import { FileText } from 'lucide-react';
import { useLanguage } from '../../../i18n/useT';
import { formatDate, formatDecimal, formatPermitNumber } from '../format';
import { PERMIT_STATUS_STYLE, getPermitStatusLabel } from '../statusMeta';
import { useActivityTypeName, useOrganizationName } from '../useRefsLookup';
import type { PermitOut } from '../queries';
import { CLICKABLE_ROW_CLASS, clickableRowProps } from '../../../lib/rowClick';

const PERMIT_CARD_I18N = {
  uz_latn: {
    validityPeriod: 'Amal qilish muddati:',
    area: 'Maydon:',
    viewPermit: 'Ruxsatnomani koʻrish',
  },
  uz_cyrl: {
    validityPeriod: 'Амал қилиш муддати:',
    area: 'Майдон:',
    viewPermit: 'Рухсатномани кўриш',
  },
  ru: {
    validityPeriod: 'Срок действия:',
    area: 'Площадь:',
    viewPermit: 'Посмотреть разрешение',
  },
  en: {
    validityPeriod: 'Validity period:',
    area: 'Area:',
    viewPermit: 'View permit',
  },
  kaa: {
    validityPeriod: 'Ámel etiw múddeti:',
    area: 'Maydan:',
    viewPermit: 'Ruxsatnamanı kóriw',
  },
};

/** One card of the applicant's own permit list (`MyPermitsPage`). */
export function PermitCard({ permit }: { permit: PermitOut }) {
  const { lang } = useLanguage();
  const t = PERMIT_CARD_I18N[lang as keyof typeof PERMIT_CARD_I18N] || PERMIT_CARD_I18N.uz_latn;
  const activityName = useActivityTypeName(permit.activity_type_id, lang);
  const organizationName = useOrganizationName(permit.organization_id, lang);
  const area = formatDecimal(permit.area_ha);
  const navigate = useNavigate();

  return (
    <div
      {...clickableRowProps(() => navigate(`/my/permits/${permit.id}`))}
      className={`bg-white border border-[#E4E7EA] rounded-2xl p-4 sm:p-6 shadow-xs hover:shadow-md transition-shadow space-y-3 sm:space-y-4 flex flex-col justify-between ${CLICKABLE_ROW_CLASS}`}
    >
      <div className="space-y-2.5 sm:space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-base sm:text-lg font-bold font-mono text-[#1A1F24] break-all">
            {formatPermitNumber(permit.series, permit.number)}
          </span>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 sm:py-1 rounded-full text-xs font-bold border shrink-0 ${
              PERMIT_STATUS_STYLE[permit.status] ?? PERMIT_STATUS_STYLE.pending_signatures
            }`}
          >
            {getPermitStatusLabel(permit.status, lang)}
          </span>
        </div>

        <div className="space-y-1">
          <h3 className="font-bold text-sm sm:text-base text-[#1A1F24] break-words">{activityName ?? '—'}</h3>
          <p className="text-xs text-[#5A646D] break-words">{organizationName ?? '—'}</p>
        </div>

        <div className="p-2.5 sm:p-3 bg-[#F8F9FA] rounded-xl border border-[#E4E7EA] flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 text-xs font-mono">
          <span className="text-[#5A646D] font-sans sm:font-mono">{t.validityPeriod}</span>
          <b className="text-[#1A1F24] break-all sm:break-normal">
            {formatDate(permit.period_from)} — {formatDate(permit.period_to)}
          </b>
        </div>

        {area && (
          <p className="text-xs text-[#767F87]">
            {t.area} <b className="text-[#1A1F24]">{area} ga</b>
          </p>
        )}
      </div>

      <div className="pt-3 sm:pt-4 border-t border-[#E4E7EA] flex justify-end">
        <Link
          to={`/my/permits/${permit.id}`}
          className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md bg-[#2E7D4F] hover:bg-[#23653F] text-white text-xs font-bold transition-colors w-full sm:w-auto"
        >
          <FileText className="w-4 h-4 shrink-0" /> {t.viewPermit}
        </Link>
      </div>
    </div>
  );
}

