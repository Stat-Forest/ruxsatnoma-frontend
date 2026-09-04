import { ArrowRight, ShieldCheck } from 'lucide-react';
import type { ApplicationTimelineOut } from '../api';
import { STATUS_LABELS } from '../statusMeta';
import type { ApplicationStatus } from '../api';
import { formatDateTime } from '../format';

/**
 * The applicant's own timeline panel — deliberately the SIMPLE rendering of
 * `GET /applications/{id}/timeline`: every transition plus the submission's
 * own ERI signature. The staff card's history panel (richer: actor names,
 * IP, reviewer notes) is a different, staff-owned component — see the
 * ownership-boundary note in `MyApplicationCardPage.tsx`.
 */
export function ApplicantTimeline({ timeline }: { timeline: ApplicationTimelineOut | undefined }) {
  if (!timeline || timeline.status_history.length === 0) {
    return <p className="text-sm text-[#5A646D]">Hozircha tarix yozuvlari yoʻq.</p>;
  }

  return (
    <div className="relative pl-6 space-y-5 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E4E7EA]">
      {timeline.status_history.map((entry, index) => (
        <div key={entry.id} className="relative space-y-1">
          <div className="absolute -left-6 top-0 w-6 h-6 rounded-full bg-[#2E7D4F] text-white flex items-center justify-center text-xs font-bold ring-4 ring-white shadow-2xs">
            {index + 1}
          </div>
          <div className="bg-white border border-[#E4E7EA] rounded-xl p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E7EA] pb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1A1F24]">
                <span>{entry.from_status ? STATUS_LABELS[entry.from_status as ApplicationStatus] : 'Boshlanishi'}</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#5A646D]" />
                <span className="text-[#2E7D4F]">{STATUS_LABELS[entry.to_status as ApplicationStatus]}</span>
              </div>
              <span className="font-mono text-xs text-[#5A646D]">{formatDateTime(entry.occurred_at)}</span>
            </div>
            {entry.reason_text && <p className="text-xs text-[#5A646D]">{entry.reason_text}</p>}
            {entry.legal_basis && <p className="text-xs text-[#5A646D]">Asos: {entry.legal_basis}</p>}
            {entry.signatures.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {entry.signatures.map((sig) => (
                  <span
                    key={sig.id}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#15803D] bg-[#DCFCE7] px-2 py-0.5 rounded border border-[#86EFAC]"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" /> E-IMZO bilan imzolangan ({formatDateTime(sig.signed_at)})
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
