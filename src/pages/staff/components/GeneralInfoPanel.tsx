import { UserCheck, FileText } from 'lucide-react';
import { useLanguage } from '../../../i18n/useT';
import { useActivityTypes, useBenefitCategories, useContour, useLivestockTypes, type ApplicationCardOut } from '../queries';
import { formatAmount, formatDate, localizedName, shortId } from '../format';

const ON_BEHALF_LABELS: Record<string, Record<ApplicationCardOut['on_behalf'], string>> = {
  uz_latn: {
    self: "Shaxsan (JSHSHIR)",
    legal: "Yuridik shaxs vakili sifatida",
  },
  uz_cyrl: {
    self: "Шахсан (ЖШШИР)",
    legal: "Юридик шахс вакили сифатида",
  },
  ru: {
    self: "Лично (ПИНФЛ)",
    legal: "От имени организации",
  },
  en: {
    self: "In person (PINFL)",
    legal: "On behalf of legal entity",
  },
  kaa: {
    self: "Ózi (JSHSHIR)",
    legal: "Yuridikalıq shaxs wákili retinde",
  },
};

const CHANNEL_LABELS: Record<ApplicationCardOut['channel'], string> = {
  portal: 'Portal (ruxsatnoma-urmon.uz)',
  mygov: 'my.gov.uz',
};

const GENERAL_INFO_I18N = {
  uz_latn: {
    title: 'Umumiy maʼlumotlar',
    subtitle: 'Ariza rekvizitlari',
    applicantSection: 'Arizachi',
    applicantId: 'Arizachi (applicant_id):',
    onBehalf: 'Kim nomidan:',
    channel: 'Yuborish kanali:',
    benefitCategory: 'Imtiyoz toifasi:',
    notSpecified: 'Koʻrsatilmagan',
    paramsSection: 'Ariza parametrlari',
    appNumber: 'Ariza raqami:',
    notAssigned: 'Hali berilmagan',
    activityType: 'Faoliyat turi:',
    requestedPeriod: 'Soʻralgan davr:',
    contour: 'Kontur:',
    area: 'Maydon:',
    vacant: 'boʻsh:',
    haUnit: 'ga',
    requestedArea: 'Soʻralgan maydon:',
    quantity: 'Miqdor (quantity):',
    livestock: 'Chorva mollari',
    livestockType: 'Chorva turi',
    headCount: 'Bosh soni',
  },
  uz_cyrl: {
    title: 'Умумий маълумотлар',
    subtitle: 'Ариза реквизитлари',
    applicantSection: 'Аризачи',
    applicantId: 'Аризачи (applicant_id):',
    onBehalf: 'Ким номидан:',
    channel: 'Юбориш канали:',
    benefitCategory: 'Имтиёз тоифаси:',
    notSpecified: 'Кўрсатилмаган',
    paramsSection: 'Ариза параметрлари',
    appNumber: 'Ариза рақами:',
    notAssigned: 'Ҳали берилмаган',
    activityType: 'Фаолият тури:',
    requestedPeriod: 'Сўралган давр:',
    contour: 'Контур:',
    area: 'Майдон:',
    vacant: 'бўш:',
    haUnit: 'га',
    requestedArea: 'Сўралган майдон:',
    quantity: 'Миқдор (quantity):',
    livestock: 'Чорва моллари',
    livestockType: 'Чорва тури',
    headCount: 'Бош сони',
  },
  ru: {
    title: 'Общие сведения',
    subtitle: 'Реквизиты заявления',
    applicantSection: 'Заявитель',
    applicantId: 'Заявитель (applicant_id):',
    onBehalf: 'От чьего имени:',
    channel: 'Канал подачи:',
    benefitCategory: 'Категория льготы:',
    notSpecified: 'Не указано',
    paramsSection: 'Параметры заявления',
    appNumber: 'Номер заявления:',
    notAssigned: 'Еще не присвоен',
    activityType: 'Вид деятельности:',
    requestedPeriod: 'Запрашиваемый период:',
    contour: 'Контур:',
    area: 'Площадь:',
    vacant: 'свободно:',
    haUnit: 'га',
    requestedArea: 'Запрашиваемая площадь:',
    quantity: 'Количество (quantity):',
    livestock: 'Скот',
    livestockType: 'Вид скота',
    headCount: 'Поголовье',
  },
  en: {
    title: 'General Information',
    subtitle: 'Application details',
    applicantSection: 'Applicant',
    applicantId: 'Applicant (applicant_id):',
    onBehalf: 'On behalf of:',
    channel: 'Submission channel:',
    benefitCategory: 'Benefit category:',
    notSpecified: 'Not specified',
    paramsSection: 'Application parameters',
    appNumber: 'Application number:',
    notAssigned: 'Not assigned yet',
    activityType: 'Activity type:',
    requestedPeriod: 'Requested period:',
    contour: 'Contour:',
    area: 'Area:',
    vacant: 'available:',
    haUnit: 'ha',
    requestedArea: 'Requested area:',
    quantity: 'Quantity:',
    livestock: 'Livestock',
    livestockType: 'Livestock type',
    headCount: 'Head count',
  },
  kaa: {
    title: 'Ulıwma maǵlıwmatlar',
    subtitle: 'Arza rekvizitleri',
    applicantSection: 'Arzashı',
    applicantId: 'Arzashı (applicant_id):',
    onBehalf: 'Kimniń atınan:',
    channel: 'Jiberiw kanalı:',
    benefitCategory: 'Jeńillik kategoriyası:',
    notSpecified: 'Kórsetilmegen',
    paramsSection: 'Arza parametrleri',
    appNumber: 'Arza nómiri:',
    notAssigned: 'Háli berilmegen',
    activityType: 'Iskerlik túri:',
    requestedPeriod: 'Soraw etilgen dáwir:',
    contour: 'Kontur:',
    area: 'Maydan:',
    vacant: 'bos:',
    haUnit: 'ga',
    requestedArea: 'Soraw etilgen maydan:',
    quantity: 'Muǵdar (quantity):',
    livestock: 'Qara mallar',
    livestockType: 'Mal túri',
    headCount: 'Bas sanı',
  },
};

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[#5A646D]">{label}</dt>
      <dd className="font-semibold text-[#1A1F24]">{value}</dd>
      {sub && <div className="text-[11px] font-normal text-[#5A646D]">{sub}</div>}
    </div>
  );
}

