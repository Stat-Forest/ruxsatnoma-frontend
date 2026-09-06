/**
 * Thin, typed wrappers around every `/gis/*` route (F1-F4, track F1 of the
 * stage 4+6 fleet). Every type comes from the generated `src/api/schema.d.ts`
 * — nothing here is hand-typed, per the project's standing rule. Deliberately
 * local to `src/pages/gis/` rather than a shared `src/api/gis.ts` — the same
 * reasoning `applicant/api.ts` gives for its own duplication: two tracks
 * editing one shared module is the merge-conflict risk the fleet asks each
 * track to avoid.
 */
import { api } from '../../api/client';
import { apiError } from '../../api/errors';
import type { components } from '../../api/schema';

export type LayerOut = components['schemas']['LayerOut'];
export type LayerPatch = components['schemas']['LayerPatch'];
export type ContourIn = components['schemas']['ContourIn'];
export type ContourOut = components['schemas']['ContourOut'];
export type ContourPatch = components['schemas']['ContourPatch'];
export type ContourListItem = components['schemas']['ContourListItem'];
export type ContourCardOut = components['schemas']['ContourCardOut'];
export type VersionIn = components['schemas']['VersionIn'];
export type VersionOut = components['schemas']['VersionOut'];
export type VersionPatch = components['schemas']['VersionPatch'];
export type CheckResultOut = components['schemas']['CheckResultOut'];
export type ChecksOut = components['schemas']['ChecksOut'];
export type FeatureIn = components['schemas']['FeatureIn'];
export type FeatureOut = components['schemas']['FeatureOut'];
export type FeaturePatch = components['schemas']['FeaturePatch'];
export type ImportOut = components['schemas']['ImportOut'];
export type PublishImportOut = components['schemas']['PublishImportOut'];
export type FeatureCollectionOut = components['schemas']['FeatureCollectionOut'];
export type OrganizationOut = components['schemas']['OrganizationOut'];
export type FileOut = components['schemas']['FileOut'];

export interface Paged<T> {
  items: T[];
  total: number;
}

// --- layers -------------------------------------------------------------

export async function listLayers(): Promise<LayerOut[]> {
  const { data, error } = await api.GET('/api/v1/gis/layers', {});
  if (error) throw apiError(error);
  return data.items;
}

/** The layer catalogue is a fixed 15-row list, not admin CRUD
 * (`gis/models.py::LAYER_CODES`) — resolving `contours`' own id is a lookup
 * every contour-creating caller needs exactly once before its one write. */
export async function getContoursLayerId(): Promise<string | null> {
  const layers = await listLayers();
  return layers.find((l) => l.code === 'contours')?.id ?? null;
}

export async function patchLayer(code: string, body: LayerPatch): Promise<LayerOut> {
  const { data, error } = await api.PATCH('/api/v1/gis/layers/{code}', {
    params: { path: { code } },
    body,
  });
  if (error) throw apiError(error);
  return data;
}

export async function listLayerFeatures(
  code: string,
  params: { bbox?: string; valid_on?: string; status?: 'draft' | 'published' | 'archived'; import_id?: string },
): Promise<FeatureCollectionOut> {
  const { data, error } = await api.GET('/api/v1/gis/layers/{code}/features', {
    params: { path: { code }, query: params },
  });
  if (error) throw apiError(error);
  return data;
}

export async function createLayerFeature(
  code: string,
  body: FeatureIn,
): Promise<FeatureOut> {
  const { data, error } = await api.POST('/api/v1/gis/layers/{code}/features', {
    params: { path: { code } },
    body,
  });
  if (error) throw apiError(error);
  return data;
}

export async function patchLayerFeature(
  code: string,
  featureId: string,
  body: FeaturePatch,
): Promise<FeatureOut> {
  const { data, error } = await api.PATCH('/api/v1/gis/layers/{code}/features/{feature_id}', {
    params: { path: { code, feature_id: featureId } },
    body,
  });
  if (error) throw apiError(error);
  return data;
}

