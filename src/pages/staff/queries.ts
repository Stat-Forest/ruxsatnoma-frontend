/**
 * Data layer for the staff worklist and application card (Track 3) — every
 * request the two screens make, in one place, kept local to
 * `src/pages/staff/` per the sprint's ownership boundary.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { apiError } from '../../api/errors';
import type { components } from '../../api/schema';

export type ApplicationOut = components['schemas']['ApplicationOut'];
export type ApplicationDecisionOut = components['schemas']['ApplicationDecisionOut'];
export type ActivityTypeOut = components['schemas']['ActivityTypeOut'];
export type ClassifierItemOut = components['schemas']['ClassifierItemOut'];
export type ContourCardOut = components['schemas']['ContourCardOut'];

/** One row of `application_conclusions` (task 5, 3.9b) — now present in
 *  `schema.d.ts` since its regeneration; re-exported under this name so
 *  every existing import of it keeps working unchanged. */
export type ApplicationConclusionOut = components['schemas']['ApplicationConclusionOut'];

/** `ApplicationCardOut`, augmented by INTERSECTION rather than by editing
 *  `schema.d.ts` — `sla_overdue` and `conclusions` are real fields the
 *  backend has answered since 3.9b tasks 4-5, just never added to the
 *  generated type (`docs/plans/06.5-staff-tails.md`'s own finding). Additive
 *  only: if a future regeneration adds either field with an incompatible
 *  type, TypeScript's `&` collapses it to `never` and the build breaks
 *  loudly rather than silently disagreeing. */
export type ApplicationCardOut = components['schemas']['ApplicationCardOut'] & {
  sla_overdue: boolean;
  conclusions: ApplicationConclusionOut[];
};

/** One row of the `info_requests` register — mirrors `app/modules/
 *  applications/schemas.py::TimelineInfoRequestRow`. `responded_at`/
 *  `response_text` are `null` for a still-open pause. */
export interface TimelineInfoRequestRow {
  id: string;
  requested_by: string;
  message: string;
  requested_at: string;
  responded_at: string | null;
  response_text: string | null;
}

/** `ApplicationTimelineOut`, augmented the same way `ApplicationCardOut` is
 *  above — with one twist: `schema.d.ts` already DECLARES `info_requests`
 *  (as `unknown[]`, a stub from before `TimelineInfoRequestRow` existed as
 *  its own schema), so a plain `&` here would intersect `unknown[]` with
 *  `TimelineInfoRequestRow[]` as two unrelated array types rather than
 *  refining the element type — TypeScript does not simplify that to the
 *  narrower array, and every read of `.info_requests` degrades to `{}`.
 *  `Omit` first, so this genuinely REPLACES the stub field instead of
 *  intersecting it. */
export type ApplicationTimelineOut = Omit<components['schemas']['ApplicationTimelineOut'], 'info_requests'> & {
  info_requests: TimelineInfoRequestRow[];
};

export interface ApplicationListFilters {
  status?: ApplicationOut['status'];
  activity_type_id?: string;
  number?: string;
  period_from?: string;
  period_to?: string;
  page: number;
  page_size: number;
}

export function useApplicationsList(filters: ApplicationListFilters) {
  return useQuery({
    queryKey: ['staff', 'applications', filters],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/applications', {
        params: { query: filters },
      });
      if (error) throw apiError(error);
      return data;
    },
    placeholderData: (previous) => previous,
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
    staleTime: 10 * 60_000,
  });
}

export function useLivestockTypes() {
  return useQuery({
    queryKey: ['refs', 'livestock-types'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/refs/livestock-types', {});
      if (error) throw apiError(error);
      return data;
    },
    staleTime: 10 * 60_000,
  });
}

/** `benefit_categories` — the classifier `applications.benefit_category_item_id`
 * belongs to (migration 0005), resolved for the general-info panel. */
export function useBenefitCategories() {
  return useQuery({
    queryKey: ['refs', 'classifiers', 'benefit_categories'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/refs/classifiers/{code}/items', {
        params: { path: { code: 'benefit_categories' } },
      });
      if (error) throw apiError(error);
      return data;
    },
    staleTime: 10 * 60_000,
  });
}

/** `doc_types` — the classifier `ApplicationDocumentIn.doc_type_item_id`
 * belongs to, resolved so the documents panel can name an attachment's kind
 * instead of showing a bare classifier id. */
export function useDocTypes() {
  return useQuery({
    queryKey: ['refs', 'classifiers', 'doc_types'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/refs/classifiers/{code}/items', {
        params: { path: { code: 'doc_types' } },
      });
      if (error) throw apiError(error);
      return data;
    },
    staleTime: 10 * 60_000,
  });
}

/** `GET /files/{id}` streams the bytes directly (no metadata-only route
 * exists) — a plain link to it, opened in a new tab, is the whole download
 * affordance a signed-in staff session needs; the browser sends the session
 * cookie on this top-level navigation the same way it would on any other
 * same-site link. */
export function fileUrl(fileId: string): string {
  const base = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';
  return `${base}/api/v1/files/${fileId}`;
}

/** `rejection_reasons` — RJ-01…RJ-15 (`tz/10` §8.2, migration 0005), the
 * classifier `ApplicationRejectIn.reason_item_id` must belong to. */
export function useRejectionReasons() {
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

/** One contour's own identity (`ContourCardOut`) — `GET /gis/contours/{id}`
 * needs no permission at all (ruling 5), so any staff reader may resolve the
 * plot a worklist row or a card names. Cached per id: several rows on one
 * page routinely share a contour. */
export function useContour(contourId: string | null | undefined) {
  return useQuery({
    queryKey: ['gis', 'contour', contourId],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/gis/contours/{contour_id}', {
        params: { path: { contour_id: contourId! } },
      });
      if (error) throw apiError(error);
      return data;
    },
    enabled: !!contourId,
    staleTime: 5 * 60_000,
  });
}

