/**
 * Typed wrappers around the five `/beekeepers*` routes
 * (`app/modules/beekeepers/router.py`, rulings #181/#182) — `openapi-fetch`,
 * every type taken from the generated `src/api/schema.d.ts`, never
 * hand-written, in the style of the now-retired `src/pages/benefits/api.ts`
 * (stage 9) this track replaces.
 *
 * Every route here answers to `beekeepers.manage` alone — no ABAC zone: the
 * register is the Union's own, central, several users, never scoped to a
 * leshoz.
 */
import { api } from '../../api/client';
import { apiError } from '../../api/errors';
import type { components } from '../../api/schema';

export type BeekeeperOut = components['schemas']['BeekeeperOut'];
export type BeekeeperCreateIn = components['schemas']['BeekeeperCreateIn'];
export type BeekeeperPatchIn = components['schemas']['BeekeeperPatchIn'];
export type BeekeeperLookupOut = components['schemas']['BeekeeperLookupOut'];
export type Page_BeekeeperOut_ = components['schemas']['Page_BeekeeperOut_'];

export interface BeekeeperListParams {
  q?: string;
  status?: string;
  page: number;
  page_size: number;
}

export async function listBeekeepers(params: BeekeeperListParams): Promise<Page_BeekeeperOut_> {
  const { data, error } = await api.GET('/api/v1/beekeepers', {
    params: {
      query: {
        q: params.q || undefined,
        status: params.status || undefined,
        page: params.page,
        page_size: params.page_size,
      },
    },
  });
  if (error) throw apiError(error);
  return data;
}

export async function createBeekeeper(body: BeekeeperCreateIn): Promise<BeekeeperOut> {
  const { data, error } = await api.POST('/api/v1/beekeepers', { body });
  if (error) throw apiError(error);
  return data;
}

export async function patchBeekeeper(id: string, body: BeekeeperPatchIn): Promise<BeekeeperOut> {
  const { data, error } = await api.PATCH('/api/v1/beekeepers/{beekeeper_id}', {
    params: { path: { beekeeper_id: id } },
    body,
  });
  if (error) throw apiError(error);
  return data;
}

export async function removeBeekeeper(id: string, reason: string): Promise<BeekeeperOut> {
  const { data, error } = await api.POST('/api/v1/beekeepers/{beekeeper_id}/remove', {
    params: { path: { beekeeper_id: id } },
    body: { reason },
  });
  if (error) throw apiError(error);
  return data;
}

/**
 * `GET /beekeepers/lookup` — ruling #182's "honest auto-fill": whatever a
 * user who has signed in through OneID left in their own profile snapshot.
 * `null` for a PINFL nobody has signed in with — the router answers 404
 * `ERR-SYS-003` for that case (not declared as a typed response in
 * `schema.d.ts`, since FastAPI only documents the shapes a `response_model`
 * names; the plain HTTP status is what this checks, not the generated
 * type), and `BeekeeperFormModal` leaves the fields exactly as typed rather
 * than showing an error for what is an entirely ordinary outcome — most
 * PINFLs entered here have never signed in at all. Any OTHER failure (a
 * dropped connection, a 500) is still thrown — this is a convenience
 * auto-fill, not a value the caller should silently paper over as "not
 * found".
 */
export async function lookupBeekeeper(pinfl: string): Promise<BeekeeperLookupOut | null> {
  const { data, error, response } = await api.GET('/api/v1/beekeepers/lookup', {
    params: { query: { pinfl } },
  });
  if (error) {
    if (response.status === 404) return null;
    throw apiError(error);
  }
  return data;
}
