/**
 * Typed wrappers around every `/admin/*` route the administration screens
 * (§H of `plans/06-frontend-screens.md`) call, plus the two `/auth` routes
 * screen C5 needs.
 *
 * One module for the whole area, unlike the per-track duplication of the demo
 * sprint: these screens are built together, share the same reference lookups
 * (roles, organizations, regions, districts) and the same error handling, and
 * a wrapper duplicated across nine files is nine places to fix when a route's
 * query shape moves.
 *
 * Every type comes from the generated `src/api/schema.d.ts` — never
 * hand-written. When the backend's contract moves, `npm run api:types` is the
 * only correct response.
 */
import { api } from '../../api/client';
import { apiError } from '../../api/errors';
import type { components } from '../../api/schema';

// --- users ---------------------------------------------------------------

export type UserAdminOut = components['schemas']['UserAdminOut'];
export type UserCreateIn = components['schemas']['UserCreateIn'];
export type UserPatchIn = components['schemas']['UserPatchIn'];
export type UserCreatedOut = components['schemas']['UserCreatedOut'];
export type OneTimePasswordOut = components['schemas']['OneTimePasswordOut'];
export type TotpUriOut = components['schemas']['TotpUriOut'];
export type UserStatsOut = components['schemas']['UserStatsOut'];
export type SessionAdminOut = components['schemas']['SessionAdminOut'];
export type RoleAdminOut = components['schemas']['RoleAdminOut'];
export type PermissionOut = components['schemas']['PermissionOut'];
export type PermissionCodesOut = components['schemas']['PermissionCodesOut'];

// --- reference data ------------------------------------------------------

export type OrganizationOut = components['schemas']['OrganizationOut'];
export type OrganizationAdminOut = components['schemas']['OrganizationAdminOut'];
export type RegionOut = components['schemas']['RegionOut'];
export type DistrictOut = components['schemas']['DistrictOut'];
export type ClassifierItemOut = components['schemas']['ClassifierItemOut'];
export type SettingOut = components['schemas']['SettingOut'];

export interface Paged<T> {
  items: T[];
  total: number;
}

export interface UserListParams {
  page?: number;
  page_size?: number;
  role_code?: string;
  status?: string;
  organization_id?: string;
  region_id?: string;
  /** ILIKE against login, full name and PINFL — one box, three columns. */
  q?: string;
}

export async function listUsers(params: UserListParams): Promise<Paged<UserAdminOut>> {
  const { data, error } = await api.GET('/api/v1/admin/users', { params: { query: params } });
  if (error) throw apiError(error);
  return data;
}

