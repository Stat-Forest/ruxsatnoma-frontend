import { useParams, Link } from 'react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { ApiError } from '../../api/errors';
import { useApplicationCard, useApplicationTimeline } from './queries';
import { formatDateTime, statusLabel } from './format';
import { GeneralInfoPanel } from './components/GeneralInfoPanel';
import { ChecksPanel } from './components/ChecksPanel';
import { GisConclusionPanel } from './components/GisConclusionPanel';
import { CalculationPanel } from './components/CalculationPanel';
import { DocumentsPanel } from './components/DocumentsPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { DecisionPanel } from './components/DecisionPanel';

/**
 * The staff application card (D2/E2, `docs/plans/06-frontend-screens.md`).
 * Reached from the worklist or, for `executor_head` (who holds
 * `applications.decide` but not `applications.review` and therefore never
 * sees the worklist route itself), by a direct link — `routes.tsx` carries no
 * permission gate on `applications/:id` for exactly that reason.
 */
export function StaffApplicationCard() {
  const { id } = useParams<{ id: string }>();
  const cardQuery = useApplicationCard(id ?? '');
  const timelineQuery = useApplicationTimeline(id ?? '');

  if (!id) return null;

  if (cardQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-[#5A646D]" data-testid="staff-card-loading">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Yuklanmoqda...
      </div>
    );
  }

  if (cardQuery.error) {
    const err = cardQuery.error;
    return (
      <div className="p-6 bg-[#FEF2F2] border border-[#FCA5A5] rounded-2xl text-sm text-[#991B1B]" role="alert">
        {err instanceof ApiError ? `${err.code}: ${err.message}` : "Ariza yuklanmadi."}
      </div>
    );
  }

  const card = cardQuery.data;
  if (!card) return null;

  return (
    <div className="space-y-6" data-testid="staff-application-card-page">
      <div className="flex items-center gap-2 text-xs text-[#5A646D] border-b border-[#E4E7EA] pb-3">
        <Link to="/applications" className="inline-flex items-center gap-1.5 text-[#2E7D4F] font-bold hover:underline">
          <ArrowLeft className="w-4 h-4" /> Arizalar roʻyxatiga qaytish
        </Link>
        <span>/</span>
        <span className="font-semibold text-[#1A1F24]">Ariza kartochkasi ({card.number ?? card.id})</span>
      </div>

      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs flex flex-wrap items-center gap-4">
        <h1 className="font-mono text-2xl font-extrabold text-[#1A1F24] tracking-tight">
          {card.number ?? '(raqamsiz)'}
        </h1>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD]">
          {statusLabel(card.status)}
        </span>
        {card.submitted_at && (
          <span className="text-xs text-[#5A646D]">Topshirilgan: {formatDateTime(card.submitted_at)}</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <GeneralInfoPanel card={card} />
          <CalculationPanel card={card} />
          <ChecksPanel card={card} />
          <DocumentsPanel card={card} />
          {timelineQuery.data && <HistoryPanel timeline={timelineQuery.data} />}
        </div>

        <div className="space-y-4">
          <GisConclusionPanel card={card} />
          <DecisionPanel card={card} />
        </div>
      </div>
    </div>
  );
}
