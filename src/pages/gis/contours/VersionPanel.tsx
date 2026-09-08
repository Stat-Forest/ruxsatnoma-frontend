import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../auth/useAuth';
import { Button } from '../../../components/ui/button';
import { Alert } from '../../../components/ui/Feedback';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useLanguage } from '../../../i18n/useT';
import { translateTerm } from '../../../i18n/terms';
import { formatDate, formatDateTime, formatDecimal } from '../format';
import type { VersionOut } from '../api';
import {
  useApproveVersion,
  useArchiveVersion,
  useCheckVersion,
  usePublishVersion,
  useReturnVersionToDraft,
  useReturnVersionToReview,
  useSubmitVersionReview,
  useUploadFile,
} from '../queries';
import { ChecksReport } from './ChecksReport';
import { isBlockedByChecks } from './checksLogic';

const CONTOURS_MANAGE = 'gis.contours.manage';
const CONTOURS_APPROVE = 'gis.contours.approve';

const STATUS_LABEL_KEYS: Record<string, string> = {
  draft: 'gis.versions.status.draft',
  review: 'gis.versions.status.review',
  approved: 'gis.versions.status.approved',
  published: 'gis.versions.status.published',
  archived: 'gis.versions.status.archived',
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  draft: 'bg-[#F8F9FA] border-[#E4E7EA] text-[#5A646D]',
  review: 'bg-[#E0F2FE] border-[#BAE6FD] text-[#0369A1]',
  approved: 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]',
  published: 'bg-[#F0F7F1] border-[#D9EBDC] text-[#123522]',
  archived: 'bg-[#F8F9FA] border-[#E4E7EA] text-[#9AA3AB]',
};

/**
 * F2 — the lifecycle panel for whichever version the operator currently
 * holds. See plan `06.5-gis-screens.md` ruling 2 for why "currently holds"
 * is load-bearing: there is no backend route to list or fetch a version by
 * id, so this panel can only ever act on a version its caller already has in
 * hand (just created, or recalled from this browser's own `localVersions`
 * cache) — never one discovered by browsing.
 *
 * Every transition button is gated on BOTH the version's current status
 * (`TRANSITIONS` mirrored from `gis/service.py`) and the actor's held
 * permission — an action the backend would refuse is never offered.
 */
