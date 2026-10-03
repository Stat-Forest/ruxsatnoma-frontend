import { useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api/client';
import { apiError } from '../api/errors';
import { Alert } from '../components/ui/Feedback';
import { Button } from '../components/ui/button';
import { toApiError } from './permits/apiErrorHelpers';
import { formatPermitNumber } from './permits/format';
import { PermitPdfPanel } from './permits/PermitPdfPanel';
import { PermitRatingPanel } from './permits/PermitRatingPanel';
import { PermitRequisitesPanel } from './permits/PermitRequisitesPanel';
import { ContourBoundaryPanel } from './gis/ContourBoundaryPanel';
import { PermitSignaturesPanel } from './permits/PermitSignaturesPanel';
import { useAuth } from '../auth/useAuth';
import { useLanguage } from '../i18n/useT';

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
  // Ruling #210: the holder signs nothing on the permit — their only signature
  // is the one over the application at filing. The panel below is read-only
  // for them: three leshoz lines, each waiting or signed.

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

      <ContourBoundaryPanel contourId={permit.contour_id} />

      <PermitPdfPanel
        permitId={permit.id}
        fileName={`permit-${permit.series}-${String(permit.number).padStart(6, '0')}.pdf`}
        ready={!!permit.doc_hash}
      />

      <PermitSignaturesPanel
        permit={permit}
        onSigned={() => void queryClient.invalidateQueries({ queryKey: ['permit', id] })}
      />

      <PermitRatingPanel permitId={permit.id} rating={permit.rating ?? null} status={permit.status} />
    </div>
  );
}
