import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Stamp } from 'lucide-react';
import { api } from '../api/client';
import { apiError } from '../api/errors';
import { useAuth } from '../auth/useAuth';
import { Alert } from '../components/ui/Feedback';
import { Button } from '../components/ui/button';
import { useLanguage } from '../i18n/useT';
import { PERMITS_ISSUE } from './permits/permissions';
import { toApiError } from './permits/apiErrorHelpers';
import { formatPermitNumber } from './permits/format';
import { PermitPdfPanel } from './permits/PermitPdfPanel';
import { PermitRequisitesPanel } from './permits/PermitRequisitesPanel';
import { PermitSignaturesPanel } from './permits/PermitSignaturesPanel';
import { PermitTimelinePanel } from './permits/PermitTimelinePanel';
import { PermitLifecyclePanel } from './permits/components/PermitLifecyclePanel';

const PERMIT_DOC_I18N = {
  uz_latn: {
    back: 'Orqaga',
    loading: 'Yuklanmoqda…',
    openErrorTitle: 'Ruxsatnoma ochilmadi',
    wrongZone: 'Bu ruxsatnoma sizning hudud vakolatingizga kirmaydi.',
    notFoundTitle: 'Bu ID boʻyicha ruxsatnoma hali mavjud emas',
    notFoundMsg: 'Agar bu toʻlangan arizaning IDsi boʻlsa, quyidan ruxsatnoma chiqarishingiz mumkin. Aks holda, ID notoʻgʻri boʻlishi mumkin.',
    issueBtn: 'Ruxsatnoma chiqarish',
    permit: 'Ruxsatnoma',
    application: 'Ariza',
  },
  uz_cyrl: {
    back: 'Орқага',
    loading: 'Юкланмоқда…',
    openErrorTitle: 'Рухсатнома очилмади',
    wrongZone: 'Бу рухсатнома сизнинг ҳудуд ваколатингизга кирмайди.',
    notFoundTitle: 'Бу ID бўйича рухсатнома ҳали мавжуд эмас',
    notFoundMsg: 'Агар бу тўланган аризанинг IDси бўлса, қуйидан рухсатнома чиқаришингиз мумкин. Акс ҳолда, ID нотўғри бўлиши мумкин.',
    issueBtn: 'Рухсатнома чиқариш',
    permit: 'Рухсатнома',
    application: 'Ариза',
  },
  ru: {
    back: 'Назад',
    loading: 'Загрузка…',
    openErrorTitle: 'Разрешение не открыто',
    wrongZone: 'Это разрешение вне вашей территориальной юрисдикции.',
    notFoundTitle: 'Разрешение по этому ID еще не существует',
    notFoundMsg: 'Если это ID оплаченного заявления, вы можете выдать разрешение ниже. В противном случае ID может быть неверным.',
    issueBtn: 'Выдать разрешение',
    permit: 'Разрешение',
    application: 'Заявление',
  },
  en: {
    back: 'Back',
    loading: 'Loading…',
    openErrorTitle: 'Failed to open permit',
    wrongZone: 'This permit is outside your territorial jurisdiction.',
    notFoundTitle: 'Permit with this ID does not exist yet',
    notFoundMsg: 'If this is the ID of a paid application, you can issue the permit below. Otherwise, the ID might be incorrect.',
    issueBtn: 'Issue permit',
    permit: 'Permit',
    application: 'Application',
  },
  kaa: {
    back: 'Artqa',
    loading: 'Júklenbekte…',
    openErrorTitle: 'Ruxsatnama ashılmadı',
    wrongZone: 'Bul ruxsatnama sizdiń aymaqlıq wákilligińizge kirmeydi.',
    notFoundTitle: 'Bul ID boyınsha ruxsatnama háli joq',
    notFoundMsg: 'Eger bul tólengen arzanıń IDsi bolsa, tómennen ruxsatnama shıǵarıwıńız múmkin. Bolmasa, ID nadurıs bolıwı múmkin.',
    issueBtn: 'Ruxsatnama shıǵarıw',
    permit: 'Ruxsatnama',
    application: 'Arza',
  },
};

/** Every reason `POST /applications/{id}/permit` documents refusing, turned
 *  into copy an operator can act on (`permits/service.py::issue`). */
