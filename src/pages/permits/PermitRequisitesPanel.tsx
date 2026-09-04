import { CheckCircle2 } from 'lucide-react';
import type { components } from '../../api/schema';
import { useLanguage } from '../../i18n/useT';
import { formatDate, formatDecimal, formatMoney, formatPermitNumber, shortId } from './format';
import { PERMIT_STATUS_LABEL, PERMIT_STATUS_STYLE } from './statusMeta';
import { useActivityTypeName, useContourNumber, useOrganizationName } from './useRefsLookup';

type PermitOut = components['schemas']['PermitOut'];

/**
 * The permit's own frozen requisites (form 1-ilova) — every field here is a
 * column of `permits` itself, set once at issuance (`permits/service.py::issue`)
 * and never re-derived from the application afterwards. This is what "display
 * from the permit, not by re-reading the application" (the task's own
 * instruction) means concretely: there is no `GET /applications/{id}` call
 * anywhere in this file.
 *
 * `permits.snapshot` (the JSON body the PDF itself is rendered from) is
 * deliberately excluded from every API response (`permits/schemas.py`'s own
 * module docstring) — so the human-readable names below come from the three
 * small ref lookups in `useRefsLookup.ts`, resolved from the permit's own id
 * columns, not from the snapshot.
 */
export function PermitRequisitesPanel({
  permit,
  applicantName,
}: {
  permit: PermitOut;
  /** The current viewer's own name, supplied by the caller ONLY when the
   *  viewer IS the permit's holder (`MyPermitPage`) — never fetched here,
   *  since there is no general "look up any applicant by id" route. Absent
   *  on the staff page, where the applicant shows as an id. */
  applicantName?: string | null;
}) {
  const { lang } = useLanguage();
  const activityName = useActivityTypeName(permit.activity_type_id, lang);
  const organizationName = useOrganizationName(permit.organization_id, lang);
  const contourNumber = useContourNumber(permit.contour_id);

  const area = formatDecimal(permit.area_ha);
  const sbLoad = formatDecimal(permit.sb_load);

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs font-sans space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E7EA] pb-3">
        <div>
          <div className="text-xs uppercase tracking-wider font-bold text-[#5A646D] mb-1">
            Ruxsatnoma seriyasi va raqami
          </div>
          <div className="font-mono text-2xl font-extrabold text-[#1A1F24] tracking-tight">
            {formatPermitNumber(permit.series, permit.number)}
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border ${
            PERMIT_STATUS_STYLE[permit.status] ?? PERMIT_STATUS_STYLE.pending_signatures
          }`}
        >
          {PERMIT_STATUS_LABEL[permit.status] ?? permit.status}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-[#1A1F24]">
        <div className="space-y-1">
          <span className="text-[#5A646D] font-medium block">Arizachi:</span>
          <strong className="font-bold block text-[#1A1F24]">
            {applicantName ?? `ID ${shortId(permit.applicant_id)}`}
          </strong>
        </div>

        <div className="space-y-1">
          <span className="text-[#5A646D] font-medium block">Vakolatli organ:</span>
          <strong className="font-bold block text-[#1A1F24]">
            {organizationName ?? `ID ${shortId(permit.organization_id)}`}
          </strong>
        </div>

        <div className="space-y-1">
          <span className="text-[#5A646D] font-medium block">Faoliyat turi:</span>
          <strong className="font-bold block text-[#2E7D4F] text-sm">
            {activityName ?? `ID ${shortId(permit.activity_type_id)}`}
          </strong>
        </div>

        <div className="space-y-1">
          <span className="text-[#5A646D] font-medium block">Kontur:</span>
          <strong className="font-mono font-bold block text-[#1A1F24]">
            {contourNumber ? `№ ${contourNumber}` : `ID ${shortId(permit.contour_id)}`}
          </strong>
        </div>

        <div className="space-y-1">
          <span className="text-[#5A646D] font-medium block">Ajratilgan maydon:</span>
          <strong className="font-mono font-bold block text-sm text-[#123522]">
            {area ? `${area} ha` : '—'}
          </strong>
        </div>

        <div className="space-y-1">
          <span className="text-[#5A646D] font-medium block">Foydalanish davri:</span>
          <strong className="font-mono font-bold block text-[#1A1F24]">
            {formatDate(permit.period_from)} — {formatDate(permit.period_to)}
          </strong>
        </div>

        <div className="space-y-1">
          <span className="text-[#5A646D] font-medium block">Shartli bosh yuklama (SB):</span>
          <strong className="font-mono font-bold block text-[#1A1F24]">
            {sbLoad ? `${sbLoad} SB` : 'Talab qilinmaydi'}
          </strong>
        </div>

        <div className="space-y-1">
          <span className="text-[#5A646D] font-medium block">Toʻlov summasi:</span>
          <strong className="font-bold block text-[#15803D] flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> {formatMoney(permit.amount)} soʻm
          </strong>
        </div>

        <div className="space-y-1">
          <span className="text-[#5A646D] font-medium block">Berilgan sana:</span>
          <strong className="font-mono font-bold block text-[#1A1F24]">
            {permit.issued_at ? formatDate(permit.issued_at.slice(0, 10)) : 'Hali imzolanmagan'}
          </strong>
        </div>
      </div>

      {/* Fact 1 (task brief): the PDF is rendered exactly once and its sha256
          frozen as the document's identity — shown here, verbatim, rather
          than asserted in prose, so a reader can actually check it against
          the downloaded file. */}
      <div className="pt-3 border-t border-[#E4E7EA] text-[11px] text-[#5A646D] font-mono break-all">
        <span className="uppercase tracking-wider font-sans font-bold text-[#767F87] mr-2">
          Hujjat SHA-256:
        </span>
        <span title={permit.doc_hash ?? undefined}>{permit.doc_hash ?? "hali render qilinmagan"}</span>
      </div>
    </div>
  );
}
