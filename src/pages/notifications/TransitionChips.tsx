import { ArrowRight } from 'lucide-react';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { getStatusLabel, STATUS_BADGE_KIND } from '../applicant/statusMeta';
import type { ApplicationStatus } from '../applicant/api';
import { getPermitStatusLabel, PERMIT_STATUS_STYLE } from '../permits/statusMeta';

/** `notifications.params.status_from` / `status_to` — written by
 * `notifications.service.transition_params` on the backend for every flow
 * that moves the notification's own object (an application decision, a
 * permit suspension), absent for a reminder or a recalculation. Each object
 * type has its own vocabulary and its own badge, so the chips are drawn per
 * type; a type this file does not know shows nothing rather than a raw code. */
function transitionOf(params: Record<string, unknown>): { from: string | null; to: string } | null {
  const to = params.status_to;
  if (typeof to !== 'string' || !to) return null;
  const from = params.status_from;
  return { from: typeof from === 'string' && from ? from : null, to };
}

function ApplicationChip({ status, lang }: { status: string; lang: string }) {
  const kind = STATUS_BADGE_KIND[status as ApplicationStatus] ?? 'info';
  return <StatusBadge status={kind} label={getStatusLabel(status as ApplicationStatus, lang)} size="sm" showIcon={false} />;
}

function PermitChip({ status, lang }: { status: string; lang: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${
        PERMIT_STATUS_STYLE[status] ?? PERMIT_STATUS_STYLE.pending_signatures
      }`}
    >
      {getPermitStatusLabel(status, lang)}
    </span>
  );
}

export function TransitionChips({
  objectType,
  params,
  lang,
  testId,
}: {
  objectType: string | null;
  params: Record<string, unknown>;
  lang: string;
  testId: string;
}) {
  const transition = transitionOf(params);
  if (!transition) return null;
  const Chip = objectType === 'application' ? ApplicationChip : objectType === 'permit' ? PermitChip : null;
  if (!Chip) return null;
  return (
    <div data-testid={testId} className="flex items-center gap-1.5 flex-wrap mt-1.5">
      {transition.from && (
        <>
          <Chip status={transition.from} lang={lang} />
          <ArrowRight className="w-3.5 h-3.5 text-[#9AA3AB] shrink-0" aria-hidden="true" />
        </>
      )}
      <Chip status={transition.to} lang={lang} />
    </div>
  );
}