export async function publishLayerFeature(code: string, featureId: string): Promise<FeatureOut> {
  const { data, error } = await api.POST('/api/v1/gis/layers/{code}/features/{feature_id}/publish', {
    params: { path: { code, feature_id: featureId } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function archiveLayerFeature(code: string, featureId: string): Promise<FeatureOut> {
  const { data, error } = await api.POST('/api/v1/gis/layers/{code}/features/{feature_id}/archive', {
    params: { path: { code, feature_id: featureId } },
  });
  if (error) throw apiError(error);
  return data;
}

// --- contours -------------------------------------------------------------

export async function listContours(params: {
  page?: number;
  page_size?: number;
  organization_id?: string;
  bbox?: string;
}): Promise<Paged<ContourListItem>> {
  const { data, error } = await api.GET('/api/v1/gis/contours', { params: { query: params } });
  if (error) throw apiError(error);
  return data;
}

/** Every published contour in `bbox`, as GeoJSON — the browsable layer a map
 * draws under whatever the operator is currently working on. No paging: a
 * viewport is not a page (`gis/router.py`'s own docstring). */
export async function listContourFeatures(params: {
  bbox?: string;
  organization_id?: string;
}): Promise<FeatureCollectionOut> {
  const { data, error } = await api.GET('/api/v1/gis/contours/features', {
    params: { query: params },
  });
  if (error) throw apiError(error);
  return data;
}

/** 404s (`ERR-SYS-003`) when the contour has no PUBLISHED version yet — true
 * for every brand-new contour until its first version clears the whole
 * lifecycle. Callers must treat that 404 as "nothing published yet", not as
 * "no such contour". */
export async function getContourCard(contourId: string): Promise<ContourCardOut> {
  const { data, error } = await api.GET('/api/v1/gis/contours/{contour_id}', {
    params: { path: { contour_id: contourId } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function createContour(body: ContourIn): Promise<ContourOut> {
  const { data, error } = await api.POST('/api/v1/gis/contours', { body });
  if (error) throw apiError(error);
  return data;
}

export async function patchContour(contourId: string, body: ContourPatch): Promise<ContourOut> {
  const { data, error } = await api.PATCH('/api/v1/gis/contours/{contour_id}', {
    params: { path: { contour_id: contourId } },
    body,
  });
  if (error) throw apiError(error);
  return data;
}

// --- contour versions -------------------------------------------------------

export async function createVersion(contourId: string, body: VersionIn): Promise<VersionOut> {
  const { data, error } = await api.POST('/api/v1/gis/contours/{contour_id}/versions', {
    params: { path: { contour_id: contourId } },
    body,
  });
  if (error) throw apiError(error);
  return data;
}

export async function patchVersion(
  contourId: string,
  versionId: string,
  body: VersionPatch,
): Promise<VersionOut> {
  const { data, error } = await api.PATCH(
    '/api/v1/gis/contours/{contour_id}/versions/{version_id}',
    { params: { path: { contour_id: contourId, version_id: versionId } }, body },
  );
  if (error) throw apiError(error);
  return data;
}

/** Read-only (`gis.service.run_version_checks`'s own docstring: "changes
 * nothing, no audit row") — safe to call speculatively, e.g. to refresh the
 * report before deciding whether Publish should be enabled. */
export async function checkVersion(contourId: string, versionId: string): Promise<ChecksOut> {
  const { data, error } = await api.POST(
    '/api/v1/gis/contours/{contour_id}/versions/{version_id}/checks',
    { params: { path: { contour_id: contourId, version_id: versionId } } },
  );
  if (error) throw apiError(error);
  return data;
}

export async function submitVersionReview(contourId: string, versionId: string): Promise<VersionOut> {
  const { data, error } = await api.POST(
    '/api/v1/gis/contours/{contour_id}/versions/{version_id}/submit-review',
    { params: { path: { contour_id: contourId, version_id: versionId } } },
  );
  if (error) throw apiError(error);
  return data;
}

export async function approveVersion(
  contourId: string,
  versionId: string,
  approvalDocId: string,
): Promise<VersionOut> {
  const { data, error } = await api.POST(
    '/api/v1/gis/contours/{contour_id}/versions/{version_id}/approve',
    {
      params: { path: { contour_id: contourId, version_id: versionId } },
      body: { approval_doc_id: approvalDocId },
    },
  );
  if (error) throw apiError(error);
  return data;
}

export async function publishVersion(contourId: string, versionId: string): Promise<VersionOut> {
  const { data, error } = await api.POST(
    '/api/v1/gis/contours/{contour_id}/versions/{version_id}/publish',
    { params: { path: { contour_id: contourId, version_id: versionId } } },
  );
  if (error) throw apiError(error);
  return data;
}

export async function returnVersionToReview(contourId: string, versionId: string): Promise<VersionOut> {
  const { data, error } = await api.POST(
    '/api/v1/gis/contours/{contour_id}/versions/{version_id}/return-to-review',
    { params: { path: { contour_id: contourId, version_id: versionId } } },
  );
  if (error) throw apiError(error);
  return data;
}

export async function returnVersionToDraft(contourId: string, versionId: string): Promise<VersionOut> {
  const { data, error } = await api.POST(
    '/api/v1/gis/contours/{contour_id}/versions/{version_id}/return-to-draft',
    { params: { path: { contour_id: contourId, version_id: versionId } } },
  );
  if (error) throw apiError(error);
  return data;
}

export async function archiveVersion(contourId: string, versionId: string): Promise<VersionOut> {
  const { data, error } = await api.POST(
    '/api/v1/gis/contours/{contour_id}/versions/{version_id}/archive',
    { params: { path: { contour_id: contourId, version_id: versionId } } },
  );
  if (error) throw apiError(error);
  return data;
}

// --- geodata import ---------------------------------------------------------

export interface CreateImportInput {
  file: File;
  layer_code: string;
  organization_id: string;
  approval_doc_id: string;
  format: string;
  attributes: Record<string, string>;
}

/** Multipart, like `applicant/api.ts::uploadFile` — the generated body type
 * for an `UploadFile` field degrades to a plain `string`, and openapi-fetch's
 * `defaultBodySerializer` special-cases a real `FormData` and sends it
 * through untouched, so the cast is the documented way through a typed
 * client, not a hole elsewhere in this file.
 *
 * `Idempotency-Key` is MANDATORY on this route (`imports_router.py`'s own
 * docstring) — a retried or double-clicked upload without one files a SECOND
 * batch that then succeeds, with no delete path for the duplicate. */
export async function createImport(input: CreateImportInput): Promise<{ import_id: string }> {
  const form = new FormData();
  form.append('file', input.file);
  form.append('layer_code', input.layer_code);
  form.append('organization_id', input.organization_id);
  form.append('approval_doc_id', input.approval_doc_id);
  form.append('format', input.format);
  form.append('attributes', JSON.stringify(input.attributes));
  const { data, error } = await api.POST('/api/v1/gis/imports', {
    body: form as unknown as { file: string; layer_code: string; organization_id: string; approval_doc_id: string; format: string; attributes: string },
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
  if (error) throw apiError(error);
  return data;
}

export interface ListImportsParams {
  status?: string;
  page: number;
  page_size: number;
}

/**
 * F12c — `GET /gis/imports`, verified against a regenerated `schema.d.ts`
 * (the version this file was written against had no `get` on this path at
 * all, per `./imports/localImports.ts`'s own comment — that gap has closed).
 * Zone-scoping and the permission gate are the service layer's concern, the
 * same as every other list route here.
 */
export async function listImports(params: ListImportsParams): Promise<Paged<ImportOut>> {
  const { data, error } = await api.GET('/api/v1/gis/imports', { params: { query: params } });
  if (error) throw apiError(error);
  return data;
}

export async function getImport(importId: string): Promise<ImportOut> {
  const { data, error } = await api.GET('/api/v1/gis/imports/{import_id}', {
    params: { path: { import_id: importId } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function submitImportReview(importId: string): Promise<ImportOut> {
  const { data, error } = await api.POST('/api/v1/gis/imports/{import_id}/submit-review', {
    params: { path: { import_id: importId } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function approveImport(importId: string): Promise<ImportOut> {
  const { data, error } = await api.POST('/api/v1/gis/imports/{import_id}/approve', {
    params: { path: { import_id: importId } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function publishImport(importId: string): Promise<PublishImportOut> {
  const { data, error } = await api.POST('/api/v1/gis/imports/{import_id}/publish', {
    params: { path: { import_id: importId } },
  });
  if (error) throw apiError(error);
  return data;
}

// --- shared reference reads --------------------------------------------------

async function listOrganizationsUnder(parentId: string | undefined): Promise<OrganizationOut[]> {
  const { data, error } = await api.GET('/api/v1/refs/organizations', {
    params: { query: { page_size: 100, parent_id: parentId } },
  });
  if (error) throw apiError(error);
  return data.items;
}

/** The full organization tree, flattened — same two-level walk
 * `applicant/api.ts::listOrganizations` documents (duplicated rather than
 * imported, for the same cross-track reason as this whole file). */
export async function listOrganizations(): Promise<OrganizationOut[]> {
  const roots = await listOrganizationsUnder(undefined);
  const children = await Promise.all(roots.map((root) => listOrganizationsUnder(root.id)));
  return [...roots, ...children.flat()];
}

/** `POST /files` — the approval decree a version/import/feature's approval
 * references. Same cast rationale as `createImport` above. */
export async function uploadFile(file: File): Promise<FileOut> {
  const form = new FormData();
  form.append('file', file);
  const { data, error } = await api.POST('/api/v1/files', {
    body: form as unknown as { file: string },
  });
  if (error) throw apiError(error);
  return data;
}
