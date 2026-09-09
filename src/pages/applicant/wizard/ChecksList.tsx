import { AlertTriangle, CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import { useT } from '../../../i18n/useT';
import { getCheckResultLabel, getCheckTypeLabel, type NormalizedCheck } from '../checkTypeLabels';

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

/** `"50.0"` -> `"50"`, `"12.50"` -> `"12,5"` — the trailing-zero trim every
 *  other decimal display in this app already applies (`permits/format.ts`'s
 *  own `formatDecimal`), duplicated here per this track's own convention of
 *  not reaching into a sibling track's file for a four-line helper. */
function trimSbNumber(value: string | number): string {
  const str = String(value);
  const trimmed = str.includes('.') ? str.replace(/0+$/, '').replace(/\.$/, '') : str;
  return (trimmed || '0').replace('.', ',');
}

/** F3 (`docs/plans/07.3-findings.md`) — three of the nine automatic checks
 *  carry a `details` object meant for a developer reading a log, not for the
 *  applicant reading this screen: `{"reason":"layer_empty"}`,
 *  `{"reason":"no_season_defined"}`, and the MaxSB load object. Each is
 *  turned into the one sentence an applicant can actually act on; anything
 *  this function does not recognise is left unsaid rather than dumped as
 *  JSON — the check's own icon, label and result already state the verdict,
 *  and an unreadable technical aside is worse than no aside at all. */
function detailNote(check: NormalizedCheck, t: (key: string) => string): string | null {
  const { type, details } = check;
  if (typeof details === 'string') return details;
  if (typeof details !== 'object' || details === null) return null;
  const d = details as Record<string, unknown>;

  if ((type === 'gis_within_fund') && d.reason === 'layer_empty') {
    return t('wizard.checks.layerEmpty');
  }
  if ((type === 'norm_season' || type === 'season') && d.reason === 'no_season_defined') {
    return t('wizard.checks.noSeason');
  }
  if ((type === 'norm_limit' || type === 'limit') && (d.max_sb !== undefined || d.used_sb !== undefined)) {
    const used = d.used_sb !== undefined && d.used_sb !== null ? trimSbNumber(d.used_sb as string | number) : null;
    const max = d.max_sb !== undefined && d.max_sb !== null ? trimSbNumber(d.max_sb as string | number) : null;
    const remaining =
      d.remaining_sb !== undefined && d.remaining_sb !== null ? trimSbNumber(d.remaining_sb as string | number) : null;
    if (used !== null && max !== null) {
      return remaining !== null
        ? t('wizard.checks.loadDetails')
            .replace('{used}', used)
            .replace('{max}', max)
            .replace('{remaining}', remaining)
        : t('wizard.checks.loadDetailsNoRemaining')
            .replace('{used}', used)
            .replace('{max}', max);
    }
  }
  return null;
}

/** Renders checks as evidence, exactly the way the backend means it: a
 * `fail` here is DATA in a 200 response (design/03), not a crash — shared by
 * the wizard's live price preview and its official precheck step, so the
 * two never describe a check differently. Callers normalize their own
 * endpoint's shape first — `fromApplicationChecks`/`fromPreviewChecks`,
 * re-exported above from `checkTypeLabels.ts` (see its own comment for why
 * the two endpoints cannot share one shape). */
export function ChecksList({ checks }: { checks: NormalizedCheck[] }) {
  const t = useT();
  if (checks.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {checks.map((check) => {
        const Icon = ICON_BY_RESULT[check.result] ?? MinusCircle;
        const note = detailNote(check, t);
        const typeLabel = getCheckTypeLabel(check.type, t);
        const resultLabel = getCheckResultLabel(check.result, t);
        return (
          <li
            key={check.key}
            className={`flex items-start gap-2 text-xs p-2 rounded-lg border ${COLOR_BY_RESULT[check.result] ?? COLOR_BY_RESULT.skipped}`}
            title={resultLabel}
          >
            <Icon className="w-4 h-4 shrink-0 mt-0.5" aria-label={resultLabel} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">{typeLabel}</span>
                <span className="text-[10px] font-bold opacity-75">{resultLabel}</span>
              </div>
              {note && <span className="block text-[11px] opacity-80 mt-0.5">{note}</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
