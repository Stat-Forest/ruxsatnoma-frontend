import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { useAuth } from '../../../auth/useAuth';
import { Button } from '../../../components/ui/button';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useLanguage, useT } from '../../../i18n/useT';
import {
  useBenefitCategories,
  useDocTypes,
  useVerifyBenefitClaim,
  fileUrl,
  type ApplicationCardOut,
  type BenefitVerificationStatus,
} from '../queries';
import { localizedName } from '../format';
import { RejectClaimModal } from './RejectClaimModal';

const VERIFY_PERMISSION = 'benefits.verify';
// The one `doc_types` code a claim is proven with (backend
// `applications.service.BENEFIT_DOC_TYPE_CODE`, seeded by migration 0024).
const BENEFIT_PROOF_CODE = 'benefit_proof';

const STATUS_BADGE_CLASS: Record<Exclude<BenefitVerificationStatus, 'not_required'>, string> = {
  pending: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]',
  verified: 'bg-[#F0F7F1] text-[#123522] border-[#D9EBDC]',
  rejected: 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-[#5A646D]">{label}</p>
      <p className="mt-0.5 text-sm text-[#1A1F24]">{children}</p>
    </div>
  );
}

/**
 * The benefit claim block on the application card (rulings #181/#182,
 * `docs/plans/10-benefits-and-simple-signature.md`, track F2). Rendered next
 * to `ReviewActionsPanel` from `StaffApplicationCard`, and only while
 * `card.benefit_verification_status !== 'not_required'` — a claim's
 * category/certificate/documents/status, moved here from the retired
 * country-wide queue (stage 9, T11): the leshoz now decides it as part of
 * its own review, not a central office.
 *
 * Everything shown here is ON THE CARD — category, number, status and the
 * `benefit_proof` documents out of `card.documents` — so the block costs no
 * request of its own and renders for every viewer of the card. The stage 10
 * review found the first version fetching `GET /applications/benefit-
 * verifications/{id}` for everyone: that route is gated on `benefits.verify`,
 * and a chief forester, an accountant or a prosecutor got a red ACL error
 * where the documents should have been.
 *
 * Verify/reject (a `benefits.verify` holder, while the claim is `pending` AND
 * the application is `IN_REVIEW` — the server answers 409 `not_in_review`
 * otherwise, and a button that leads there is a button that lies) call the
 * SAME two routes stage 9 used, now reached from the ONE application
 * carrying the claim rather than from a shared queue.
 *
 * A `verified` claim with `benefit_verified_by === null` means the Union
 * register confirmed it automatically at filing (ruling #182's apiary
 * seam) — rendered as its own sentence, never as "decided by (nobody)".
 */
export function BenefitClaimPanel({ card }: { card: ApplicationCardOut }) {
  const { me } = useAuth();
  const t = useT();
  const { lang } = useLanguage();
  const errorText = useApiErrorText();
  const [rejecting, setRejecting] = useState(false);

  const status = card.benefit_verification_status;
  const benefitCategories = useBenefitCategories();
  const docTypes = useDocTypes();
  const verify = useVerifyBenefitClaim(card.id);

  if (status === 'not_required') return null;

  const canVerify = !!me && (me.is_superuser || me.permissions.includes(VERIFY_PERMISSION));
  const inReview = card.status === 'IN_REVIEW';
  // The claim's own documents: `benefit_proof` rows of the card. While the
  // doc-type list is unknown nothing is hidden — every document is listed,
  // each named by its type — rather than an empty list that reads as "no
  // proof attached".
  const proofTypeId = docTypes.data?.find((d) => d.code === BENEFIT_PROOF_CODE)?.id;
  const proofDocuments = proofTypeId
    ? card.documents.filter((doc) => doc.doc_type_item_id === proofTypeId)
    : card.documents;
  const categoryName = card.benefit_category_item_id
    ? localizedName(benefitCategories.data?.find((c) => c.id === card.benefit_category_item_id)?.name, lang)
    : null;

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-5 shadow-xs space-y-3 font-sans" data-testid="benefit-claim-panel">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A646D] border-b border-[#E4E7EA] pb-2">
        {t('staff.benefitClaim.title')}
      </h3>

      <Field label={t('staff.benefitClaim.category')}>
        {categoryName || (card.benefit_category_item_id ?? '—')}
      </Field>
      <Field label={t('staff.benefitClaim.certificateNo')}>
        {card.benefit_certificate_no || t('staff.benefitClaim.noCertificateNo')}
      </Field>
      <Field label={t('staff.benefitClaim.status')}>
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold border ${STATUS_BADGE_CLASS[status]}`}
        >
          {t(`staff.benefitClaim.status.${status}`)}
        </span>
      </Field>

      {status === 'verified' && card.benefit_verified_by === null && (
        <p className="text-xs text-[#123522] bg-[#F0F7F1] border border-[#D9EBDC] rounded-xl p-3">
          {t('staff.benefitClaim.registryVerified')}
        </p>
      )}

      {status === 'rejected' && (
        <Field label={t('staff.benefitClaim.rejectionReason')}>
          {card.benefit_rejection_reason || '—'}
        </Field>
      )}

      <div className="pt-2 border-t border-[#E4E7EA]">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#5A646D] mb-2">
          {t('staff.benefitClaim.documents.title')}
        </h4>
        {docTypes.isLoading ? (
          <p className="text-xs text-[#5A646D]">…</p>
        ) : proofDocuments.length === 0 ? (
          <p className="text-xs text-[#5A646D]">{t('staff.benefitClaim.documents.empty')}</p>
        ) : (
          <div className="space-y-2">
            {proofDocuments.map((doc) => (
              <div
                key={doc.id}
                className="p-3 border border-[#E4E7EA] rounded-xl flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-5 h-5 text-[#5A646D] shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-[#1A1F24] block">
                      {localizedName(docTypes.data?.find((d) => d.id === doc.doc_type_item_id)?.name, lang) ||
                        t('staff.benefitClaim.documents.fallbackName')}
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
                  <Download className="w-3.5 h-3.5" /> {t('staff.benefitClaim.documents.download')}
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {verify.error && (
        <p className="text-xs text-[#B91C1C]" role="alert">
          {verify.error instanceof ApiError ? errorText(verify.error) : t('staff.benefitClaim.actions.verifyError')}
        </p>
      )}

      {status === 'pending' && canVerify && !inReview && (
        <p className="text-xs text-[#B45309] pt-2" data-testid="benefit-claim-not-in-review">
          {t('staff.benefitClaim.notInReview')}
        </p>
      )}

      {status === 'pending' && canVerify && inReview && (
        <div className="flex gap-2 pt-2">
          <Button
            variant="primary"
            size="sm"
            isLoading={verify.isPending}
            onClick={() => verify.mutate()}
            data-testid="verify-claim-button"
          >
            {t('staff.benefitClaim.actions.verify')}
          </Button>
          <Button variant="danger" size="sm" onClick={() => setRejecting(true)} data-testid="open-reject-claim-modal">
            {t('staff.benefitClaim.actions.reject')}
          </Button>
        </div>
      )}

      {rejecting && (
        <RejectClaimModal applicationId={card.id} onClose={() => setRejecting(false)} onRejected={() => setRejecting(false)} />
      )}
    </div>
  );
}
