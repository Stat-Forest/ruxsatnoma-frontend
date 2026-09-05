/**
 * Data layer for screen H2, kept local to this folder the way
 * `src/pages/staff/queries.ts` and `src/pages/permits/queries.ts` keep theirs.
 * Every request goes through the typed wrappers in `src/pages/admin/api.ts` —
 * this module adds caching and invalidation, never a new endpoint.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listPermissions, listRoles, setRolePermissions, type RoleAdminOut } from '../api';

export const ROLES_KEY = ['admin', 'roles'] as const;
export const PERMISSIONS_KEY = ['admin', 'permissions'] as const;

export function useRoles() {
  return useQuery({ queryKey: ROLES_KEY, queryFn: listRoles });
}

/** The permission REGISTRY — every code the backend knows, not one role's
 *  grants. It changes only when a module ships a new code, so it is fetched
 *  once and reused for every role the operator clicks through. */
export function usePermissions() {
  return useQuery({ queryKey: PERMISSIONS_KEY, queryFn: listPermissions });
}

export function useSetRolePermissions(roleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (codes: string[]) => setRolePermissions(roleId, codes),
    onSuccess: (updated) => {
      // `PUT /admin/roles/{id}/permissions` answers with the whole row,
      // `permission_codes` and `holders` recomputed server-side — that IS the
      // fresh value, so the list is patched from the response instead of
      // being invalidated into a second round trip that would return it again.
      queryClient.setQueryData<RoleAdminOut[]>(ROLES_KEY, (previous) =>
        previous?.map((role) => (role.id === updated.id ? updated : role)),
      );
      // The registry's own `roles` column ("which roles grant this code") IS
      // now stale, and nothing in the response can repair it.
      void queryClient.invalidateQueries({ queryKey: PERMISSIONS_KEY });
    },
  });
}
