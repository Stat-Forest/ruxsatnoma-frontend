import { CheckCircle2 } from 'lucide-react';
import type { components } from '../../api/schema';
import { useLanguage } from '../../i18n/useT';
import { translateTerm } from '../../i18n/terms';
import { formatDate, formatDecimal, formatMoney, formatPermitNumber, shortId } from './format';
import { PERMIT_STATUS_STYLE, getPermitStatusLabel } from './statusMeta';
import { useActivityTypeName, useContourNumber, useOrganizationName } from './useRefsLookup';

type PermitOut = components['schemas']['PermitOut'];

export function PermitRequisitesPanel({
  permit,
  applicantName,
}: {
  permit: PermitOut;
  applicantName?: string | null;
}) {
  const { lang } = useLanguage();
  const activityName = useActivityTypeName(permit.activity_type_id, lang);
  const organizationName = useOrganizationName(permit.organization_id, lang);
  const contourNumber = useContourNumber(permit.contour_id);

  const area = formatDecimal(permit.area_ha);
  const sbLoad = formatDecimal(permit.sb_load);

  const areaUnit = lang === 'en' ? 'ha' : lang === 'ru' || lang === 'uz_cyrl' ? 'га' : 'ga';
  const currencyUnit = lang === 'ru' ? 'сум' : lang === 'en' ? 'UZS' : lang === 'uz_cyrl' ? 'сўм' : lang === 'kaa' ? 'swm' : 'soʻm';
  const sha256Label = lang === 'ru' ? 'SHA-256 документа:' : lang === 'en' ? 'Document SHA-256:' : lang === 'uz_cyrl' ? 'Ҳужжат SHA-256:' : lang === 'kaa' ? 'Hújjet SHA-256:' : 'Hujjat SHA-256:';
  const notRenderedText = lang === 'ru' ? 'еще не сформирован' : lang === 'en' ? 'not rendered yet' : lang === 'uz_cyrl' ? 'ҳали рендер қилинмаган' : lang === 'kaa' ? 'háli render qılınbaǵan' : 'hali render qilinmagan';

  return (
    <div
      data-testid="permit-requisites-panel"
      className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E4E7EA]">
        <div>
          <span className="text-xs text-[#5A646D] block mb-1">
            {lang === 'ru' ? 'Электронное разрешение' : lang === 'en' ? 'Electronic permit' : lang === 'uz_cyrl' ? 'Электрон рухсатнома' : lang === 'kaa' ? 'Elektron ruqsatnama' : 'Elektron ruxsatnoma'}
          </span>
          <h2 className="text-xl font-bold font-mono text-[#1A1F24]">
            {formatPermitNumber(permit.series, permit.number)}
          </h2>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border ${
            PERMIT_STATUS_STYLE[permit.status] ?? PERMIT_STATUS_STYLE.pending_signatures
          }`}
        >
          {getPermitStatusLabel(permit.status, lang)}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-[#1A1F24]">
        <div className="space-y-1">
          <span className="text-[#5A646D] font-medium block">
            {lang === 'ru' ? 'Заявитель:' : lang === 'en' ? 'Applicant:' : lang === 'uz_cyrl' ? 'Аризачи:' : lang === 'kaa' ? 'Arzashı:' : 'Arizachi:'}
          </span>
          <strong className="font-bold block text-[#1A1F24]">
            {applicantName ?? `ID ${shortId(permit.applicant_id)}`}
          </strong>
        </div>

        <div className="space-y-1">
          <span className="text-[#5A646D] font-medium block">
            {translateTerm('Vakolatli organ', lang)}:
          </span>
          <strong className="font-bold block text-[#1A1F24]">
            {organizationName ?? `ID ${shortId(permit.organization_id)}`}
          </strong>
        </div>

        <div className="space-y-1">
          <span className="text-[#5A646D] font-medium block">
            {lang === 'ru' ? 'Вид деятельности:' : lang === 'en' ? 'Activity type:' : lang === 'uz_cyrl' ? 'Фаолият тури:' : lang === 'kaa' ? 'Iskerlik túri:' : 'Faoliyat turi:'}
          </span>
          <strong className="font-bold block text-[#2E7D4F] text-sm">
            {activityName ?? `ID ${shortId(permit.activity_type_id)}`}
          </strong>
        </div>

        <div className="space-y-1">
          <span className="text-[#5A646D] font-medium block">
            {lang === 'ru' ? 'Контур:' : lang === 'en' ? 'Contour:' : lang === 'uz_cyrl' ? 'Контур:' : lang === 'kaa' ? 'Kontur:' : 'Kontur:'}
          </span>
          <strong className="font-mono font-bold block text-[#1A1F24]">
            {contourNumber ? `№ ${contourNumber}` : `ID ${shortId(permit.contour_id)}`}
          </strong>
        </div>

        <div className="space-y-1">
          <span className="text-[#5A646D] font-medium block">
            {lang === 'ru' ? 'Выделенная площадь:' : lang === 'en' ? 'Allocated area:' : lang === 'uz_cyrl' ? 'Ажратилган майдон:' : lang === 'kaa' ? 'Ajıratılǵan maydan:' : 'Ajratilgan maydon:'}
          </span>
          <strong className="font-mono font-bold block text-sm text-[#123522]">
            {area ? `${area} ${areaUnit}` : '—'}
          </strong>
        </div>

        <div className="space-y-1">
          <span className="text-[#5A646D] font-medium block">
            {lang === 'ru' ? 'Период использования:' : lang === 'en' ? 'Usage period:' : lang === 'uz_cyrl' ? 'Фойдаланиш даври:' : lang === 'kaa' ? 'Paydalanıw dáwiri:' : 'Foydalanish davri:'}
          </span>
          <strong className="font-mono font-bold block text-[#1A1F24]">
            {formatDate(permit.period_from)} — {formatDate(permit.period_to)}
          </strong>
        </div>

        <div className="space-y-1">
          <span className="text-[#5A646D] font-medium block">
            {lang === 'ru' ? 'Нагрузка (условные головы):' : lang === 'en' ? 'Load (conditional heads):' : lang === 'uz_cyrl' ? 'Шартли бош юклама (ШБ):' : lang === 'kaa' ? 'Shártli bas júkleme:' : 'Shartli bosh yuklama (SB):'}
          </span>
          <strong className="font-mono font-bold block text-[#1A1F24]">
            {sbLoad ? `${sbLoad} SB` : (lang === 'ru' ? 'Не требуется' : lang === 'en' ? 'Not required' : lang === 'uz_cyrl' ? 'Талаб қилинмайди' : lang === 'kaa' ? 'Talap etilmeydi' : 'Talab qilinmaydi')}
          </strong>
        </div>

        <div className="space-y-1">
          <span className="text-[#5A646D] font-medium block">
            {lang === 'ru' ? 'Сумма оплаты:' : lang === 'en' ? 'Payment amount:' : lang === 'uz_cyrl' ? 'Тўлов суммаси:' : lang === 'kaa' ? 'Tólem summası:' : 'Toʻlov summasi:'}
          </span>
          <strong className="font-bold block text-[#15803D] flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> {formatMoney(permit.amount)} {currencyUnit}
          </strong>
        </div>

        <div className="space-y-1">
          <span className="text-[#5A646D] font-medium block">
            {lang === 'ru' ? 'Дата выдачи:' : lang === 'en' ? 'Date of issue:' : lang === 'uz_cyrl' ? 'Берилган сана:' : lang === 'kaa' ? 'Berilgen sánesi:' : 'Berilgan sana:'}
          </span>
          <strong className="font-mono font-bold block text-[#1A1F24]">
            {permit.issued_at ? formatDate(permit.issued_at.slice(0, 10)) : (lang === 'ru' ? 'Еще не подписано' : lang === 'en' ? 'Not signed yet' : lang === 'uz_cyrl' ? 'Ҳали имзоланмаган' : lang === 'kaa' ? 'Háli imzalanbaǵan' : 'Hali imzolanmagan')}
          </strong>
        </div>
      </div>

      <div className="pt-3 border-t border-[#E4E7EA] text-[11px] text-[#5A646D] font-mono break-all">
        <span className="uppercase tracking-wider font-sans font-bold text-[#767F87] mr-2">
          {sha256Label}
        </span>
        <span title={permit.doc_hash ?? undefined}>{permit.doc_hash ?? notRenderedText}</span>
      </div>
    </div>
  );
}
