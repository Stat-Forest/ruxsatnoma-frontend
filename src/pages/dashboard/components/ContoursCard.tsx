import { BarChart3 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DashboardCard, EmptyPanel } from './DashboardCard';
import { formatHectares } from '../format';
import type { ContourRow } from '../metrics';

const AREA_COLOR = '#3B82F6';
const DAYS_COLOR = '#2E7D4F';

/**
 * One bar pair per contour the citizen holds: how much land it is, and how
 * long the permit on it still runs. The two quantities share an axis on
 * purpose — the reference design does the same, and the comparison a citizen
 * actually makes is "which of my plots runs out first", not "how many
 * hectares is a day".
 */
export function ContoursCard({
  rows,
  numberOf,
  t,
}: {
  rows: ContourRow[];
  numberOf: (contourId: string) => string;
  t: (key: string) => string;
}) {
  const data = rows.map((row) => ({ ...row, label: numberOf(row.contourId) }));

  return (
    <DashboardCard title={t('dash.contours.title')} subtitle={t('dash.contours.subtitle')} icon={BarChart3}>
      {data.length ? (
        <>
          <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-2">
            <li className="flex items-center gap-2 text-xs text-[#5A646D]">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: AREA_COLOR }} />
              {t('dash.contours.area')}
            </li>
            <li className="flex items-center gap-2 text-xs text-[#5A646D]">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DAYS_COLOR }} />
              {t('dash.contours.daysLeft')}
            </li>
          </ul>
          <div className="h-[240px] -ml-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EA" vertical={false} />
                <XAxis dataKey="label" stroke="#767F87" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#767F87" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: '#F8F9FA' }}
                  contentStyle={{ borderRadius: 12, border: '1px solid #E4E7EA', fontSize: 12 }}
                />
                <Bar dataKey="areaHa" name={t('dash.contours.area')} fill={AREA_COLOR} radius={[4, 4, 0, 0]} />
                <Bar dataKey="daysLeft" name={t('dash.contours.daysLeft')} fill={DAYS_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* The same rows in words, under the chart: a bar chart answers
              "which is bigger" and these answer "by how much" — and on a
              phone, where the axis labels compress, they are the readable
              half of the panel. */}
          <ul data-testid="contour-cards" className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {data.map((row) => (
              <li key={row.contourId} className="bg-[#F8F9FA] border border-[#E4E7EA] rounded-xl px-4 py-3">
                <p className="text-sm font-bold text-[#1A1F24] truncate">{row.label}</p>
                <p className="mt-0.5 text-xs text-[#5A646D] font-mono tabular-nums">
                  {formatHectares(row.areaHa)} ga · {row.daysLeft} {t('dash.contours.daysLeftShort')}
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyPanel testId="contours-empty">{t('dash.contours.empty')}</EmptyPanel>
      )}
    </DashboardCard>
  );
}
