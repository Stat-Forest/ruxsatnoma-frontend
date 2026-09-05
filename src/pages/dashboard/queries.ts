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

/** `GET /invoices` takes one `application_id` and has no "all of mine" form,
 *  so the invoices are fetched per application — but only for the few that
 *  ever reached billing. An application below `INVOICED` has no invoice by
 *  construction, so asking for one would be a round trip guaranteed to come
 *  back empty. */
const BILLED_STATUSES = new Set(['INVOICED', 'PAID', 'PERMIT_ISSUED', 'CLOSED', 'ARCHIVED']);

export function billedApplicationIds(applications: ApplicationOut[]): string[] {
  return applications.filter((item) => BILLED_STATUSES.has(item.status)).map((item) => item.id);
}

export function useInvoicesFor(applicationIds: string[]) {
  return useQueries({
    queries: applicationIds.map((applicationId) => ({
      queryKey: ['dashboard', 'invoices', applicationId],
      queryFn: async () => {
        const { data, error } = await api.GET('/api/v1/invoices', {
          params: { query: { application_id: applicationId, limit: 50, offset: 0 } },
        });
        if (error) throw apiError(error);
        return data.items;
      },
      staleTime: 60 * 1000,
    })),
    combine: (results: { data?: InvoiceOut[] }[]) => results.flatMap((result) => result.data ?? []),
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
