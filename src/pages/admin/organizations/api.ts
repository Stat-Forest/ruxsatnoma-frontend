/**
 * The `/admin/organizations` WRITE surface, plus the full-depth tree walk H5
 * needs. Read wrappers (`listOrganizationsUnder`, `listRegions`,
 * `listDistricts`) stay in `../api` — only what that module does not yet wrap
 * lives here, in the same openapi-fetch style.
 *
 * Every type comes from the generated `src/api/schema.d.ts`; none is written
 * by hand.
 */
import { api } from '../../../api/client';
import { apiError } from '../../../api/errors';
import type { components } from '../../../api/schema';
import { listOrganizationsUnder, type OrganizationOut } from '../api';

export type OrganizationIn = components['schemas']['OrganizationIn'];
export type OrganizationPatch = components['schemas']['OrganizationPatch'];
export type OrganizationAdminOut = components['schemas']['OrganizationAdminOut'];
export type LocalizedName = components['schemas']['LocalizedName'];

export async function createOrganization(body: OrganizationIn): Promise<OrganizationAdminOut> {
  const { data, error } = await api.POST('/api/v1/admin/organizations', { body });
  if (error) throw apiError(error);
  return data;
}

/** The only route that returns `requisites` — `/refs` omits the bank details
 *  deliberately, so the edit form reads the row it is about to patch from
 *  here rather than from the tree it was opened out of. */
export async function getOrganization(orgId: string): Promise<OrganizationAdminOut> {
  const { data, error } = await api.GET('/api/v1/admin/organizations/{org_id}', {
    params: { path: { org_id: orgId } },
  });
  if (error) throw apiError(error);
  return data;
}

/** `OrganizationPatch` carries neither `kind` nor `code`: both are immutable
 *  after creation (the kind decides the legal parent, the code is a stable
 *  slug other tables point at), which is why the edit form disables them. */
export async function patchOrganization(
  orgId: string,
  body: OrganizationPatch,
): Promise<OrganizationAdminOut> {
  const { data, error } = await api.PATCH('/api/v1/admin/organizations/{org_id}', {
    params: { path: { org_id: orgId } },
    body,
  });
  if (error) throw apiError(error);
  return data;
}

/** Archival replaces deletion. The backend refuses a node that still has
 *  active children (`ERR-VAL-001`, `details.reason === "active children"`). */
export async function archiveOrganization(orgId: string): Promise<OrganizationAdminOut> {
  const { data, error } = await api.POST('/api/v1/admin/organizations/{org_id}/archive', {
    params: { path: { org_id: orgId } },
  });
  if (error) throw apiError(error);
  return data;
}

/** agency > territorial > leshoz > bolim > aylanma > bolak — six kinds, so a
 *  legal hierarchy is at most six levels deep. */
const MAX_DEPTH = 6;

/**
 * The whole hierarchy, flattened, at full depth.
 *
 * `GET /refs/organizations`' `parent_id` is a STRICT filter: omitting it
 * returns ONLY top-level rows (the single agency), never everything, so the
 * tree has to be walked one level at a time. `../api::listOrganizationTree`
 * walks exactly two levels, which covers "the agency and its leshozes" and
 * silently loses a territorial administration's leshozes and everything below
 * a bolim — this walk keeps going until a level comes back empty.
 *
 * Each level is fetched in parallel; the levels themselves are sequential
 * because a level's parent ids are not known until the level above has
 * answered. `seen` guards against a cycle in the data turning that into an
 * infinite walk (the backend forbids cycles, but this loop should not depend
 * on it), and `MAX_DEPTH` bounds it regardless.
 */
export async function fetchOrganizationTree(): Promise<OrganizationOut[]> {
  const collected: OrganizationOut[] = [];
  const seen = new Set<string>();
  let level = await listOrganizationsUnder(undefined);

  for (let depth = 0; depth < MAX_DEPTH && level.length > 0; depth += 1) {
    const fresh = level.filter((org) => !seen.has(org.id));
    for (const org of fresh) seen.add(org.id);
    collected.push(...fresh);
    const below = await Promise.all(fresh.map((org) => listOrganizationsUnder(org.id)));
    level = below.flat();
  }

  return collected;
}
