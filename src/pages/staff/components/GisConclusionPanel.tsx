import { Compass, Info } from 'lucide-react';
import type { ApplicationCardOut } from '../queries';
import { checkResultStyle, checkTypeLabel } from '../format';

const GIS_CHECK_TYPES = new Set(['gis_validity', 'gis_within_fund', 'gis_overlap']);

/**
 * A read-only summary of the GIS checks a submission already carries — never
 * a form to write a new one. Writing a GIS specialist's own conclusion
 * (`conclusions` table, `CONCLUSION_KINDS = ("executor", "gis")` in
 * `applications/models.py`) has no route yet in 3.9a-flow; the reference's
 * own panel invents a submit button against nothing. `gis_within_fund` is
 * called out on its own because it is the one that is routinely `skipped`
 * today — the forest-fund boundary layer stays empty until the Agency
 * delivers it (root CLAUDE.md).
 */
export function GisConclusionPanel({ card }: { card: ApplicationCardOut }) {
  const gisChecks = card.checks.filter((c) => GIS_CHECK_TYPES.has(c.check_type));

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-5 shadow-xs space-y-3 font-sans">
      <div className="flex items-center gap-2 border-b border-[#E4E7EA] pb-3">
        <Compass className="w-5 h-5 text-[#2E7D4F]" />
        <h3 className="text-sm font-bold text-[#1A1F24]">GIS xulosasi</h3>
      </div>

      {gisChecks.length === 0 ? (
        <p className="text-xs text-[#5A646D]">Hali GIS tekshiruvi oʻtkazilmagan.</p>
      ) : (
        <div className="space-y-1.5">
          {gisChecks.map((check) => {
            const style = checkResultStyle(check.result);
            return (
              <div key={check.id} className={`p-2.5 rounded-xl border text-xs ${style.badgeClass}`}>
                <div className="font-semibold">{checkTypeLabel(check.check_type)}</div>
                <div className="text-[11px]">{style.label}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="p-3 bg-[#F8F9FA] border border-[#E4E7EA] rounded-xl text-[11px] text-[#5A646D] flex items-start gap-2">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#2E7D4F]" />
        <span>
          GIS mutaxassisining alohida xulosa yozish imkoniyati keyingi bosqichda (3.9b) qoʻshiladi — bu yerda
          faqat avtomatik topologik tekshiruv natijalari koʻrsatiladi.
        </span>
      </div>
    </div>
  );
}
