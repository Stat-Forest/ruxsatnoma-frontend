import { AlertTriangle, CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import { CHECK_TYPE_LABELS, type NormalizedCheck } from '../checkTypeLabels';

const ICON_BY_RESULT: Record<string, typeof CheckCircle2> = {
  pass: CheckCircle2,
  fail: XCircle,
  warning: AlertTriangle,
  skipped: MinusCircle,
};

const COLOR_BY_RESULT: Record<string, string> = {
  pass: 'text-[#15803D] bg-[#F0F7F1] border-[#D9EBDC]',
  fail: 'text-[#B91C1C] bg-[#FEF2F2] border-[#FCA5A5]',
  warning: 'text-[#B45309] bg-[#FFFBEB] border-[#FDE68A]',
  skipped: 'text-[#5A646D] bg-[#F8F9FA] border-[#E4E7EA]',
};

/** Renders checks as evidence, exactly the way the backend means it: a
 * `fail` here is DATA in a 200 response (design/03), not a crash — shared by
 * the wizard's live price preview and its official precheck step, so the
 * two never describe a check differently. Callers normalize their own
 * endpoint's shape first — `fromApplicationChecks`/`fromPreviewChecks`,
 * re-exported above from `checkTypeLabels.ts` (see its own comment for why
 * the two endpoints cannot share one shape). */
export function ChecksList({ checks }: { checks: NormalizedCheck[] }) {
  if (checks.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {checks.map((check) => {
        const Icon = ICON_BY_RESULT[check.result] ?? MinusCircle;
        return (
          <li
            key={check.key}
            className={`flex items-start gap-2 text-xs p-2 rounded-lg border ${COLOR_BY_RESULT[check.result] ?? COLOR_BY_RESULT.skipped}`}
          >
            <Icon className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">{CHECK_TYPE_LABELS[check.type] ?? check.type}</span>
              {check.details !== null && check.details !== undefined && (
                <span className="block text-[11px] opacity-80 mt-0.5">
                  {typeof check.details === 'string'
                    ? check.details
                    : Object.keys(check.details as object).length > 0
                      ? JSON.stringify(check.details)
                      : null}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