export async function getUser(userId: string): Promise<UserAdminOut> {
  const { data, error } = await api.GET('/api/v1/admin/users/{user_id}', {
    params: { path: { user_id: userId } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function getUserStats(): Promise<UserStatsOut> {
  const { data, error } = await api.GET('/api/v1/admin/users/stats', {});
  if (error) throw apiError(error);
  return data;
}

/** Staff roles only — the backend refuses `role_code: "applicant"`, because a
 *  citizen is born through OneID or E-IMZO and never created by hand. The
 *  response carries the one-time password and the TOTP URI, shown ONCE. */
export async function createUser(body: UserCreateIn): Promise<UserCreatedOut> {
  const { data, error } = await api.POST('/api/v1/admin/users', { body });
  if (error) throw apiError(error);
  return data;
}

export async function patchUser(userId: string, body: UserPatchIn): Promise<UserAdminOut> {
  const { data, error } = await api.PATCH('/api/v1/admin/users/{user_id}', {
    params: { path: { user_id: userId } },
    body,
  });
  if (error) throw apiError(error);
  return data;
}

/** Blocking is the ONE action of the three that carries a body: the reason is
 *  mandatory and lands in the audit trail, so the confirm dialog must collect
 *  it rather than sending a placeholder. Unblock and delete take none. */
export async function blockUser(userId: string, reason: string): Promise<UserAdminOut> {
  const { data, error } = await api.POST('/api/v1/admin/users/{user_id}/block', {
    params: { path: { user_id: userId } },
    body: { reason },
  });
  if (error) throw apiError(error);
  return data;
}

export async function unblockUser(userId: string): Promise<UserAdminOut> {
  const { data, error } = await api.POST('/api/v1/admin/users/{user_id}/unblock', {
    params: { path: { user_id: userId } },
  });
  if (error) throw apiError(error);
  return data;
}

/** Soft delete — the row stays, its status becomes `deleted`. */
export async function deleteUser(userId: string): Promise<UserAdminOut> {
  const { data, error } = await api.POST('/api/v1/admin/users/{user_id}/delete', {
    params: { path: { user_id: userId } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function resetPassword(userId: string): Promise<OneTimePasswordOut> {
  const { data, error } = await api.POST('/api/v1/admin/users/{user_id}/reset-password', {
    params: { path: { user_id: userId } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function resetMfa(userId: string): Promise<TotpUriOut> {
  const { data, error } = await api.POST('/api/v1/admin/users/{user_id}/reset-mfa', {
    params: { path: { user_id: userId } },
  });
  if (error) throw apiError(error);
  return data;
}

// --- roles, permissions, personal grants ---------------------------------

export async function listRoles(): Promise<RoleAdminOut[]> {
  const { data, error } = await api.GET('/api/v1/admin/roles', {});
  if (error) throw apiError(error);
  return data;
}

export async function listPermissions(): Promise<PermissionOut[]> {
  const { data, error } = await api.GET('/api/v1/admin/permissions', {});
  if (error) throw apiError(error);
  return data;
}

export async function setRolePermissions(roleId: string, codes: string[]): Promise<RoleAdminOut> {
  const { data, error } = await api.PUT('/api/v1/admin/roles/{role_id}/permissions', {
    params: { path: { role_id: roleId } },
    body: { codes },
  });
  if (error) throw apiError(error);
  return data;
}

/** The user's PERSONAL grants — extra codes on top of their role, never the
 *  effective set. `GET /auth/me` is what answers "what may this caller do". */
export async function getUserPermissions(userId: string): Promise<PermissionCodesOut> {
  const { data, error } = await api.GET('/api/v1/admin/users/{user_id}/permissions', {
    params: { path: { user_id: userId } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function setUserPermissions(userId: string, codes: string[]): Promise<PermissionCodesOut> {
  const { data, error } = await api.PUT('/api/v1/admin/users/{user_id}/permissions', {
    params: { path: { user_id: userId } },
    body: { codes },
  });
  if (error) throw apiError(error);
  return data;
}

// --- sessions ------------------------------------------------------------

export async function listUserSessions(userId: string): Promise<SessionAdminOut[]> {
  const { data, error } = await api.GET('/api/v1/admin/users/{user_id}/sessions', {
    params: { path: { user_id: userId } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function revokeSession(sessionId: string): Promise<void> {
  const { error } = await api.POST('/api/v1/admin/sessions/{session_id}/revoke', {
    params: { path: { session_id: sessionId } },
  });
  if (error) throw apiError(error);
}

export async function revokeAllSessions(userId: string): Promise<{ revoked: number }> {
  const { data, error } = await api.POST('/api/v1/admin/users/{user_id}/sessions/revoke-all', {
    params: { path: { user_id: userId } },
  });
  if (error) throw apiError(error);
  return data;
}

// --- reference lookups the forms need ------------------------------------

export async function listRegions(): Promise<RegionOut[]> {
  const { data, error } = await api.GET('/api/v1/refs/regions', {});
  if (error) throw apiError(error);
  return data;
}

export async function listDistricts(regionId?: string): Promise<DistrictOut[]> {
  const { data, error } = await api.GET('/api/v1/refs/districts', {
    params: { query: { region_id: regionId } },
  });
  if (error) throw apiError(error);
  return data;
}

/** `parent_id` is a STRICT filter: omitted means "top level only", never
 *  "everything". The tree is walked one level at a time — the same trap
 *  `applicant/api.ts::listOrganizations` documents. */
export async function listOrganizationsUnder(parentId?: string): Promise<OrganizationOut[]> {
  const { data, error } = await api.GET('/api/v1/refs/organizations', {
    params: { query: { page_size: 100, parent_id: parentId } },
  });
  if (error) throw apiError(error);
  return data.items;
}

export async function listOrganizationTree(): Promise<OrganizationOut[]> {
  const roots = await listOrganizationsUnder(undefined);
  const children = await Promise.all(roots.map((root) => listOrganizationsUnder(root.id)));
  return [...roots, ...children.flat()];
}

// --- C5: the caller's own password ---------------------------------------

/** The ONLY way out of `must_change_password`. An administrator cannot clear
 *  the flag for somebody else — they can only issue a new one-time password —
 *  so without this screen every account created by `POST /admin/users` is
 *  unusable (`ERR-AUTH-007` on every route but `GET /auth/me`). */
export async function changeOwnPassword(oldPassword: string, newPassword: string): Promise<void> {
  const { error } = await api.POST('/api/v1/auth/password/change', {
    // `old_password`, not `current_password` — the contract's own name.
    body: { old_password: oldPassword, new_password: newPassword },
  });
  if (error) throw apiError(error);
}