function issueErrorMessage(err: ReturnType<typeof toApiError>, lang: string): string {
  const reason = (err.details as { reason?: string } | undefined)?.reason;
  const messages: Record<string, Record<string, string>> = {
    uz_latn: {
      unpaid: 'Ariza hali toʻlanmagan — ruxsatnoma faqat toʻlangan arizadan chiqariladi.',
      alreadyIssued: 'Bu ariza uchun ruxsatnoma allaqachon chiqarilgan.',
      outsideZone: 'Bu uchastka sizning hudud vakolatingizdan tashqarida.',
      noCalc: 'Ariza boʻyicha hisob-kitob topilmadi.',
      noTemplate: 'Bu faoliyat turi uchun ruxsatnoma shabloni sozlanmagan.',
      mismatchSubject: 'Hisob-kitob boshqa kontur/faoliyat turi uchun — nomuvofiqlik.',
      calcAfterDecision: 'Hisob-kitob qaror qabul qilingandan keyin yaratilgan — nomuvofiqlik.',
      appNotFound: 'Ariza topilmadi.',
      seriesError: 'Ruxsatnoma seriyasi sozlanmagan (tizim xatosi).',
    },
    uz_cyrl: {
      unpaid: 'Ариза ҳали тўланмаган — рухсатнома фақат тўланган аризадан чиқарилади.',
      alreadyIssued: 'Бу ариза учун рухсатнома аллақачон чиқарилган.',
      outsideZone: 'Бу участка сизнинг ҳудуд ваколатингиздан ташқарида.',
      noCalc: 'Ариза бўйича ҳисоб-китоб топилмади.',
      noTemplate: 'Бу фаолият тури учун рухсатнома шаблони созланмаган.',
      mismatchSubject: 'Ҳисоб-китоб бошқа контур/фаолият тури учун — номувофиқлик.',
      calcAfterDecision: 'Ҳисоб-китоб қарор қабул қилингандан keyin яратилган — номувофиқлик.',
      appNotFound: 'Ариза топилмади.',
      seriesError: 'Рухсатнома серияси созланмаган (тизим хатоси).',
    },
    ru: {
      unpaid: 'Заявление еще не оплачено — разрешение выдается только по оплаченному заявлению.',
      alreadyIssued: 'Разрешение по этому заявлению уже выдано.',
      outsideZone: 'Этот участок вне вашей территориальной юрисдикции.',
      noCalc: 'Расчет по заявлению не найден.',
      noTemplate: 'Шаблон разрешения для этого вида деятельности не настроен.',
      mismatchSubject: 'Расчет для другого контура/вида деятельности — несоответствие.',
      calcAfterDecision: 'Расчет создан после принятия решения — несоответствие.',
      appNotFound: 'Заявление не найдено.',
      seriesError: 'Серия разрешения не настроена (системная ошибка).',
    },
    en: {
      unpaid: 'Application is not paid yet — permit is issued only for paid applications.',
      alreadyIssued: 'Permit for this application has already been issued.',
      outsideZone: 'This parcel is outside your territorial jurisdiction.',
      noCalc: 'Calculation for application not found.',
      noTemplate: 'Permit template for this activity type is not configured.',
      mismatchSubject: 'Calculation is for another contour/activity type — mismatch.',
      calcAfterDecision: 'Calculation created after decision — mismatch.',
      appNotFound: 'Application not found.',
      seriesError: 'Permit series not configured (system error).',
    },
    kaa: {
      unpaid: 'Arza háli tólenbegan — ruxsatnama tek tólengen arzadan shıǵarıladı.',
      alreadyIssued: 'Bul arza ushın ruxsatnama álleqashan shıǵarılǵan.',
      outsideZone: 'Bul uchastka sizdiń aymaqlıq wákilligińizden tıs.',
      noCalc: 'Arza boyınsha esap-kitap tabılmadı.',
      noTemplate: 'Bul iskerlik túri ushın ruxsatnama shablonı sazlanbaǵan.',
      mismatchSubject: 'Esap-kitap basqa kontur/iskerlik túri ushın — sáykessizlik.',
      calcAfterDecision: 'Esap-kitap qarar qabıl etilgennen keyin jaratılǵan — sáykessizlik.',
      appNotFound: 'Arza tabılmadı.',
      seriesError: 'Ruxsatnama seriyası sazlanbaǵan (sistema qáteligi).',
    },
  };
  const m = messages[lang] || messages.uz_latn;
  if (err.code === 'ERR-PAY-001') return m.unpaid;
  if (err.code === 'ERR-PERM-001') return m.alreadyIssued;
  if (err.code === 'ERR-ACL-002') return m.outsideZone;
  if (err.code === 'ERR-VAL-001') {
    if (reason === 'no_calculation') return m.noCalc;
    if (reason === 'no_active_template') return m.noTemplate;
    if (reason === 'calculation_for_another_subject') return m.mismatchSubject;
    if (reason === 'calculation_after_decision') return m.calcAfterDecision;
    return err.message;
  }
  if (err.code === 'ERR-SYS-003') return m.appNotFound;
  if (err.code === 'ERR-SYS-001') return m.seriesError;
  return err.message;
}

