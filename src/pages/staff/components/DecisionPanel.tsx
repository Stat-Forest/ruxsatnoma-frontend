import { useState } from 'react';
import { AlertTriangle, ArrowUpCircle, CheckCircle2, Inbox, XCircle } from 'lucide-react';
import { useAuth } from '../../../auth/useAuth';
import { Button } from '../../../components/ui/button';
import { ApiError } from '../../../api/errors';
import { useApprove, useReject, useStartReview, type ApplicationCardOut } from '../queries';
import { shortId, statusLabel } from '../format';
import { SignDecisionModal, type DecisionMode } from './SignDecisionModal';

const REVIEW_PERMISSION = 'applications.review';
const DECIDE_PERMISSION = 'applications.decide';

/**
 * The decision rail. Every action rendered here is gated by what
 * `GET /auth/me` actually says the caller may do — never a hard-coded role
 * name — because the same card is opened by two roles with different
 * rights: `executor_staff` holds `applications.review` (take into work) but
 * not `applications.decide`, and `executor_head` is the exact opposite
 * (routes.tsx's own comment, and the sprint brief).
 *
 * **The over-limit forward is rendered as what it is, never as an
 * approval.** `POST /approve` answers 200 with `status: "IN_REVIEW"` and
 * `forwarded_to_organization` set when decision #29's ceiling is exceeded —
 * `ApplicationDecisionOut.build`'s own docstring says a client tells the two
 * apart by this field, not by guessing from the status, so that is exactly
 * what this component checks.
 */
export function DecisionPanel({ card }: { card: ApplicationCardOut }) {
  const { me } = useAuth();
  const [modalMode, setModalMode] = useState<DecisionMode | null>(null);
  const [forwardedTo, setForwardedTo] = useState<string | null>(null);
  const [decided, setDecided] = useState<'approved' | 'rejected' | null>(null);

  const startReview = useStartReview(card.id);
  const approve = useApprove(card.id);
  const reject = useReject(card.id);

  if (!me) return null;
  const canReview = me.is_superuser || me.permissions.includes(REVIEW_PERMISSION);
  const canDecide = me.is_superuser || me.permissions.includes(DECIDE_PERMISSION);

  function closeModal() {
    setModalMode(null);
    approve.reset();
    reject.reset();
  }

  function handleApproveSubmit(pkcs7: string) {
    approve.mutate(pkcs7, {
      onSuccess: (data) => {
        setForwardedTo(data.forwarded_to_organization ?? null);
        setDecided(data.forwarded_to_organization ? null : 'approved');
        setModalMode(null);
      },
    });
  }

  function handleRejectSubmit(input: { pkcs7: string; reason_item_id: string; legal_basis: string }) {
    reject.mutate(input, {
      onSuccess: () => {
        setDecided('rejected');
        setModalMode(null);
      },
    });
  }

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-5 shadow-xs space-y-4 font-sans">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A646D] border-b border-[#E4E7EA] pb-2">
        Qaror va harakatlar
      </h3>

      <div className="text-xs text-[#5A646D]">
        Joriy status: <span className="font-bold text-[#1A1F24]">{statusLabel(card.status)}</span>
      </div>

      {forwardedTo && (
        <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-xs text-[#92400E] flex items-start gap-2">
          <ArrowUpCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Tasdiqlanmadi — yuqori tashkilotga yuborildi.</strong> Rolingizning tasdiqlash chegarasi
            (summa yoki maydon boʻyicha) oshib ketgani uchun ariza yuqori tashkilotga (
            <span className="font-mono">{shortId(forwardedTo)}</span>) avtomatik yuborildi. Hech narsa imzolanmadi
            va ariza hali IN_REVIEW holatida.
          </span>
        </div>
      )}

      {decided === 'approved' && (
        <div className="p-3 bg-[#F0F7F1] border border-[#D9EBDC] rounded-xl text-xs text-[#123522] flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Ariza tasdiqlandi. Hisob-faktura yaratilgani uchun status endi INVOICED.</span>
        </div>
      )}
      {decided === 'rejected' && (
        <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl text-xs text-[#991B1B] flex items-start gap-2">
          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Ariza rad etildi.</span>
        </div>
      )}

      {card.status === 'SUBMITTED' &&
        (canReview ? (
          <Button
            variant="primary"
            fullWidth
            leftIcon={<Inbox className="w-4 h-4" />}
            isLoading={startReview.isPending}
            onClick={() => startReview.mutate()}
          >
            Koʻrib chiqishga olish
          </Button>
        ) : (
          <p className="text-xs text-[#5A646D] bg-[#F8F9FA] p-3 rounded-xl border border-[#E4E7EA]">
            Ariza hali ijroga olinmagan. Buni ijrochi tashkilot xodimi (applications.review) bajaradi.
          </p>
        ))}
      {startReview.error && (
        <p className="text-xs text-[#B91C1C]" role="alert">
          {startReview.error instanceof ApiError ? `${startReview.error.code}: ${startReview.error.message}` : 'Xatolik'}
        </p>
      )}

      {card.status === 'IN_REVIEW' &&
        (canDecide ? (
          <div className="space-y-2">
            {!card.assigned_user_id && (
              <p className="text-[11px] text-[#B45309] bg-[#FFFBEB] p-2 rounded-lg border border-[#FDE68A] flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> Bu darajada hali hech kim arizani ishga
                olmagan (assigned_user_id boʻsh).
              </p>
            )}
            <Button
              variant="primary"
              fullWidth
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
              onClick={() => setModalMode('approve')}
            >
              Tasdiqlash
            </Button>
            <Button
              variant="danger"
              fullWidth
              leftIcon={<XCircle className="w-4 h-4" />}
              onClick={() => setModalMode('reject')}
            >
              Rad etish
            </Button>
          </div>
        ) : (
          <p className="text-xs text-[#5A646D] bg-[#F8F9FA] p-3 rounded-xl border border-[#E4E7EA]">
            Qaror qabul qilish (tasdiqlash/rad etish) ijrochi tashkilot rahbari (applications.decide) vakolatida.
          </p>
        ))}

      {card.status !== 'SUBMITTED' && card.status !== 'IN_REVIEW' && (
        <p className="text-xs text-[#5A646D] bg-[#F8F9FA] p-3 rounded-xl border border-[#E4E7EA]">
          Bu status boʻyicha hech qanday harakat mumkin emas.
        </p>
      )}

      {modalMode && (
        <SignDecisionModal
          mode={modalMode}
          applicationId={card.id}
          isSubmitting={modalMode === 'approve' ? approve.isPending : reject.isPending}
          error={modalMode === 'approve' ? approve.error : reject.error}
          onClose={closeModal}
          onSubmitApprove={handleApproveSubmit}
          onSubmitReject={handleRejectSubmit}
        />
      )}
    </div>
  );
}
