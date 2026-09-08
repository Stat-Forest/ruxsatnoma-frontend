import { History } from 'lucide-react';
import type { components } from '../../api/schema';
import { useLanguage } from '../../i18n/useT';
import { formatDateTime, shortId } from './format';
import { getPermitStatusLabel } from './statusMeta';

type PermitHistoryRow = components['schemas']['PermitHistoryRow'];

const TIMELINE_I18N = {
  uz_latn: {
    title: 'Holat tarixi',
    empty: 'Tarix boʻsh.',
    userId: 'foydalanuvchi ID',
  },
  uz_cyrl: {
    title: 'Ҳолат тарихи',
    empty: 'Тарих бўш.',
    userId: 'фойдаланувчи ID',
  },
  ru: {
    title: 'История статусов',
    empty: 'История пуста.',
    userId: 'ID пользователя',
  },
  en: {
    title: 'Status history',
    empty: 'History is empty.',
    userId: 'user ID',
  },
  kaa: {
    title: 'Status tariyxı',
    empty: 'Tariyx bos.',
    userId: 'paydalanıwshı ID',
  },
};

/**
 * `permit_status_history`, read back verbatim — real data, not the
 * suspend/resume/revoke ACTIONS the reference's `PermitLifecyclePanel` also
 * draws.
 */
export function PermitTimelinePanel({ history }: { history: PermitHistoryRow[] }) {
  const { lang } = useLanguage();
  const t = TIMELINE_I18N[lang as keyof typeof TIMELINE_I18N] || TIMELINE_I18N.uz_latn;

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-5 shadow-xs space-y-3 font-sans">
      <div className="flex items-center gap-2 border-b border-[#E4E7EA] pb-3">
        <History className="w-5 h-5 text-[#2E7D4F]" />
        <h3 className="text-sm font-bold text-[#1A1F24]">{t.title}</h3>
      </div>
      {history.length === 0 ? (
        <p className="text-xs text-[#5A646D]">{t.empty}</p>
      ) : (
        <div className="space-y-1.5">
          {history.map((row, i) => (
            <div key={i} className="p-2.5 bg-[#F8F9FA] border border-[#E4E7EA] rounded-xl text-xs">
              <div className="text-[#1A1F24] font-semibold">
                {row.from_status ? `${getPermitStatusLabel(row.from_status, lang)} → ` : ''}
                {getPermitStatusLabel(row.to_status, lang)}
              </div>
              <div className="text-[11px] text-[#767F87] font-mono mt-0.5">
                {formatDateTime(row.occurred_at)}
                {row.changed_by ? ` · ${t.userId} ${shortId(row.changed_by)}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
