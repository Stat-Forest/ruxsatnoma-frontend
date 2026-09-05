import { Clock, TrendingUp } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CardBadge, DashboardCard, EmptyPanel } from './DashboardCard';
import { formatReviewDays } from '../format';
import type { MonthPoint, ReviewStats } from '../metrics';

const SERIES = [
  { key: 'applications', color: '#0284C7', labelKey: 'dash.dynamics.applications' },
  { key: 'permits', color: '#2E7D4F', labelKey: 'dash.dynamics.permits' },
  { key: 'payments', color: '#B45309', labelKey: 'dash.dynamics.payments' },
] as const;

/** `YYYY-MM` to the short month name of the active dictionary. */
function monthLabel(key: string, t: (key: string) => string): string {
  return t(`dash.month.${Number(key.slice(5, 7))}`);
}

/**
 * The three flows of the citizen's own year — applications handed in,
 * permits issued, payments settled — one point per month.
 *
 * Counts, not sums of money: the three series share one axis, and a figure in
 * millions beside a figure of "2" would flatten the other two into the
 * baseline. What the panel answers is "when did things happen", and the money
 * has a tile of its own.
 */
export function DynamicsCard({
  points,
  stats,
  t,
}: {
  points: MonthPoint[];
  stats: ReviewStats;
  t: (key: string) => string;
}) {
  const hasEvents = points.some((point) => point.applications + point.permits + point.payments > 0);
  const data = points.map((point) => ({ ...point, label: monthLabel(point.key, t) }));

  return (
    <DashboardCard
      title={t('dash.dynamics.title')}
      subtitle={t('dash.dynamics.subtitle')}
      icon={TrendingUp}
      badge={
        stats.avgReviewDays === null ? undefined : (
          <CardBadge>
            <Clock className="w-3.5 h-3.5" />
            {t('dash.dynamics.avgReview')}: {formatReviewDays(stats.avgReviewDays)} {t('dash.dynamics.days')}
          </CardBadge>
        )
      }
    >
      {hasEvents ? (
        <>
          <div className="h-[260px] -ml-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EA" vertical={false} />
                <XAxis dataKey="label" stroke="#767F87" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#767F87" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #E4E7EA',
                    fontSize: 12,
                    boxShadow: '0 4px 12px rgba(26,31,36,0.08)',
                  }}
                />
                {SERIES.map((series) => (
                  <Area
                    key={series.key}
                    type="monotone"
                    dataKey={series.key}
                    name={t(series.labelKey)}
                    stroke={series.color}
                    fill={series.color}
                    fillOpacity={0.12}
                    strokeWidth={2}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {SERIES.map((series) => (
              <li key={series.key} className="flex items-center gap-2 text-xs text-[#5A646D]">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: series.color }} />
                {t(series.labelKey)}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyPanel testId="dynamics-empty">{t('dash.dynamics.noData')}</EmptyPanel>
      )}

      <dl className="mt-5 pt-4 border-t border-[#E4E7EA] grid grid-cols-1 sm:grid-cols-3 gap-4 sm:divide-x sm:divide-[#E4E7EA]">
        <Figure label={t('dash.dynamics.totalLabel')} tone="neutral">
          {stats.total}
          {stats.yearsFrom !== null && stats.yearsTo !== null ? (
            <span className="ml-1.5 text-xs font-normal text-[#5A646D]">
              ({stats.yearsFrom === stats.yearsTo ? stats.yearsFrom : `${stats.yearsFrom}–${stats.yearsTo}`})
            </span>
          ) : null}
        </Figure>
        <Figure label={t('dash.dynamics.slaLabel')} tone="brand" className="sm:pl-4">
          {stats.slaOnTimePct === null ? '—' : `${stats.slaOnTimePct}% ${t('dash.dynamics.slaValue')}`}
        </Figure>
        <Figure label={t('dash.dynamics.successLabel')} tone="info" className="sm:pl-4">
          {stats.approvedPct === null ? '—' : `${stats.approvedPct}% ${t('dash.dynamics.successValue')}`}
        </Figure>
      </dl>
    </DashboardCard>
  );
}

function Figure({
  label,
  children,
  tone,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  tone: 'neutral' | 'brand' | 'info';
  className?: string;
}) {
  const color = tone === 'brand' ? 'text-[#2E7D4F]' : tone === 'info' ? 'text-[#0369A1]' : 'text-[#1A1F24]';
  return (
    <div className={className}>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-[#5A646D]">{label}</dt>
      <dd className={`mt-1 text-sm font-bold font-mono tabular-nums ${color}`}>{children}</dd>
    </div>
  );
}
