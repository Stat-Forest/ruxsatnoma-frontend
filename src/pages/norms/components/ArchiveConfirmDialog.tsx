/**
 * The archive-confirmation dialog, generic across F7's two write-gated
 * entities the same way `PublishConfirmDialog` is: task 5's tariffs archive
 * flow reuses this file as-is. Modeled on
 * `pages/admin/organizations/ArchiveConfirmModal.tsx`'s shape (question,
 * an identity box, an optional error line), but with the org-specific
 * detail box and its one refusal (`active children`) replaced by
 * caller-supplied copy — rule parameters and tariffs archive under a
 * DIFFERENT asymmetry (task-4 brief: a published row additionally needs
 * `norms.tariffs.publish`), which the caller resolves into whether this
 * dialog is even opened. Per the house rule "an action the backend would
 * refuse is not offered", this component never reads a permission or a
 * row's `status` itself — the archive button that opens it is what decides
 * whether archiving is offered at all.
 */
import { Alert } from '../../../components/ui/Feedback';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/Overlay';

export interface ArchiveConfirmDialogLabels {
  title: string;
  question: string;
  confirm: string;
  cancel: string;
}

export interface ArchiveConfirmDialogProps {
  /** The row's own identity, shown as a fact — see the same note on
   *  `PublishConfirmDialogProps.itemLabel`. */
  itemLabel: string;
  labels: ArchiveConfirmDialogLabels;
  isPending: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function ArchiveConfirmDialog({
  itemLabel,
  labels,
  isPending,
  errorMessage,
  onConfirm,
  onClose,
}: ArchiveConfirmDialogProps) {
  return (
    <Modal
      isOpen
      onClose={onClose}
      title={labels.title}
      maxWidth="sm"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            data-testid="archive-dialog-cancel"
            onClick={onClose}
            disabled={isPending}
          >
            {labels.cancel}
          </Button>
          <Button
            type="button"
            variant="danger"
            data-testid="archive-dialog-confirm"
            isLoading={isPending}
            onClick={onConfirm}
          >
            {labels.confirm}
          </Button>
        </>
      }
    >
      <div data-testid="archive-confirm-dialog" className="space-y-3">
        <p className="text-sm text-[#5A646D]">{labels.question}</p>
        <div className="rounded-lg border border-[#E4E7EA] bg-[#F8F9FA] p-3">
          <p className="font-mono text-sm font-semibold text-[#1A1F24]">{itemLabel}</p>
        </div>
        {errorMessage && (
          <div data-testid="archive-dialog-error">
            <Alert variant="danger">{errorMessage}</Alert>
          </div>
        )}
      </div>
    </Modal>
  );
}
