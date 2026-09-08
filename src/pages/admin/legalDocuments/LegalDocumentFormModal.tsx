import { useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { Modal } from '../../../components/ui/Overlay';
import { Button } from '../../../components/ui/button';
import { FormField, Input, Textarea } from '../../../components/ui/FormControls';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import {
  DOCUMENT_LANGUAGES,
  uploadDocumentFile,
  type BackendLanguage,
  type LegalDocumentAdminOut,
  type LocalizedName,
} from './api';
import { LANGUAGE_LABEL, type LegalDocumentLabels } from './labels';
import { useCreateLegalDocument, useLegalDocument, usePatchLegalDocument } from './queries';

interface FormState {
  title: Record<BackendLanguage, string>;
  summary: Record<BackendLanguage, string>;
  docNumber: string;
  adoptedOn: string;
  sourceUrl: string;
  sortOrder: string;
  fileId: string | null;
  fileName: string | null;
}

function emptyLanguages(): Record<BackendLanguage, string> {
  return { uz_latn: '', uz_cyrl: '', ru: '', kaa: '', en: '' };
}

function emptyForm(): FormState {
  return {
    title: emptyLanguages(),
    summary: emptyLanguages(),
    docNumber: '',
    adoptedOn: '',
    sourceUrl: '',
    sortOrder: '0',
    fileId: null,
    fileName: null,
  };
}

/** `title`/`summary` arrive as untyped jsonb maps, so each language is read
 *  defensively — a non-string value is treated as absent, never rendered into
 *  an input as `[object Object]`. */
function readLanguages(source: Record<string, unknown> | null | undefined) {
  const out = emptyLanguages();
  if (!source) return out;
  for (const code of DOCUMENT_LANGUAGES) {
    const value = source[code];
    if (typeof value === 'string') out[code] = value;
  }
  return out;
}

function formFrom(row: LegalDocumentAdminOut): FormState {
  return {
    title: readLanguages(row.title),
    summary: readLanguages(row.summary),
    docNumber: row.doc_number,
    adoptedOn: row.adopted_on.slice(0, 10),
    sourceUrl: row.source_url ?? '',
    sortOrder: String(row.sort_order),
    fileId: row.file?.id ?? null,
    fileName: row.file?.filename ?? null,
  };
}

/** Only the languages somebody actually typed into. An empty string sent as
 *  `{"kaa": ""}` would be a Karakalpak title that is blank, not an absent
 *  translation. */
function localized(values: Record<BackendLanguage, string>): LocalizedName {
  const out: LocalizedName = {};
  for (const code of DOCUMENT_LANGUAGES) {
    const value = values[code].trim();
    if (value) out[code] = value;
  }
  return out;
}

/**
 * The document editor. Two of its fields are the register's whole point:
 * `sort_order`, because the Forest Code must head the page despite being the
 * oldest act on it, and the file/link pair, because a published row with
 * neither is what the backend refuses — this form does not enforce that,
 * deliberately: a draft is routinely written before the PDF is on hand.
 */
interface FormModalProps {
  docId: string | null;
  labels: LegalDocumentLabels;
  onClose: () => void;
}

/** The row is fetched HERE and the form is only mounted once it has arrived,
 *  so the form's own state is seeded from props exactly once — the same split
 *  `AnnouncementFormModal` uses, and for the same reason: seeding state from
 *  an effect is how "my edit was overwritten by a refetch" happens. */
export function LegalDocumentFormModal({ docId, labels: L, onClose }: FormModalProps) {
  const existing = useLegalDocument(docId);

  if (docId !== null && !existing.data) {
    return (
      <Modal
        isOpen
        onClose={onClose}
        title={L.formEditTitle}
        maxWidth="2xl"
        footer={
          <Button variant="outline" size="sm" onClick={onClose}>
            {L.cancel}
          </Button>
        }
      >
        <p className="py-8 text-center text-sm text-[#5A646D]" role="status">
          {existing.error ? L.loadFailed : '…'}
        </p>
      </Modal>
    );
  }

  return (
    <LegalDocumentForm
      docId={docId}
      labels={L}
      initial={existing.data ? formFrom(existing.data) : emptyForm()}
      onClose={onClose}
    />
  );
}

function LegalDocumentForm({
  docId,
  labels: L,
  initial,
  onClose,
}: FormModalProps & { initial: FormState }) {
  const errorText = useApiErrorText();
  const create = useCreateLegalDocument();
  const patch = usePatchLegalDocument(docId);
  const fileInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(initial);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadFailed, setUploadFailed] = useState<unknown>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setLanguage(field: 'title' | 'summary', code: BackendLanguage, value: string) {
    setForm((prev) => ({ ...prev, [field]: { ...prev[field], [code]: value } }));
  }

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadFailed(null);
    try {
      const uploaded = await uploadDocumentFile(file);
      setForm((prev) => ({ ...prev, fileId: uploaded.id, fileName: uploaded.filename }));
    } catch (error) {
      setUploadFailed(error);
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    const title = localized(form.title);
    if (!title.uz_latn) return setInvalid(L.errTitleRequired);
    if (!form.docNumber.trim()) return setInvalid(L.errNumberRequired);
    if (!form.adoptedOn) return setInvalid(L.errAdoptedRequired);
    setInvalid(null);

    const summary = localized(form.summary);
    const body = {
      title,
      summary: Object.keys(summary).length > 0 ? summary : null,
      doc_number: form.docNumber.trim(),
      adopted_on: form.adoptedOn,
      source_url: form.sourceUrl.trim() || null,
      file_id: form.fileId,
      sort_order: Number.parseInt(form.sortOrder, 10) || 0,
    };

    if (docId) patch.mutate(body, { onSuccess: onClose });
    else create.mutate(body, { onSuccess: onClose });
  }

  const saving = create.isPending || patch.isPending;
  const failure = create.error ?? patch.error ?? uploadFailed;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={docId ? L.formEditTitle : L.formCreateTitle}
      maxWidth="2xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            {L.cancel}
          </Button>
          <Button variant="primary" size="sm" disabled={saving || uploading} onClick={submit}>
            {L.save}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label={L.fieldNumber} helperText={L.fieldNumberHint} htmlFor="legal-document-number">
            <Input
              id="legal-document-number"
              data-testid="legal-document-number"
              value={form.docNumber}
              onChange={(e) => set('docNumber', e.target.value)}
            />
          </FormField>
          <FormField label={L.fieldAdopted} htmlFor="legal-document-adopted">
            <Input
              id="legal-document-adopted"
              data-testid="legal-document-adopted"
              type="date"
              value={form.adoptedOn}
              onChange={(e) => set('adoptedOn', e.target.value)}
            />
          </FormField>
          <FormField
            label={L.fieldSortOrder}
            helperText={L.fieldSortOrderHint}
            htmlFor="legal-document-sort-order"
          >
            <Input
              id="legal-document-sort-order"
              data-testid="legal-document-sort-order"
              type="number"
              value={form.sortOrder}
              onChange={(e) => set('sortOrder', e.target.value)}
            />
          </FormField>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-[#5A646D]">
            {L.fieldTitle}
          </p>
          {DOCUMENT_LANGUAGES.map((code) => (
            <FormField
              key={code}
              label={LANGUAGE_LABEL[code]}
              htmlFor={`legal-document-title-${code}`}
            >
              <Input
                id={`legal-document-title-${code}`}
                data-testid={`legal-document-title-${code}`}
                value={form.title[code]}
                onChange={(e) => setLanguage('title', code, e.target.value)}
              />
            </FormField>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-[#5A646D]">
            {L.fieldSummary}
          </p>
          {DOCUMENT_LANGUAGES.map((code) => (
            <FormField
              key={code}
              label={LANGUAGE_LABEL[code]}
              htmlFor={`legal-document-summary-${code}`}
            >
              <Textarea
                id={`legal-document-summary-${code}`}
                data-testid={`legal-document-summary-${code}`}
                rows={2}
                value={form.summary[code]}
                onChange={(e) => setLanguage('summary', code, e.target.value)}
              />
            </FormField>
          ))}
        </div>

        <FormField label={L.fieldSourceUrl} htmlFor="legal-document-source-url">
          <Input
            id="legal-document-source-url"
            data-testid="legal-document-source-url"
            value={form.sourceUrl}
            onChange={(e) => set('sourceUrl', e.target.value)}
            placeholder="https://lex.uz/..."
          />
        </FormField>

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-[#5A646D]">{L.fieldFile}</p>
          {form.fileName && (
            <p className="text-sm text-[#1A1F24] flex items-center gap-2" data-testid="legal-document-file">
              <Paperclip className="w-4 h-4 text-[#2E7D4F]" />
              {form.fileName}
              <button
                type="button"
                aria-label={L.fileRemove}
                className="text-[#B42318]"
                onClick={() => setForm((prev) => ({ ...prev, fileId: null, fileName: null }))}
              >
                <X className="w-4 h-4" />
              </button>
            </p>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf"
            className="hidden"
            data-testid="legal-document-file-input"
            onChange={(e) => void pickFile(e.target.files?.[0])}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
          >
            {form.fileName ? L.fileReplace : L.fileChoose}
          </Button>
        </div>

        {invalid && (
          <p
            data-testid="legal-document-form-error"
            className="text-sm text-[#B42318] bg-[#FDF2F2] border border-[#F5C2C0] rounded-lg p-3"
          >
            {invalid}
          </p>
        )}
        {failure != null && (
          <p
            data-testid="legal-document-save-error"
            className="text-sm text-[#B42318] bg-[#FDF2F2] border border-[#F5C2C0] rounded-lg p-3"
          >
            {errorText(failure, L.loadFailed)}
          </p>
        )}
      </div>
    </Modal>
  );
}
