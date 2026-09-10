import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, PenTool } from 'lucide-react';
import { api } from '../api/client';
import { apiError } from '../api/errors';
import { Alert } from '../components/ui/Feedback';
import { Button } from '../components/ui/button';
import { toApiError } from './permits/apiErrorHelpers';
import { formatPermitNumber } from './permits/format';
import { PermitPdfPanel } from './permits/PermitPdfPanel';
import { PermitRatingPanel } from './permits/PermitRatingPanel';
import { PermitRequisitesPanel } from './permits/PermitRequisitesPanel';
import { PermitSignaturesPanel } from './permits/PermitSignaturesPanel';
import { useAuth } from '../auth/useAuth';
import { useApiErrorText } from '../i18n/useApiErrorText';
import { useLanguage } from '../i18n/useT';
import { getApplicationCard } from './applicant/api';
import { RECIPIENT_PURPOSE } from '../lib/eimzo';

const MY_PERMIT_PAGE_I18N = {
  uz_latn: {
    back: 'Orqaga',
    loading: 'Yuklanmoqda…',
    notFoundTitle: 'Ruxsatnoma topilmadi',
    notFoundMsg: 'Bunday ruxsatnoma mavjud emas yoki sizga tegishli emas.',
    permit: 'Ruxsatnoma',
    pendingSigTitle: 'Barcha imzolar hali qoʻyilmagan',
    pendingSigMsg:
      'Ruxsatnoma hujjati shakllantirilgan va toʻlov qabul qilingan, lekin u faqat toʻrtta imzoning barchasi qoʻyilgach kuchga kiradi. Quyida qaysi imzolar qoʻyilganini koʻrishingiz mumkin.',
    // Stage 10, F1 — ruling #183: the holder's own signature, for an
    // `on_behalf='self'` filing — a plain button, no envelope.
    holderSignTitle: 'Ruxsatnomani imzolash',
    holderSignDesc:
      'Siz ushbu ruxsatnoma egasisiz. Uni kuchga kiritish uchun quyidagi tugmani bosing — elektron imzo talab qilinmaydi.',
    holderSignButton: 'Imzolash',
  },
  uz_cyrl: {
    back: 'Орқага',
    loading: 'Юкланмоқда…',
    notFoundTitle: 'Рухсатнома топилмади',
    notFoundMsg: 'Бундай рухсатнома мавжуд эмас ёки сизга тегишли эмас.',
    permit: 'Рухсатнома',
    pendingSigTitle: 'Барча имзолар ҳали қўйилмаган',
    pendingSigMsg:
      'Рухсатнома ҳужжати шакллантирилган ва тўлов қабул қилинган, лекин у фақат тўртта имзонинг барчаси қўйилгач кучга киради. Қуйида қайси имзолар қўйилганини кўришингиз мумкин.',
    holderSignTitle: 'Рухсатномани имзолаш',
    holderSignDesc:
      'Сиз ушбу рухсатнома эгасисиз. Уни кучга киритиш учун қуйидаги тугмани босинг — электрон имзо талаб қилинмайди.',
    holderSignButton: 'Имзолаш',
  },
  ru: {
    back: 'Назад',
    loading: 'Загрузка…',
    notFoundTitle: 'Разрешение не найдено',
    notFoundMsg: 'Такое разрешение не существует или вам не принадлежит.',
    permit: 'Разрешение',
    pendingSigTitle: 'Не все подписи еще проставлены',
    pendingSigMsg:
      'Документ разрешения сформирован и оплата принята, но он вступает в силу только после проставления всех четырех подписей. Ниже вы можете увидеть статус каждой подписи.',
    holderSignTitle: 'Подписание разрешения',
    holderSignDesc:
      'Вы являетесь владельцем этого разрешения. Чтобы оно вступило в силу, нажмите кнопку ниже — электронная подпись не требуется.',
    holderSignButton: 'Подписать',
  },
  en: {
    back: 'Back',
    loading: 'Loading…',
    notFoundTitle: 'Permit not found',
    notFoundMsg: 'Such permit does not exist or does not belong to you.',
    permit: 'Permit',
    pendingSigTitle: 'All signatures are not yet placed',
    pendingSigMsg:
      'The permit document has been generated and payment accepted, but it takes effect only after all four signatures are placed. Below you can see which signatures have been placed.',
    holderSignTitle: 'Sign the permit',
    holderSignDesc:
      'You are the holder of this permit. Press the button below to bring it into force — no electronic signature is required.',
    holderSignButton: 'Sign',
  },
  kaa: {
    back: 'Artqa',
    loading: 'Júklenbekte…',
    notFoundTitle: 'Ruxsatnama tabılmadı',
    notFoundMsg: 'Bunday ruxsatnama joq yamasa sizge tiyisli emes.',
    permit: 'Ruxsatnama',
    pendingSigTitle: 'Barlıq qol qoyıwlar háli qoyılmaǵan',
    pendingSigMsg:
      'Ruxsatnama hújjeti qáliplestirilgen hám tólem qabıllanǵan, biraq ol tek tórt qol qoyıwdıń barlıǵı qoyılǵannan soń kúshke kiredi. Tómende qaysı qol qoyıwlar qoyılǵanın kóriwińiz múmkin.',
    holderSignTitle: 'Ruxsatnamaǵa qol qoyıw',
    holderSignDesc:
      'Siz usı ruxsatnama iyesisiz. Onı kúshke kirgiziw ushın tómendegi túymeni basıń — elektron qol tańba talap etilmeydi.',
    holderSignButton: 'Qol qoyıw',
  },
};

/**
 * B10 — the applicant's own permit: view, download the PDF, sign with ERI.
 */
