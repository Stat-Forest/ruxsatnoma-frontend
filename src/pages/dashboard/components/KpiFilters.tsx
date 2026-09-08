import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Checkbox, FormField, Input, Select } from '../../../components/ui/FormControls';
import { pickName } from '../../applicant/format';
import { useActivityTypes, useDistricts, useOrganizationsInRegion, useRegions, type KpiParams } from '../queries';

interface DraftState {
  period_from: string;
  period_to: string;
  region_id: string;
  district_id: string;
  organization_id: string;
  activity_type_id: string;
  compare_previous: boolean;
}

function toDraft(filters: KpiParams): DraftState {
  return {
    period_from: filters.period_from,
    period_to: filters.period_to,
    region_id: filters.region_id ?? '',
    district_id: filters.district_id ?? '',
    organization_id: filters.organization_id ?? '',
    activity_type_id: filters.activity_type_id ?? '',
    compare_previous: filters.compare_previous ?? false,
  };
}

function toApplied(draft: DraftState): KpiParams {
  return {
    period_from: draft.period_from,
    period_to: draft.period_to,
    region_id: draft.region_id || undefined,
    district_id: draft.district_id || undefined,
    organization_id: draft.organization_id || undefined,
    activity_type_id: draft.activity_type_id || undefined,
    compare_previous: draft.compare_previous,
  };
}

/**
 * The KPI dashboard's own filter bar — draft-state-until-Apply, the same
 * shape `staff/ApplicationsListPage.tsx` uses (a local draft object, an
 * Apply/Reset pair, nothing hits the network until Apply is pressed). Owns
 * the region/district/organization/activity-type reference data itself
 * (`useRegions`/`useDistricts`/`useOrganizationsInRegion`/`useActivityTypes`)
 * so `LeadershipDashboardPage.tsx` only has to hand it a starting point and
 * a callback.
 */
export function KpiFilters({
  initial,
  onApply,
  t,
  lang,
}: {
  initial: KpiParams;
  onApply: (filters: KpiParams) => void;
  t: (key: string) => string;
  lang: string;
}) {
  const [draft, setDraft] = useState<DraftState>(() => toDraft(initial));

  const regions = useRegions();
  const districts = useDistricts(draft.region_id || undefined);
  const organizations = useOrganizationsInRegion(draft.region_id || undefined);
  const activityTypes = useActivityTypes();

  // `GET /refs/organizations` has no `district_id` filter of its own
  // (queries.ts's own comment) — narrowing by both region and district is
  // this component's job, over the region-scoped list the hook already
  // fetched.
  const organizationOptions = (organizations.data ?? []).filter(
    (org) => !draft.district_id || org.district_id === draft.district_id,
  );

  function setRegion(regionId: string) {
    // Changing the parent invalidates any child already picked — a stale
    // district/organization id from a different region is not a filter
    // anyone meant to apply.
    setDraft((d) => ({ ...d, region_id: regionId, district_id: '', organization_id: '' }));
  }

  function setDistrict(districtId: string) {
    setDraft((d) => ({ ...d, district_id: districtId, organization_id: '' }));
  }

  function applyFilters() {
    onApply(toApplied(draft));
  }

  function resetFilters() {
    const reset = toDraft(initial);
    setDraft(reset);
    onApply(toApplied(reset));
  }

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-5 shadow-xs space-y-3" data-testid="kpi-filters">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 items-end">
        <FormField label={t('leadership.dash.filters.periodFrom')}>
          <Input
            type="date"
            value={draft.period_from}
            onChange={(e) => setDraft((d) => ({ ...d, period_from: e.target.value }))}
          />
        </FormField>
        <FormField label={t('leadership.dash.filters.periodTo')}>
          <Input
            type="date"
            value={draft.period_to}
            onChange={(e) => setDraft((d) => ({ ...d, period_to: e.target.value }))}
          />
        </FormField>
        <FormField label={t('leadership.dash.filters.region')}>
          <Select
            value={draft.region_id}
            onChange={(e) => setRegion(e.target.value)}
            options={[
              { value: '', label: t('leadership.dash.filters.allRegions') },
              ...(regions.data ?? []).map((region) => ({ value: region.id, label: pickName(region.name, lang) })),
            ]}
          />
        </FormField>
        <FormField label={t('leadership.dash.filters.district')}>
          <Select
            value={draft.district_id}
            onChange={(e) => setDistrict(e.target.value)}
            disabled={!draft.region_id}
            options={[
              { value: '', label: t('leadership.dash.filters.allDistricts') },
              ...(draft.region_id ? districts.data ?? [] : []).map((district) => ({
                value: district.id,
                label: pickName(district.name, lang),
              })),
            ]}
          />
        </FormField>
        <FormField label={t('leadership.dash.filters.organization')}>
          <Select
            value={draft.organization_id}
            onChange={(e) => setDraft((d) => ({ ...d, organization_id: e.target.value }))}
            disabled={!draft.region_id}
            options={[
              { value: '', label: t('leadership.dash.filters.allOrganizations') },
              ...(draft.region_id ? organizationOptions : []).map((org) => ({
                value: org.id,
                label: pickName(org.name, lang),
              })),
            ]}
          />
        </FormField>
        <FormField label={t('leadership.dash.filters.activityType')}>
          <Select
            value={draft.activity_type_id}
            onChange={(e) => setDraft((d) => ({ ...d, activity_type_id: e.target.value }))}
            options={[
              { value: '', label: t('leadership.dash.filters.allActivityTypes') },
              ...(activityTypes.data ?? []).map((activityType) => ({
                value: activityType.id,
                label: pickName(activityType.name, lang) || activityType.code,
              })),
            ]}
          />
        </FormField>
        <Checkbox
          label={t('leadership.dash.filters.comparePrevious')}
          checked={draft.compare_previous}
          onChange={(e) => setDraft((d) => ({ ...d, compare_previous: e.target.checked }))}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" leftIcon={<RotateCcw className="w-3.5 h-3.5" />} onClick={resetFilters}>
          {t('leadership.dash.filters.reset')}
        </Button>
        <Button variant="primary" size="sm" onClick={applyFilters}>
          {t('leadership.dash.filters.apply')}
        </Button>
      </div>
    </div>
  );
}
