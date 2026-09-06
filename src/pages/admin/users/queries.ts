/**
 * React-query layer for H1 (users), H3 (personal grants) and H4 (sessions),
 * in the style of `src/pages/permits/queries.ts` — the fetch wrappers
 * themselves live in `src/pages/admin/api.ts` and are NOT re-implemented
 * here; these hooks only decide what is cached, under which key, and what a
 * successful mutation invalidates.
 *
 * Every key starts with `['admin', 'users']`, so one prefix invalidation
 * after a write refreshes the paged list, the counters, the open card and
 * (if a tab is mounted) that user's sessions and grants — the four things a
 * block, a delete or a patch can all move at once.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  blockUser,
  createUser,
  deleteUser,
  getUser,
  getUserPermissions,
  getUserStats,
  listDistricts,
  listOrganizationTree,
  listPermissions,
  listRegions,
  listRoles,
  listUserSessions,
  listUsers,
  patchUser,
  resetMfa,
  resetPassword,
  revokeAllSessions,
  revokeSession,
  setUserPermissions,
  unblockUser,
  type UserCreateIn,
  type UserListParams,
  type UserPatchIn,
} from '../api';

const USERS_KEY = ['admin', 'users'] as const;

export function useUsersList(params: UserListParams) {
  return useQuery({
    queryKey: [...USERS_KEY, 'list', params],
    queryFn: () => listUsers(params),
    // Paging keeps the previous page on screen while the next one loads,
    // rather than blanking the table under the reader's cursor.
    placeholderData: (previous) => previous,
  });
}

export function useUserStats() {
  return useQuery({ queryKey: [...USERS_KEY, 'stats'], queryFn: getUserStats });
}

/** The card re-reads the row from `GET /admin/users/{id}` rather than
 *  trusting the list's copy, which may be a page or two old by the time
 *  somebody opens it. */
export function useUser(userId: string | null) {
  return useQuery({
    queryKey: [...USERS_KEY, 'one', userId],
    queryFn: () => getUser(userId!),
    enabled: userId !== null,
  });
}

export function useUserSessions(userId: string | null) {
  return useQuery({
    queryKey: [...USERS_KEY, 'sessions', userId],
    queryFn: () => listUserSessions(userId!),
    enabled: userId !== null,
  });
}

/** PERSONAL grants only — extra codes on top of the role, never the
 *  effective set (`admin/api.ts::getUserPermissions`). */
export function useUserPermissions(userId: string | null) {
  return useQuery({
    queryKey: [...USERS_KEY, 'grants', userId],
    queryFn: () => getUserPermissions(userId!),
    enabled: userId !== null,
  });
}

// --- reference lookups, shared by the filters, the form and the table ----

export function useRoles() {
  return useQuery({ queryKey: ['admin', 'roles'], queryFn: listRoles });
}

export function usePermissions() {
  return useQuery({ queryKey: ['admin', 'permissions'], queryFn: listPermissions });
}

export function useOrganizations() {
  return useQuery({ queryKey: ['refs', 'organizations', 'tree'], queryFn: listOrganizationTree });
}

export function useRegions() {
  return useQuery({ queryKey: ['refs', 'regions'], queryFn: listRegions });
}

/** Districts narrow to the chosen region; with no region there is nothing to
 *  narrow to and the request is not made at all. */
export function useDistricts(regionId: string) {
  return useQuery({
    queryKey: ['refs', 'districts', regionId],
    queryFn: () => listDistricts(regionId),
    enabled: regionId !== '',
  });
}

// --- mutations -----------------------------------------------------------

function useUsersInvalidator() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: USERS_KEY });
}

export function useCreateUser() {
  const invalidate = useUsersInvalidator();
  return useMutation({ mutationFn: (body: UserCreateIn) => createUser(body), onSuccess: invalidate });
}

export function usePatchUser() {
  const invalidate = useUsersInvalidator();
  return useMutation({
    mutationFn: ({ userId, body }: { userId: string; body: UserPatchIn }) => patchUser(userId, body),
    onSuccess: invalidate,
  });
}

export function useBlockUser() {
  const invalidate = useUsersInvalidator();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) => blockUser(userId, reason),
    onSuccess: invalidate,
  });
}

export function useUnblockUser() {
  const invalidate = useUsersInvalidator();
  return useMutation({ mutationFn: (userId: string) => unblockUser(userId), onSuccess: invalidate });
}

export function useDeleteUser() {
  const invalidate = useUsersInvalidator();
  return useMutation({ mutationFn: (userId: string) => deleteUser(userId), onSuccess: invalidate });
}

/** Both resets answer with a secret the server will never show again — the
 *  caller hands the result straight to `SecretPanel`, it is never cached. */
export function useResetPassword() {
  const invalidate = useUsersInvalidator();
  return useMutation({ mutationFn: (userId: string) => resetPassword(userId), onSuccess: invalidate });
}

export function useResetMfa() {
  const invalidate = useUsersInvalidator();
  return useMutation({ mutationFn: (userId: string) => resetMfa(userId), onSuccess: invalidate });
}

export function useSetUserPermissions() {
  const invalidate = useUsersInvalidator();
  return useMutation({
    mutationFn: ({ userId, codes }: { userId: string; codes: string[] }) =>
      setUserPermissions(userId, codes),
    onSuccess: invalidate,
  });
}

export function useRevokeSession() {
  const invalidate = useUsersInvalidator();
  return useMutation({
    // `userId` is not part of the route (`/admin/sessions/{id}/revoke`) — it
    // is carried only so the invalidation below can name the right cache.
    mutationFn: ({ sessionId }: { sessionId: string; userId: string }) => revokeSession(sessionId),
    onSuccess: invalidate,
  });
}

export function useRevokeAllSessions() {
  const invalidate = useUsersInvalidator();
  return useMutation({ mutationFn: (userId: string) => revokeAllSessions(userId), onSuccess: invalidate });
}
