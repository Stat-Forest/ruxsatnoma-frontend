import { useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, ArrowUpCircle, Award, CheckCircle2, Inbox, XCircle } from 'lucide-react';
import { useAuth } from '../../../auth/useAuth';
import { Button } from '../../../components/ui/button';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useLanguage, useT } from '../../../i18n/useT';
import { useApprove, useReject, useStartReview, type ApplicationCardOut } from '../queries';
import { shortId, statusLabel } from '../format';
import { formatPermitNumber } from '../../permits/format';
import { usePermitForApplication } from '../../permits/usePermitForApplication';
import { SignDecisionModal, type DecisionMode } from './SignDecisionModal';

const REVIEW_PERMISSION = 'applications.review';
const DECIDE_PERMISSION = 'applications.decide';

const DECISION_PANEL_I18N = {
  uz_latn: {
    panelTitle: 'Qaror va harakatlar',
    currentStatus: 'Joriy status:',
    permit: 'Ruxsatnoma:',
    viewLink: 'Koʻrish →',
    forwardedBold: 'Tasdiqlanmadi — yuqori tashkilotga yuborildi.',
    forwardedText: (org: string) =>
      `Rolingizning tasdiqlash chegarasi (summa yoki maydon boʻyicha) oshib ketgani uchun ariza yuqori tashkilotga (${org}) avtomatik yuborildi. Hech narsa imzolanmadi va ariza hali IN_REVIEW holatida.`,
    approvedText: 'Ariza tasdiqlandi. Hisob-faktura yaratilgani uchun status endi INVOICED.',
    rejectedText: 'Ariza rad etildi.',
    takeReviewBtn: 'Koʻrib chiqishga olish',
    notReviewedYet: 'Ariza hali ijroga olinmagan. Buni ijrochi tashkilot xodimi (applications.review) bajaradi.',
    errorText: 'Xatolik',
    unassignedWarning: 'Bu darajada hali hech kim arizani ishga olmagan (assigned_user_id boʻsh).',
    approveBtn: 'Tasdiqlash',
    rejectBtn: 'Rad etish',
    decideOnlyHead: 'Qaror qabul qilish (tasdiqlash/rad etish) ijrochi tashkilot rahbari (applications.decide) vakolatida.',
    noActionsAllowed: 'Bu status boʻyicha hech qanday harakat mumkin emas.',
  },
  uz_cyrl: {
    panelTitle: 'Қарор ва ҳаракатлар',
    currentStatus: 'Жорий статус:',
    permit: 'Рухсатнома:',
    viewLink: 'Кўриш →',
    forwardedBold: 'Тасдиқланмади — юқори ташкилотга юборилди.',
    forwardedText: (org: string) =>
      `Ролингизнинг тасдиқлаш чегараси (сумма ёки майдон бўйича) ошиб кетгани учун ариза юқори ташкилотга (${org}) автоматик юборилди. Ҳеч нарса имзоланмади ва ариза ҳали IN_REVIEW ҳолатида.`,
    approvedText: 'Ариза тасдиқланди. Ҳисоб-фактура яратилгани учун статус энди INVOICED.',
    rejectedText: 'Ариза рад этилди.',
    takeReviewBtn: 'Кўриб чиқишга олиш',
    notReviewedYet: 'Ариза ҳали ижрога олинмаган. Буни ижрочи ташкилот ходими (applications.review) бажаради.',
    errorText: 'Хатолик',
    unassignedWarning: 'Бу даражада ҳали ҳеч ким аризани ишга олмаган (assigned_user_id бўш).',
    approveBtn: 'Тасдиқлаш',
    rejectBtn: 'Рад этиш',
    decideOnlyHead: 'Қарор қабул қилиш (тасдиқлаш/рад этиш) ижрочи ташкилот раҳбари (applications.decide) ваколатида.',
    noActionsAllowed: 'Бу статус бўйича ҳеч қандай ҳаракат мумкин эмас.',
  },
  ru: {
    panelTitle: 'Решение и действия',
    currentStatus: 'Текущий статус:',
    permit: 'Разрешение:',
    viewLink: 'Просмотр →',
    forwardedBold: 'Не утверждено — направлено в вышестоящую организацию.',
    forwardedText: (org: string) =>
      `Так как лимит утверждения вашей роли (по сумме или площади) превышен, заявление автоматически направлено в вышестоящую организацию (${org}). Подписание не производилось, заявление остается в статусе IN_REVIEW.`,
    approvedText: 'Заявление утверждено. Так как сформирован счет-фактура, статус изменен на INVOICED.',
    rejectedText: 'Заявление отклонено.',
    takeReviewBtn: 'Взять на рассмотрение',
    notReviewedYet: 'Заявление еще не взято в работу. Это действие сотрудника организации (applications.review).',
    errorText: 'Ошибка',
    unassignedWarning: 'На этом уровне заявление еще никто не взял в работу (assigned_user_id пуст).',
    approveBtn: 'Утвердить',
    rejectBtn: 'Отклонить',
    decideOnlyHead: 'Принятие решения (утверждение/отклонение) находится в полномочиях руководителя (applications.decide).',
    noActionsAllowed: 'Для данного статуса действия недоступны.',
  },
  en: {
    panelTitle: 'Decision and actions',
    currentStatus: 'Current status:',
    permit: 'Permit:',
    viewLink: 'View →',
    forwardedBold: 'Not approved — forwarded to parent organization.',
    forwardedText: (org: string) =>
      `Because your role's approval limit (by sum or area) was exceeded, the application was forwarded automatically to (${org}). Nothing was signed and the application remains in IN_REVIEW.`,
    approvedText: 'Application approved. Invoice generated, status changed to INVOICED.',
    rejectedText: 'Application rejected.',
    takeReviewBtn: 'Take for review',
    notReviewedYet: 'Application is not taken into work yet. Staff reviewer (applications.review) performs this.',
    errorText: 'Error',
    unassignedWarning: 'No one has assigned this application at this level yet (assigned_user_id is empty).',
    approveBtn: 'Approve',
    rejectBtn: 'Reject',
    decideOnlyHead: 'Making a decision (approve/reject) is restricted to head of organization (applications.decide).',
    noActionsAllowed: 'No actions are available for this status.',
  },
  kaa: {
    panelTitle: 'Sheshim hám háreketler',
    currentStatus: 'Házirgi status:',
    permit: 'Ruxsatnama:',
    viewLink: 'Kóriw →',
    forwardedBold: 'Tastıyıqlanbadı — joqarı turıwshı shólkemge jiberildi.',
    forwardedText: (org: string) =>
      `Rolińizdiń tastıyıqlaw shegarası (summa yamasa maydan boyınsha) asıp ketkeni sebepli arza joqarı turıwshı shólkemge (${org}) avtomatikalıq jiberildi. Hesh nárse qol qoyılmadı hám arza ele de IN_REVIEW halatında.`,
    approvedText: 'Arza tastıyıqlandı. Esap-faktura jaratılǵanı sebepli status endi INVOICED.',
    rejectedText: 'Arza biykar etildi.',
    takeReviewBtn: 'Kórip shıǵıwǵa alıw',
    notReviewedYet: 'Arza háli orınlawǵa alınbaǵan. Bunı orınlawshı shólkem xızmetkeri (applications.review) atqaradı.',
    errorText: 'Qátelik',
    unassignedWarning: 'Bul dárejede háli hesh kim arzanı iske almaǵan (assigned_user_id bos).',
    approveBtn: 'Tastıyıqlaw',
    rejectBtn: 'Biykar etiw',
    decideOnlyHead: 'Sheshim qabıl etiw (tastıyıqlaw/biykar etiw) orınlawshı shólkem basshısı (applications.decide) wákilliginde.',
    noActionsAllowed: 'Bul status boyınsha hesh qanday háreket múmkin emes.',
  },
};

