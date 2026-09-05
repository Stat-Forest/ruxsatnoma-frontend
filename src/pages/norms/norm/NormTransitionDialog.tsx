/**
 * A generic confirmation dialog for the FOUR no-extra-input transitions —
 * `submit-review`, `return-to-draft`, `return-to-review`, `publish` — plus
 * `archive`. Not a reuse of `../components/ArchiveConfirmDialog.tsx`: that
 * component hard-codes a `danger` confirm button, correct for archiving a
 * row out of force but wrong for a benign forward step like "submit for
 * review" — this dialog takes `tone` instead so each of the five callers in
 * `NormsTab.tsx` picks its own. `approve` is deliberately NOT one of the
 * five (see `NormApproveDialog.tsx`): it alone needs a document picked
 * before it can be confirmed at all.
 */
import { Alert } from '../../../components/ui/Feedback';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/Overlay';

export interface NormTransitionDialogLabels {
  title: string;
  question: string;
  confirm: string;
  cancel: string;
}

export interface NormTransitionDialogProps {
  itemLabel: string;
  tone: 'primary' | 'danger';
  labels: NormTransitionDialogLabels;
  isPending: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function NormTransitionDialog({
  itemLabel,
  tone,
  labels,
  isPending,
  errorMessage,
  onConfirm,
  onClose,
}: NormTransitionDialogProps) {
  return (
    <Modal
      isOpen
      onClose={onClose}
      title={labels.title}
      maxWidth="sm"
      footer={
        <>
          <Button type="button" variant="secondary" data-testid="norm-transition-cancel" onClick={onClose} disabled={isPending}>
            {labels.cancel}
          </Button>
          <Button type="button" variant={tone} data-testid="norm-transition-confirm" isLoading={isPending} onClick={onConfirm}>
            {labels.confirm}
          </Button>
        </>
      }
    >
      <div data-testid="norm-transition-dialog" className="space-y-3">
        <p className="text-sm text-[#5A646D]">{labels.question}</p>
        <div className="rounded-lg border border-[#E4E7EA] bg-[#F8F9FA] p-3">
          <p className="text-sm font-semibold text-[#1A1F24]">{itemLabel}</p>
        </div>
        {errorMessage && (
          <div data-testid="norm-transition-error">
            <Alert variant="danger">{errorMessage}</Alert>
          </div>
        )}
      </div>
    </Modal>
  );
}
