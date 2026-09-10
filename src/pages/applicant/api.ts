/**
 * Thin, typed wrappers around the endpoints the applicant screens (B6/B7/B8)
 * call. Every type comes from the generated `src/api/schema.d.ts` — nothing
 * here is hand-typed (per the task brief: "never hand-write an API type").
 *
 * Deliberately local to `src/pages/applicant/` rather than a shared
 * `src/api/applications.ts`: the staff track (worklist, staff card) touches
 * the same `applications`/`gis` endpoints from its own files, and two tracks
 * editing one shared module is exactly the merge-conflict risk the sprint
 * plan asks each track to avoid by duplicating a small helper instead.
 */
import { api } from '../../api/client';
import { apiError } from '../../api/errors';
import type { components } from '../../api/schema';

export type ApplicationOut = components['schemas']['ApplicationOut'];
export type ApplicationCardOut = components['schemas']['ApplicationCardOut'];
export type ApplicationPatch = components['schemas']['ApplicationPatch'];
export type ApplicationStatus = ApplicationOut['status'];
export type ApplicationItemIn = components['schemas']['ApplicationItemIn'];
export type ApplicationDocumentOut = components['schemas']['ApplicationDocumentOut'];
export type ApplicationCheckOut = components['schemas']['ApplicationCheckOut'];
export type ApplicationTimelineOut = components['schemas']['ApplicationTimelineOut'];
export type PrecheckOut = components['schemas']['PrecheckOut'];
export type ActivityTypeOut = components['schemas']['ActivityTypeOut'];
export type LivestockTypeOut = components['schemas']['LivestockTypeOut'];
export type ClassifierItemOut = components['schemas']['ClassifierItemOut'];
export type ContourListItem = components['schemas']['ContourListItem'];
export type ContourCardOut = components['schemas']['ContourCardOut'];
export type OrganizationOut = components['schemas']['OrganizationOut'];
export type InvoiceOut = components['schemas']['InvoiceOut'];
export type CalculationIn = components['schemas']['CalculationIn'];
export type FileOut = components['schemas']['FileOut'];

export interface Paged<T> {
  items: T[];
  total: number;
}

export interface ListApplicationsParams {
  page?: number;
  page_size?: number;
  status?: ApplicationStatus;
  activity_type_id?: string;
  number?: string;
  period_from?: string;
  period_to?: string;
}

export async function listApplications(params: ListApplicationsParams): Promise<Paged<ApplicationOut>> {
  const { data, error } = await api.GET('/api/v1/applications', { params: { query: params } });
  if (error) throw apiError(error);
  return data;
}

export async function createApplicationDraft(body: {
  on_behalf: 'self' | 'legal';
  applicant_id?: string | null;
}): Promise<ApplicationOut> {
  const { data, error } = await api.POST('/api/v1/applications', { body });
  if (error) throw apiError(error);
  return data;
}

export async function patchApplication(id: string, body: ApplicationPatch): Promise<ApplicationOut> {
  const { data, error } = await api.PATCH('/api/v1/applications/{application_id}', {
    params: { path: { application_id: id } },
    body,
  });
  if (error) throw apiError(error);
  return data;
}