export function MyPermitPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { me } = useAuth();
  const { lang } = useLanguage();
  const t = MY_PERMIT_PAGE_I18N[lang as keyof typeof MY_PERMIT_PAGE_I18N] || MY_PERMIT_PAGE_I18N.uz_latn;
  const errorText = useApiErrorText();
  const queryClient = useQueryClient();

  const permitQuery = useQuery({
    queryKey: ['permit', id],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/permits/{permit_id}', {
        params: { path: { permit_id: id! } },
      });
      if (error) throw apiError(error);
      return data;
    },
    enabled: !!id,
    retry: false,
  });

  // Ruling #183: whether this permit's application was filed `on_behalf=
  // 'self'` decides how the HOLDER'S OWN line is signed — a plain button
  // with no envelope, versus the legal entity's unchanged ERI flow inside
  // `PermitSignaturesPanel`. Fetched only once the permit itself is known.
  const applicationQuery = useQuery({
    queryKey: ['application-for-permit', permitQuery.data?.application_id],
    queryFn: () => getApplicationCard(permitQuery.data!.application_id),
    enabled: !!permitQuery.data?.application_id,
  });

  const [holderSignError, setHolderSignError] = useState<string | null>(null);
  const holderSignMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST('/api/v1/permits/{permit_id}/signatures', {
        params: { path: { permit_id: id! } },
        body: { purpose: RECIPIENT_PURPOSE },
      });
      if (error) throw apiError(error);
      return data;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['permit', id] }),
    onError: (err: unknown) => setHolderSignError(errorText(toApiError(err))),
  });

  if (permitQuery.isLoading) {
    return <div className="text-sm text-[#5A646D]">{t.loading}</div>;
  }
  if (permitQuery.isError) {
    const e = toApiError(permitQuery.error);
    return (
      <div className="max-w-4xl mx-auto space-y-4 font-sans">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/my/permits');
            }
          }}
          className="text-[#2E7D4F] font-semibold hover:bg-[#F0F7F1] cursor-pointer"
        >
          {t.back}
        </Button>
        <Alert variant="danger" title={t.notFoundTitle}>
          {e.code === 'ERR-SYS-003' ? t.notFoundMsg : e.message}
        </Alert>
      </div>
    );
  }

  const permit = permitQuery.data!;
  const isPendingSignatures = permit.status === 'pending_signatures';
  const onBehalfSelf = applicationQuery.data?.on_behalf === 'self';
  const holderSigned = permit.signatures.some(
    (s) => s.purpose === RECIPIENT_PURPOSE && s.verification_status === 'valid',
  );
  const holderMissing = permit.missing_signatures.includes(RECIPIENT_PURPOSE);
  // Ruling #183: a `self` filing never meets the ERI dialog `PermitSignaturesPanel`
  // (F3's own file, untouched here) still renders for the holder purpose —
  // the plain-button panel below is the ONLY way to sign it, so that row is
  // hidden from `missing_signatures` here rather than shown twice, in two
  // different shapes, for the same action. Signed rows still render there
  // normally: `SignatureSlot` reads `permit.signatures` for that branch,
  // unaffected by this filtered copy.
  const permitForPanel =
    onBehalfSelf && holderMissing
      ? { ...permit, missing_signatures: permit.missing_signatures.filter((p) => p !== RECIPIENT_PURPOSE) }
      : permit;

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 font-sans pb-16">
      <div className="flex items-center gap-2 border-b border-[#E4E7EA] pb-3">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/my/permits');
            }
          }}
          className="text-[#2E7D4F] font-semibold hover:bg-[#F0F7F1] cursor-pointer"
        >
          {t.back}
        </Button>
      </div>

      <div className="border-b border-[#E4E7EA] pb-4">
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#1A1F24] tracking-tight break-all sm:break-normal">
          {t.permit} {formatPermitNumber(permit.series, permit.number)}
        </h1>
      </div>

      {isPendingSignatures && (
        <Alert variant="warning" title={t.pendingSigTitle}>
          {t.pendingSigMsg}
        </Alert>
      )}

      <PermitRequisitesPanel
        permit={permit}
        applicantName={me?.applicant && me.applicant.id === permit.applicant_id ? me.applicant.name : null}
      />

      <PermitPdfPanel
        permitId={permit.id}
        fileName={`permit-${permit.series}-${String(permit.number).padStart(6, '0')}.pdf`}
        ready={!!permit.doc_hash}
      />

      {/* Ruling #183: the holder's own signature for a `self` filing — a
          plain button, no envelope, no E-IMZO dialog. `src/pages/permits/**`
          (F3's own PermitSignaturesPanel below) stays untouched; this panel
          is this track's own, and disappears once the row is signed. */}
      {onBehalfSelf && holderMissing && !holderSigned && (
        <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-3">
          <h2 className="text-base font-bold text-[#1A1F24]">{t.holderSignTitle}</h2>
          <p className="text-xs text-[#5A646D]">{t.holderSignDesc}</p>
          {holderSignError && <Alert variant="danger">{holderSignError}</Alert>}
          <Button
            variant="primary"
            size="lg"
            leftIcon={<PenTool className="w-5 h-5" />}
            isLoading={holderSignMutation.isPending}
            onClick={() => {
              setHolderSignError(null);
              holderSignMutation.mutate();
            }}
            className="cursor-pointer font-bold"
          >
            {t.holderSignButton}
          </Button>
        </div>
      )}

      <PermitSignaturesPanel
        permit={permitForPanel}
        onSigned={() => void queryClient.invalidateQueries({ queryKey: ['permit', id] })}
      />

      <PermitRatingPanel permitId={permit.id} rating={permit.rating ?? null} status={permit.status} />
    </div>
  );
}