export function PermitDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { me } = useAuth();
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const t = PERMIT_DOC_I18N[lang as keyof typeof PERMIT_DOC_I18N] || PERMIT_DOC_I18N.uz_latn;
  const [issueError, setIssueError] = useState<string | null>(null);

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

  const issueMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST('/api/v1/applications/{application_id}/permit', {
        params: { path: { application_id: id! } },
      });
      if (error) throw apiError(error);
      return data;
    },
    onSuccess: (permit) => {
      setIssueError(null);
      queryClient.setQueryData(['permit', permit.id], {
        ...permit,
        signatures: [],
        history: [
          {
            from_status: null,
            to_status: permit.status,
            reason_item_id: null,
            legal_basis: null,
            doc_file_id: null,
            changed_by: me?.user.id ?? null,
            occurred_at: permit.created_at,
          },
        ],
        missing_signatures: ['permit_head', 'permit_chief_forester', 'permit_accountant', 'permit_recipient'],
      });
      navigate(`/permits/${permit.id}`, { replace: true });
    },
    onError: (err: unknown) => setIssueError(issueErrorMessage(toApiError(err), lang)),
  });

  if (permitQuery.isLoading) {
    return <div className="text-sm text-[#5A646D]">{t.loading}</div>;
  }

  if (permitQuery.isError) {
    const e = toApiError(permitQuery.error);
    if (e.code !== 'ERR-SYS-003') {
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
                navigate('/permits');
              }
            }}
            className="text-[#2E7D4F] font-semibold hover:bg-[#F0F7F1] cursor-pointer"
          >
            {t.back}
          </Button>
          <Alert variant="danger" title={t.openErrorTitle}>
            {e.code === 'ERR-ACL-002' ? t.wrongZone : e.message}
          </Alert>
        </div>
      );
    }
    const canIssue = !!me?.permissions.includes(PERMITS_ISSUE) || !!me?.is_superuser;
    return (
      <div className="max-w-2xl mx-auto space-y-4 font-sans">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/permits');
            }
          }}
          className="text-[#2E7D4F] font-semibold hover:bg-[#F0F7F1] cursor-pointer"
        >
          {t.back}
        </Button>
        <Alert variant="info" title={t.notFoundTitle}>
          {t.notFoundMsg}
        </Alert>
        {issueError && <Alert variant="danger">{issueError}</Alert>}
        {canIssue && (
          <Button
            variant="primary"
            size="touch"
            fullWidth
            isLoading={issueMutation.isPending}
            leftIcon={<Stamp className="w-4 h-4" />}
            onClick={() => issueMutation.mutate()}
            className="bg-[#2E7D4F] hover:bg-[#23653F] text-white font-bold"
          >
            {t.issueBtn}
          </Button>
        )}
      </div>
    );
  }

  const permit = permitQuery.data!;

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans pb-16">
      <div className="flex items-center gap-2 border-b border-[#E4E7EA] pb-3">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/permits');
            }
          }}
          className="text-[#2E7D4F] font-semibold hover:bg-[#F0F7F1] cursor-pointer"
        >
          {t.back}
        </Button>
      </div>

      <div className="border-b border-[#E4E7EA] pb-4">
        <h1 className="text-2xl font-extrabold text-[#1A1F24] tracking-tight">
          {t.permit} {formatPermitNumber(permit.series, permit.number)}
        </h1>
        <p className="text-xs text-[#5A646D] mt-0.5">
          {t.application} <span className="font-mono text-[#1A1F24]">{permit.application_id}</span>
        </p>
      </div>

      <PermitRequisitesPanel permit={permit} />

      <PermitPdfPanel
        permitId={permit.id}
        fileName={`permit-${permit.series}-${String(permit.number).padStart(6, '0')}.pdf`}
        ready={!!permit.doc_hash}
      />

      <PermitSignaturesPanel
        permit={permit}
        onSigned={() => void queryClient.invalidateQueries({ queryKey: ['permit', id] })}
      />

      <PermitLifecyclePanel permit={permit} />

      <PermitTimelinePanel history={permit.history} />
    </div>
  );
}