export async function getApplicationCard(id: string): Promise<ApplicationCardOut> {
  const { data, error } = await api.GET('/api/v1/applications/{application_id}', {
    params: { path: { application_id: id } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function addApplicationDocument(
  id: string,
  body: { doc_type_item_id: string; file_id: string; note?: string | null },
): Promise<ApplicationDocumentOut> {
  const { data, error } = await api.POST('/api/v1/applications/{application_id}/documents', {
    params: { path: { application_id: id } },
    body,
  });
  if (error) throw apiError(error);
  return data;
}

export async function removeApplicationDocument(id: string, documentId: string): Promise<void> {
  const { error } = await api.DELETE('/api/v1/applications/{application_id}/documents/{document_id}', {
    params: { path: { application_id: id, document_id: documentId } },
  });
  if (error) throw apiError(error);
}

export async function precheckApplication(id: string): Promise<PrecheckOut> {
  const { data, error } = await api.POST('/api/v1/applications/{application_id}/precheck', {
    params: { path: { application_id: id } },
  });
  if (error) throw apiError(error);
  return data;
}

/** The canonical bytes to sign — the client hashes exactly this, mock ERI or
 * real. `parseAs: 'arrayBuffer'` is what lets us hash the OCTET bytes rather
 * than something re-encoded through a string round trip. */
export async function getApplicationPackage(id: string): Promise<ArrayBuffer> {
  const { data, error } = await api.GET('/api/v1/applications/{application_id}/package', {
    params: { path: { application_id: id } },
    parseAs: 'arrayBuffer',
  });
  if (error) throw apiError(error);
  return data;
}

export async function submitApplication(id: string, pkcs7: string): Promise<ApplicationOut> {
  const { data, error } = await api.POST('/api/v1/applications/{application_id}/submit', {
    params: { path: { application_id: id } },
    body: { pkcs7 },
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
  if (error) throw apiError(error);
  return data;
}

export async function getApplicationTimeline(id: string): Promise<ApplicationTimelineOut> {
  const { data, error } = await api.GET('/api/v1/applications/{application_id}/timeline', {
    params: { path: { application_id: id } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function listActivityTypes(): Promise<ActivityTypeOut[]> {
  const { data, error } = await api.GET('/api/v1/refs/activity-types', {});
  if (error) throw apiError(error);
  return data;
}

export async function listLivestockTypes(): Promise<LivestockTypeOut[]> {
  const { data, error } = await api.GET('/api/v1/refs/livestock-types', {});
  if (error) throw apiError(error);
  return data;
}

export async function listClassifierItems(code: string): Promise<ClassifierItemOut[]> {
  const { data, error } = await api.GET('/api/v1/refs/classifiers/{code}/items', {
    params: { path: { code } },
  });
  if (error) throw apiError(error);
  return data;
}

async function listOrganizationsUnder(parentId: string | undefined): Promise<OrganizationOut[]> {
  const { data, error } = await api.GET('/api/v1/refs/organizations', {
    params: { query: { page_size: 100, parent_id: parentId } },
  });
  if (error) throw apiError(error);
  return data.items;
}

/** The full organization tree, flattened — `GET /refs/organizations`'
 * `parent_id` is a STRICT filter (omitted/`undefined` means "top-level
 * only", never "every organization"), so a picker that needs to label a
 * leshoz by name has to walk it one level at a time. This demo's data is two
 * levels deep (the agency, then its leshozes), so one extra round trip per
 * root covers it; a deeper tree would need this to recurse. */
export async function listOrganizations(): Promise<OrganizationOut[]> {
  const roots = await listOrganizationsUnder(undefined);
  const children = await Promise.all(roots.map((root) => listOrganizationsUnder(root.id)));
  return [...roots, ...children.flat()];
}

export async function listContours(params: {
  page?: number;
  page_size?: number;
  organization_id?: string;
}): Promise<Paged<ContourListItem>> {
  const { data, error } = await api.GET('/api/v1/gis/contours', { params: { query: params } });
  if (error) throw apiError(error);
  return data;
}

/** Every published contour the caller may see inside `bbox`, as GeoJSON —
 * what the map draws before anything is picked. `GET /gis/contours` above is
 * the same contours as a paged list with NO geometry, so it cannot feed a map.
 *
 * `bbox` is the viewport, `min_lon,min_lat,max_lon,max_lat`. Sending one is
 * not optional in practice: without it the server answers every published
 * contour the caller may see — ~13,500 rows once the leshozes land — and sets
 * `truncated` to say the answer was clipped.
 *
 * `organizationId` narrows the browsable layer to one leshoz, the same
 * `organization_id` filter `listContours` already sends to the paged list
 * (T2, demo remark 2026-09-10) — so picking a leshoz narrows the MAP, not
 * only the list beside it. */
export async function listContourFeatures(
  bbox: string,
  organizationId?: string | null,
): Promise<ContourFeatureCollection> {
  const { data, error } = await api.GET('/api/v1/gis/contours/features', {
    params: { query: { bbox, organization_id: organizationId ?? undefined } },
  });
  if (error) throw apiError(error);
  // Through `unknown` because the server's own schema types a feature as an
  // opaque `dict[str, Any]` (`FeatureCollectionOut`, shared with the layers
  // endpoint), so the generated types carry no shape to narrow from. The
  // interface below is that shape, asserted here rather than inferred.
  return data as unknown as ContourFeatureCollection;
}

export interface ContourFeature {
  type: 'Feature';
  id: string;
  geometry: Record<string, unknown>;
  properties: { contour_id: string; number: string; organization_id: string; area_ha: string };
}

export interface ContourFeatureCollection {
  type: 'FeatureCollection';
  /** The server hit its own cap and this collection is a prefix of the match.
   * Only reachable with no bbox or an enormous one — the map always sends its
   * viewport — but a client that ignored it would silently draw a partial
   * layer as if it were the whole one. */
  truncated: boolean;
  features: ContourFeature[];
}

export async function getContourCard(id: string): Promise<ContourCardOut> {
  const { data, error } = await api.GET('/api/v1/gis/contours/{contour_id}', {
    params: { path: { contour_id: id } },
  });
  if (error) throw apiError(error);
  return data;
}

/** One row of `POST /calculations/preview`'s `checks[]` —
 * `norms.checks.CheckResult` (a `TypedDict`, `norms/checks.py`), NOT
 * `ApplicationCheckOut`: this endpoint stores nothing, so there is no id, no
 * `check_type` (the field is called `check`, and its values are the
 * PRE-ruling-21 names — `season`, `rotation`, `norm`, `fire_ban`,
 * `restrictions`, `limit` — never `norm_season` etc.), no `source`, no
 * `checked_at`. Conflating this with the precheck endpoint's real
 * `application_checks` rows is exactly the bug `ChecksList.fromPreviewChecks`
 * exists to avoid. */
export interface PreviewCheck {
  check: string;
  result: string;
  details: unknown;
}

/** Returns the free-form preview body as-is (`service.preview`'s own JSON —
 * no fixed `response_model` on the backend route). A BLOCKING check comes
 * back inside `checks[]` at 200; only a broken INPUT (`ERR-NORM-004`,
 * `ERR-VAL-001`) throws. */
export async function previewCalculation(body: CalculationIn): Promise<{
  amount: string;
  used_sb: string | null;
  max_sb: number | null;
  remaining_sb: string | null;
  breakdown: unknown[];
  rule_code_version: string;
  checks: PreviewCheck[];
}> {
  const { data, error } = await api.POST('/api/v1/calculations/preview', { body });
  if (error) throw apiError(error);
  return data as {
    amount: string;
    used_sb: string | null;
    max_sb: number | null;
    remaining_sb: string | null;
    breakdown: unknown[];
    rule_code_version: string;
    checks: PreviewCheck[];
  };
}

/** `POST /files` is multipart; the generated type for its body is the FastAPI
 * `UploadFile` field typed as a plain `string`, which is what every
 * openapi-typescript binary field degrades to. openapi-fetch's own
 * `defaultBodySerializer` special-cases a `FormData` instance and sends it
 * through untouched (`node_modules/openapi-fetch/src/index.js`), so the cast
 * below is the documented way to pass one through a typed client — not a
 * type-safety hole anywhere else in this file. */
export async function uploadFile(file: File): Promise<FileOut> {
  const form = new FormData();
  form.append('file', file);
  const { data, error } = await api.POST('/api/v1/files', {
    body: form as unknown as { file: string },
  });
  if (error) throw apiError(error);
  return data;
}

export async function listInvoicesForApplication(applicationId: string): Promise<InvoiceOut[]> {
  const { data, error } = await api.GET('/api/v1/invoices', {
    params: { query: { application_id: applicationId, limit: 50, offset: 0 } },
  });
  if (error) throw apiError(error);
  return data.items;
}
