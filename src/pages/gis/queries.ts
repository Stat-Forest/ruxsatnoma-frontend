/**
 * React Query hooks over `./api.ts`, in the style of
 * `admin/settings/queries.ts`: the raw route wrappers live in `api.ts`, the
 * hooks (and their cache-update strategy) live here.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Geometry } from 'geojson';
import * as gisApi from './api';
import type {
  ContourIn,
  ContourPatch,
  FeatureIn,
  FeaturePatch,
  LayerPatch,
  VersionIn,
  VersionPatch,
} from './api';
import { rememberNewVersion, rememberVersionUpdate } from './localVersions';

// --- reference ---------------------------------------------------------------

export function useOrganizations() {
  return useQuery({ queryKey: ['gis', 'organizations'], queryFn: gisApi.listOrganizations });
}

export function useUploadFile() {
  return useMutation({ mutationFn: (file: File) => gisApi.uploadFile(file) });
}

// --- layers -------------------------------------------------------------

export function useLayers() {
  return useQuery({ queryKey: ['gis', 'layers'], queryFn: gisApi.listLayers });
}

export function usePatchLayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code, body }: { code: string; body: LayerPatch }) => gisApi.patchLayer(code, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gis', 'layers'] }),
  });
}

export function useLayerFeatures(
  code: string | null,
  status: 'draft' | 'published' | 'archived',
) {
  return useQuery({
    queryKey: ['gis', 'layer-features', code, status],
    queryFn: () => gisApi.listLayerFeatures(code!, { status }),
    enabled: !!code,
  });
}

function invalidateFeatures(queryClient: ReturnType<typeof useQueryClient>, code: string) {
  return queryClient.invalidateQueries({ queryKey: ['gis', 'layer-features', code] });
}

export function useCreateLayerFeature(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: FeatureIn) => gisApi.createLayerFeature(code, body),
    onSuccess: () => invalidateFeatures(queryClient, code),
  });
}

export function usePatchLayerFeature(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ featureId, body }: { featureId: string; body: FeaturePatch }) =>
      gisApi.patchLayerFeature(code, featureId, body),
    onSuccess: () => invalidateFeatures(queryClient, code),
  });
}

export function usePublishLayerFeature(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (featureId: string) => gisApi.publishLayerFeature(code, featureId),
    onSuccess: () => invalidateFeatures(queryClient, code),
  });
}

export function useArchiveLayerFeature(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (featureId: string) => gisApi.archiveLayerFeature(code, featureId),
    onSuccess: () => invalidateFeatures(queryClient, code),
  });
}

// --- contours -------------------------------------------------------------

export function useContours(params: { page: number; page_size?: number; organization_id?: string }) {
  return useQuery({
    queryKey: ['gis', 'contours', params],
    queryFn: () => gisApi.listContours(params),
  });
}

export function useContourFeatures(bbox: string | null, organizationId?: string) {
  return useQuery({
    queryKey: ['gis', 'contour-features', bbox, organizationId],
    queryFn: () => gisApi.listContourFeatures({ bbox: bbox!, organization_id: organizationId }),
    enabled: !!bbox,
    staleTime: 60_000,
  });
}

/** 404s (`ERR-SYS-003`) whenever the contour has no published version yet —
 * that is an ORDINARY, expected outcome here (every brand-new contour starts
 * that way), not a fetch failure, so `retry: false` keeps a missing card from
 * hammering the API three times before the screen can show "not published
 * yet" instead of a spinner.
 *
 * `options.enabled` (default `true`) lets a caller that ALREADY knows the
 * answer skip the round trip entirely rather than wait for a guaranteed
 * 404 — `ContoursTab` uses it for a contour it just created itself: it has
 * zero versions by construction, so there is nothing this route could ever
 * find yet. */
export function useContourCard(contourId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['gis', 'contour-card', contourId],
    queryFn: () => gisApi.getContourCard(contourId!),
    enabled: !!contourId && (options?.enabled ?? true),
    retry: false,
  });
}

export function useCreateContour() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ContourIn) => gisApi.createContour(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gis', 'contours'] }),
  });
}

export function usePatchContour() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ contourId, body }: { contourId: string; body: ContourPatch }) =>
      gisApi.patchContour(contourId, body),
    onSuccess: (_data, { contourId }) => {
      queryClient.invalidateQueries({ queryKey: ['gis', 'contours'] });
      queryClient.invalidateQueries({ queryKey: ['gis', 'contour-card', contourId] });
    },
  });
}