export function useApplicationCard(applicationId: string) {
  return useQuery({
    queryKey: ['staff', 'application', applicationId],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/applications/{application_id}', {
        params: { path: { application_id: applicationId } },
      });
      if (error) throw apiError(error);
      // The response genuinely carries `sla_overdue`/`conclusions` (3.9b
      // tasks 4-5); only the generated type does not know it yet — see
      // `ApplicationCardOut`'s own docstring above.
      return data as ApplicationCardOut;
    },
  });
}

export function useApplicationTimeline(applicationId: string) {
  return useQuery({
    queryKey: ['staff', 'application', applicationId, 'timeline'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/applications/{application_id}/timeline', {
        params: { path: { application_id: applicationId } },
      });
      if (error) throw apiError(error);
      // The response genuinely carries `info_requests` (3.9b task 4); see
      // `ApplicationTimelineOut`'s own docstring above.
      return data as ApplicationTimelineOut;
    },
  });
}

/** The exact bytes a decision (or the submission) signs —
 * `GET /applications/{id}/package`, priced afresh on every call (ruling 23).
 * Fetched as raw bytes, not through the typed client's JSON path: the route
 * answers `application/octet-stream`, and openapi-fetch's own generated type
 * for it is `unknown` for exactly that reason. */
async function fetchApplicationPackage(applicationId: string): Promise<ArrayBuffer> {
  const { data, error } = await api.GET('/api/v1/applications/{application_id}/package', {
    params: { path: { application_id: applicationId } },
    parseAs: 'arrayBuffer',
  });
  if (error) throw apiError(error);
  return data as ArrayBuffer;
}

/** `staleTime: 0` (the default) and a fresh mount per modal open — the sign
 * modal unmounts on close, so React Query re-fetches on every open, which is
 * what ruling 23 requires: the package must be priced at the moment it is
 * about to be signed, never reused from an earlier open. */
export function useApplicationPackage(applicationId: string) {
  return useQuery({
    queryKey: ['staff', 'application', applicationId, 'package'],
    queryFn: () => fetchApplicationPackage(applicationId),
    retry: false,
  });
}

export function useStartReview(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST('/api/v1/applications/{application_id}/start-review', {
        params: { path: { application_id: applicationId } },
      });
      if (error) throw apiError(error);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff', 'application', applicationId] });
      void queryClient.invalidateQueries({ queryKey: ['staff', 'applications'] });
    },
  });
}

/** Same mutation, callable from a worklist row without navigating to the
 * card first — "taking an application into work" is one of the worklist's
 * own jobs per the task brief. */
export function useStartReviewRow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (applicationId: string) => {
      const { data, error } = await api.POST('/api/v1/applications/{application_id}/start-review', {
        params: { path: { application_id: applicationId } },
      });
      if (error) throw apiError(error);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff', 'applications'] });
    },
  });
}

export function useApprove(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pkcs7: string) => {
      const { data, error } = await api.POST('/api/v1/applications/{application_id}/approve', {
        params: { path: { application_id: applicationId } },
        body: { pkcs7 },
      });
      if (error) throw apiError(error);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff', 'application', applicationId] });
      void queryClient.invalidateQueries({ queryKey: ['staff', 'applications'] });
    },
  });
}

export interface RejectInput {
  pkcs7: string;
  reason_item_id: string;
  legal_basis: string;
}

export function useReject(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RejectInput) => {
      const { data, error } = await api.POST('/api/v1/applications/{application_id}/reject', {
        params: { path: { application_id: applicationId } },
        body: input,
      });
      if (error) throw apiError(error);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff', 'application', applicationId] });
      void queryClient.invalidateQueries({ queryKey: ['staff', 'applications'] });
    },
  });
}

// --- D3 (3.9b task 3-4): return for correction, request-info --------------
//
// Both routes are now present in `schema.d.ts` since its regeneration —
// reached through the ordinary typed `api.POST`. Neither carries a
// `pkcs7`: `applications.review` holds no ERI purpose (`ApplicationReturnIn`'s
// own docstring, `app/modules/applications/schemas.py`).

/** `fields_to_fix` is a JSON OBJECT (field name -> what is wrong with it),
 *  never a bare list of names. */
export type ApplicationReturnIn = components['schemas']['ApplicationReturnIn'];

export function useReturnApplication(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ApplicationReturnIn) => {
      const { data, error } = await api.POST('/api/v1/applications/{application_id}/return', {
        params: { path: { application_id: applicationId } },
        body: input,
      });
      if (error) throw apiError(error);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff', 'application', applicationId] });
      void queryClient.invalidateQueries({ queryKey: ['staff', 'applications'] });
    },
  });
}

export function useRequestInfo(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (message: string) => {
      const { data, error } = await api.POST('/api/v1/applications/{application_id}/request-info', {
        params: { path: { application_id: applicationId } },
        body: { message },
      });
      if (error) throw apiError(error);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff', 'application', applicationId] });
      void queryClient.invalidateQueries({ queryKey: ['staff', 'applications'] });
    },
  });
}

// --- D4 (3.9b task 5): conclusions -----------------------------------------

export type ApplicationConclusionIn = components['schemas']['ApplicationConclusionIn'];

export function useAddConclusion(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ApplicationConclusionIn) => {
      const { data, error } = await api.POST('/api/v1/applications/{application_id}/conclusion', {
        params: { path: { application_id: applicationId } },
        body: input,
      });
      if (error) throw apiError(error);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff', 'application', applicationId] });
    },
  });
}
