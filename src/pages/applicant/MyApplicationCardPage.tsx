import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Award, FileText, Receipt } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import {
  getApplicationCard,
  getApplicationTimeline,
  listActivityTypes,
  listClassifierItems,
  listInvoicesForApplication,
  listLivestockTypes,
} from './api';
import { formatDate, formatDateTime, formatMoney, pickName } from './format';
import { STATUS_BADGE_KIND, getStatusLabel } from './statusMeta';
import { ApplicantTimeline } from './components/ApplicantTimeline';
import { ContourBoundaryPanel } from '../gis/ContourBoundaryPanel';
import { formatPermitNumber } from '../permits/format';
import { usePermitForApplication } from '../permits/usePermitForApplication';
import { useLanguage } from '../../i18n/useT';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:8000';

const CARD_I18N = {
  uz_latn: {
    backToList: 'Arizalar roʻyxatiga qaytish',
    loading: 'Yuklanmoqda...',
    notFound: 'Ariza topilmadi yoki uni koʻrish huquqingiz yoʻq.',
    returnToList: 'Roʻyxatga qaytish',
    period: 'Davr',
    area: 'Maydon',
    submitted: 'Topshirilgan',
    livestockComposition: 'Chorva tarkibi',
    head: 'bosh',
    quantity: 'Miqdor:',
    calculatedAmount: 'Hisoblangan summa',
    som: 'soʻm',
    notCalculatedYet: 'Hali hisob-kitob qilinmagan.',
    invoice: 'Hisob-faktura:',
    viewInvoice: 'Hisob-fakturani koʻrish',
    permit: 'Ruxsatnoma',
    viewPermit: 'Ruxsatnomani koʻrish',
    attachedDocuments: 'Ilova qilingan hujjatlar',
    noDocuments: 'Hujjat biriktirilmagan.',
    download: 'Yuklab olish',
    history: 'Holatlar tarixi',
    defaultDocName: 'Hujjat',
    condHead: 'shartli bosh',
  },
  uz_cyrl: {
    backToList: 'Аризалар рўйхатига қайтиш',
    loading: 'Юкланмоқда...',
    notFound: 'Ариза топилмади ёки уни кўриш ҳуқуқингиз йўқ.',
    returnToList: 'Рўйхатга қайтиш',
    period: 'Давр',
    area: 'Майдон',
    submitted: 'Топширилган',
    livestockComposition: 'Чорва таркиби',
    head: 'бош',
    quantity: 'Миқдор:',
    calculatedAmount: 'Ҳисобланган сумма',
    som: 'сўм',
    notCalculatedYet: 'Ҳали ҳисоб-китоб қилинмаган.',
    invoice: 'Ҳисоб-фактура:',
    viewInvoice: 'Ҳисоб-фактурани кўриш',
    permit: 'Рухсатнома',
    viewPermit: 'Рухсатномани кўриш',
    attachedDocuments: 'Илова қилинган ҳужжатлар',
    noDocuments: 'Ҳужжат бириктирилмаган.',
    download: 'Юклаб олиш',
    history: 'Ҳолатлар тарихи',
    defaultDocName: 'Ҳужжат',
    condHead: 'шартли бош',
  },
  ru: {
    backToList: 'Вернуться к списку заявок',
    loading: 'Загрузка...',
    notFound: 'Заявка не найдена или у вас нет прав на её просмотр.',
    returnToList: 'Вернуться к списку',
    period: 'Период',
    area: 'Площадь',
    submitted: 'Подано',
    livestockComposition: 'Состав скота',
    head: 'голов',
    quantity: 'Количество:',
    calculatedAmount: 'Рассчитанная сумма',
    som: 'сум',
    notCalculatedYet: 'Расчет еще не произведен.',
    invoice: 'Счет-фактура:',
    viewInvoice: 'Посмотреть счет-фактуру',
    permit: 'Разрешение',
    viewPermit: 'Посмотреть разрешение',
    attachedDocuments: 'Прикрепленные документы',
    noDocuments: 'Документы не прикреплены.',
    download: 'Скачать',
    history: 'История статусов',
    defaultDocName: 'Документ',
    condHead: 'усл. голов',
  },
  en: {
    backToList: 'Back to applications list',
    loading: 'Loading...',
    notFound: 'Application not found or you do not have permission to view it.',
    returnToList: 'Back to list',
    period: 'Period',
    area: 'Area',
    submitted: 'Submitted',
    livestockComposition: 'Livestock details',
    head: 'heads',
    quantity: 'Quantity:',
    calculatedAmount: 'Calculated amount',
    som: 'UZS',
    notCalculatedYet: 'Not calculated yet.',
    invoice: 'Invoice:',
    viewInvoice: 'View invoice',
    permit: 'Permit',
    viewPermit: 'View permit',
    attachedDocuments: 'Attached documents',
    noDocuments: 'No documents attached.',
    download: 'Download',
    history: 'Status history',
    defaultDocName: 'Document',
    condHead: 'standard head',
  },
  kaa: {
    backToList: 'Arzalar dizimine qaytıw',
    loading: 'Júklenbekte...',
    notFound: 'Arza tabılmadı yamasa onı kóriw huqıqıńız joq.',
    returnToList: 'Dizimge qaytıw',
    period: 'Dáwir',
    area: 'Maydan',
    submitted: 'Tapsırılǵan',
    livestockComposition: 'Sharwa quramı',
    head: 'bas',
    quantity: 'Muǵdarı:',
    calculatedAmount: 'Esaplanǵan summa',
    som: 'swm',
    notCalculatedYet: 'Házirshe esap-kitap qılınbaǵan.',
    invoice: 'Esap-faktura:',
    viewInvoice: 'Esap-fakturanı kóriw',
    permit: 'Ruxsatnama',
    viewPermit: 'Ruxsatnamanı kóriw',
    attachedDocuments: 'Qosımsha etilgen hújjetler',
    noDocuments: 'Hújjet biriktirilmegen.',
    download: 'Júklep alıw',
    history: 'Jaǵdaylar tariyxı',
    defaultDocName: 'Hújjet',
    condHead: 'shártli bas',
  },
};