export function VersionPanel({
  contourId,
  version,
  onVersionChange,
  t,
}: {
  contourId: string;
  version: VersionOut;
  onVersionChange: (version: VersionOut) => void;
  t: (key: string) => string;
}) {
  const { me } = useAuth();
  const { lang } = useLanguage();
  const errorText = useApiErrorText();
  const canManage = !!me?.permissions.includes(CONTOURS_MANAGE) || !!me?.is_superuser;
  const canApprove = !!me?.permissions.includes(CONTOURS_APPROVE) || !!me?.is_superuser;

  const checkMutation = useCheckVersion(contourId);
  const submitReview = useSubmitVersionReview(contourId);
  const approve = useApproveVersion(contourId);
  const publish = usePublishVersion(contourId);
  const returnToReview = useReturnVersionToReview(contourId);
  const returnToDraft = useReturnVersionToDraft(contourId);
  const archive = useArchiveVersion(contourId);
  const uploadFile = useUploadFile();

  const [approvalFile, setApprovalFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const versionIdRef = useRef(version.id);
  useEffect(() => {
    // A held version's own status can move (submit-review, approve, ...)
    // without its `id` changing — checks are worth re-running automatically
    // only when we start looking at a DIFFERENT version, so a stale report
    // from the version this replaced is never shown against the new one.
    if (versionIdRef.current !== version.id) {
      versionIdRef.current = version.id;
      checkMutation.reset();
    }
    if (version.status === 'approved' && !checkMutation.data && !checkMutation.isPending) {
      checkMutation.mutate(version.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version.id, version.status]);

  const checks = checkMutation.data?.checks ?? [];
  const blocked = isBlockedByChecks(checks);

  async function handleApprove() {
    if (!approvalFile) return;
    const uploaded = await uploadFile.mutateAsync(approvalFile);
    const result = await approve.mutateAsync({ versionId: version.id, approvalDocId: uploaded.id });
    onVersionChange(result);
    setApprovalFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function runAndUpdate(action: ReturnType<typeof useSubmitVersionReview>) {
    const result = await action.mutateAsync(version.id);
    onVersionChange(result);
  }

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-5 shadow-xs space-y-4" data-testid="version-panel">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5A646D]">
            {t('gis.versions.title')}
          </span>
          <div className="text-sm font-bold text-[#1A1F24]">
            {t('gis.versions.versionNo')} {version.version_no}
          </div>
        </div>
        <span
          data-testid="version-status-badge"
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
            STATUS_BADGE_CLASS[version.status] ?? STATUS_BADGE_CLASS.draft
          }`}
        >
          {t(STATUS_LABEL_KEYS[version.status] ?? version.status)}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-y-1.5 text-xs">
        <dt className="text-[#5A646D]">{t('gis.versions.areaHa')}</dt>
        <dd className="text-right font-mono font-semibold">{formatDecimal(version.area_ha, 'ga')}</dd>
        <dt className="text-[#5A646D]">{t('gis.versions.declaredAreaHa')}</dt>
        <dd className="text-right font-mono">{formatDecimal(version.declared_area_ha, 'ga')}</dd>
        <dt className="text-[#5A646D]">{t('gis.versions.source')}</dt>
        <dd className="text-right">{translateTerm(version.source, lang)}</dd>
        <dt className="text-[#5A646D]">{t('gis.versions.surveyDate')}</dt>
        <dd className="text-right">{formatDate(version.survey_date)}</dd>
        <dt className="text-[#5A646D]">{t('gis.versions.effectiveFrom')}</dt>
        <dd className="text-right">{formatDate(version.effective_from)}</dd>
        {version.published_at && (
          <>
            <dt className="text-[#5A646D]">{t('gis.versions.publishedAt')}</dt>
            <dd className="text-right">{formatDateTime(version.published_at)}</dd>
          </>
        )}
      </dl>

      <div className="border-t border-[#E4E7EA] pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5A646D]">
            {t('gis.versions.checks.title')}
          </span>
          <Button
            size="sm"
            variant="outline"
            isLoading={checkMutation.isPending}
            onClick={() => checkMutation.mutate(version.id)}
            className="cursor-pointer"
          >
            {t('gis.versions.checks.run')}
          </Button>
        </div>
        {checkMutation.isError && (
          <Alert variant="danger" className="mt-2">
            {errorText(checkMutation.error, t('gis.versions.checks.failed'))}
          </Alert>
        )}
        <div className="mt-2">
          <ChecksReport checks={checks} t={t} />
        </div>
      </div>

      <div className="border-t border-[#E4E7EA] pt-3 flex flex-wrap gap-2">
        {version.status === 'draft' && canManage && (
          <Button
            variant="primary"
            size="sm"
            isLoading={submitReview.isPending}
            onClick={() => runAndUpdate(submitReview)}
            className="cursor-pointer"
          >
            {t('gis.versions.actions.submitReview')}
          </Button>
        )}

        {version.status === 'review' && canApprove && (
          <div className="w-full space-y-2 rounded-lg border border-[#E4E7EA] p-3">
            <span className="text-xs font-semibold text-[#5A646D]">
              {t('gis.versions.actions.approvalDocHint')}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              data-testid="approval-doc-input"
              onChange={(e) => setApprovalFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs"
            />
            <Button
              variant="success"
              size="sm"
              disabled={!approvalFile}
              isLoading={uploadFile.isPending || approve.isPending}
              onClick={handleApprove}
              className="cursor-pointer"
            >
              {t('gis.versions.actions.approve')}
            </Button>
            {approve.isError && (
              <Alert variant="danger">{errorText(approve.error, t('gis.versions.actions.failed'))}</Alert>
            )}
          </div>
        )}
        {version.status === 'review' && canManage && (
          <Button
            variant="outline"
            size="sm"
            isLoading={returnToDraft.isPending}
            onClick={() => runAndUpdate(returnToDraft)}
            className="cursor-pointer"
          >
            {t('gis.versions.actions.returnToDraft')}
          </Button>
        )}

        {version.status === 'approved' && canApprove && (
          <>
            <Button
              variant="primary"
              size="sm"
              isLoading={publish.isPending}
              disabled={blocked}
              title={blocked ? t('gis.versions.actions.publishBlockedHint') : undefined}
              onClick={() => runAndUpdate(publish)}
              className="cursor-pointer"
            >
              {t('gis.versions.actions.publish')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              isLoading={returnToReview.isPending}
              onClick={() => runAndUpdate(returnToReview)}
              className="cursor-pointer"
            >
              {t('gis.versions.actions.returnToReview')}
            </Button>
          </>
        )}

        {version.status === 'published' && canApprove && (
          <Button
            variant="danger"
            size="sm"
            isLoading={archive.isPending}
            onClick={() => runAndUpdate(archive)}
            className="cursor-pointer"
          >
            {t('gis.versions.actions.archive')}
          </Button>
        )}

        {(submitReview.isError || publish.isError || returnToReview.isError || returnToDraft.isError || archive.isError) && (
          <Alert variant="danger" className="w-full">
            {errorText(
              submitReview.error ?? publish.error ?? returnToReview.error ?? returnToDraft.error ?? archive.error,
              t('gis.versions.actions.failed'),
            )}
          </Alert>
        )}
      </div>
    </div>
  );
}
