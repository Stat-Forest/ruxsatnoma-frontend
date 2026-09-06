import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { DashboardCard } from './DashboardCard';
import { useTerritorySlice, type SliceCellOut } from '../queries';

interface PathStep {
  key: string;
  label: string;
}

/**
 * The leadership dashboard's own drill-down through the territorial
 * hierarchy — region → district → organization → contour (terminal).
 *
 * Design choice, spelled out per the task brief's own invitation to document
 * it: this component owns BOTH its navigation state (the breadcrumb, the
 * current level) AND its own data fetching (`useTerritorySlice`), rather
 * than being a prop-driven presentational component. The query to run next
 * depends entirely on which row was just clicked, and only this component
 * tracks that — pushing it up to the page would mean the page re-implements
 * this component's own state machine just to know what to fetch.
 *
 * It starts at the region level with no filter, independent of `KpiFilters`'
 * own region/district/organization selects rendered above it on the page —
 * those narrow the KPI tiles; this is a separate walk down the same
 * territory, reset on purpose whenever the reporting period changes (a new
 * period is a new report, not a deeper look at the same one).
 *
 * `LeadershipDashboardPage.tsx` also calls `useTerritorySlice` once, with
 * the same region-level (no-filter) params this component starts at, purely
 * to gate its own initial `dashboard-loading`/`dashboard-error` screen the
 * way it already gates on `useKpi`. TanStack Query dedupes an identical
 * query key across both call sites, so that is one network request, not two.
 */
export function TerritoryDrilldown({
  periodFrom,
  periodTo,
  t,
}: {
  periodFrom: string;
  periodTo: string;
  t: (key: string) => string;
}) {
  const [region, setRegion] = useState<PathStep | null>(null);
  const [district, setDistrict] = useState<PathStep | null>(null);
  const [organization, setOrganization] = useState<PathStep | null>(null);

  // Resets the walk whenever the reporting period itself changes — a new
  // period is a new report, not a deeper look at the same one. Adjusted
  // during render (React's own pattern for "some prop changed, reset local
  // state") rather than in an effect: a `setState` in an effect body commits
  // one throwaway render first, then a second one with the reset value.
  const [seenPeriod, setSeenPeriod] = useState([periodFrom, periodTo]);
  if (seenPeriod[0] !== periodFrom || seenPeriod[1] !== periodTo) {
    setSeenPeriod([periodFrom, periodTo]);
    setRegion(null);
    setDistrict(null);
    setOrganization(null);
  }

  const params = organization
    ? { period_from: periodFrom, period_to: periodTo, organization_id: organization.key }
    : district
      ? { period_from: periodFrom, period_to: periodTo, district_id: district.key }
      : region
        ? { period_from: periodFrom, period_to: periodTo, region_id: region.key }
        : { period_from: periodFrom, period_to: periodTo };

  const slice = useTerritorySlice(params);
  const cells = slice.data?.cells ?? [];
  const threshold = slice.data?.k_anonymity_threshold;

  function drillInto(cell: SliceCellOut) {
    if (cell.suppressed || cell.level === 'contour' || !cell.key) return;
    if (cell.level === 'region') setRegion({ key: cell.key, label: cell.label });
    else if (cell.level === 'district') setDistrict({ key: cell.key, label: cell.label });
    else if (cell.level === 'organization') setOrganization({ key: cell.key, label: cell.label });
  }

  function back() {
    if (organization) setOrganization(null);
    else if (district) setDistrict(null);
    else if (region) setRegion(null);
  }

  const breadcrumb = [t('leadership.dash.territory.root'), region?.label, district?.label, organization?.label]
    .filter((part): part is string => !!part)
    .join(' ▸ ');

  const suppressedText = (n: number) => `${t('leadership.dash.territory.suppressed')} (< ${n})`;

  return (
    <DashboardCard title={t('leadership.dash.territory.title')}>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <p className="text-xs font-semibold text-[#1A1F24]" data-testid="territory-breadcrumb">
          {breadcrumb}
        </p>
        {threshold !== undefined && (
          <p className="text-xs text-[#5A646D]">
            {t('leadership.dash.territory.threshold')} {threshold}
          </p>
        )}
      </div>
      {(region || district || organization) && (
        <Button variant="ghost" size="sm" onClick={back} className="mb-3">
          {t('leadership.dash.territory.back')}
        </Button>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse" data-testid="territory-table">
          <thead>
            <tr className="bg-[#F8F9FA] border-b border-[#E4E7EA] text-[#5A646D] uppercase font-bold text-[11px]">
              <th className="p-3">{t('leadership.dash.territory.col.label')}</th>
              <th className="p-3 text-right">{t('leadership.dash.territory.col.applications')}</th>
              <th className="p-3 text-right">{t('leadership.dash.territory.col.permits')}</th>
              <th className="p-3 text-right">{t('leadership.dash.territory.col.applicants')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E7EA]">
            {cells.map((cell) => {
              const clickable = !cell.suppressed && cell.level !== 'contour';
              return (
                <tr key={cell.key ?? cell.label} data-testid={`territory-cell-${cell.key ?? cell.label}`}>
                  <td className="p-3">
                    {cell.suppressed && <Lock className="w-3.5 h-3.5 inline-block mr-1.5 text-[#767F87]" />}
                    {clickable ? (
                      <button
                        type="button"
                        className="text-[#2E7D4F] font-semibold hover:underline"
                        onClick={() => drillInto(cell)}
                      >
                        {cell.label}
                      </button>
                    ) : (
                      <span className={cell.suppressed ? 'text-[#5A646D]' : 'text-[#1A1F24]'}>{cell.label}</span>
                    )}
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums">
                    {cell.suppressed ? suppressedText(threshold ?? 0) : cell.applications_count}
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums">
                    {cell.suppressed ? suppressedText(threshold ?? 0) : cell.permits_count}
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums">
                    {cell.suppressed ? suppressedText(threshold ?? 0) : cell.applicant_count}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  );
}
