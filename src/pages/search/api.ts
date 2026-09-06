/**
 * Typed wrappers around the ten `/search*` routes (`app/modules/search/
 * router.py`) — `openapi-fetch`, every type taken from the generated
 * `src/api/schema.d.ts`, never hand-written, in the style of
 * `src/pages/support/tickets/api.ts`.
 *
 * `GET /search` pages via `page`/`page_size` (`app/core/schemas.py::
 * PageParams`), the same convention every module but `norms` uses.
 *
 * С22 (decision #98): the four `/search/exports*` routes at the bottom.
 * `POST`/list/get answer JSON through the typed client same as everything
 * above; `.../file` answers a binary body, so it bypasses that client the
 * same way `src/pages/reports/api.ts::fetchExport` does for its own
 * `export.xlsx`/`export.pdf` — openapi-fetch parses every response as JSON.
 */
import { api } from '../../api/client';
import { apiError } from '../../api/errors';
import type { components } from '../../api/schema';

export type SearchKind = 'applications' | 'permits';
export type SearchResultOut = components['schemas']['SearchResultOut'];
export type SearchResultPage = components['schemas']['Page_SearchResultOut_'];
export type SavedFilterOut = components['schemas']['SavedFilterOut'];
export type SavedFilterIn = components['schemas']['SavedFilterIn'];
export type SavedFilterPatch = components['schemas']['SavedFilterPatch'];
export type ExportFormat = 'pdf' | 'xlsx';
export type ExportCreate = components['schemas']['ExportCreate'];
export type ExportJobOut = components['schemas']['ExportJobOut'];

export interface SearchParams {
  kind: SearchKind;
  q?: string;
  status?: string;
  organization_id?: string;
  activity_type_id?: string;
  series?: string;
  page: number;
  page_size: number;
}

export async function search(params: SearchParams): Promise<SearchResultPage> {
  const { data, error } = await api.GET('/api/v1/search', {
    params: {
      query: {
        kind: params.kind,
        q: params.q || undefined,
        status: params.status || undefined,
        organization_id: params.organization_id || undefined,
        activity_type_id: params.activity_type_id || undefined,
        series: params.series || undefined,
        page: params.page,
        page_size: params.page_size,
      },
    },
  });
  if (error) throw apiError(error);
  return data;
}

export async function listProfiles(): Promise<SavedFilterOut[]> {
  const { data, error } = await api.GET('/api/v1/search/profiles', {});
  if (error) throw apiError(error);
  return data;
}

export async function createProfile(body: SavedFilterIn): Promise<SavedFilterOut> {
  const { data, error } = await api.POST('/api/v1/search/profiles', { body });
  if (error) throw apiError(error);
  return data;
}

export async function updateProfile(profileId: string, patch: SavedFilterPatch): Promise<SavedFilterOut> {
  const { data, error } = await api.PATCH('/api/v1/search/profiles/{profile_id}', {
    params: { path: { profile_id: profileId } },
    body: patch,
  });
  if (error) throw apiError(error);
  return data;
}

export async function deleteProfile(profileId: string): Promise<void> {
  const { error } = await api.DELETE('/api/v1/search/profiles/{profile_id}', {
    params: { path: { profile_id: profileId } },
  });
  if (error) throw apiError(error);
}

// --- exports (С22, decision #98) ------------------------------------------

export async function createExport(body: ExportCreate): Promise<ExportJobOut> {
  const { data, error } = await api.POST('/api/v1/search/exports', { body });
  if (error) throw apiError(error);
  return data;
}

export async function listExports(): Promise<ExportJobOut[]> {
  const { data, error } = await api.GET('/api/v1/search/exports', {});
  if (error) throw apiError(error);
  return data;
}

// Binary response, outside the typed JSON client — same reasoning as
// `src/pages/reports/api.ts::fetchExport`.
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

export async function fetchExportFile(jobId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/v1/search/exports/${jobId}/file`, {
    credentials: 'include',
  });
  if (!res.ok) {
    let message = `Faylni yuklab boʻlmadi (${res.status})`;
    try {
      const body = (await res.clone().json()) as { error?: { message?: string } };
      if (body?.error?.message) message = body.error.message;
    } catch {
      // The body was not JSON — the fallback message above stays.
    }
    throw new Error(message);
  }
  return res.blob();
}
