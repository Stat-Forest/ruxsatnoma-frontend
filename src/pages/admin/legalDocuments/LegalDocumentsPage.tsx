import { useState } from 'react';
import { ExternalLink, FileText, Loader2, Plus } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { FormField, Select } from '../../../components/ui/FormControls';
import { Pagination } from '../../../components/ui/Navigation';
import { Modal } from '../../../components/ui/Overlay';
import { StatusBadge, type StatusType } from '../../../components/ui/StatusBadge';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useLanguage } from '../../../i18n/useT';
import { formatDate, pickName } from '../../applicant/format';
import type { LegalDocumentAdminOut, LegalDocumentStatus } from './api';
import { LABELS, type LegalDocumentLabels } from './labels';
import { LegalDocumentFormModal } from './LegalDocumentFormModal';
import {
  useArchiveLegalDocument,
  useLegalDocumentsList,
  usePublishLegalDocument,
} from './queries';
import { CLICKABLE_ROW_CLASS, clickableRowProps } from '../../../lib/rowClick';

const PAGE_SIZE = 20;

const STATUS_META: Record<
  LegalDocumentStatus,
  { badge: StatusType; label: keyof LegalDocumentLabels; accent: string }
> = {
  draft: { badge: 'draft', label: 'statusDraft', accent: 'border-l-[#9AA3AB]' },
  published: { badge: 'approved', label: 'statusPublished', accent: 'border-l-[#2E7D4F]' },
  archived: { badge: 'warning', label: 'statusArchived', accent: 'border-l-[#B45309]' },
};

function isKnownStatus(status: string): status is LegalDocumentStatus {
  return status === 'draft' || status === 'published' || status === 'archived';
}

/**
 * The legal-documents register — what the public site's /documents page shows.
 *
 * Publishing here is the one action that reaches citizens, and the backend
 * refuses it for a row with neither a PDF nor a lex.uz link: that refusal is
 * rendered in the confirmation dialog rather than swallowed, because a silent
 * no-op would leave the editor believing the document is on the site.
 */
