import { ArrowRight, ShieldCheck, ShieldX } from 'lucide-react';
import type { ApplicationTimelineOut } from '../queries';
import { formatDateTime, shortId, statusLabel } from '../format';
import { useLanguage } from '../../../i18n/useT';

const HISTORY_PANEL_I18N = {
  uz_latn: {
    title: 'Tarix va audit',
    subtitle: 'Status oʻzgarishlari, biriktirishlar va ERI imzolari',
    statusHistory: 'Status tarixi',
    noRecords: 'Yozuv yoʻq.',
    performedBy: 'Amalga oshirdi:',
    system: 'Tizim',
    basis: 'Asos:',
    assignments: 'Biriktirishlar (assignments)',
    noAssignments: 'Hali hech kimga biriktirilmagan.',
    org: 'Tashkilot:',
    staff: 'Xodim:',
    notTakenYet: '— (hali olinmagan)',
    decisionSig: 'Qaror imzosi',
  },
  uz_cyrl: {
    title: 'Тарих ва аудит',
    subtitle: 'Статус ўзгаришлари, бириктиришлар ва ЭРИ имзолари',
    statusHistory: 'Статус тарихи',
    noRecords: 'Ёзув йўқ.',
    performedBy: 'Амалга оширди:',
    system: 'Тизим',
    basis: 'Асос:',
    assignments: 'Бириктиришлар (assignments)',
    noAssignments: 'Ҳали ҳеч кимга бириктирилмаган.',
    org: 'Ташкилот:',
    staff: 'Ходим:',
    notTakenYet: '— (ҳали олинмаган)',
    decisionSig: 'Қарор имзоси',
  },
  ru: {
    title: 'История и аудит',
    subtitle: 'Изменения статуса, назначения и ЭЦП подписи',
    statusHistory: 'История статусов',
    noRecords: 'Записей нет.',
    performedBy: 'Выполнил:',
    system: 'Система',
    basis: 'Основание:',
    assignments: 'Назначения (assignments)',
    noAssignments: 'Еще никому не назначено.',
    org: 'Организация:',
    staff: 'Сотрудник:',
    notTakenYet: '— (еще не взят)',
    decisionSig: 'Подпись решения',
  },
  en: {
    title: 'History and audit',
    subtitle: 'Status changes, assignments, and EDS signatures',
    statusHistory: 'Status history',
    noRecords: 'No records.',
    performedBy: 'Performed by:',
    system: 'System',
    basis: 'Basis:',
    assignments: 'Assignments',
    noAssignments: 'Not assigned to anyone yet.',
    org: 'Organization:',
    staff: 'Staff:',
    notTakenYet: '— (not taken yet)',
    decisionSig: 'Decision signature',
  },
  kaa: {
    title: 'Tariyx hám audit',
    subtitle: 'Status ózgerisleri, biriktiriwler hám ERI qol qoyıwları',
    statusHistory: 'Status tariyxı',
    noRecords: 'Jazba joq.',
    performedBy: 'Ámelge asırdı:',
    system: 'Tizim',
    basis: 'Tiykar:',
    assignments: 'Biriktiriwler (assignments)',
    noAssignments: 'Háli hesh kimge biriktirilmegen.',
    org: 'Shólkem:',
    staff: 'Xızmetker:',
    notTakenYet: '— (háli alınbaǵan)',
    decisionSig: 'Sheshim qolı',
  },
};

function SignatureBadge({ signature }: { signature: ApplicationTimelineOut['signatures'][number] }) {
  const valid = signature.verification_status === 'valid';
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.2 rounded-full border ${
        valid
          ? 'bg-[#F0F7F1] border-[#D9EBDC] text-[#123522]'
          : 'bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]'
      }`}
    >
      {valid ? <ShieldCheck className="w-3 h-3" /> : <ShieldX className="w-3 h-3" />}
      {signature.purpose} · {signature.verification_status}
    </span>
  );
}

/** `GET /applications/{id}/timeline` verbatim: `status_history` (each row
 * with the submission signature bound to it, ruling 25), `assignments` (who
 * held the file, including a superseded row after an over-limit forward) and
 * the top-level `signatures` (the DECISION line only). Actors are shown by
 * id — no route resolves a user id to a display name for an arbitrary
 * caller, applicant included. */
export function HistoryPanel({ timeline }: { timeline: ApplicationTimelineOut }) {
  const { lang } = useLanguage();
  const tr = HISTORY_PANEL_I18N[lang] ?? HISTORY_PANEL_I18N.uz_latn;

  return (
    <section className="bg-white border border-[#E4E7EA] rounded-2xl shadow-xs font-sans overflow-hidden">
      <div className="p-6 border-b border-[#E4E7EA]">
        <h2 className="text-lg font-bold text-[#1A1F24]">{tr.title}</h2>
        <p className="text-xs text-[#5A646D] mt-0.5">{tr.subtitle}</p>
      </div>

      <div className="p-6 space-y-6">
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A646D]">{tr.statusHistory}</h3>
          {timeline.status_history.length === 0 && <p className="text-xs text-[#5A646D]">{tr.noRecords}</p>}
          <div className="space-y-2">
            {timeline.status_history.map((entry) => (
              <div key={entry.id} className="border border-[#E4E7EA] rounded-xl p-3 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-[#1A1F24]">
                    <span>{entry.from_status ? statusLabel(entry.from_status, lang) : '—'}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#5A646D]" />
                    <span className="text-[#2E7D4F]">{statusLabel(entry.to_status, lang)}</span>
                  </div>
                  <span className="font-mono text-[11px] text-[#5A646D]">{formatDateTime(entry.occurred_at)}</span>
                </div>
                <div className="text-[11px] text-[#5A646D]">
                  {entry.changed_by ? `${tr.performedBy} ${shortId(entry.changed_by)}` : tr.system}
                </div>
                {entry.reason_text && (
                  <p className="text-[11px] text-[#1A1F24] bg-[#F8F9FA] p-2 rounded border-l-2 border-l-[#2E7D4F]">
                    {entry.reason_text}
                  </p>
                )}
                {entry.legal_basis && (
                  <p className="text-[11px] text-[#5A646D]">{tr.basis} {entry.legal_basis}</p>
                )}
                {entry.signatures.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {entry.signatures.map((sig) => (
                      <SignatureBadge key={sig.id} signature={sig} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A646D]">{tr.assignments}</h3>
          {timeline.assignments.length === 0 && <p className="text-xs text-[#5A646D]">{tr.noAssignments}</p>}
          <div className="space-y-1.5">
            {timeline.assignments.map((a) => (
              <div
                key={a.id}
                className={`text-xs border rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2 ${
                  a.is_active ? 'border-[#2E7D4F] bg-[#F0F7F1]' : 'border-[#E4E7EA] bg-[#F8F9FA] opacity-70'
                }`}
              >
                <span>
                  {tr.org} <span className="font-mono">{shortId(a.org_id)}</span> · {tr.staff}{' '}
                  <span className="font-mono">{a.user_id ? shortId(a.user_id) : tr.notTakenYet}</span>
                </span>
                <span className="font-mono text-[10px] text-[#767F87]">{formatDateTime(a.created_at)}</span>
              </div>
            ))}
          </div>
        </div>

        {timeline.signatures.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A646D]">{tr.decisionSig}</h3>
            <div className="flex flex-wrap gap-1.5">
              {timeline.signatures.map((sig) => (
                <SignatureBadge key={sig.id} signature={sig} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
