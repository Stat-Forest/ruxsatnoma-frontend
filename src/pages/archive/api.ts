/**
 * Typed wrappers around the four `/archive*` routes (`app/modules/archive/
 * router.py`) — `openapi-fetch`, every type taken from the generated
 * `src/api/schema.d.ts`, never hand-written, in the style of
 * `src/pages/support/tickets/api.ts`.
 *
 * Reads (`GET /archive`, `GET /archive/{id}`) require `archive.view`;
 * archiving and verifying require `archive.manage` (F23,
 * `docs/plans/07.3-findings.md` — the two used to share one code). Which
 * button a caller sees is decided in `ArchivePage.tsx` with `satisfies(...)`,
 * never here — this file is a plain HTTP layer.
 */
import { api } from '../../api/client';
import { apiError } from '../../api/errors';
import type { components } from '../../api/schema';

export type ArchiveObjectType = 'application' | 'permit';
export type ArchiveItemStatus = 'stored' | 'verified';
export type ArchiveItemOut = components['schemas']['ArchiveItemOut'];
export type ArchiveItemPage = components['schemas']['Page_ArchiveItemOut_'];

export interface ArchiveListParams {
  object_type?: ArchiveObjectType;
  status?: ArchiveItemStatus;
  page: number;
  page_size: number;
}

export async function listArchiveItems(params: ArchiveListParams): Promise<ArchiveItemPage> {
  const { data, error } = await api.GET('/api/v1/archive', {
    params: {
      query: {
        object_type: params.object_type,
        status: params.status,
        page: params.page,
        page_size: params.page_size,
      },
    },
  });
  if (error) throw apiError(error);
  return data;
}

export async function getArchiveItem(itemId: string): Promise<ArchiveItemOut> {
  const { data, error } = await api.GET('/api/v1/archive/{item_id}', {
    params: { path: { item_id: itemId } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function archiveObject(
  objectType: ArchiveObjectType,
  objectId: string,
  retentionUntil: string | null,
): Promise<ArchiveItemOut> {
  const { data, error } = await api.POST('/api/v1/archive/{object_type}/{object_id}', {
    params: { path: { object_type: objectType, object_id: objectId } },
    body: { retention_until: retentionUntil },
  });
  if (error) throw apiError(error);
  return data;
}

export async function verifyArchiveItem(itemId: string): Promise<ArchiveItemOut> {
  const { data, error } = await api.POST('/api/v1/archive/{item_id}/verify', {
    params: { path: { item_id: itemId } },
  });
  if (error) throw apiError(error);
  return data;
}
