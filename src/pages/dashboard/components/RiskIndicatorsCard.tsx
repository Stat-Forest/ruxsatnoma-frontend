import { ShieldAlert } from 'lucide-react';
import { DashboardCard, EmptyPanel } from './DashboardCard';

/**
 * The neutral-to-alarming 4-step badge palette for a risk level, shared by
 * this card and (Task 2) `oversight/OversightPage.tsx`'s own level badges —
 * the two screens must agree pixel-for-pixel on what "high" looks like, so
 * these exact hex values are the ones to copy, not approximate. `low` and
 * `critical` reuse this codebase's existing neutral/danger tones verbatim
 * (`DashboardCard.tsx::CardBadge`'s neutral palette, `Feedback.tsx`'s Alert
 * danger palette); `medium` reuses the existing warning tone; `high` is the
 * one genuinely new step, sitting between them.
 */
const RISK_LEVEL_BADGE_CLASS: Record<string, string> = {
  low: 'bg-[#F8F9FA] text-[#5A646D] border-[#E4E7EA]',
  medium: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
  high: 'bg-[#FFEDD5] text-[#C2410C] border-[#FDBA74]',
  critical: 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]',
};

const LEVEL_ORDER = ['low', 'medium', 'high', 'critical'];

/** `low`/`medium`/`high`/`critical` are generic words with an unambiguous
 *  translation, unlike `RI-01`..`RI-15` (a domain code whose meaning is not
 *  known here — rendered raw on purpose, never guessed at). */
const LEVEL_LABEL_KEY: Record<string, string> = {
  low: 'leadership.dash.risk.level.low',
  medium: 'leadership.dash.risk.level.medium',
  high: 'leadership.dash.risk.level.high',
  critical: 'leadership.dash.risk.level.critical',
};

/**
 * `KpiOut.risk_indicators`'s two breakdowns for the period — `by_code` (which
 * `RI-01`..`RI-15` fired) and `by_level` (how severe). Presentational only:
 * it takes its data as props and fetches nothing itself, so Task 2 can add a
 * "open the full register" link (once `/oversight` exists) without touching
 * this component's data layer.
 */
export function RiskIndicatorsCard({
  byCode,
  byLevel,
  t,
}: {
  byCode: Record<string, number>;
  byLevel: Record<string, number>;
  t: (key: string) => string;
}) {
  const codeRows = Object.entries(byCode).sort(([a], [b]) => a.localeCompare(b));
  const levelRows = LEVEL_ORDER.filter((level) => level in byLevel).map((level) => [level, byLevel[level]] as const);
  // A level this fixed order does not know about (a future backend addition)
  // still renders — appended, in a neutral badge — rather than being dropped.
  const extraLevelRows = Object.entries(byLevel).filter(([level]) => !LEVEL_ORDER.includes(level));

  const isEmpty = codeRows.length === 0 && levelRows.length === 0 && extraLevelRows.length === 0;

  return (
    <DashboardCard title={t('leadership.dash.risk.title')} icon={ShieldAlert}>
      {isEmpty ? (
        <EmptyPanel testId="risk-empty">{t('leadership.dash.risk.empty')}</EmptyPanel>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ul data-testid="risk-by-code" className="space-y-1.5">
            {codeRows.map(([code, count]) => (
              <li key={code} className="flex items-center justify-between text-sm text-[#1A1F24]">
                <span className="font-mono text-xs text-[#5A646D]">{code}</span>
                <span className="font-mono font-bold tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
          <ul data-testid="risk-by-level" className="space-y-1.5">
            {[...levelRows, ...extraLevelRows].map(([level, count]) => (
              <li key={level} className="flex items-center justify-between gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${
                    RISK_LEVEL_BADGE_CLASS[level] ?? RISK_LEVEL_BADGE_CLASS.low
                  }`}
                >
                  {LEVEL_LABEL_KEY[level] ? t(LEVEL_LABEL_KEY[level]) : level}
                </span>
                <span className="font-mono font-bold tabular-nums text-sm">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DashboardCard>
  );
}
