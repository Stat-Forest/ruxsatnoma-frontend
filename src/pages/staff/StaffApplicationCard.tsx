import { useParams, Link } from 'react-router';
import { ArrowLeft, Loader2, PauseCircle } from 'lucide-react';
import { useLanguage, useT } from '../../i18n/useT';
import { ApiError } from '../../api/errors';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { useApplicationCard, useApplicationTimeline } from './queries';
import { formatDateTime, slaStatus, statusLabel } from './format';
import { GeneralInfoPanel } from './components/GeneralInfoPanel';
import { ChecksPanel } from './components/ChecksPanel';
import { ConclusionsPanel } from './components/ConclusionsPanel';
import { CalculationPanel } from './components/CalculationPanel';
import { DocumentsPanel } from './components/DocumentsPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { DecisionPanel } from './components/DecisionPanel';
import { ReviewActionsPanel } from './components/ReviewActionsPanel';
import { BenefitClaimPanel } from './components/BenefitClaimPanel';
import { ContourBoundaryPanel } from '../gis/ContourBoundaryPanel';

const STAFF_CARD_I18N = {
  uz_latn: {
    backToList: 'Arizalar roʻyxatiga qaytish',
    backToSearch: 'Qidiruvga qaytish',
    cardTitle: 'Ariza kartochkasi',
    noNumber: '(raqamsiz)',
    loading: 'Yuklanmoqda...',
    loadError: 'Ariza yuklanmadi.',
    notFoundOrNoOrg: 'Ariza topilmadi yoki unga tashkilot biriktirilmagan.',
    notFoundOrNoOrgDesc: 'Ushbu ariza qoralama holatida boʻlishi yoki masʼul tashkilotga yoʻnaltirilmagan boʻlishi mumkin.',
    submittedAt: 'Topshirilgan:',
  },
  uz_cyrl: {
    backToList: 'Аризалар рўйхатига қайтиш',
    backToSearch: 'Қидирувга қайтиш',
    cardTitle: 'Ариза карточкаси',
    noNumber: '(рақамсиз)',
    loading: 'Юкланмоқда...',
    loadError: 'Ариза юкланмади.',
    notFoundOrNoOrg: 'Ариза топилмади ёки унга ташкилот бириктирилмаган.',
    notFoundOrNoOrgDesc: 'Ушбу ариза қоралама ҳолатида бўлиши ёки масъул ташкилотга йўналтирилмаган бўлиши мумкин.',
    submittedAt: 'Топширилган:',
  },
  ru: {
    backToList: 'Назад к списку заявлений',
    backToSearch: 'Назад к поиску',
    cardTitle: 'Карточка заявления',
    noNumber: '(без номера)',
    loading: 'Загрузка...',
    loadError: 'Не удалось загрузить заявление.',
    notFoundOrNoOrg: 'Заявление не найдено или к нему не привязана организация.',
    notFoundOrNoOrgDesc: 'Данное заявление может находиться в статусе черновика или ещё не направлено в организацию.',
    submittedAt: 'Подано:',
  },
  en: {
    backToList: 'Back to applications list',
    backToSearch: 'Back to search',
    cardTitle: 'Application card',
    noNumber: '(no number)',
    loading: 'Loading...',
    loadError: 'Failed to load application.',
    notFoundOrNoOrg: 'Application not found or no organization assigned.',
    notFoundOrNoOrgDesc: 'This application might be in draft status or not yet routed to an organization.',
    submittedAt: 'Submitted:',
  },
  kaa: {
    backToList: 'Arzalar dizimine qaytıw',
    backToSearch: 'İzlewge qaytıw',
    cardTitle: 'Arza kartochkası',
    noNumber: '(nómersiz)',
    loading: 'Júklenbekte...',
    loadError: 'Arza júklenbedi.',
    notFoundOrNoOrg: 'Arza tabılmadı yamasa oǵan shólkem biriktirilmegen.',
    notFoundOrNoOrgDesc: 'Bul arza dáslepki nusqa jaǵdayında bolıwı yamasa juwapker shólkemge jiberilmegen bolıwı múmkin.',
    submittedAt: 'Tapsırılǵan:',
  },
};

/**
 * The staff application card (D2/E2, `docs/plans/06-frontend-screens.md`).
 * Reached from the worklist or, for `executor_head` (who holds
 * `applications.decide` but not `applications.review` and therefore never
 * sees the worklist route itself), by a direct link — `routes.tsx` carries no
 * permission gate on `applications/:id` for exactly that reason.
 */
