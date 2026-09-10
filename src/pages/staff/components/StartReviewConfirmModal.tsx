import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/Overlay';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useT } from '../../../i18n/useT';
import { useStartReview } from '../queries';
import { shortId } from '../format';

/**
 * The question before `POST /start-review`. "Koʻrib chiqishga olish" on the
 * card and "Ishga olish" on a worklist row both used to post on the first
 * click — one slip of the mouse moved a SUBMITTED application into
 * IN_REVIEW and assigned it to whoever slipped, with no way back short of
 * a return. Owns the mutation itself, the way `RequestInfoModal` does, so
 * a failure stays on screen next to the button that caused it.
 *
 * Callers render it OUTSIDE any `clickableRowProps` row: `Modal` renders in
 * place (no portal), so a dialog inside the `<tr>` would bubble its
 * backdrop click up to the row and open the card the reader was declining.
 */
export function StartReviewConfirmModal({
  application,
  onClose,
}: {
  application: { id: string; number: string | null };
  onClose: () => void;
}) {
  const t = useT();
  const errorText = useApiErrorText();
  const mutation = useStartReview(application.id);
  const error = mutation.error;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('staff.startReview.confirm.title')}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            {t('staff.startReview.confirm.cancel')}
          </Button>
          <Button
            variant="primary"
            isLoading={mutation.isPending}
            onClick={() => mutation.mutate(undefined, { onSuccess: onClose })}
          >
            {t('staff.startReview.confirm.button')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p>
          {t('staff.startReview.confirm.bodyPrefix')}{' '}
          <strong className="font-mono">{application.number ?? shortId(application.id)}</strong>{' '}
          {t('staff.startReview.confirm.bodyEffect')}
        </p>
        {error && (
          <p className="text-xs text-[#B91C1C]" role="alert">
            {error instanceof ApiError ? errorText(error) : t('staff.startReview.confirm.error')}
          </p>
        )}
      </div>
    </Modal>
  );
}
