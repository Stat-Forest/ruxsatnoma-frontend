import { AlertTriangle, CheckCircle2, HelpCircle, XCircle } from 'lucide-react';
import type { ApplicationCardOut } from '../queries';
import { checkResultStyle, checkTypeLabel, formatDateTime } from '../format';

function resultIcon(result: string) {
  switch (result) {
    case 'pass':
      return <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />;
    case 'fail':
      return <XCircle className="w-4 h-4 text-[#B91C1C] shrink-0 mt-0.5" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />;
    default:
      return <HelpCircle className="w-4 h-4 text-[#9AA3AB] shrink-0 mt-0.5" />;
  }
}

/** A check's `details` as a short human note — special-cased for the one
 * shape the task brief calls out (`{"reason": "layer_empty"}`, the
 * `gis_within_fund` skip that is the common case today because the
 * forest-fund boundary layer is still empty), falling back to a compact
 * key/value listing for everything else rather than raw JSON. */
function DetailNote({ checkType, result, details }: { checkType: string; result: string; details: unknown }) {
  if (
    checkType === 'gis_within_fund' &&
    result === 'skipped' &&
    typeof details === 'object' &&
    details !== null &&
    (details as Record<string, unknown>).reason === 'layer_empty'
  ) {
    return (
      <p className="text-[11px] text-[#5A646D]">
        Oʻrmon fondi chegara qatlami hali boʻsh (Agentlik maʼlumotlarini kutmoqda) — bu tekshiruv shu sababli
        oʻtkazib yuborilgan, muvaffaqiyatsiz emas.
      </p>
    );
  }
  if (typeof details === 'object' && details !== null && Object.keys(details as object).length > 0) {
    return (
      <p className="text-[11px] text-[#5A646D] font-mono break-all">
        {Object.entries(details as Record<string, unknown>)
          .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
          .join(' · ')}
      </p>
    );
  }
  return null;
}

export function ChecksPanel({ card }: { card: ApplicationCardOut }) {
  const checks = card.checks;
  const failCount = checks.filter((c) => c.result === 'fail').length;
  const warnCount = checks.filter((c) => c.result === 'warning').length;

  return (
    <section className="bg-white border border-[#E4E7EA] rounded-2xl shadow-xs font-sans overflow-hidden">
      <div className="p-6 border-b border-[#E4E7EA] flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-[#1A1F24]">Tekshiruvlar</h2>
            {failCount > 0 && (
              <span className="text-xs font-semibold text-[#991B1B] bg-[#FEF2F2] px-2.5 py-0.5 rounded-full border border-[#FCA5A5]">
                {failCount} ta oʻtmadi
              </span>
            )}
            {warnCount > 0 && (
              <span className="text-xs font-semibold text-[#B45309] bg-[#FFFBEB] px-2.5 py-0.5 rounded-full border border-[#FDE68A]">
                {warnCount} ta ogohlantirish
              </span>
            )}
          </div>
          <p className="text-xs text-[#5A646D] mt-0.5">GIS va meʼyor avto-tekshiruvlari natijalari</p>
        </div>
      </div>

      <div className="p-6 space-y-2">
        {checks.length === 0 && (
          <p className="text-xs text-[#5A646D]">Hali birorta tekshiruv yozilmagan.</p>
        )}
        {checks.map((check) => {
          const style = checkResultStyle(check.result);
          return (
            <div
              key={check.id}
              className={`p-4 rounded-xl border flex items-start gap-3 ${style.badgeClass}`}
            >
              {resultIcon(check.result)}
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-[#1A1F24]">{checkTypeLabel(check.check_type)}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${style.badgeClass}`}>
                    {style.label}
                  </span>
                </div>
                <DetailNote checkType={check.check_type} result={check.result} details={check.details} />
                <div className="text-[10px] text-[#767F87] font-mono">{formatDateTime(check.checked_at)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