export function StaffApplicationCard() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const { lang } = useLanguage();
  const tr = STAFF_CARD_I18N[lang] ?? STAFF_CARD_I18N.uz_latn;
  const errorText = useApiErrorText();
  const cardQuery = useApplicationCard(id ?? '');
  const timelineQuery = useApplicationTimeline(id ?? '');

  if (!id) return null;

  if (cardQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-[#5A646D]" data-testid="staff-card-loading">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> {tr.loading}
      </div>
    );
  }

  if (cardQuery.error) {
    const err = cardQuery.error;
    const isNotFound = err instanceof ApiError && err.code === 'ERR-SYS-003';
    return (
      <div className="space-y-4" data-testid="staff-card-error">
        <div className="flex items-center gap-2 text-xs text-[#5A646D] border-b border-[#E4E7EA] pb-3">
          <Link to="/applications" className="inline-flex items-center gap-1.5 text-[#2E7D4F] font-bold hover:underline">
            <ArrowLeft className="w-4 h-4" /> {tr.backToList}
          </Link>
          <span>/</span>
          <Link to="/search" className="inline-flex items-center gap-1.5 text-[#2E7D4F] font-bold hover:underline">
            {tr.backToSearch}
          </Link>
        </div>
        <div className="p-6 bg-[#FEF2F2] border border-[#FCA5A5] rounded-2xl text-sm text-[#991B1B]" role="alert">
          <p className="font-semibold">{isNotFound ? tr.notFoundOrNoOrg : (err instanceof ApiError ? errorText(err) : tr.loadError)}</p>
          {isNotFound && (
            <p className="text-xs text-[#7F1D1D] mt-1.5">
              {tr.notFoundOrNoOrgDesc}
            </p>
          )}
        </div>
      </div>
    );
  }

  const card = cardQuery.data;
  if (!card) return null;

  return (
    <div className="space-y-6" data-testid="staff-application-card-page">
      <div className="flex items-center gap-2 text-xs text-[#5A646D] border-b border-[#E4E7EA] pb-3">
        <Link to="/applications" className="inline-flex items-center gap-1.5 text-[#2E7D4F] font-bold hover:underline">
          <ArrowLeft className="w-4 h-4" /> {tr.backToList}
        </Link>
        <span>/</span>
        <span className="font-semibold text-[#1A1F24]">{tr.cardTitle} ({card.number ?? card.id})</span>
      </div>

      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs flex flex-wrap items-center gap-4">
        <h1 className="font-mono text-2xl font-extrabold text-[#1A1F24] tracking-tight">
          {card.number ?? tr.noNumber}
        </h1>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD]">
          {statusLabel(card.status, lang)}
        </span>
        {(() => {
          // `card.sla_overdue` is the AUTHORITATIVE, pause-aware answer
          // (`sla.is_overdue`) — preferred over recomputing from the raw
          // deadline, which is exactly what would misreport a paused clock
          // as overdue (`docs/status.md`'s own fact #1; `slaStatus`'s own
          // docstring).
          const sla = slaStatus(card.status, card.sla_deadline_at, card.sla_overdue);
          if (sla === 'paused') {
            return (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD]">
                <PauseCircle className="w-3.5 h-3.5" /> {t('staff.infoRequest.slaPausedBadge')}
              </span>
            );
          }
          if (!card.sla_deadline_at) return null;
          return (
            <span
              className={`text-xs font-mono ${
                sla === 'overdue' ? 'text-[#B91C1C] font-bold' : sla === 'soon' ? 'text-[#B45309] font-bold' : 'text-[#5A646D]'
              }`}
            >
              SLA: {formatDateTime(card.sla_deadline_at)}
            </span>
          );
        })()}
        {card.submitted_at && (
          <span className="text-xs text-[#5A646D]">{tr.submittedAt} {formatDateTime(card.submitted_at)}</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <GeneralInfoPanel card={card} />
          <CalculationPanel card={card} />
          <ContourBoundaryPanel contourId={card.contour_id} />
          <ChecksPanel card={card} />
          <DocumentsPanel card={card} />
          {timelineQuery.data && <HistoryPanel timeline={timelineQuery.data} />}
        </div>

        <div className="space-y-4">
          <ReviewActionsPanel card={card} timeline={timelineQuery.data} />
          <BenefitClaimPanel card={card} />
          <ConclusionsPanel card={card} />
          <DecisionPanel card={card} />
        </div>
      </div>
    </div>
  );
}