export function LegalDocumentsPage() {
  const { lang } = useLanguage();
  const errorText = useApiErrorText();
  const L = LABELS[lang] ?? LABELS.uz_latn;

  const [status, setStatus] = useState<LegalDocumentStatus | ''>('');
  const [page, setPage] = useState(1);
  /** `{ id: null }` — a new document; `{ id }` — editing that one. */
  const [editor, setEditor] = useState<{ id: string | null } | null>(null);
  const [confirming, setConfirming] = useState<{
    kind: 'publish' | 'archive';
    row: LegalDocumentAdminOut;
  } | null>(null);

  const list = useLegalDocumentsList({ status, page, page_size: PAGE_SIZE });
  const publish = usePublishLegalDocument();
  const archive = useArchiveLegalDocument();

  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;

  function openConfirm(kind: 'publish' | 'archive', row: LegalDocumentAdminOut) {
    // A stale failure from the previous row would otherwise greet the operator
    // inside a dialog about a different document.
    publish.reset();
    archive.reset();
    setConfirming({ kind, row });
  }

  function runConfirmed() {
    if (!confirming) return;
    const action = confirming.kind === 'publish' ? publish : archive;
    action.mutate(confirming.row.id, { onSuccess: () => setConfirming(null) });
  }

  const confirmFailure = confirming?.kind === 'publish' ? publish.error : archive.error;

  /** The backend's `nothing_to_open` is the one refusal an editor can act on
   *  — it says exactly which two fields would fix it, so it gets its own
   *  sentence rather than the generic validation message. */
  function refusalText(error: unknown): string {
    if (
      error instanceof ApiError &&
      (error.details as { reason?: string } | undefined)?.reason === 'nothing_to_open'
    ) {
      return L.errNothingToOpen;
    }
    return errorText(error, L.loadFailed);
  }

  return (
    <div className="space-y-6 font-sans pb-16" data-testid="legal-documents-page">
      <div className="border-b border-[#E4E7EA] pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-[#1A1F24] tracking-tight">
            {L.pageTitle}
          </h1>
          <p className="text-xs md:text-sm text-[#5A646D] mt-1">{L.pageSubtitle}</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setEditor({ id: null })}
        >
          {L.create}
        </Button>
      </div>

      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs">
        <FormField label={L.filterStatus} htmlFor="legal-documents-status-filter">
          <Select
            id="legal-documents-status-filter"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as LegalDocumentStatus | '');
              setPage(1);
            }}
            options={[
              { value: '', label: L.filterAll },
              { value: 'draft', label: L.statusDraft },
              { value: 'published', label: L.statusPublished },
              { value: 'archived', label: L.statusArchived },
            ]}
          />
        </FormField>
      </div>

      {list.isPending && (
        <div className="flex items-center gap-2 text-sm text-[#5A646D]" data-testid="legal-documents-loading">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      )}

      {list.isError && (
        <div className="rounded-2xl border border-[#F5C2C0] bg-[#FDF2F2] p-4 text-sm text-[#B42318]">
          {errorText(list.error, L.loadFailed)}
        </div>
      )}

      {list.data && list.data.items.length === 0 && (
        <div
          data-testid="legal-documents-empty"
          className="bg-white border border-[#E4E7EA] rounded-2xl p-10 text-center space-y-2"
        >
          <FileText className="w-8 h-8 mx-auto text-[#9AA3AB]" />
          <p className="text-sm text-[#5A646D]">{L.empty}</p>
        </div>
      )}

      {list.data && list.data.items.length > 0 && (
        <div className="space-y-3">
          {list.data.items.map((row) => {
            const meta = isKnownStatus(row.status) ? STATUS_META[row.status] : STATUS_META.draft;
            // An archived document has no editor to open, so its card stays plain.
            const editable = row.status !== 'archived';
            return (
              <div
                key={row.id}
                {...(editable ? clickableRowProps(() => setEditor({ id: row.id })) : {})}
                data-testid={`legal-document-row-${row.id}`}
                data-status={row.status}
                className={`bg-white border border-[#E4E7EA] border-l-4 ${meta.accent} rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center gap-3 md:justify-between ${
                  editable ? `hover:bg-[#F8F9FA] ${CLICKABLE_ROW_CLASS}` : ''
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#2E7D4F] bg-[#F0F7F1] px-2 py-0.5 rounded">
                      {row.doc_number}
                    </span>
                    <span className="text-xs text-[#767F87]">{formatDate(row.adopted_on)}</span>
                    <span data-testid="legal-document-status">
                      <StatusBadge status={meta.badge} label={L[meta.label]} />
                    </span>
                  </div>
                  <h2 className="text-sm font-semibold text-[#1A1F24] truncate">
                    {pickName(row.title, lang === 'ru' ? 'ru' : 'uz_latn')}
                  </h2>
                  <p
                    data-testid="legal-document-source"
                    className="text-xs text-[#5A646D] flex items-center gap-1"
                  >
                    {row.file ? (
                      <>
                        <FileText className="w-3 h-3" />
                        {L.sourceFile}
                      </>
                    ) : row.source_url ? (
                      <>
                        <ExternalLink className="w-3 h-3" />
                        {L.sourceLink}
                      </>
                    ) : (
                      L.sourceNone
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {row.status !== 'archived' && (
                    <Button variant="outline" size="sm" onClick={() => setEditor({ id: row.id })}>
                      {L.edit}
                    </Button>
                  )}
                  {row.status === 'draft' && (
                    <Button variant="primary" size="sm" onClick={() => openConfirm('publish', row)}>
                      {L.publish}
                    </Button>
                  )}
                  {row.status === 'published' && (
                    <Button variant="outline" size="sm" onClick={() => openConfirm('archive', row)}>
                      {L.archive}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {list.data && totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      {editor && (
        <LegalDocumentFormModal
          docId={editor.id}
          labels={L}
          onClose={() => setEditor(null)}
        />
      )}

      {confirming && (
        <Modal
          isOpen
          onClose={() => setConfirming(null)}
          title={confirming.kind === 'publish' ? L.publishTitle : L.archiveTitle}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirming(null)}>
                {L.cancel}
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={publish.isPending || archive.isPending}
                onClick={runConfirmed}
              >
                {L.confirm}
              </Button>
            </div>
          }
        >
          <div className="space-y-3" data-testid="legal-document-confirm">
            <p className="text-sm text-[#1A1F24] font-semibold">
              {confirming.row.doc_number} — {pickName(confirming.row.title, lang === 'ru' ? 'ru' : 'uz_latn')}
            </p>
            <p className="text-sm text-[#5A646D]">
              {confirming.kind === 'publish' ? L.publishBody : L.archiveBody}
            </p>
            {confirmFailure && (
              <p
                data-testid="legal-document-confirm-error"
                className="text-sm text-[#B42318] bg-[#FDF2F2] border border-[#F5C2C0] rounded-lg p-3"
              >
                {refusalText(confirmFailure)}
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
