import { useState } from 'react';
import { Star } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { apiError } from '../../api/errors';
import type { components } from '../../api/schema';
import { Button } from '../../components/ui/button';
import { FormField, Textarea } from '../../components/ui/FormControls';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { useT } from '../../i18n/useT';
import { formatDateTime } from './format';

type PermitRatingOut = components['schemas']['PermitRatingOut'];
type PermitStatus = components['schemas']['PermitCardOut']['status'];

/** The five score options, worst first in the source but rendered best
 *  first (5 → 1) — the same order the old landing form used for its own
 *  4. Titles/descriptions for 5-2 are that form's copy verbatim; "1" is new
 *  (task-8-brief.md point 1: an opinion survey that cannot express the worst
 *  opinion is a witness, not a survey). */
const SCORE_OPTIONS = [
  { score: 5, titleKey: 'permitRating.option5Title', descKey: 'permitRating.option5Desc' },
  { score: 4, titleKey: 'permitRating.option4Title', descKey: 'permitRating.option4Desc' },
  { score: 3, titleKey: 'permitRating.option3Title', descKey: 'permitRating.option3Desc' },
  { score: 2, titleKey: 'permitRating.option2Title', descKey: 'permitRating.option2Desc' },
  { score: 1, titleKey: 'permitRating.option1Title', descKey: 'permitRating.option1Desc' },
] as const;

/**
 * B10's own rating panel (ruling #140/#141, task 8 of
 * `07.7-services-catalog-and-ratings`).
 *
 * `rating` comes straight off the permit card (`PermitCardOut.rating`) —
 * this panel makes no GET of its own; the cabinet already fetches the card,
 * and the card already carries the citizen's own rating, or `null`. The
 * panel renders nothing (`return null`) while `status` is still
 * `pending_signatures` — there is no service yet to rate, the same
 * `issued_at IS NULL` refusal `service.rate_permit` gives as `ERR-PERM-001`/
 * `not_issued`. Every other status (`active`, `suspended`, `revoked`,
 * `expired`, `archived`) is reachable only from an issuance the permit
 * already had, so "not pending signatures" here is exactly "issued", the
 * same predicate the backend checks.
 *
 * Once rated, the form is REPLACED by the given score (decision 3) — a
 * citizen who already rated has nothing left to submit, so there is no
 * "disabled form" state to design for.
 */
export function PermitRatingPanel({
  permitId,
  rating,
  status,
}: {
  permitId: string;
  rating: PermitRatingOut | null;
  status: PermitStatus;
}) {
  const t = useT();
  const errorText = useApiErrorText();
  const queryClient = useQueryClient();
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');

  const mutation = useMutation({
    mutationFn: async (vars: { score: number; comment: string }) => {
      const { data, error } = await api.POST('/api/v1/permits/{permit_id}/rating', {
        params: { path: { permit_id: permitId } },
        body: { score: vars.score, comment: vars.comment || undefined },
      });
      if (error) throw apiError(error);
      return data;
    },
    // The card's own `rating` (the prop above) is what decides which half of
    // this component renders — invalidating `['permit', permitId]` (the
    // exact key `MyPermitPage` fetches under) is what makes that prop catch
    // up, the same `onSigned`-then-invalidate shape `PermitSignaturesPanel`
    // uses for its own mutations.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['permit', permitId] });
    },
  });

  if (status === 'pending_signatures') return null;

  if (rating) {
    return (
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs font-sans space-y-3">
        <div className="flex items-center gap-2 border-b border-[#E4E7EA] pb-3">
          <Star className="w-5 h-5 text-[#2E7D4F]" />
          <h2 className="text-base font-bold text-[#1A1F24]">{t('permitRating.ratedTitle')}</h2>
        </div>
        <p className="text-sm text-[#5A646D]">{t('permitRating.thankYou')}</p>
        <p className="text-sm text-[#1A1F24]">
          {t('permitRating.resultLabel')}{' '}
          <strong>
            {rating.score} / 5 {t('permitRating.resultUnit')}
          </strong>
        </p>
        {rating.comment && <p className="text-sm text-[#5A646D] italic">“{rating.comment}”</p>}
        <p className="text-xs text-[#9AA3AB]">{formatDateTime(rating.created_at)}</p>
      </div>
    );
  }

  function handleSubmit() {
    if (score == null) return;
    mutation.mutate({ score, comment: comment.trim() });
  }

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs font-sans space-y-4">
      <div className="flex items-center gap-2 border-b border-[#E4E7EA] pb-3">
        <Star className="w-5 h-5 text-[#2E7D4F]" />
        <h2 className="text-base font-bold text-[#1A1F24]">{t('permitRating.title')}</h2>
      </div>
      <p className="text-xs text-[#5A646D]">{t('permitRating.subtitle')}</p>

      <fieldset className="space-y-2">
        <legend className="sr-only">{t('permitRating.title')}</legend>
        {SCORE_OPTIONS.map((opt) => {
          const inputId = `permit-rating-score-${opt.score}`;
          return (
            <label
              key={opt.score}
              htmlFor={inputId}
              className="flex items-start gap-2.5 border border-[#E4E7EA] rounded-xl p-3 cursor-pointer has-[:checked]:border-[#2E7D4F] has-[:checked]:bg-[#F0F7F1]"
            >
              <input
                type="radio"
                id={inputId}
                name="permit-rating-score"
                value={opt.score}
                checked={score === opt.score}
                onChange={() => setScore(opt.score)}
                className="mt-0.5 accent-[#2E7D4F]"
              />
              <span className="text-sm">
                <span className="font-semibold text-[#1A1F24]">{t(opt.titleKey)}</span>
                {' — '}
                <span className="text-[#5A646D]">{t(opt.descKey)}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <FormField label={t('permitRating.commentLabel')} htmlFor="permit-rating-comment">
        <Textarea
          id="permit-rating-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={2000}
        />
      </FormField>

      {mutation.isError && (
        <p className="text-xs text-[#B91C1C] font-semibold" role="alert">
          {errorText(mutation.error, t('permitRating.submitError'))}
        </p>
      )}

      <Button
        variant="primary"
        size="sm"
        disabled={score == null}
        isLoading={mutation.isPending}
        onClick={handleSubmit}
        className="bg-[#2E7D4F] hover:bg-[#23653F] text-white font-bold"
      >
        {t('permitRating.submitButton')}
      </Button>
    </div>
  );
}
