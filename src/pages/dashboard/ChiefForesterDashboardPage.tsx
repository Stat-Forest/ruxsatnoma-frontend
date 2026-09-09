import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  Award,
  Building2,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  FileText,
  Filter,
  Layers,
  Loader2,
  Map as MapIcon,
  MapPin,
  PenTool,
  RotateCcw,
  Scale,
  ShieldAlert,
  Trees,
  UploadCloud,
} from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { Button } from '../../components/ui/button';
import { Alert } from '../../components/ui/Feedback';
import { Input } from '../../components/ui/FormControls';
import { useLanguage, useT } from '../../i18n/useT';
import { pickName } from '../applicant/format';
import { formatDateTime, pickLayerName } from '../gis/format';
import { recalledPendingReviewVersions, type RecalledPendingVersion } from '../gis/localVersions';
import { getPermitStatusLabel, PERMIT_STATUS_STYLE } from '../permits/statusMeta';
import { CardBadge, DashboardCard } from './components/DashboardCard';
import { KpiTile } from './components/KpiTile';
import { formatPercent } from './format';
import { useKpi, type KpiParams } from './queries';
import { useContours, useImportsList, useLayers, useOrganizations } from '../gis/queries';
import { usePermitsList } from '../permits/queries';

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function firstOfMonthIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function defaultFilters(): KpiParams {
  return { period_from: firstOfMonthIso(), period_to: todayIso(), compare_previous: false };
}

