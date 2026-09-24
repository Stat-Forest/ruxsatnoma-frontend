import type { ReactNode } from 'react';
import { Hourglass } from 'lucide-react';
import { DashboardCard } from './DashboardCard';
import type { ActivityExpiry, ReviewDeadline } from '../metrics';

/** A permit this close to its end is worth the citizen's attention now — the
 *  same threshold the expiry tile above turns green at. */
const SOON_DAYS = 30;

/**
 * Replaces the "areas in use" donut (2026-09-24): what a citizen
 * asks of this screen is not how their hectares split, but how long each kind
 * of permit still runs and how long the office still has to answer each
 * application. Two lists rather than two charts — every row is one figure a
 * reader acts on, and a list states it without an axis to decode.
 */
export function DeadlinesCard({
  expiry,
  review,
  nameOf,
  t,
}: {
  expiry: ActivityExpiry[];
  review: ReviewDeadline[];
  nameOf: (activityTypeId: string) => string;
  t: (key: string) => string;
}) {
  return (
    <DashboardCard title={t('dash.deadlines.title')} subtitle={t('dash.deadlines.subtitle')} icon={Hourglass}>
      <Section heading={t('dash.deadlines.expiryHeading')}>
        {expiry.length ? (
          <ul data-testid="expiry-by-type" className="space-y-2">
            {expiry.map((row) => (
              <Row
                key={row.activityTypeId}
                title={nameOf(row.activityTypeId)}
                hint={`${row.count} ${t('dash.activePermits.unit')}`}
                figure={`${row.daysLeft} ${t('dash.deadlines.daysLeft')}`}
                tone={row.daysLeft <= SOON_DAYS ? 'warn' : 'neutral'}
              />
            ))}
          </ul>
        ) : (
          <Empty testId="expiry-by-type-empty">{t('dash.expiry.none')}</Empty>
        )}
      </Section>

      <Section heading={t('dash.deadlines.reviewHeading')}>
        {review.length ? (
          <ul data-testid="review-deadlines" className="space-y-2">
            {review.map((row) => (
              <Row
                key={row.applicationId}
                title={row.activityTypeId ? nameOf(row.activityTypeId) : '—'}
                hint={row.number ?? '—'}
                {...reviewFigure(row, t)}
              />
            ))}
          </ul>
        ) : (
          <Empty testId="review-deadlines-empty">{t('dash.deadlines.reviewEmpty')}</Empty>
        )}
      </Section>
    </DashboardCard>
  );
}

function reviewFigure(
  row: ReviewDeadline,
  t: (key: string) => string,
): { figure: string; tone: 'neutral' | 'warn' | 'danger' | 'muted' } {
  switch (row.state) {
    case 'overdue':
      return { figure: t('dash.deadlines.overdue'), tone: 'danger' };
    case 'paused':
      return { figure: t('dash.deadlines.paused'), tone: 'muted' };
    case 'unknown':
      return { figure: '—', tone: 'muted' };
    case 'running':
      return row.workingDaysLeft === 0
        ? { figure: t('dash.deadlines.dueToday'), tone: 'warn' }
        : { figure: `${row.workingDaysLeft} ${t('dash.deadlines.workDaysLeft')}`, tone: 'neutral' };
  }
}

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="mt-5 first:mt-0">
      <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wide text-[#767F87]">{heading}</h3>
      {children}
    </div>
  );
}

const FIGURE_TONE = {
  neutral: 'text-[#1A1F24]',
  warn: 'text-[#B45309]',
  danger: 'text-[#B91C1C]',
  muted: 'text-[#5A646D] font-medium',
} as const;

function Row({
  title,
  hint,
  figure,
  tone,
}: {
  title: string;
  hint: string;
  figure: string;
  tone: keyof typeof FIGURE_TONE;
}) {
  return (
    <li className="flex items-center gap-3 bg-[#F8F9FA] border border-[#E4E7EA] rounded-xl px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#1A1F24] truncate">{title}</p>
        <p className="mt-0.5 text-xs text-[#5A646D] font-mono tabular-nums truncate">{hint}</p>
      </div>
      <span className={`shrink-0 text-right text-sm font-semibold tabular-nums ${FIGURE_TONE[tone]}`}>{figure}</span>
    </li>
  );
}

/** Not `EmptyPanel`: that one is sized to stand in for a whole chart, and
 *  here two short sentences share one card. */
function Empty({ testId, children }: { testId: string; children: ReactNode }) {
  return (
    <p
      data-testid={testId}
      className="text-center text-sm text-[#5A646D] bg-[#F8F9FA] border border-dashed border-[#E4E7EA] rounded-xl px-4 py-5"
    >
      {children}
    </p>
  );
}
