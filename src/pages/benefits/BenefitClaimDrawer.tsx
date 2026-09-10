import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { Drawer } from '../../components/ui/Overlay';
import { Button } from '../../components/ui/button';
import { Alert } from '../../components/ui/Feedback';
import { ApiError } from '../../api/errors';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { useLanguage, useT } from '../../i18n/useT';
import { useBenefitClaim, useVerifyBenefitClaim } from './queries';
import { useActivityTypes, useDocTypes } from './refs';
import { formatDate, formatDateTime, localizedName, shortId } from './format';
import { RejectClaimModal } from './RejectClaimModal';
import type { BenefitVerificationStatus } from './api';

export interface BenefitClaimDrawerProps {
  applicationId: string;
  onClose: () => void;
}

const STATUS_BADGE_CLASS: Record<BenefitVerificationStatus, string> = {
  not_required: 'bg-[#F8F9FA] text-[#5A646D] border-[#E4E7EA]',
  pending: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]',
  verified: 'bg-[#F0F7F1] text-[#123522] border-[#D9EBDC]',
  rejected: 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]',
};

function fileUrl(fileId: string): string {
  const base = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';
  return `${base}/api/v1/files/${fileId}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-[#5A646D]">{label}</p>
      <p className="mt-0.5 text-sm text-[#1A1F24]">{children}</p>
    </div>
  );
}

/**
 * One claim's own view (T11 task 2): the certificate number and its
 * attached file(s), plus the application's own particulars for context —
 * `BenefitClaimDetailOut` in one call (`GET /applications/
 * benefit-verifications/{id}`), never `ApplicationCardOut` (that route 404s
 * for this role — see `api.ts`'s own docstring).
 *
 * Verify/reject (T11 task 3) show ONLY while the claim is still `pending` —
 * `_transition`'s own 409 (`reason="not_pending"`) is the server backstop for
 * a race (another verifier decided it a moment earlier), but this drawer
 * does not wait for that response to hide a decided claim's actions in the
 * first place.
 */
export function BenefitClaimDrawer({ applicationId, onClose }: BenefitClaimDrawerProps) {
  const t = useT();
  const { lang } = useLanguage();
  const errorText = useApiErrorText();
  const detail = useBenefitClaim(applicationId);
  const activityTypes = useActivityTypes();
  const docTypes = useDocTypes();
  const verify = useVerifyBenefitClaim(applicationId);
  const [rejecting, setRejecting] = useState(false);

  const claim = detail.data;
  const activityName = claim?.activity_type_id
    ? localizedName(activityTypes.data?.find((a) => a.id === claim.activity_type_id)?.name, lang)
    : null;

  return (
    <Drawer isOpen onClose={onClose} title={t('benefitVerification.detail.title')}>
      {detail.isLoading ? (
        <p className="py-8 text-center text-sm text-[#5A646D]">{t('benefitVerification.loading')}</p>
      ) : detail.error ? (
        <p className="py-8 text-center text-sm text-[#991B1B]" role="alert">
          {detail.error instanceof ApiError ? errorText(detail.error) : t('benefitVerification.detail.loadFailed')}
        </p>
      ) : claim ? (
        <div className="space-y-4" data-testid={`benefit-claim-detail-${claim.id}`}>
          <Field label={t('benefitVerification.detail.status')}>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold border ${STATUS_BADGE_CLASS[claim.benefit_verification_status]}`}
            >
              {t(`benefitVerification.status.${claim.benefit_verification_status}`)}
            </span>
          </Field>
          <Field label={t('benefitVerification.detail.certificateNo')}>
            {claim.benefit_certificate_no || t('benefitVerification.detail.noCertificateNo')}
          </Field>
          <Field label={t('benefitVerification.detail.applicant')}>
            <span className="font-mono">{shortId(claim.applicant_id)}</span>
          </Field>
          <Field label={t('benefitVerification.detail.activity')}>
            {activityName || (claim.activity_type_id ? shortId(claim.activity_type_id) : '—')}
          </Field>
          <Field label={t('benefitVerification.detail.period')}>
            {claim.period_from && claim.period_to ? `${formatDate(claim.period_from)} — ${formatDate(claim.period_to)}` : '—'}
          </Field>
          <Field label={t('benefitVerification.detail.submittedAt')}>{formatDateTime(claim.submitted_at)}</Field>

          {claim.benefit_verification_status !== 'pending' && (
            <>
              <Field label={t('benefitVerification.detail.decidedBy')}>
                {claim.benefit_verified_by ? <span className="font-mono">{shortId(claim.benefit_verified_by)}</span> : '—'}
              </Field>
              <Field label={t('benefitVerification.detail.decidedAt')}>{formatDateTime(claim.benefit_verified_at)}</Field>
              {claim.benefit_verification_status === 'rejected' && (
                <Field label={t('benefitVerification.detail.rejectionReason')}>{claim.benefit_rejection_reason}</Field>
              )}
            </>
          )}

          <div className="pt-2 border-t border-[#E4E7EA]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A646D] mb-2">
              {t('benefitVerification.detail.documents.title')}
            </h3>
            {claim.documents.length === 0 ? (
              <p className="text-xs text-[#5A646D]">{t('benefitVerification.detail.documents.empty')}</p>
            ) : (
              <div className="space-y-2">
                {claim.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 border border-[#E4E7EA] rounded-xl flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-5 h-5 text-[#5A646D] shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-[#1A1F24] block">
                          {localizedName(docTypes.data?.find((d) => d.id === doc.doc_type_item_id)?.name, lang) ||
                            t('benefitVerification.detail.documents.fallbackName')}
                        </span>
                        {doc.note && <span className="text-[11px] text-[#5A646D] block">{doc.note}</span>}
                      </div>
                    </div>
                    <a
                      href={fileUrl(doc.file_id)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-semibold rounded-md border border-[#767F87] text-[#1A1F24] hover:bg-[#F8F9FA] shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" /> {t('benefitVerification.detail.documents.download')}
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {verify.error && (
            <Alert variant="danger">
              {verify.error instanceof ApiError ? errorText(verify.error) : t('benefitVerification.actions.verifyError')}
            </Alert>
          )}

          {claim.benefit_verification_status === 'pending' && (
            <div className="flex gap-2 pt-2">
              <Button
                variant="primary"
                size="sm"
                isLoading={verify.isPending}
                onClick={() => verify.mutate()}
                data-testid="verify-claim-button"
              >
                {t('benefitVerification.actions.verify')}
              </Button>
              <Button variant="danger" size="sm" onClick={() => setRejecting(true)} data-testid="open-reject-claim-modal">
                {t('benefitVerification.actions.reject')}
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {rejecting && (
        <RejectClaimModal
          applicationId={applicationId}
          onClose={() => setRejecting(false)}
          onRejected={() => setRejecting(false)}
        />
      )}
    </Drawer>
  );
}