function formatHectares(ha: number | string | null | undefined): string {
  if (ha == null) return '—';
  const n = typeof ha === 'string' ? parseFloat(ha) : ha;
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(1)} ga`;
}

const IMPORT_STATUS_KEYS: Record<string, string> = {
  pending: 'gis.imports.status.pending',
  processing: 'gis.imports.status.processing',
  review: 'gis.imports.status.review',
  approved: 'gis.imports.status.approved',
  done: 'gis.imports.status.done',
  failed: 'gis.imports.status.failed',
};

const VERSION_STATUS_KEYS: Record<string, string> = {
  draft: 'gis.versions.status.draft',
  review: 'gis.versions.status.review',
  approved: 'gis.versions.status.approved',
  published: 'gis.versions.status.published',
  archived: 'gis.versions.status.archived',
};

export function ChiefForesterDashboardPage() {
  const t = useT();
  const { lang } = useLanguage();
  const { me } = useAuth();

  const [periodFrom, setPeriodFrom] = useState(firstOfMonthIso);
  const [periodTo, setPeriodTo] = useState(todayIso);
  const [appliedFilters, setAppliedFilters] = useState<KpiParams>(defaultFilters);

  const canViewKpi = Boolean(me?.is_superuser || me?.permissions.includes('dashboard.view'));
  const kpi = useKpi(appliedFilters, { enabled: canViewKpi });

  const organizationsQuery = useOrganizations();
  const layersQuery = useLayers();

  const userOrgId = me?.zone?.organization_id ?? undefined;

  const contoursQuery = useContours({
    page: 1,
    page_size: 20,
    organization_id: userOrgId,
  });

  const importsQuery = useImportsList({
    page: 1,
    page_size: 10,
    status: 'review',
  });

  const permitsQuery = usePermitsList({
    page: 1,
    page_size: 10,
    status: 'pending_signatures',
    organization_id: userOrgId,
  });

  const currentOrg = useMemo(() => {
    if (!userOrgId) return null;
    return organizationsQuery.data?.find((o) => o.id === userOrgId) ?? null;
  }, [userOrgId, organizationsQuery.data]);

  const orgDisplayName = useMemo(() => {
    if (currentOrg) {
      return pickName(currentOrg.name, lang) || currentOrg.code;
    }
    const match = me?.user?.full_name?.match(/\(([^)]+)\)/);
    if (match) return match[1];
    return null;
  }, [currentOrg, lang, me?.user?.full_name]);

  function handleApplyFilters(e: React.FormEvent) {
    e.preventDefault();
    setAppliedFilters({
      period_from: periodFrom,
      period_to: periodTo,
      compare_previous: false,
    });
  }

  function handleResetFilters() {
    const d = defaultFilters();
    setPeriodFrom(d.period_from);
    setPeriodTo(d.period_to);
    setAppliedFilters(d);
  }

  const kpiData = kpi.data;

  // Operational metrics
  const contourCount = kpiData?.occupancy?.contour_count ?? contoursQuery.data?.total ?? 0;
  const occupancyPct = kpiData?.occupancy?.avg_occupied_pct ?? null;
  const sbLoad = kpiData?.sb_load_total ?? '0';
  const activePermits = kpiData?.permits?.active_count ?? permitsQuery.data?.total ?? 0;
  const issuedPermits = kpiData?.permits?.issued_count ?? 0;
  const applicationsCount = kpiData?.applications?.total_count ?? 0;
  const slaActive = kpiData?.sla?.active_count ?? 0;
  const inspectionsCount = kpiData?.inspections?.inspections_count ?? 0;
  const violationsCount = kpiData?.inspections?.violations_count ?? 0;

  // Pending GIS contour versions awaiting approval (from browser localVersions store)
  const pendingVersions: RecalledPendingVersion[] = useMemo(() => {
    return recalledPendingReviewVersions();
  }, []);

  // Pending GIS imports waiting for review/approval
  const pendingImports = useMemo(() => {
    const items = importsQuery.data?.items ?? [];
    return items.filter((item) => item.status === 'review' || item.status === 'pending');
  }, [importsQuery.data]);

  // Permits that need signatures or attention
  const pendingPermits = useMemo(() => {
    const items = permitsQuery.data?.items ?? [];
    const pending = items.filter((p) => p.status === 'pending_signatures');
    return pending.length > 0 ? pending : items.slice(0, 5);
  }, [permitsQuery.data]);

  const monitoredContours = useMemo(() => {
    return contoursQuery.data?.items ?? [];
  }, [contoursQuery.data]);

  // Territory / Zone breakdown calculations
  const territoryStats = useMemo(() => {
    const items = monitoredContours;
    const totalArea = items.reduce((sum, c) => sum + (parseFloat(c.area_ha ?? '0') || 0), 0);
    const availArea = items.reduce((sum, c) => sum + (parseFloat(c.s_available_ha ?? '0') || 0), 0);
    const occupiedArea = Math.max(0, totalArea - availArea);

    let occupiedContours = 0;
    let partialContours = 0;
    let freeContours = 0;

    for (const c of items) {
      const tot = parseFloat(c.area_ha ?? '0') || 0;
      const av = parseFloat(c.s_available_ha ?? '0') || 0;
      if (av <= 0.01) {
        occupiedContours++;
      } else if (av < tot) {
        partialContours++;
      } else {
        freeContours++;
      }
    }

    const calculatedPct = totalArea > 0 ? Math.round((occupiedArea / totalArea) * 100) : 0;
    return {
      totalArea,
      availArea,
      occupiedArea,
      occupiedContours,
      partialContours,
      freeContours,
      calculatedPct,
    };
  }, [monitoredContours]);

  const resolveLayerName = (layerId: string) => {
    const layer = layersQuery.data?.find((l) => l.id === layerId);
    return layer ? pickLayerName(layer, lang) : layerId.slice(0, 8);
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-8 w-full max-w-full min-w-0 font-sans" data-testid="chief-forester-dashboard">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F5E9] text-[#1B5E33] border border-[#C8E6C9] text-xs font-semibold">
              <Trees className="w-3.5 h-3.5 text-[#2E7D4F]" aria-hidden="true" />
              {t('chiefForester.dash.roleBadge')}
            </span>
            {orgDisplayName && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[#5A646D] border border-[#E4E7EA] text-xs font-medium shadow-2xs">
                <Building2 className="w-3.5 h-3.5 text-[#2E7D4F]" aria-hidden="true" />
                <span className="font-semibold text-[#1A1F24]">{orgDisplayName}</span>
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1A1F24] tracking-tight">
            {t('chiefForester.dash.title')}
          </h1>
          <p className="text-xs sm:text-sm text-[#5A646D] mt-1 max-w-3xl leading-relaxed">
            {t('chiefForester.dash.subtitle')}
          </p>
        </div>
      </div>

      {/* Date Filters Card */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 sm:p-5 shadow-xs" data-testid="chief-forester-filters">
        <form onSubmit={handleApplyFilters} className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 sm:gap-4 flex-1">
            <div className="w-full sm:w-48">
              <label className="block text-xs font-semibold text-[#5A646D] mb-1.5">
                {t('chiefForester.dash.filters.periodFrom')}
              </label>
              <Input
                type="date"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
                data-testid="filter-period-from"
                className="w-full text-xs sm:text-sm h-10"
              />
            </div>
            <div className="w-full sm:w-48">
              <label className="block text-xs font-semibold text-[#5A646D] mb-1.5">
                {t('chiefForester.dash.filters.periodTo')}
              </label>
              <Input
                type="date"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
                data-testid="filter-period-to"
                className="w-full text-xs sm:text-sm h-10"
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 pt-1 sm:pt-0">
            <Button
              type="submit"
              variant="primary"
              size="md"
              leftIcon={<Filter className="w-4 h-4" aria-hidden="true" />}
              data-testid="filter-apply-btn"
              className="cursor-pointer h-10 px-5 text-xs sm:text-sm font-semibold w-full sm:w-auto justify-center"
            >
              {t('chiefForester.dash.filters.apply')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="md"
              leftIcon={<RotateCcw className="w-4 h-4" aria-hidden="true" />}
              onClick={handleResetFilters}
              data-testid="filter-reset-btn"
              className="cursor-pointer h-10 px-4 text-xs sm:text-sm font-medium w-full sm:w-auto justify-center"
            >
              {t('chiefForester.dash.filters.reset')}
            </Button>
          </div>
        </form>
      </div>

      {/* KPI Tiles Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        <KpiTile
          testId="tile-contours"
          label={t('chiefForester.dash.tile.contours.label')}
          value={String(contourCount)}
          hint={t('chiefForester.dash.tile.contours.hint')}
          hintIcon={Trees}
          tone="neutral"
        />
        <KpiTile
          testId="tile-occupancy"
          label={t('chiefForester.dash.tile.occupancy.label')}
          value={formatPercent(occupancyPct ?? (territoryStats.totalArea > 0 ? territoryStats.calculatedPct.toFixed(1) : null))}
          hint={t('chiefForester.dash.tile.occupancy.hint')}
          hintIcon={Layers}
          tone="brand"
        />
        <KpiTile
          testId="tile-sb-load"
          label={t('chiefForester.dash.tile.sbLoad.label')}
          value={String(sbLoad)}
          hint={t('chiefForester.dash.tile.sbLoad.hint')}
          hintIcon={Scale}
          tone="neutral"
        />
        <KpiTile
          testId="tile-permits"
          label={t('chiefForester.dash.tile.permits.label')}
          value={String(activePermits)}
          hint={`${t('chiefForester.dash.tile.permits.hint')}: ${issuedPermits}`}
          hintIcon={Award}
          tone="neutral"
        />
        <KpiTile
          testId="tile-applications"
          label={t('chiefForester.dash.tile.applications.label')}
          value={String(applicationsCount)}
          hint={`${t('chiefForester.dash.tile.applications.hint')}: ${slaActive}`}
          hintIcon={FileText}
          tone="info"
        />
        <KpiTile
          testId="tile-inspections"
          label={t('chiefForester.dash.tile.inspections.label')}
          value={String(inspectionsCount)}
          hint={`${t('chiefForester.dash.tile.inspections.hint')}: ${violationsCount}`}
          hintIcon={ShieldAlert}
          tone={violationsCount > 0 ? 'brand' : 'neutral'}
        />
      </section>

      {/* Territory / Zone & Leshoz Statistics Overview */}
      <section data-testid="zone-overview-card" className="bg-white border border-[#E4E7EA] rounded-2xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#F0F7F1] text-[#2E7D4F] grid place-items-center shrink-0">
              <Compass className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1A1F24]">
                {t('chiefForester.dash.zoneOverview.title')}
              </h2>
              <p className="text-xs text-[#5A646D]">
                {orgDisplayName || t('chiefForester.dash.roleBadge')}
              </p>
            </div>
          </div>
          <Link
            to="/gis"
            className="text-xs font-semibold text-[#2E7D4F] hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            {t('chiefForester.dash.contours.allOnMap')}
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-1">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#F8F9FA] border border-[#E4E7EA] shadow-2xs">
            <span className="text-xs font-semibold text-[#5A646D] uppercase tracking-wider block">
              {t('chiefForester.dash.zoneOverview.totalArea')}
            </span>
            <span className="text-xl sm:text-2xl font-extrabold font-mono text-[#1A1F24] mt-2 block">
              {formatHectares(territoryStats.totalArea)}
            </span>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-[#FEF2F2]/60 border border-[#FECACA] shadow-2xs">
            <span className="text-xs font-semibold text-[#991B1B] uppercase tracking-wider block">
              {t('chiefForester.dash.zoneOverview.occupiedArea')}
            </span>
            <span className="text-xl sm:text-2xl font-extrabold font-mono text-[#991B1B] mt-2 block">
              {formatHectares(territoryStats.occupiedArea)}
            </span>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] shadow-2xs">
            <span className="text-xs font-semibold text-[#15803D] uppercase tracking-wider block">
              {t('chiefForester.dash.zoneOverview.availableArea')}
            </span>
            <span className="text-xl sm:text-2xl font-extrabold font-mono text-[#15803D] mt-2 block">
              {formatHectares(territoryStats.availArea)}
            </span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#E4E7EA]/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#FEF2F2] text-[#991B1B] border border-[#FCA5A5]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" aria-hidden="true" />
              {t('chiefForester.dash.zoneOverview.occupiedContours')}: <strong className="font-mono ml-0.5">{territoryStats.occupiedContours}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" aria-hidden="true" />
              {t('chiefForester.dash.zoneOverview.partialContours')}: <strong className="font-mono ml-0.5">{territoryStats.partialContours}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" aria-hidden="true" />
              {t('chiefForester.dash.zoneOverview.freeContours')}: <strong className="font-mono ml-0.5">{territoryStats.freeContours}</strong>
            </span>
          </div>
        </div>
      </section>

      {/* Pending Approvals & Signatures: GIS Versions, GIS Imports, and Permits */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
        {/* GIS Contour Versions Awaiting Approval */}
        <div data-testid="gis-versions-card">
          <DashboardCard
            title={t('chiefForester.dash.actions.gisVersionsTitle')}
            icon={Layers}
            badge={<CardBadge tone={pendingVersions.length > 0 ? 'brand' : 'neutral'}>{pendingVersions.length}</CardBadge>}
          >
            {pendingVersions.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#F8F9FA] border border-dashed border-[#E4E7EA] text-center text-xs text-[#5A646D] flex flex-col items-center justify-center py-8">
                <CheckCircle2 className="w-8 h-8 text-[#2E7D4F]/70 mb-2" aria-hidden="true" />
                <p className="font-medium text-[#1A1F24]">{t('chiefForester.dash.actions.gisVersionsEmpty')}</p>
              </div>
            ) : (
              <div className="divide-y divide-[#E4E7EA] border border-[#E4E7EA] rounded-xl overflow-hidden">
                {pendingVersions.map((item) => (
                  <div key={item.version.id} className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-[#F8F9FA] transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#1A1F24]">
                          {t('chiefForester.dash.actions.versionNo')} № {item.version.version_no}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD]">
                          {t(VERSION_STATUS_KEYS[item.version.status] ?? item.version.status)}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#5A646D] mt-1 flex items-center gap-1.5 font-mono">
                        <span>{formatHectares(item.version.area_ha)}</span>
                        {item.version.survey_date && (
                          <>
                            <span>•</span>
                            <span>{item.version.survey_date}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <Link to="/gis" className="shrink-0">
                      <Button variant="primary" size="sm" className="cursor-pointer text-xs h-8 px-3 rounded-lg font-semibold">
                        {t('chiefForester.dash.actions.gisVersionsReview')}
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-[#E4E7EA] flex justify-between items-center">
              <Link
                to="/gis"
                className="text-xs font-semibold text-[#2E7D4F] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                {t('chiefForester.dash.actions.allContours')}
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          </DashboardCard>
        </div>

        {/* GIS Import Batches Awaiting Approval */}
        <div data-testid="gis-imports-card">
          <DashboardCard
            title={t('chiefForester.dash.actions.gisImportsTitle')}
            icon={UploadCloud}
            badge={<CardBadge tone={pendingImports.length > 0 ? 'brand' : 'neutral'}>{pendingImports.length}</CardBadge>}
          >
            {importsQuery.isLoading ? (
              <div className="py-12 text-center text-xs text-[#5A646D]">
                <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" aria-hidden="true" />
                {t('chiefForester.dash.loading')}
              </div>
            ) : importsQuery.isError ? (
              <Alert variant="danger">{t('chiefForester.dash.error')}</Alert>
            ) : pendingImports.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#F8F9FA] border border-dashed border-[#E4E7EA] text-center text-xs text-[#5A646D] flex flex-col items-center justify-center py-8">
                <CheckCircle2 className="w-8 h-8 text-[#2E7D4F]/70 mb-2" aria-hidden="true" />
                <p className="font-medium text-[#1A1F24]">{t('chiefForester.dash.actions.gisImportsEmpty')}</p>
              </div>
            ) : (
              <div className="divide-y divide-[#E4E7EA] border border-[#E4E7EA] rounded-xl overflow-hidden">
                {pendingImports.map((item) => (
                  <div key={item.id} className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-[#F8F9FA] transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#1A1F24]">
                          {resolveLayerName(item.layer_id)}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD]">
                          {t(IMPORT_STATUS_KEYS[item.status] ?? item.status)}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#5A646D] mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#767F87]" aria-hidden="true" />
                        {item.created_at ? formatDateTime(item.created_at) : '—'}
                      </p>
                    </div>
                    <Link to="/gis" className="shrink-0">
                      <Button variant="primary" size="sm" className="cursor-pointer text-xs h-8 px-3 rounded-lg font-semibold">
                        {t('chiefForester.dash.actions.gisImportsReview')}
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-[#E4E7EA] flex justify-between items-center">
              <Link
                to="/gis"
                className="text-xs font-semibold text-[#2E7D4F] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                {t('chiefForester.dash.actions.allImports')}
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          </DashboardCard>
        </div>

        {/* Permits Awaiting Chief Forester Signature */}
        <div data-testid="permits-to-sign-card">
          <DashboardCard
            title={t('chiefForester.dash.actions.permitsToSignTitle')}
            icon={PenTool}
            badge={<CardBadge tone={pendingPermits.length > 0 ? 'brand' : 'neutral'}>{pendingPermits.length}</CardBadge>}
          >
            {permitsQuery.isLoading ? (
              <div className="py-12 text-center text-xs text-[#5A646D]">
                <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" aria-hidden="true" />
                {t('chiefForester.dash.loading')}
              </div>
            ) : permitsQuery.isError ? (
              <Alert variant="danger">{t('chiefForester.dash.error')}</Alert>
            ) : pendingPermits.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#F8F9FA] border border-dashed border-[#E4E7EA] text-center text-xs text-[#5A646D] flex flex-col items-center justify-center py-8">
                <CheckCircle2 className="w-8 h-8 text-[#2E7D4F]/70 mb-2" aria-hidden="true" />
                <p className="font-medium text-[#1A1F24]">{t('chiefForester.dash.actions.permitsToSignEmpty')}</p>
              </div>
            ) : (
              <div className="divide-y divide-[#E4E7EA] border border-[#E4E7EA] rounded-xl overflow-hidden">
                {pendingPermits.map((permit) => (
                  <div key={permit.id} className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-[#F8F9FA] transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#1A1F24]">
                          {permit.series}-{String(permit.number).padStart(6, '0')}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${PERMIT_STATUS_STYLE[permit.status] ?? 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]'}`}>
                          {getPermitStatusLabel(permit.status, lang)}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#5A646D] mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono">
                        <span>{formatHectares(permit.area_ha)}</span>
                        <span>•</span>
                        <span>{permit.period_from} — {permit.period_to}</span>
                      </p>
                    </div>
                    <Link to={`/permits/${permit.id}`} className="shrink-0">
                      <Button variant="success" size="sm" leftIcon={<PenTool className="w-3.5 h-3.5" aria-hidden="true" />} className="cursor-pointer text-xs h-8 px-3 rounded-lg font-semibold inline-flex items-center gap-1.5">
                        {t('chiefForester.dash.actions.sign')}
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-[#E4E7EA] flex justify-between items-center">
              <Link
                to="/permits"
                className="text-xs font-semibold text-[#2E7D4F] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                {t('chiefForester.dash.actions.allPermits')}
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          </DashboardCard>
        </div>
      </section>

      {/* Forestry Contours Monitoring Table */}
      <div data-testid="contours-monitoring-card">
        <DashboardCard
          title={t('chiefForester.dash.contours.title')}
          subtitle={t('chiefForester.dash.contours.subtitle')}
          icon={MapPin}
          badge={
            <Link to="/gis" className="inline-flex items-center gap-1 text-xs font-semibold text-[#2E7D4F] hover:underline">
              {t('chiefForester.dash.contours.allOnMap')}
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          }
        >
          {contoursQuery.isLoading ? (
            <div className="py-12 text-center text-xs text-[#5A646D]">
              <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" aria-hidden="true" />
              {t('chiefForester.dash.loading')}
            </div>
          ) : contoursQuery.isError ? (
            <Alert variant="danger">{t('chiefForester.dash.error')}</Alert>
          ) : monitoredContours.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#5A646D]">{t('chiefForester.dash.contours.empty')}</p>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[#E4E7EA] bg-[#F8F9FA] text-[#5A646D] font-semibold whitespace-nowrap">
                    <th className="py-3 px-4">{t('chiefForester.dash.contours.colNumber')}</th>
                    <th className="py-3 px-4">{t('chiefForester.dash.contours.colOrg')}</th>
                    <th className="py-3 px-4 text-right">{t('chiefForester.dash.contours.colArea')}</th>
                    <th className="py-3 px-4 text-right">{t('chiefForester.dash.contours.colAvailable')}</th>
                    <th className="py-3 px-4 text-center">{t('chiefForester.dash.contours.colStatus')}</th>
                    <th className="py-3 px-4 text-right">{t('chiefForester.dash.contours.colAction')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E7EA]">
                  {monitoredContours.map((contour) => {
                    const totalHa = parseFloat(contour.area_ha ?? '0');
                    const availHa = parseFloat(contour.s_available_ha ?? '0');
                    const isOccupied = availHa <= 0.01;
                    const isPartial = availHa < totalHa && !isOccupied;

                    const statusBadgeText = isOccupied
                      ? t('chiefForester.dash.contours.statusOccupied')
                      : isPartial
                        ? t('chiefForester.dash.contours.statusPartial')
                        : t('chiefForester.dash.contours.statusAvailable');

                    return (
                      <tr key={contour.id} className="hover:bg-[#F8F9FA] transition-colors whitespace-nowrap">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#1A1F24]">
                          {contour.number}
                        </td>
                        <td className="py-3.5 px-4 text-[#5A646D]">
                          {orgDisplayName || '—'}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-right text-[#1A1F24]">
                          {formatHectares(contour.area_ha)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-right text-[#2E7D4F] font-semibold">
                          {formatHectares(contour.s_available_ha)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              isOccupied
                                ? 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]'
                                : isPartial
                                  ? 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]'
                                  : 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isOccupied
                                  ? 'bg-[#EF4444]'
                                  : isPartial
                                    ? 'bg-[#F59E0B]'
                                    : 'bg-[#22C55E]'
                              }`}
                              aria-hidden="true"
                            />
                            {statusBadgeText}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            to="/gis"
                            className="text-[#2E7D4F] hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            {t('chiefForester.dash.contours.viewOnMap')}
                            <ArrowRight className="w-3 h-3" aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </DashboardCard>
      </div>

      {/* Quick Navigation Shortcuts */}
      <section data-testid="quick-links-card" className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#5A646D]">
          {t('chiefForester.dash.quickLinks.title')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Link
            to="/gis"
            className="bg-white border border-[#E4E7EA] hover:border-[#2E7D4F]/50 rounded-2xl p-4 shadow-xs hover:shadow-sm transition-all group cursor-pointer flex items-start gap-3.5"
          >
            <div className="w-10 h-10 rounded-xl bg-[#F0F7F1] text-[#2E7D4F] grid place-items-center shrink-0 group-hover:bg-[#2E7D4F] group-hover:text-white transition-colors">
              <MapIcon className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#1A1F24] group-hover:text-[#2E7D4F] transition-colors">
                {t('chiefForester.dash.quickLinks.gis')}
              </h3>
              <p className="text-xs text-[#5A646D] mt-1 leading-snug">
                {t('chiefForester.dash.quickLinks.gisDesc')}
              </p>
            </div>
          </Link>

          <Link
            to="/permits"
            className="bg-white border border-[#E4E7EA] hover:border-[#2E7D4F]/50 rounded-2xl p-4 shadow-xs hover:shadow-sm transition-all group cursor-pointer flex items-start gap-3.5"
          >
            <div className="w-10 h-10 rounded-xl bg-[#F0F7F1] text-[#2E7D4F] grid place-items-center shrink-0 group-hover:bg-[#2E7D4F] group-hover:text-white transition-colors">
              <Award className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#1A1F24] group-hover:text-[#2E7D4F] transition-colors">
                {t('chiefForester.dash.quickLinks.permits')}
              </h3>
              <p className="text-xs text-[#5A646D] mt-1 leading-snug">
                {t('chiefForester.dash.quickLinks.permitsDesc')}
              </p>
            </div>
          </Link>

          <Link
            to="/applications"
            className="bg-white border border-[#E4E7EA] hover:border-[#2E7D4F]/50 rounded-2xl p-4 shadow-xs hover:shadow-sm transition-all group cursor-pointer flex items-start gap-3.5"
          >
            <div className="w-10 h-10 rounded-xl bg-[#F0F7F1] text-[#2E7D4F] grid place-items-center shrink-0 group-hover:bg-[#2E7D4F] group-hover:text-white transition-colors">
              <FileText className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#1A1F24] group-hover:text-[#2E7D4F] transition-colors">
                {t('chiefForester.dash.quickLinks.applications')}
              </h3>
              <p className="text-xs text-[#5A646D] mt-1 leading-snug">
                {t('chiefForester.dash.quickLinks.applicationsDesc')}
              </p>
            </div>
          </Link>

          <Link
            to="/gis"
            className="bg-white border border-[#E4E7EA] hover:border-[#2E7D4F]/50 rounded-2xl p-4 shadow-xs hover:shadow-sm transition-all group cursor-pointer flex items-start gap-3.5"
          >
            <div className="w-10 h-10 rounded-xl bg-[#F0F7F1] text-[#2E7D4F] grid place-items-center shrink-0 group-hover:bg-[#2E7D4F] group-hover:text-white transition-colors">
              <UploadCloud className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#1A1F24] group-hover:text-[#2E7D4F] transition-colors">
                {t('chiefForester.dash.quickLinks.imports')}
              </h3>
              <p className="text-xs text-[#5A646D] mt-1 leading-snug">
                {t('chiefForester.dash.quickLinks.importsDesc')}
              </p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
