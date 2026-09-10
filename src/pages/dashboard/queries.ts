/**
 * Data layer for the applicant's home screen (B1). Three reads, all of them
 * routes that already exist — the dashboard adds no aggregate endpoint of its
 * own, because a citizen owns tens of applications, not thousands, and the
 * whole screen is arithmetic over three lists the backend already scopes to
 * the caller (`applications/service.py::list_applications` and
 * `permits/service.py::list_permits` both narrow to the caller's own rows
 * without being asked).
 */
import { useQueries, useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { apiError } from '../../api/errors';
import type { components } from '../../api/schema';

export type ApplicationOut = components['schemas']['ApplicationOut'];
export type PermitOut = components['schemas']['PermitOut'];
export type InvoiceOut = components['schemas']['InvoiceOut'];
export type ActivityTypeOut = components['schemas']['ActivityTypeOut'];
export type KpiOut = components['schemas']['KpiOut'];
export type TerritorySliceOut = components['schemas']['TerritorySliceOut'];
export type SliceCellOut = components['schemas']['SliceCellOut'];
export type ClassifierItemOut = components['schemas']['ClassifierItemOut'];
export type RegionOut = components['schemas']['RegionOut'];
export type DistrictOut = components['schemas']['DistrictOut'];
export type OrganizationOut = components['schemas']['OrganizationOut'];

/** One page is enough for a citizen's whole history — `PageParams` caps
 *  `page_size` at 100 and nobody in this system holds that many applications.
 *  The `total` that comes back is what the history line reports, so a rare
 *  overflow is visible rather than silently truncated. */
const PAGE_SIZE = 100;

export function useMyApplications() {
  return useQuery({
    queryKey: ['dashboard', 'applications'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/applications', {
        params: { query: { page: 1, page_size: PAGE_SIZE } },
      });
      if (error) throw apiError(error);
      return data;
    },
  });
}

export function useMyPermits() {
  return useQuery({
    queryKey: ['dashboard', 'permits'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/permits', {
        params: { query: { page: 1, page_size: PAGE_SIZE } },
      });
      if (error) throw apiError(error);
      return data;
    },
  });
}

/** Every invoice of the citizen's own applications in one call (stage 11,
 * ruling R5) — `GET /invoices` with no `application_id`, which the backend
 * answers an applicant as their own list (R1). Replaces a per-application fan-out
 * that also skipped `EXPIRED_UNPAID`, so an expired invoice never reached
 * these figures. 200 is the route's cap and far above a citizen's history. */
export function useOwnInvoices() {
  return useQuery({
    queryKey: ['dashboard', 'invoices'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/invoices', {
        params: { query: { limit: 200, offset: 0 } },
      });
      if (error) throw apiError(error);
      return data.items;
    },
    staleTime: 60 * 1000,
  });
}

export function useActivityTypes() {
  return useQuery({
    queryKey: ['refs', 'activity-types'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/refs/activity-types', {});
      if (error) throw apiError(error);
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Contour numbers for the bar chart's labels, one card per contour the
 *  citizen actually holds — not the first page of `GET /gis/contours`, which
 *  would silently label a permit "—" whenever its contour fell past the page
 *  boundary. `get_contour_card` gates on nothing but `get_current_user`
 *  (`gis/router.py`), the same reason `permits/useRefsLookup.ts` reads it. */
export function useContourNumbers(contourIds: string[]) {
  return useQueries({
    queries: contourIds.map((contourId) => ({
      queryKey: ['gis', 'contour', contourId],
      queryFn: async () => {
        const { data, error } = await api.GET('/api/v1/gis/contours/{contour_id}', {
          params: { path: { contour_id: contourId } },
        });
        if (error) throw apiError(error);
        return { id: contourId, number: data.number };
      },
      staleTime: 5 * 60 * 1000,
    })),
    combine: (results: { data?: { id: string; number: string } }[]) =>
      new Map(results.flatMap((result) => (result.data ? [[result.data.id, result.data.number] as const] : []))),
  });
}

// --- leadership's KPI dashboard (stage 6.7, J3) ----------------------------

export interface KpiParams {
  period_from: string;
  period_to: string;
  region_id?: string;
  district_id?: string;
  organization_id?: string;
  activity_type_id?: string;
  compare_previous?: boolean;
}

/** `options.enabled` (F19, `StaffDashboardPage.tsx`) lets a caller withhold
 *  this query until it has confirmed `dashboard.view` itself — the same
 *  never-fire-a-query-the-backend-would-refuse rule every gated panel in
 *  this app follows. Defaults to `true`, so `LeadershipDashboardPage.tsx`'s
 *  existing single-argument call is unaffected. */
export function useKpi(params: KpiParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['dashboard', 'kpi', params],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/dashboard/kpi', {
        params: { query: params },
      });
      if (error) throw apiError(error);
      return data;
    },
    enabled: options?.enabled ?? true,
  });
}

export interface TerritorySliceParams {
  period_from: string;
  period_to: string;
  region_id?: string;
  district_id?: string;
  organization_id?: string;
}

export function useTerritorySlice(params: TerritorySliceParams) {
  return useQuery({
    queryKey: ['dashboard', 'territory-slice', params],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/dashboard/territory-slice', {
        params: { query: params },
      });
      if (error) throw apiError(error);
      return data;
    },
  });
}

/** Mirrors `staff/queries.ts::useRejectionReasons` exactly — same classifier
 *  code, same call, same `staleTime` — kept as its own copy here rather than
 *  imported across page folders, per this folder's own convention above (a
 *  small cross-cutting query duplicated is cheaper than a shared module
 *  every track has to merge around). */
export function useRejectionReasonItems() {
  return useQuery({
    queryKey: ['refs', 'classifiers', 'rejection_reasons'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/refs/classifiers/{code}/items', {
        params: { path: { code: 'rejection_reasons' } },
      });
      if (error) throw apiError(error);
      return data;
    },
    staleTime: 10 * 60_000,
  });
}

export function useRegions() {
  return useQuery({
    queryKey: ['refs', 'regions'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/refs/regions', {});
      if (error) throw apiError(error);
      return data;
    },
    staleTime: 10 * 60_000,
  });
}

/** Every district in the country when `regionId` is omitted — not what a
 *  cascading picker wants, so this hook simply does not fire until a region
 *  is chosen, same as `useOrganizationsInRegion` below. */
export function useDistricts(regionId: string | undefined) {
  return useQuery({
    queryKey: ['refs', 'districts', regionId],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/refs/districts', {
        params: { query: { region_id: regionId } },
      });
      if (error) throw apiError(error);
      return data;
    },
    enabled: !!regionId,
  });
}

/** `GET /refs/organizations` has no `district_id` filter — `OrganizationOut`
 *  carries its own `district_id` on each row, so a caller narrowing by both
 *  region AND district filters this hook's result client-side (in
 *  `KpiFilters.tsx`) rather than asking the route for something it cannot
 *  do. */
export function useOrganizationsInRegion(regionId: string | undefined) {
  return useQuery({
    queryKey: ['refs', 'organizations', regionId],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/refs/organizations', {
        params: { query: { region_id: regionId, page_size: 100 } },
      });
      if (error) throw apiError(error);
      return data.items;
    },
    enabled: !!regionId,
  });
}
