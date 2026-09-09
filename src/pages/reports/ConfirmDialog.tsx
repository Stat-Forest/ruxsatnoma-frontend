/**
 * A small reusable confirm dialog — title/question/confirm/cancel/error/
 * isPending — generic across every simple write action this track's screens
 * need (form activate/archive, report submit/approve/revise). Modeled on
 * `pages/norms/components/ArchiveConfirmDialog.tsx`'s shape (question, an
 * optional error line, `Modal`'s `footer` prop holding the two buttons —
 * never trailing children, per `components/ui/Overlay.tsx`'s real
 * signature), generalised with an optional `children` slot so the SAME
 * component also carries the sign modal's PINFL field and the return
 * modal's comment textarea (`ReportLifecyclePanel.tsx`, task 5) rather than
 * a second dialog shell being written for those two.
 */
import type { ReactNode } from 'react';
import { Alert } from '../../components/ui/Feedback';
import { Button, type ButtonVariant } from '../../components/ui/button';
import { Modal, type ModalProps } from '../../components/ui/Overlay';

export interface ConfirmDialogProps {
  title: string;
  subtitle?: string;
  question?: string;
  confirmLabel: string;
  cancelLabel: string;
  isPending: boolean;
  errorMessage?: string | null;
  onConfirm: () => void;
  onClose: () => void;
  confirmVariant?: ButtonVariant;
  confirmDisabled?: boolean;
  maxWidth?: ModalProps['maxWidth'];
  children?: ReactNode;
}

export function ConfirmDialog({
  title,
  subtitle,
  question,
  confirmLabel,
  cancelLabel,
  isPending,
  errorMessage,
  onConfirm,
  onClose,
  confirmVariant = 'primary',
  confirmDisabled = false,
  maxWidth = 'sm',
  children,
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      maxWidth={maxWidth}
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 w-full">
          <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={onClose} disabled={isPending} data-testid="confirm-dialog-cancel">
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            className="w-full sm:w-auto"
            isLoading={isPending}
            disabled={confirmDisabled}
            onClick={onConfirm}
            data-testid="confirm-dialog-confirm"
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div data-testid="confirm-dialog" className="space-y-3">
        {question && <p className="text-sm text-[#5A646D]">{question}</p>}
        {children}
        {errorMessage && (
          <div data-testid="confirm-dialog-error">
            <Alert variant="danger">{errorMessage}</Alert>
          </div>
        )}
      </div>
    </Modal>
  );
}
