/**
 * `approve` alone among the six transitions carries a payload
 * (`NormApproveIn.approval_doc_id`, mandatory — `service.approve_norm`'s own
 * comment: "the basis document must be on record before the raҳbar's own
 * approval means anything"). This dialog is what makes that a real gate
 * rather than a client-side afterthought: the confirm button stays disabled
 * until a document has actually been uploaded, so `POST .../approve` is
 * never called with no `approval_doc_id` to send at all.
 */
import { useState } from 'react';
import { Alert } from '../../../components/ui/Feedback';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/Overlay';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { uploadDocument } from './api';

export interface NormApproveDialogLabels {
  title: string;
  question: string;
  docLabel: string;
  docRequired: string;
  docUploading: string;
  docUploadFailed: string;
  confirm: string;
  cancel: string;
}

export interface NormApproveDialogProps {
  itemLabel: string;
  labels: NormApproveDialogLabels;
  isPending: boolean;
  errorMessage: string | null;
  onConfirm: (approvalDocId: string) => void;
  onClose: () => void;
}

export function NormApproveDialog({ itemLabel, labels, isPending, errorMessage, onConfirm, onClose }: NormApproveDialogProps) {
  const errorText = useApiErrorText();
  const [docId, setDocId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleUpload(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      const uploaded = await uploadDocument(file);
      setDocId(uploaded.id);
    } catch (error) {
      setUploadError(errorText(error, labels.docUploadFailed));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={isPending ? () => {} : onClose}
      title={labels.title}
      maxWidth="sm"
      footer={
        <>
          <Button type="button" variant="secondary" data-testid="norm-approve-cancel" onClick={onClose} disabled={isPending}>
            {labels.cancel}
          </Button>
          <Button
            type="button"
            variant="primary"
            data-testid="norm-approve-confirm"
            isLoading={isPending}
            disabled={docId === null}
            onClick={() => docId && onConfirm(docId)}
          >
            {labels.confirm}
          </Button>
        </>
      }
    >
      <div data-testid="norm-approve-dialog" className="space-y-3">
        <p className="text-sm text-[#5A646D]">{labels.question}</p>
        <div className="rounded-lg border border-[#E4E7EA] bg-[#F8F9FA] p-3">
          <p className="text-sm font-semibold text-[#1A1F24]">{itemLabel}</p>
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5A646D]">{labels.docLabel}</span>
          <input
            type="file"
            data-testid="norm-approve-doc-upload"
            disabled={uploading || isPending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleUpload(file);
            }}
            className="block text-xs"
          />
          {uploading && <p className="text-xs text-[#5A646D]">{labels.docUploading}</p>}
          {docId === null && !uploading && <p className="text-xs text-[#B91C1C]">{labels.docRequired}</p>}
          {uploadError && <p className="text-xs text-[#B91C1C]">{uploadError}</p>}
        </div>
        {errorMessage && (
          <div data-testid="norm-approve-error">
            <Alert variant="danger">{errorMessage}</Alert>
          </div>
        )}
      </div>
    </Modal>
  );
}
