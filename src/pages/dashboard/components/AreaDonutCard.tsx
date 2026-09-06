import { PieChart as PieIcon } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { CardBadge, DashboardCard, EmptyPanel } from './DashboardCard';
import { formatHectares } from '../format';
import type { ActivitySlice } from '../metrics';

/** Five hues, reused in order. The first two are the brand green and the
 *  system's blue, because grazing and haymaking are the two activities that
 *  carry almost all the land today. */
const SLICE_COLORS = ['#2E7D4F', '#0284C7', '#B45309', '#7C3AED', '#0D9488'];

export function AreaDonutCard({
  slices,
  nameOf,
  t,
}: {
  slices: ActivitySlice[];
  nameOf: (activityTypeId: string) => string;
  t: (key: string) => string;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.areaHa, 0);
  const data = slices.map((slice, index) => ({
    ...slice,
    name: nameOf(slice.activityTypeId),
    color: SLICE_COLORS[index % SLICE_COLORS.length],
  }));

  return (
    <DashboardCard
      title={t('dash.area.title')}
      subtitle={t('dash.area.subtitle')}
      icon={PieIcon}
      badge={data.length ? <CardBadge tone="brand">{formatHectares(total)} ga</CardBadge> : undefined}
    >
      {data.length ? (
        <>
          <div className="relative h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  formatter={(value) => `${formatHectares(Number(value))} ga`}
                  contentStyle={{ borderRadius: 12, border: '1px solid #E4E7EA', fontSize: 12 }}
                />
                <Pie data={data} dataKey="areaHa" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={2}>
                  {data.map((slice) => (
                    <Cell key={slice.activityTypeId} fill={slice.color} stroke="#FFFFFF" strokeWidth={2} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* The total belongs in the hole of the ring, not in a legend row:
                it is the one figure every slice is a fraction of. */}
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <div className="text-center">
                <p className="text-2xl font-bold font-mono tabular-nums text-[#1A1F24]">{formatHectares(total)}</p>
                <p className="text-[10px] font-bold tracking-wide text-[#767F87]">{t('dash.area.center')}</p>
              </div>
            </div>
          </div>
          <ul data-testid="area-legend" className="mt-5 space-y-2.5">
            {data.map((slice) => (
              <li key={slice.activityTypeId} className="flex items-center gap-3 text-sm">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                <span className="flex-1 min-w-0 truncate text-[#1A1F24]">{slice.name}</span>
                <span className="font-mono tabular-nums font-semibold text-[#1A1F24]">
                  {formatHectares(slice.areaHa)} ga
                </span>
                <span className="w-11 text-right font-mono tabular-nums text-xs text-[#5A646D]">
                  {Math.round(slice.pct)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyPanel testId="area-empty">{t('dash.area.empty')}</EmptyPanel>
      )}
    </DashboardCard>
  );
}
