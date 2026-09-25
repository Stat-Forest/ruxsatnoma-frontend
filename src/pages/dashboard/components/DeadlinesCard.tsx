import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Hourglass } from 'lucide-react';
import { DashboardCard } from './DashboardCard';
import type { ActivityExpiry, ReviewDeadline } from '../metrics';

/** A permit this close to its end is worth the citizen's attention now — the
 *  same threshold the expiry tile above turns green at. */
const SOON_DAYS = 30;

/** Review rows shown before the rest fold behind a link to the full list.
 *  A citizen with twenty applications in flight once stretched this card to
 *  twice the height of the screen; the most urgent five are what the home
 *  screen owes them, and the list page has the others. */
const REVIEW_LIMIT = 5;

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
          <>
            <ul data-testid="review-deadlines" className="space-y-2">
              {review.slice(0, REVIEW_LIMIT).map((row) => (
                <Row
                  key={row.applicationId}
                  to={`/my/applications/${row.applicationId}`}
                  title={row.activityTypeId ? nameOf(row.activityTypeId) : '—'}
                  hint={row.number ?? '—'}
                  {...reviewFigure(row, t)}
                />
              ))}
            </ul>
            {review.length > REVIEW_LIMIT ? (
              <Link
                to="/my/applications"
                data-testid="review-deadlines-all"
                className="mt-3 flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-[#2E7D4F] hover:bg-[#F0F7F2]"
              >
                {t('dash.deadlines.showAll')} ({review.length})
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : null}
          </>
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
  to,
  title,
  hint,
  figure,
  tone,
}: {
  to?: string;
  title: string;
  hint: string;
  figure: string;
  tone: keyof typeof FIGURE_TONE;
}) {
  const body = (
    <>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#1A1F24] truncate">{title}</p>
        <p className="mt-0.5 text-xs text-[#5A646D] tabular-nums truncate">{hint}</p>
      </div>
      {/* Capped rather than `shrink-0`: "Paused — awaiting your reply" is the
          longest figure, and unshrinkable it squeezed the title to "As…". */}
      <span className={`max-w-[55%] text-right text-sm font-semibold tabular-nums ${FIGURE_TONE[tone]}`}>
        {figure}
      </span>
    </>
  );
  const box = 'flex items-center gap-3 bg-[#F8F9FA] border border-[#E4E7EA] rounded-xl px-4 py-3';
  return (
    <li>
      {to ? (
        <Link to={to} className={`${box} hover:border-[#2E7D4F]/40 hover:bg-white transition-colors`}>
          {body}
        </Link>
      ) : (
        <div className={box}>{body}</div>
      )}
    </li>
  );
}

/** Not `EmptyPanel`: that one is sized to stand in for a whole chart, and
 *  here two short sentences share one card. Two faded placeholder rows sit
 *  behind the sentence — the shape of what will appear here, with no text a
 *  reader could mistake for a deadline. */
function Empty({ testId, children }: { testId: string; children: ReactNode }) {
  return (
    <div data-testid={testId} className="relative">
      <div aria-hidden="true" className="space-y-2 opacity-40">
        {[0, 1].map((key) => (
          <div key={key} className="flex items-center gap-3 bg-[#F8F9FA] border border-[#E4E7EA] rounded-xl px-4 py-3">
            <div className="flex-1 space-y-1.5">
              <div className="h-2.5 w-2/5 rounded-full bg-[#DDE2E6]" />
              <div className="h-2 w-1/4 rounded-full bg-[#E8EBEE]" />
            </div>
            <div className="h-2.5 w-16 rounded-full bg-[#DDE2E6]" />
          </div>
        ))}
      </div>
      <p className="absolute inset-0 flex items-center justify-center text-center text-sm font-medium text-[#5A646D] px-4">
        <span className="rounded-full bg-white/90 border border-[#E4E7EA] px-3 py-1.5 shadow-xs">{children}</span>
      </p>
    </div>
  );
}
