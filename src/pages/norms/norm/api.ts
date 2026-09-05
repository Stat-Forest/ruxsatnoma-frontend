/**
 * F5 — norms. Named `norm/` (singular), not `norms/` — the plural would
 * collide with the page directory itself (`pages/norms/norm/api.ts` reads;
 * `pages/norms/norms/api.ts` does not).
 *
 * Unlike F6/F7 (`{ item, warnings }` from `/publish`, a bare row from
 * `/archive` — two different shapes), EVERY ONE of `POST`/`PATCH` and all
 * six lifecycle routes below answers `NormOut` DIRECTLY (task-6 brief's own
 * warning: "do not assume one shape for both halves of this track"). That
 * is what makes `transitionNorm` below a single parameterised function
 * rather than six near-duplicates — there is no shape difference between
 * the six calls for a shared implementation to paper over, unlike
 * `params/queries.ts`'s explicit choice to keep `usePublishRuleParameter`/
 * `useArchiveRuleParameter` separate specifically BECAUSE their responses
 * differ.
 */
import { api } from '../../../api/client';
import { apiError } from '../../../api/errors';
import type { components } from '../../../api/schema';

export type NormOut = components['schemas']['NormOut'];
export type NormPage = components['schemas']['Page_NormOut_'];
export type NormIn = components['schemas']['NormIn'];
export type NormPatch = components['schemas']['NormPatch'];
export type FileOut = components['schemas']['FileOut'];
export type ContourListItem = components['schemas']['ContourListItem'];
export type ContourPage = components['schemas']['Page_ContourListItem_'];

export interface NormListParams {
  contour_id?: string;
  activity_type_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export async function listNorms(params: NormListParams): Promise<NormPage> {
  const { data, error } = await api.GET('/api/v1/norms', { params: { query: params } });
  if (error) throw apiError(error);
  return data;
}

export async function createNorm(body: NormIn): Promise<NormOut> {
  const { data, error } = await api.POST('/api/v1/norms', { body });
  if (error) throw apiError(error);
  return data;
}

/** `NormPatch` excludes `contour_id`/`activity_type_id` — identity, the same
 *  reason `TariffPatch` excludes its own key fields. */
export async function patchNorm(normId: string, body: NormPatch): Promise<NormOut> {
  const { data, error } = await api.PATCH('/api/v1/norms/{norm_id}', {
    params: { path: { norm_id: normId } },
    body,
  });
  if (error) throw apiError(error);
  return data;
}

export type NormTransitionAction =
  | 'submit-review'
  | 'return-to-draft'
  | 'return-to-review'
  | 'publish'
  | 'archive';

const TRANSITION_PATH = {
  'submit-review': '/api/v1/norms/{norm_id}/submit-review',
  'return-to-draft': '/api/v1/norms/{norm_id}/return-to-draft',
  'return-to-review': '/api/v1/norms/{norm_id}/return-to-review',
  publish: '/api/v1/norms/{norm_id}/publish',
  archive: '/api/v1/norms/{norm_id}/archive',
} as const;

/** The five transitions that take NO body at all — `approve` is deliberately
 *  excluded (it carries `NormApproveIn.approval_doc_id`) and kept as its own
 *  `approveNorm` below, the same way this module keeps a payload-bearing
 *  call separate rather than forcing an optional-body parameter through a
 *  shared function for one outlier. */
export async function transitionNorm(action: NormTransitionAction, normId: string): Promise<NormOut> {
  const { data, error } = await api.POST(TRANSITION_PATH[action], {
    params: { path: { norm_id: normId } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function approveNorm(normId: string, approvalDocId: string): Promise<NormOut> {
  const { data, error } = await api.POST('/api/v1/norms/{norm_id}/approve', {
    params: { path: { norm_id: normId } },
    body: { approval_doc_id: approvalDocId },
  });
  if (error) throw apiError(error);
  return data;
}

/** `geobotanic_doc_id`/`approval_doc_id` both name a `media_files` row —
 *  `POST /files` is the one upload route the whole app shares
 *  (`applicant/api.ts::uploadFile`'s identical body). Duplicated here rather
 *  than imported, per this track's own "each screen keeps its own copy of a
 *  small reference call" precedent (`params/valueEditor.ts`'s file header;
 *  `tariffs/api.ts::listBenefitCategories`'s identical note). */
export async function uploadDocument(file: File): Promise<FileOut> {
  const form = new FormData();
  form.append('file', file);
  const { data, error } = await api.POST('/api/v1/files', {
    body: form as unknown as { file: string },
  });
  if (error) throw apiError(error);
  return data;
}

export function fileUrl(fileId: string): string {
  const base = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';
  return `${base}/api/v1/files/${fileId}`;
}

export interface ContourListParams {
  page?: number;
  page_size?: number;
}

/** `GET /gis/contours` — published contours only (its own docstring, quoted
 *  in `ContourSearchField.tsx`), attributes only, no geometry. Feeds the
 *  create form's contour picker; no full map here (task-6 brief asks for
 *  the lifecycle screen, not a GIS picker) — a text search over the same
 *  list `applicant/wizard/ContourPicker.tsx`'s own list column already
 *  uses. */
export async function listContours(params: ContourListParams): Promise<ContourPage> {
  const { data, error } = await api.GET('/api/v1/gis/contours', { params: { query: params } });
  if (error) throw apiError(error);
  return data;
}
