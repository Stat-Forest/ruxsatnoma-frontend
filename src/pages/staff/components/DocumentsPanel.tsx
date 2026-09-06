import { Download, FileText } from 'lucide-react';
import { useLanguage } from '../../../i18n/useT';
import { fileUrl, useDocTypes, type ApplicationCardOut } from '../queries';
import { formatDateTime, localizedName } from '../format';

/** Attachments as `GET /applications/{id}` actually lists them
 * (`ApplicationDocumentOut`: `doc_type_item_id`, `file_id`, `note`,
 * `created_at` — no filename or size; `media_files` carries those but no
 * route answers them without downloading the whole file). Read-only here —
 * adding or removing a document is the applicant's own action
 * (`POST/DELETE /applications/{id}/documents`), not staff's. */
export function DocumentsPanel({ card }: { card: ApplicationCardOut }) {
  const { lang } = useLanguage();
  const docTypes = useDocTypes();

  return (
    <section className="bg-white border border-[#E4E7EA] rounded-2xl shadow-xs font-sans overflow-hidden">
      <div className="p-6 border-b border-[#E4E7EA]">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-[#1A1F24]">Ilova qilingan hujjatlar</h2>
          <span className="text-xs font-semibold text-[#2E7D4F] bg-[#F0F7F1] px-2.5 py-0.5 rounded-full border border-[#D9EBDC]">
            {card.documents.length} ta fayl
          </span>
        </div>
      </div>

      <div className="p-6 space-y-3">
        {card.documents.length === 0 && (
          <p className="text-xs text-[#5A646D]">Hujjat biriktirilmagan.</p>
        )}
        {card.documents.map((doc) => (
          <div
            key={doc.id}
            className="p-4 border border-[#E4E7EA] rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="w-8 h-8 text-[#5A646D] shrink-0" />
              <div className="min-w-0">
                <span className="text-sm font-bold text-[#1A1F24] block">
                  {localizedName(docTypes.data?.find((d) => d.id === doc.doc_type_item_id)?.name, lang) || 'Hujjat'}
                </span>
                {doc.note && <span className="text-xs text-[#5A646D] block">{doc.note}</span>}
                <span className="text-[11px] text-[#767F87] font-mono">
                  Yuklangan: {formatDateTime(doc.created_at)}
                </span>
              </div>
            </div>
            <a
              href={fileUrl(doc.file_id)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold rounded-md border border-[#767F87] text-[#1A1F24] hover:bg-[#F8F9FA] shrink-0"
            >
              <Download className="w-4 h-4" /> Yuklab olish
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