export function DecisionPanel({ card }: { card: ApplicationCardOut }) {
  const { me } = useAuth();
  const { lang } = useLanguage();
  const t = useT();
  const tr = DECISION_PANEL_I18N[lang] ?? DECISION_PANEL_I18N.uz_latn;
  const errorText = useApiErrorText();
  const [modalMode, setModalMode] = useState<DecisionMode | null>(null);
  const [forwardedTo, setForwardedTo] = useState<string | null>(null);
  const [decided, setDecided] = useState<'approved' | 'rejected' | null>(null);

  const startReview = useStartReview(card.id);
  const approve = useApprove(card.id);
  const reject = useReject(card.id);

  const permitQuery = usePermitForApplication({
    applicationId: card.id,
    applicantId: card.applicant_id,
    contourId: card.contour_id,
    enabled: card.status === 'PAID' || card.status === 'PERMIT_ISSUED',
  });

  if (!me) return null;
  const canReview = me.is_superuser || me.permissions.includes(REVIEW_PERMISSION);
  const canDecide = me.is_superuser || me.permissions.includes(DECIDE_PERMISSION);

  // Rulings #181/#182: the leshoz's own verify/reject pair on the benefit
  // claim (`BenefitClaimPanel`) is a mandatory block before a decision —
  // `approve` refuses 409 `ERR-APP-004` (`reason="benefit_unverified"` /
  // `"benefit_rejected"`) exactly for these two statuses. Disabled here
  // proactively, matching the server's own refusal, rather than only
  // discovered from the error `SignDecisionModal` would otherwise show
  // after a wasted signature; `errorMessages.ts`'s own reason-aware
  // `ERR-APP-004` copy is the backstop for the race this button cannot see
  // (another reviewer decides the claim between render and click).
  const benefitPending = card.benefit_verification_status === 'pending';
  const benefitRejected = card.benefit_verification_status === 'rejected';
  const approveBlockedByBenefit = benefitPending || benefitRejected;

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

  function handleRejectSubmit(input: { pkcs7: string; reason_item_id: string; legal_basis: string | null }) {
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
        {tr.panelTitle}
      </h3>

      <div className="text-xs text-[#5A646D]">
        {tr.currentStatus} <span className="font-bold text-[#1A1F24]">{statusLabel(card.status, lang)}</span>
      </div>

      {permitQuery.data && (
        <div className="p-3 bg-[#F0F7F1] border border-[#D9EBDC] rounded-xl text-xs text-[#123522] flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <Award className="w-4 h-4 shrink-0" />
            {tr.permit} <strong className="font-mono">{formatPermitNumber(permitQuery.data.series, permitQuery.data.number)}</strong>
          </span>
          <Link to={`/permits/${permitQuery.data.id}`} className="font-bold text-[#2E7D4F] hover:underline whitespace-nowrap">
            {tr.viewLink}
          </Link>
        </div>
      )}

      {forwardedTo && (
        <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-xs text-[#92400E] flex items-start gap-2">
          <ArrowUpCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>{tr.forwardedBold}</strong> {tr.forwardedText(shortId(forwardedTo))}
          </span>
        </div>
      )}

      {decided === 'approved' && (
        <div className="p-3 bg-[#F0F7F1] border border-[#D9EBDC] rounded-xl text-xs text-[#123522] flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{tr.approvedText}</span>
        </div>
      )}
      {decided === 'rejected' && (
        <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl text-xs text-[#991B1B] flex items-start gap-2">
          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{tr.rejectedText}</span>
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
            {tr.takeReviewBtn}
          </Button>
        ) : (
          <p className="text-xs text-[#5A646D] bg-[#F8F9FA] p-3 rounded-xl border border-[#E4E7EA]">
            {tr.notReviewedYet}
          </p>
        ))}
      {startReview.error && (
        <p className="text-xs text-[#B91C1C]" role="alert">
          {startReview.error instanceof ApiError ? errorText(startReview.error) : tr.errorText}
        </p>
      )}

      {card.status === 'IN_REVIEW' &&
        (canDecide ? (
          <div className="space-y-2">
            {!card.assigned_user_id && (
              <p className="text-[11px] text-[#B45309] bg-[#FFFBEB] p-2 rounded-lg border border-[#FDE68A] flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {tr.unassignedWarning}
              </p>
            )}
            <Button
              variant="primary"
              fullWidth
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
              onClick={() => setModalMode('approve')}
              disabled={approveBlockedByBenefit}
              data-testid="approve-button"
            >
              {tr.approveBtn}
            </Button>
            {approveBlockedByBenefit && (
              <p className="text-[11px] text-[#B45309] bg-[#FFFBEB] p-2 rounded-lg border border-[#FDE68A]" role="status">
                {benefitPending
                  ? t('staff.decision.benefit.approveBlockedPending')
                  : `${t('staff.decision.benefit.approveBlockedRejectedPrefix')} ${card.benefit_rejection_reason ?? ''}`}
              </p>
            )}
            <Button
              variant="danger"
              fullWidth
              leftIcon={<XCircle className="w-4 h-4" />}
              onClick={() => setModalMode('reject')}
            >
              {tr.rejectBtn}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-[#5A646D] bg-[#F8F9FA] p-3 rounded-xl border border-[#E4E7EA]">
            {tr.decideOnlyHead}
          </p>
        ))}

      {card.status !== 'SUBMITTED' && card.status !== 'IN_REVIEW' && (
        <p className="text-xs text-[#5A646D] bg-[#F8F9FA] p-3 rounded-xl border border-[#E4E7EA]">
          {tr.noActionsAllowed}
        </p>
      )}

      {modalMode && (
        <SignDecisionModal
          mode={modalMode}
          applicationId={card.id}
          isSubmitting={modalMode === 'approve' ? approve.isPending : reject.isPending}
          error={modalMode === 'approve' ? approve.error : reject.error}
          benefitRejectionReason={benefitRejected ? card.benefit_rejection_reason : null}
          onClose={closeModal}
          onSubmitApprove={handleApproveSubmit}
          onSubmitReject={handleRejectSubmit}
        />
      )}
    </div>
  );
}