// --- contour versions ---------------------------------------------------
//
// Every mutation below records its result in `./localVersions.ts` (the
// localStorage mitigation) as well as returning it — the ONLY way this
// browser can find the version again once it leaves this page, since no
// `GET` route for a single version exists at all.

export function useCreateVersion(contourId: string) {
  return useMutation({
    mutationFn: (body: VersionIn) => gisApi.createVersion(contourId, body),
    onSuccess: (version, body) => rememberNewVersion(contourId, version, body.geom as unknown as Geometry),
  });
}

export function usePatchVersion(contourId: string) {
  return useMutation({
    mutationFn: ({ versionId, body }: { versionId: string; body: VersionPatch }) =>
      gisApi.patchVersion(contourId, versionId, body),
    onSuccess: (version) => rememberVersionUpdate(contourId, version),
  });
}

export function useCheckVersion(contourId: string) {
  return useMutation({
    mutationFn: (versionId: string) => gisApi.checkVersion(contourId, versionId),
  });
}

function versionMutation(
  contourId: string,
  fn: (contourId: string, versionId: string) => Promise<gisApi.VersionOut>,
) {
  return {
    mutationFn: (versionId: string) => fn(contourId, versionId),
    onSuccess: (version: gisApi.VersionOut) => rememberVersionUpdate(contourId, version),
  };
}

export function useSubmitVersionReview(contourId: string) {
  return useMutation(versionMutation(contourId, gisApi.submitVersionReview));
}

export function useApproveVersion(contourId: string) {
  return useMutation({
    mutationFn: ({ versionId, approvalDocId }: { versionId: string; approvalDocId: string }) =>
      gisApi.approveVersion(contourId, versionId, approvalDocId),
    onSuccess: (version) => rememberVersionUpdate(contourId, version),
  });
}

export function usePublishVersion(contourId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => gisApi.publishVersion(contourId, versionId),
    onSuccess: (version) => {
      rememberVersionUpdate(contourId, version);
      // Publishing is the ONE transition that makes a contour newly
      // discoverable through the ordinary read routes (`list_contours`/
      // `contour_card` join to the published version only) — worth an
      // explicit refresh rather than waiting for the next unrelated refetch.
      queryClient.invalidateQueries({ queryKey: ['gis', 'contours'] });
      queryClient.invalidateQueries({ queryKey: ['gis', 'contour-card', contourId] });
    },
  });
}

export function useReturnVersionToReview(contourId: string) {
  return useMutation(versionMutation(contourId, gisApi.returnVersionToReview));
}

export function useReturnVersionToDraft(contourId: string) {
  return useMutation(versionMutation(contourId, gisApi.returnVersionToDraft));
}

/** `archived` is only reachable from `published` (`TRANSITIONS`) — archiving
 * always ends the one state `list_contours`/`contour_card` can see, so this
 * invalidates them the same way `usePublishVersion` does. */
export function useArchiveVersion(contourId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    ...versionMutation(contourId, gisApi.archiveVersion),
    onSuccess: (version: gisApi.VersionOut) => {
      rememberVersionUpdate(contourId, version);
      queryClient.invalidateQueries({ queryKey: ['gis', 'contours'] });
      queryClient.invalidateQueries({ queryKey: ['gis', 'contour-card', contourId] });
    },
  });
}

// --- geodata import -----------------------------------------------------

export function useCreateImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: gisApi.CreateImportInput) => gisApi.createImport(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gis', 'imports'] }),
  });
}

/** Polls while the batch is still being parsed — `pending`/`processing` are
 * the job's own transient states (`import_service.py`), and there is no
 * push notification path this screen can subscribe to instead. Stops on its
 * own once the row leaves those two states. */
export function useImport(importId: string | null) {
  return useQuery({
    queryKey: ['gis', 'imports', importId],
    queryFn: () => gisApi.getImport(importId!),
    enabled: !!importId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending' || status === 'processing' ? 2000 : false;
    },
  });
}

function importMutation(fn: (importId: string) => Promise<gisApi.ImportOut>) {
  return { mutationFn: fn };
}

export function useSubmitImportReview() {
  return useMutation(importMutation(gisApi.submitImportReview));
}

export function useApproveImport() {
  return useMutation(importMutation(gisApi.approveImport));
}

export function usePublishImport() {
  return useMutation({ mutationFn: (importId: string) => gisApi.publishImport(importId) });
}