/**
 * B8 — the applicant's OWN application card. Deliberately the SIMPLE view:
 * status, timeline, attached documents, the calculated amount and a link to
 * the invoice.
 */
export function MyApplicationCardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const t = CARD_I18N[lang as keyof typeof CARD_I18N] || CARD_I18N.uz_latn;

  const cardQuery = useQuery({
    queryKey: ['my-application-card', id],
    queryFn: () => getApplicationCard(id!),
    enabled: !!id,
  });
  const timelineQuery = useQuery({
    queryKey: ['my-application-timeline', id],
    queryFn: () => getApplicationTimeline(id!),
    enabled: !!id,
  });
  const activityTypesQuery = useQuery({ queryKey: ['activity-types'], queryFn: listActivityTypes });
  const livestockTypesQuery = useQuery({ queryKey: ['livestock-types'], queryFn: listLivestockTypes });
  const docTypesQuery = useQuery({ queryKey: ['classifier-items', 'doc_types'], queryFn: () => listClassifierItems('doc_types') });
  const invoicesQuery = useQuery({
    queryKey: ['invoices-for-application', id],
    queryFn: () => listInvoicesForApplication(id!),
    enabled: !!id,
    retry: false,
  });
  const permitQuery = usePermitForApplication({
    applicationId: id ?? '',
    applicantId: cardQuery.data?.applicant_id,
    contourId: cardQuery.data?.contour_id,
    enabled: !!id && (cardQuery.data?.status === 'PAID' || cardQuery.data?.status === 'PERMIT_ISSUED'),
  });

  if (!id) return null;

  if (cardQuery.isLoading) {
    return <div className="max-w-5xl mx-auto py-16 text-center text-sm text-[#5A646D]">{t.loading}</div>;
  }
  if (cardQuery.isError || !cardQuery.data) {
    return (
      <div className="max-w-5xl mx-auto py-16 text-center space-y-3">
        <p className="text-sm text-[#B91C1C]" role="alert">
          {t.notFound}
        </p>
        <Button variant="outline" onClick={() => navigate('/my/applications')}>
          {t.returnToList}
        </Button>
      </div>
    );
  }

  const card = cardQuery.data;
  const activityName = card.activity_type_id
    ? pickName(activityTypesQuery.data?.find((a) => a.id === card.activity_type_id)?.name, lang)
    : '—';
  const livestockName = (livestockTypeId: string) =>
    pickName(livestockTypesQuery.data?.find((l) => l.id === livestockTypeId)?.name, lang);
  const docTypeName = (docTypeItemId: string) =>
    pickName(docTypesQuery.data?.find((d) => d.id === docTypeItemId)?.name, lang) || t.defaultDocName;

  const invoice = invoicesQuery.data?.[0];

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 font-sans pb-16">
      <div className="flex items-center gap-2 text-xs text-[#5A646D] border-b border-[#E4E7EA] pb-3">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => navigate('/my/applications')}
          className="text-[#2E7D4F] font-bold hover:bg-[#F0F7F1] cursor-pointer"
        >
          {t.backToList}
        </Button>
      </div>

      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 sm:p-6 shadow-xs space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            {/* Plan 12, R1: every application is born SUBMITTED and numbered
                in the same transaction that files it, so `card.number` is
                never null in practice any more — this fallback is only for
                the type, which still allows it. */}
            <h1 className="text-lg sm:text-xl font-bold text-[#1A1F24] font-mono break-all sm:break-normal">{card.number ?? card.id.slice(0, 8)}</h1>
            <p className="text-sm text-[#5A646D] mt-1 break-words">{activityName}</p>
          </div>
          <div className="shrink-0">
            <StatusBadge status={STATUS_BADGE_KIND[card.status]} label={getStatusLabel(card.status, lang)} />
          </div>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-[#E4E7EA] text-xs">
          <div>
            <dt className="text-[#5A646D]">{t.period}</dt>
            <dd className="font-semibold text-[#1A1F24] mt-0.5">
              {card.period_from && card.period_to ? `${formatDate(card.period_from)} — ${formatDate(card.period_to)}` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[#5A646D]">{t.area}</dt>
            <dd className="font-semibold text-[#1A1F24] mt-0.5">
              {card.requested_area_ha ? `${card.requested_area_ha} ga` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[#5A646D]">{t.submitted}</dt>
            <dd className="font-semibold text-[#1A1F24] mt-0.5">{formatDateTime(card.submitted_at)}</dd>
          </div>
        </dl>

        {card.items.length > 0 && (
          <div className="pt-3 border-t border-[#E4E7EA]">
            <dt className="text-xs text-[#5A646D] mb-1">{t.livestockComposition}</dt>
            <ul className="text-xs text-[#1A1F24] space-y-0.5">
              {card.items.map((item) => (
                <li key={item.id} className="break-words">
                  {livestockName(item.livestock_type_id)}: <strong>{item.head_count}</strong> {t.head}
                </li>
              ))}
            </ul>
          </div>
        )}
        {card.quantity && (
          <div className="pt-3 border-t border-[#E4E7EA] text-xs">
            <span className="text-[#5A646D]">{t.quantity} </span>
            <strong className="text-[#1A1F24]">{card.quantity}</strong>
          </div>
        )}
      </div>

      {/* Calculated amount */}
      <section className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-2xl p-4 sm:p-6 shadow-xs space-y-2">
        <h2 className="text-sm font-bold text-[#0369A1] uppercase tracking-wider">{t.calculatedAmount}</h2>
        {card.calculation ? (
          <>
            <div className="font-mono text-xl sm:text-2xl font-extrabold text-[#123522] break-all">{formatMoney(card.calculation.amount)} {t.som}</div>
            <p className="text-xs text-[#5A646D] break-words">
              rule_version: <code className="bg-white px-1 py-0.5 rounded border border-[#BAE6FD]">{card.calculation.rule_version}</code>
              {card.calculation.max_sb !== null && (
                <>
                  {' '}
                  · limit: {card.calculation.used_sb}/{card.calculation.max_sb} {t.condHead}
                </>
              )}
            </p>
          </>
        ) : (
          <p className="text-xs text-[#5A646D]">{t.notCalculatedYet}</p>
        )}

        {invoice && (
          <div className="pt-3 border-t border-[#BAE6FD] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-[#1A1F24] min-w-0">
              <span className="text-[#5A646D]">{t.invoice} </span>
              <strong className="font-mono">{invoice.number}</strong> — {formatMoney(invoice.amount)} {t.som}
            </div>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Receipt className="w-4 h-4 shrink-0" />}
              onClick={() => navigate(`/my/invoices/${invoice.id}`)}
              className="cursor-pointer w-full sm:w-auto shrink-0 justify-center"
            >
              {t.viewInvoice}
            </Button>
          </div>
        )}
      </section>

      {/* Permit */}
      {permitQuery.data && (
        <section className="bg-[#F0F7F1] border border-[#D9EBDC] rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[#123522] uppercase tracking-wider">{t.permit}</h2>
            <p className="text-xs text-[#5A646D] mt-1 font-mono break-all">
              {formatPermitNumber(permitQuery.data.series, permitQuery.data.number)}
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Award className="w-4 h-4 shrink-0" />}
            onClick={() => navigate(`/my/permits/${permitQuery.data!.id}`)}
            className="cursor-pointer font-bold w-full sm:w-auto shrink-0 justify-center"
          >
            {t.viewPermit}
          </Button>
        </section>
      )}

      {/* The plot on a map + KMZ (Odilxon, 2026-09-13) */}
      <ContourBoundaryPanel contourId={card.contour_id} />

      {/* Documents */}
      <section className="bg-white border border-[#E4E7EA] rounded-2xl shadow-xs p-4 sm:p-6 space-y-3">
        <h2 className="text-sm font-bold text-[#1A1F24] uppercase tracking-wider">
          {t.attachedDocuments} {card.documents.length > 0 && `(${card.documents.length})`}
        </h2>
        {card.documents.length === 0 ? (
          <p className="text-xs text-[#5A646D]">{t.noDocuments}</p>
        ) : (
          <ul className="space-y-2">
            {card.documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-3 p-3 border border-[#E4E7EA] rounded-xl text-xs"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <FileText className="w-4 h-4 text-[#5A646D] shrink-0" />
                  <span className="font-semibold text-[#1A1F24] truncate">{docTypeName(doc.doc_type_item_id)}</span>
                  {doc.note && <span className="text-[#5A646D] truncate">— {doc.note}</span>}
                </div>
                <a
                  href={`${API_BASE}/api/v1/files/${doc.file_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-[#2E7D4F] hover:underline shrink-0"
                >
                  {t.download}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Timeline */}
      <section className="bg-white border border-[#E4E7EA] rounded-2xl shadow-xs p-4 sm:p-6 space-y-3">
        <h2 className="text-sm font-bold text-[#1A1F24] uppercase tracking-wider">{t.history}</h2>
        <ApplicantTimeline timeline={timelineQuery.data} />
      </section>
    </div>
  );
}

