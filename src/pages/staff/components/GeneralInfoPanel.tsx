import { UserCheck, FileText } from 'lucide-react';
import { useActivityTypes, useContour, useLivestockTypes, type ApplicationCardOut } from '../queries';
import { formatAmount, formatDate, localizedName, shortId } from '../format';

const ON_BEHALF_LABELS: Record<ApplicationCardOut['on_behalf'], string> = {
  self: "Shaxsan (JSHSHIR) — От своего имени",
  legal: "Yuridik shaxs vakili sifatida — От имени организации",
};

const CHANNEL_LABELS: Record<ApplicationCardOut['channel'], string> = {
  portal: 'Portal (ruxsatnoma-urmon.uz)',
  mygov: 'my.gov.uz',
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
  const activityTypes = useActivityTypes();
  const livestockTypes = useLivestockTypes();
  const contour = useContour(card.contour_id);

  const activityName = card.activity_type_id
    ? localizedName(activityTypes.data?.find((a) => a.id === card.activity_type_id)?.name)
    : null;

  return (
    <section className="bg-white border border-[#E4E7EA] rounded-2xl shadow-xs font-sans overflow-hidden">
      <div className="p-6 border-b border-[#E4E7EA]">
        <h2 className="text-lg font-bold text-[#1A1F24]">Umumiy maʼlumotlar</h2>
        <p className="text-xs text-[#5A646D] mt-0.5">
          Ariza rekvizitlari — GET /api/v1/applications/{'{id}'} javobidan
        </p>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A646D] border-b border-[#E4E7EA] pb-2 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-[#2E7D4F]" /> Arizachi
          </h3>
          <dl className="grid grid-cols-1 gap-3 text-xs">
            <Fact label="Arizachi (applicant_id):" value={shortId(card.applicant_id)} />
            <Fact label="Kim nomidan:" value={ON_BEHALF_LABELS[card.on_behalf]} />
            <Fact label="Yuborish kanali:" value={CHANNEL_LABELS[card.channel]} />
            <Fact
              label="Imtiyoz toifasi:"
              value={card.benefit_category_item_id ? shortId(card.benefit_category_item_id) : "Koʻrsatilmagan"}
            />
          </dl>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A646D] border-b border-[#E4E7EA] pb-2 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-[#2E7D4F]" /> Ariza parametrlari
          </h3>
          <dl className="grid grid-cols-1 gap-3 text-xs">
            <Fact label="Ariza raqami:" value={card.number ?? "Hali berilmagan"} />
            <Fact
              label="Faoliyat turi:"
              value={activityName || (card.activity_type_id ? shortId(card.activity_type_id) : "—")}
            />
            <Fact
              label="Soʻralgan davr:"
              value={card.period_from && card.period_to ? `${formatDate(card.period_from)} — ${formatDate(card.period_to)}` : "—"}
            />
            <Fact
              label="Kontur:"
              value={contour.data ? `№ ${contour.data.number}` : card.contour_id ? shortId(card.contour_id) : "—"}
              sub={
                contour.data
                  ? `Maydon: ${formatAmount(contour.data.area_ha)} ga, boʻsh: ${formatAmount(contour.data.s_available_ha)} ga`
                  : undefined
              }
            />
            <Fact
              label="Soʻralgan maydon:"
              value={card.requested_area_ha ? `${formatAmount(card.requested_area_ha)} ga` : "—"}
            />
            <Fact label="Miqdor (quantity):" value={card.quantity ? formatAmount(card.quantity) : "—"} />
          </dl>
        </div>
      </div>

      {card.items.length > 0 && (
        <div className="px-6 pb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A646D] border-b border-[#E4E7EA] pb-2 mb-3">
            Chorva mollari (application_items)
          </h3>
          <div className="overflow-x-auto border border-[#E4E7EA] rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8F9FA] border-b border-[#E4E7EA] text-[#5A646D] font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2 px-3">Chorva turi</th>
                  <th className="py-2 px-3 text-right">Bosh soni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E7EA]">
                {card.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 px-3 font-medium text-[#1A1F24]">
                      {localizedName(livestockTypes.data?.find((l) => l.id === item.livestock_type_id)?.name) ||
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
