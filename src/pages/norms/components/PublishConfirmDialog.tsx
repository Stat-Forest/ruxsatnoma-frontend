/**
 * The publish-confirmation dialog (rulings R3/R4, task-4 brief). Built to be
 * reused by task 5's tariffs publish flow AS-IS: nothing here reads
 * `RuleParameterOut`/`TariffOut`, calls `t()`, or reads `me.permissions` —
 * every string is a prop and every permission/session decision is made by
 * the caller before this component ever mounts, so a second entity calling
 * it needs no change to this file, only its own copy and its own
 * `editedByCallerThisSession`/`canPublish` bookkeeping.
 *
 * Two warnings, both computed from props the caller already has — this
 * component derives nothing from a row object it never sees:
 *
 *  - R4, retroactive: `effectiveFrom < today` (plain ISO-date string
 *    comparison, valid because both are `YYYY-MM-DD`). The server's own
 *    `RI-04` warning for this arrives only after the row is already
 *    published, which is too late to inform the operator's decision — so
 *    this is computed and shown BEFORE the confirm button is pressed.
 *  - R3, self-publish: `editedByCallerThisSession` is true when the caller
 *    edited (created or PATCHed) this exact row earlier in the SAME
 *    session. This is NOT a rule the server enforces — a migration-seeded
 *    row's `created_by` is `NULL`, which skips the maker-checker identity
 *    check entirely — so the warning is worded as a heads-up, never as a
 *    guarantee the backend is actually holding.
 *
 * After a successful call, `result` (the AUTHORITATIVE `warnings` the
 * server actually returned) replaces the confirmation view entirely — it
 * may carry a code neither warning above predicted, which is the whole
 * reason ruling R4 asks for both: the client-side guess before the call,
 * and the server's own answer after it.
 */
import { Alert } from '../../../components/ui/Feedback';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/Overlay';
import type { components } from '../../../api/schema';

export type PublishOut = components['schemas']['PublishOut'];

export interface PublishConfirmDialogLabels {
  title: string;
  question: string;
  effectiveFromLabel: string;
  retroactiveWarning: string;
  selfPublishWarning: string;
  confirm: string;
  cancel: string;
  resultTitle: string;
  resultEmpty: string;
  close: string;
}

export interface PublishConfirmDialogProps {
  /** The row's own identity, shown as a fact line — never spliced into a
   *  translated sentence: this codebase's `t()` takes no interpolation
   *  arguments (task-3 report), so identity and copy are always two
   *  separate pieces of markup, here as everywhere else in this track. */
  itemLabel: string;
  /** The row's own `effective_from` (`YYYY-MM-DD`). */
  effectiveFrom: string;
  /** The caller's own idea of "today" (`YYYY-MM-DD`) — never read from
   *  `new Date()` inside this component, so a test pins it without faking
   *  timers (the same reason `ClassifiersPage.tsx`'s `todayIso()` reads
   *  `Date.now()` rather than constructing a bare `new Date()`). */
  today: string;
  /** Formats a `YYYY-MM-DD` for display — passed in so this shared
   *  component does not duplicate a date formatter per caller. */
  formatDate: (value: string) => string;
  editedByCallerThisSession: boolean;
  labels: PublishConfirmDialogLabels;
  isPending: boolean;
  /** Already resolved to user-facing text by the caller — one of the four
   *  distinct refusal messages (see `publishRefusalReason` in this same
   *  folder) or a generic fallback. `null` when there is nothing to show. */
  errorMessage: string | null;
  /** Set once the call has SUCCEEDED. `null` before that, including while
   *  `isPending` — that is what tells this component whether it is still
   *  showing the confirmation step or the result step. */
  result: PublishOut | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function PublishConfirmDialog({
  itemLabel,
  effectiveFrom,
  today,
  formatDate,
  editedByCallerThisSession,
  labels,
  isPending,
  errorMessage,
  result,
  onConfirm,
  onClose,
}: PublishConfirmDialogProps) {
  const retroactive = effectiveFrom < today;
  const published = result !== null;
  // `Modal` wires its backdrop, Escape and header cross to ONE `onClose`,
  // with no opt-out — so blocking a stray dismissal means swapping in a
  // no-op for those three, not the footer buttons below, which still call
  // the real `onClose` directly. Two cases need it: mid-flight (`isPending`)
  // a vanished dialog would look like the publish itself silently vanished
  // (and the Cancel button is already `disabled` then — Escape/backdrop
  // must agree, not offer a second, inconsistent way out); after success,
  // a stray dismissal would drop `result.warnings`, the AUTHORITATIVE set
  // ruling R4 exists to show, with no way to see them again. Same reasoning
  // as the house rule that a one-time-secret panel has exactly one exit —
  // applied here as a guard on the shared `Modal`'s own exits rather than a
  // bespoke overlay, since the footer already has the one deliberate exit
  // each state needs.
  const blockDismiss = () => {};

  return (
    <Modal
      isOpen
      onClose={isPending || published ? blockDismiss : onClose}
      title={labels.title}
      maxWidth="md"
      footer={
        published ? (
          <Button type="button" variant="primary" data-testid="publish-dialog-close" onClick={onClose}>
            {labels.close}
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="secondary"
              data-testid="publish-dialog-cancel"
              onClick={onClose}
              disabled={isPending}
            >
              {labels.cancel}
            </Button>
            <Button
              type="button"
              variant="primary"
              data-testid="publish-dialog-confirm"
              isLoading={isPending}
              onClick={onConfirm}
            >
              {labels.confirm}
            </Button>
          </>
        )
      }
    >
      <div data-testid="publish-confirm-dialog" className="space-y-3">
        {!published ? (
          <>
            <p className="text-sm text-[#5A646D]">{labels.question}</p>
            <div className="rounded-lg border border-[#E4E7EA] bg-[#F8F9FA] p-3 space-y-1">
              <p className="font-mono text-sm font-semibold text-[#1A1F24]">{itemLabel}</p>
              <p className="text-xs text-[#5A646D]">
                {labels.effectiveFromLabel}: <span className="font-mono">{formatDate(effectiveFrom)}</span>
              </p>
            </div>
            {retroactive && (
              <div data-testid="publish-retroactive-warning">
                <Alert variant="warning">{labels.retroactiveWarning}</Alert>
              </div>
            )}
            {editedByCallerThisSession && (
              <div data-testid="publish-self-warning">
                <Alert variant="warning">{labels.selfPublishWarning}</Alert>
              </div>
            )}
            {errorMessage && (
              <div data-testid="publish-dialog-error">
                <Alert variant="danger">{errorMessage}</Alert>
              </div>
            )}
          </>
        ) : (
          <div data-testid="publish-result">
            <p className="text-sm font-semibold text-[#123522]">{labels.resultTitle}</p>
            {result.warnings.length === 0 ? (
              <p className="mt-1 text-xs text-[#5A646D]">{labels.resultEmpty}</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {result.warnings.map((warning, index) => (
                  <li
                    key={`${warning.code}-${index}`}
                    data-testid={`publish-warning-${warning.code}`}
                    className="rounded-md border border-[#FDE68A] bg-[#FFFBEB] px-3 py-1.5 text-xs text-[#92400E]"
                  >
                    <span className="font-mono font-semibold">{warning.code}</span>: {warning.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
