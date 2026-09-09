import { Calculator } from 'lucide-react';
import type { ApplicationCardOut } from '../queries';
import { formatAmount, formatDateTime } from '../format';
import { useLanguage } from '../../../i18n/useT';

const CALCULATION_PANEL_I18N = {
  uz_latn: {
    title: 'Hisob-kitob',
    subtitle: 'Ariza uchun saqlangan joriy narx',
    empty: 'Hali hisob-kitob saqlanmagan — bu ariza submit bosqichidan oʻtmagan boʻlishi mumkin.',
    calculatedAt: 'Hisoblangan:',
    currency: 'UZS',
  },
  uz_cyrl: {
    title: 'Ҳисоб-китоб',
    subtitle: 'Ариза учун сақланган жорий нарх',
    empty: 'Ҳали ҳисоб-китоб сақланмаган — бу ариза submit босқичидан ўтмаган бўлиши мумкин.',
    calculatedAt: 'Ҳисобланган:',
    currency: 'UZS',
  },
  ru: {
    title: 'Расчет',
    subtitle: 'Текущая сохраненная стоимость заявления',
    empty: 'Расчет еще не сохранен — возможно, заявление еще не отправлено.',
    calculatedAt: 'Рассчитано:',
    currency: 'UZS',
  },
  en: {
    title: 'Calculation',
    subtitle: 'Current saved price for application',
    empty: 'No calculation saved yet — application might not have passed submission stage.',
    calculatedAt: 'Calculated:',
    currency: 'UZS',
  },
  kaa: {
    title: 'Esap-kitap',
    subtitle: 'Arza ushın saqlanǵan házirgi baha',
    empty: 'Háli esap-kitap saqlanbaǵan — bul arza submit basqıshınan ótpegen bolıwı múmkin.',
    calculatedAt: 'Esaplanǵan:',
    currency: 'UZS',
  },
};

/** The application's CURRENT stored price — `card.calculation`, the newest
 * `calculations` row (`applications.service.current_calculation`), which is
 * exactly what `payments` invoices from and what `decision.approve` checks
 * against the role's limit. Not the reference's invented formula breakdown
 * (`Oz`, `Oz_eff`, `InfraFee`) — `ApplicationCalculationOut` carries no
 * breakdown at all, only `PrecheckCalculationOut` (the dry-run preview) does,
 * and this card never runs a preview. */
export function CalculationPanel({ card }: { card: ApplicationCardOut }) {
  const { lang } = useLanguage();
  const tr = CALCULATION_PANEL_I18N[lang] ?? CALCULATION_PANEL_I18N.uz_latn;
  const calc = card.calculation;

  return (
    <section className="bg-white border border-[#E4E7EA] rounded-2xl shadow-xs font-sans overflow-hidden">
      <div className="p-6 border-b border-[#E4E7EA] flex items-center gap-2">
        <Calculator className="w-5 h-5 text-[#2E7D4F]" />
        <div>
          <h2 className="text-lg font-bold text-[#1A1F24]">{tr.title}</h2>
          <p className="text-xs text-[#5A646D] mt-0.5">{tr.subtitle}</p>
        </div>
      </div>

      <div className="p-6">
        {!calc ? (
          <p className="text-xs text-[#5A646D]">{tr.empty}</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-2xl font-bold text-[#123522] font-mono">
                {formatAmount(calc.amount)} {tr.currency}
              </span>
              <span className="text-xs text-[#5A646D] font-mono">rule_version: {calc.rule_version}</span>
            </div>

            {(calc.max_sb !== null || calc.used_sb !== null) && (
              <div className="bg-[#F8F9FA] p-4 rounded-xl border border-[#E4E7EA] space-y-2">
                <div className="flex flex-wrap gap-4 text-xs text-[#5A646D]">
                  <span>
                    <strong className="text-[#1A1F24]">MaxSB:</strong> {calc.max_sb ?? '—'}
                  </span>
                  <span>
                    <strong className="text-[#2E7D4F]">UsedSB:</strong> {formatAmount(calc.used_sb)}
                  </span>
                  <span>
                    <strong className="text-[#B45309]">RemainingSB:</strong> {formatAmount(calc.remaining_sb)}
                  </span>
                </div>
              </div>
            )}

            <div className="text-[11px] text-[#767F87] font-mono">{tr.calculatedAt} {formatDateTime(calc.created_at)}</div>
          </div>
        )}
      </div>
    </section>
  );
}