/** Real requisites only — every value below is a column `GET /applications/
 * {id}` actually returns or a reference lookup resolved from it. The
 * reference's own `GeneralInfoPanel` invents a Solik.uz/OneID/passport
 * narrative with no backing route; none of that is reproduced here. */
export function GeneralInfoPanel({ card }: { card: ApplicationCardOut }) {
  const { lang } = useLanguage();
  const tr = GENERAL_INFO_I18N[lang] ?? GENERAL_INFO_I18N.uz_latn;
  const onBehalfTr = ON_BEHALF_LABELS[lang] ?? ON_BEHALF_LABELS.uz_latn;

  const activityTypes = useActivityTypes();
  const livestockTypes = useLivestockTypes();
  const benefitCategories = useBenefitCategories();
  const contour = useContour(card.contour_id);

  const benefitName = card.benefit_category_item_id
    ? localizedName(benefitCategories.data?.find((b) => b.id === card.benefit_category_item_id)?.name, lang)
    : null;

  const activityName = card.activity_type_id
    ? localizedName(activityTypes.data?.find((a) => a.id === card.activity_type_id)?.name, lang)
    : null;

  return (
    <section className="bg-white border border-[#E4E7EA] rounded-2xl shadow-xs font-sans overflow-hidden">
      <div className="p-6 border-b border-[#E4E7EA]">
        <h2 className="text-lg font-bold text-[#1A1F24]">{tr.title}</h2>
        <p className="text-xs text-[#5A646D] mt-0.5">{tr.subtitle}</p>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A646D] border-b border-[#E4E7EA] pb-2 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-[#2E7D4F]" /> {tr.applicantSection}
          </h3>
          <dl className="grid grid-cols-1 gap-3 text-xs">
            <Fact label={tr.applicantId} value={shortId(card.applicant_id)} />
            <Fact label={tr.onBehalf} value={onBehalfTr[card.on_behalf] ?? card.on_behalf} />
            <Fact label={tr.channel} value={CHANNEL_LABELS[card.channel] ?? card.channel} />
            <Fact
              label={tr.benefitCategory}
              value={
                card.benefit_category_item_id
                  ? benefitName || shortId(card.benefit_category_item_id)
                  : tr.notSpecified
              }
            />
          </dl>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A646D] border-b border-[#E4E7EA] pb-2 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-[#2E7D4F]" /> {tr.paramsSection}
          </h3>
          <dl className="grid grid-cols-1 gap-3 text-xs">
            <Fact label={tr.appNumber} value={card.number ?? tr.notAssigned} />
            <Fact
              label={tr.activityType}
              value={activityName || (card.activity_type_id ? shortId(card.activity_type_id) : "—")}
            />
            <Fact
              label={tr.requestedPeriod}
              value={card.period_from && card.period_to ? `${formatDate(card.period_from)} — ${formatDate(card.period_to)}` : "—"}
            />
            <Fact
              label={tr.contour}
              value={contour.data ? `№ ${contour.data.number}` : card.contour_id ? shortId(card.contour_id) : "—"}
              sub={
                contour.data
                  ? `${tr.area} ${formatAmount(contour.data.area_ha)} ${tr.haUnit}, ${tr.vacant} ${formatAmount(contour.data.s_available_ha)} ${tr.haUnit}`
                  : undefined
              }
            />
            <Fact
              label={tr.requestedArea}
              value={card.requested_area_ha ? `${formatAmount(card.requested_area_ha)} ${tr.haUnit}` : "—"}
            />
            <Fact label={tr.quantity} value={card.quantity ? formatAmount(card.quantity) : "—"} />
          </dl>
        </div>
      </div>

      {card.items.length > 0 && (
        <div className="px-6 pb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A646D] border-b border-[#E4E7EA] pb-2 mb-3">
            {tr.livestock}
          </h3>
          <div className="overflow-x-auto border border-[#E4E7EA] rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8F9FA] border-b border-[#E4E7EA] text-[#5A646D] font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2 px-3">{tr.livestockType}</th>
                  <th className="py-2 px-3 text-right">{tr.headCount}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E7EA]">
                {card.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 px-3 font-medium text-[#1A1F24]">
                      {localizedName(livestockTypes.data?.find((l) => l.id === item.livestock_type_id)?.name, lang) ||
                        shortId(item.livestock_type_id)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-[#1A1F24]">{item.head_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
