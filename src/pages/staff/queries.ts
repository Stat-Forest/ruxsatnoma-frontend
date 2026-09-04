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
export type ApplicationCardOut = components['schemas']['ApplicationCardOut'];
export type ApplicationTimelineOut = components['schemas']['ApplicationTimelineOut'];
export type ApplicationDecisionOut = components['schemas']['ApplicationDecisionOut'];
export type ActivityTypeOut = components['schemas']['ActivityTypeOut'];
export type ClassifierItemOut = components['schemas']['ClassifierItemOut'];
export type ContourCardOut = components['schemas']['ContourCardOut'];

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
      return data;
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
      return data;
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
