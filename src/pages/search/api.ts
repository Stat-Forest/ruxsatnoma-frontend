/**
 * Typed wrappers around the six `/search*` routes (`app/modules/search/
 * router.py`) — `openapi-fetch`, every type taken from the generated
 * `src/api/schema.d.ts`, never hand-written, in the style of
 * `src/pages/support/tickets/api.ts`.
 *
 * `GET /search` pages via `page`/`page_size` (`app/core/schemas.py::
 * PageParams`), the same convention every module but `norms` uses.
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
