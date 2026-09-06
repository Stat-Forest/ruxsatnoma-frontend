import { Calculator } from 'lucide-react';
import type { ApplicationCardOut } from '../queries';
import { formatAmount, formatDateTime } from '../format';

/** The application's CURRENT stored price — `card.calculation`, the newest
 * `calculations` row (`applications.service.current_calculation`), which is
 * exactly what `payments` invoices from and what `decision.approve` checks
 * against the role's limit. Not the reference's invented formula breakdown
 * (`Oz`, `Oz_eff`, `InfraFee`) — `ApplicationCalculationOut` carries no
 * breakdown at all, only `PrecheckCalculationOut` (the dry-run preview) does,
 * and this card never runs a preview. */
export function CalculationPanel({ card }: { card: ApplicationCardOut }) {
  const calc = card.calculation;

  return (
    <section className="bg-white border border-[#E4E7EA] rounded-2xl shadow-xs font-sans overflow-hidden">
      <div className="p-6 border-b border-[#E4E7EA] flex items-center gap-2">
        <Calculator className="w-5 h-5 text-[#2E7D4F]" />
        <div>
          <h2 className="text-lg font-bold text-[#1A1F24]">Hisob-kitob</h2>
          <p className="text-xs text-[#5A646D] mt-0.5">Ariza uchun saqlangan joriy narx</p>
        </div>
      </div>

      <div className="p-6">
        {!calc ? (
          <p className="text-xs text-[#5A646D]">
            Hali hisob-kitob saqlanmagan — bu ariza submit bosqichidan oʻtmagan boʻlishi mumkin.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-2xl font-bold text-[#123522] font-mono">
                {formatAmount(calc.amount)} UZS
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

            <div className="text-[11px] text-[#767F87] font-mono">Hisoblangan: {formatDateTime(calc.created_at)}</div>
          </div>
        )}
      </div>
    </section>
  );
}
