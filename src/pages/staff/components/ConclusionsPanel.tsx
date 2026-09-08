import { useState } from 'react';
import { Compass, FileCheck2, Info, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useAuth } from '../../../auth/useAuth';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useLanguage, useT } from '../../../i18n/useT';
import { Button } from '../../../components/ui/button';
import { FormField, Select, Textarea } from '../../../components/ui/FormControls';
import { ApiError } from '../../../api/errors';
import { useAddConclusion, type ApplicationCardOut, type ApplicationConclusionOut } from '../queries';
import { checkResultStyle, checkTypeLabel, formatDateTime, shortId } from '../format';

const REVIEW_PERMISSION = 'applications.review';

const GIS_CHECK_TYPES = new Set(['gis_validity', 'gis_within_fund', 'gis_overlap']);

const KIND_LABEL: Record<ApplicationConclusionOut['kind'], string> = {
  executor: 'staff.conclusions.kindExecutor',
  gis: 'staff.conclusions.kindGis',
};

function ConclusionRow({ conclusion }: { conclusion: ApplicationConclusionOut }) {
  const t = useT();
  return (
    <div className="border border-[#E4E7EA] rounded-xl p-3 space-y-1.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-[#F0F7F1] border border-[#D9EBDC] text-[#123522]">
          {t(KIND_LABEL[conclusion.kind])}
        </span>
        <span className="text-[11px] font-mono text-[#767F87]">{formatDateTime(conclusion.created_at)}</span>
      </div>
      <p className="text-[#1A1F24]">{conclusion.text}</p>
      {conclusion.recommendation && (
        <p
          className={`inline-flex items-center gap-1 font-bold ${
            conclusion.recommendation === 'approve' ? 'text-[#15803D]' : 'text-[#B91C1C]'
          }`}
        >
          {conclusion.recommendation === 'approve' ? (
            <ThumbsUp className="w-3.5 h-3.5" />
          ) : (
            <ThumbsDown className="w-3.5 h-3.5" />
          )}
          {t(conclusion.recommendation === 'approve' ? 'staff.conclusions.recommendApprove' : 'staff.conclusions.recommendReject')}
        </p>
      )}
      <p className="text-[11px] text-[#767F87] font-mono">
        {t('staff.conclusions.authorLabel')} {shortId(conclusion.author_id)}
      </p>
    </div>
  );
}

/**
 * D4 (`docs/plans/06-frontend-screens.md`) — conclusions. Replaces the old
 * `GisConclusionPanel` (kept nothing but a note that writing one had "no
 * route yet"): migration 0025 granted `applications.conclude_gis` to
 * `gis_specialist`, and this task adds the `kind=executor` write path
 * `applications.review` (the hodim, `executor_staff` — this card's own
 * role) actually holds. The GIS write control is deliberately NOT here:
 * that authority belongs to the GIS specialist's own screen (track F1),
 * offering it on this card would be a second place to get the permission
 * gate wrong.
 *
 * No status restriction on the write form — `service.add_conclusion` itself
 * checks none (permission + zone only), so this does not invent one either.
 */
export function ConclusionsPanel({ card }: { card: ApplicationCardOut }) {
  const { me } = useAuth();
  const t = useT();
  const { lang } = useLanguage();
  const errorText = useApiErrorText();
  const gisChecks = card.checks.filter((c) => GIS_CHECK_TYPES.has(c.check_type));
  const [text, setText] = useState('');
  const [recommendation, setRecommendation] = useState<'' | 'approve' | 'reject'>('');
  const mutation = useAddConclusion(card.id);
  const apiError = mutation.error instanceof ApiError ? mutation.error : null;

  const canWrite = !!me && (me.is_superuser || me.permissions.includes(REVIEW_PERMISSION));

  function submit() {
    mutation.mutate(
      { kind: 'executor', text: text.trim(), recommendation: recommendation || null },
      { onSuccess: () => setText('') },
    );
  }

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-5 shadow-xs space-y-3 font-sans">
      <div className="flex items-center gap-2 border-b border-[#E4E7EA] pb-2">
        <FileCheck2 className="w-5 h-5 text-[#2E7D4F]" />
        <h3 className="text-sm font-bold text-[#1A1F24]">{t('staff.conclusions.panelTitle')}</h3>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#5A646D] flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5" /> {t('staff.conclusions.gisChecksTitle')}
        </p>
        {gisChecks.length === 0 ? (
          <p className="text-xs text-[#5A646D]">{t('staff.conclusions.gisChecksEmpty')}</p>
        ) : (
          gisChecks.map((check) => {
            const style = checkResultStyle(check.result, lang);
            return (
              <div key={check.id} className={`p-2 rounded-lg border text-xs ${style.badgeClass}`}>
                <span className="font-semibold">{checkTypeLabel(check.check_type, lang)}</span> — {style.label}
              </div>
            );
          })
        )}
      </div>

      <div className="space-y-1.5 pt-2 border-t border-[#E4E7EA]">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#5A646D]">
          {t('staff.conclusions.listTitle')}
        </p>
        {card.conclusions.length === 0 ? (
          <p className="text-xs text-[#5A646D]">{t('staff.conclusions.listEmpty')}</p>
        ) : (
          <div className="space-y-2">
            {card.conclusions.map((c) => (
              <ConclusionRow key={c.id} conclusion={c} />
            ))}
          </div>
        )}
      </div>

      {canWrite && (
        <div className="space-y-2 pt-2 border-t border-[#E4E7EA]">
          <FormField label={t('staff.conclusions.writeLabel')}>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={4000}
              placeholder={t('staff.conclusions.writePlaceholder')}
            />
          </FormField>
          <FormField label={t('staff.conclusions.recommendationLabel')}>
            <Select
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value as typeof recommendation)}
              options={[
                { value: '', label: t('staff.conclusions.recommendationNone') },
                { value: 'approve', label: t('staff.conclusions.recommendApprove') },
                { value: 'reject', label: t('staff.conclusions.recommendReject') },
              ]}
            />
          </FormField>
          <Button
            variant="outline"
            size="sm"
            fullWidth
            leftIcon={<Info className="w-4 h-4" />}
            isLoading={mutation.isPending}
            disabled={text.trim().length === 0}
            onClick={submit}
          >
            {t('staff.conclusions.submitButton')}
          </Button>
          {apiError && (
            <p className="text-xs text-[#B91C1C]" role="alert">
              {errorText(apiError)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
