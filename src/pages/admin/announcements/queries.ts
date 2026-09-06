/**
 * React-query layer for H8, in the style of `src/pages/permits/queries.ts` —
 * the wrappers themselves live in `./api.ts`, these hooks only decide what is
 * cached, under which key, and what a successful mutation invalidates.
 *
 * The two reference lookups come from `src/pages/admin/api.ts` rather than
 * being re-wrapped here: that module exists precisely so the nine admin
 * screens share one `GET /admin/roles` and one `GET /refs/regions`, and the
 * audience picker needs exactly those two.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listRegions, listRoles } from '../api';
import {
  archiveAnnouncement,
  createAnnouncement,
  getAnnouncement,
  listAnnouncements,
  patchAnnouncement,
  publishAnnouncement,
  type AnnouncementCreateIn,
  type AnnouncementListParams,
  type AnnouncementPatchIn,
} from './api';

const LIST_KEY = ['admin', 'announcements', 'list'] as const;

export function useAnnouncementsList(params: AnnouncementListParams) {
  return useQuery({
    queryKey: [...LIST_KEY, params],
    queryFn: () => listAnnouncements(params),
    // Paging keeps the previous page on screen while the next one loads,
    // rather than blanking the table under the reader's cursor.
    placeholderData: (previous) => previous,
  });
}

/** Only fires once a row is actually being edited: the form reads the row
 *  from the route the contract offers rather than trusting the list's copy,
 *  which may be a page or two old by the time somebody clicks Edit. */
export function useAnnouncement(announcementId: string | null) {
  return useQuery({
    queryKey: ['admin', 'announcements', 'one', announcementId],
    queryFn: async () => {
      if (!announcementId) throw new Error('useAnnouncement called without an id');
      return getAnnouncement(announcementId);
    },
    enabled: announcementId !== null,
  });
}

export function useRoles() {
  return useQuery({ queryKey: ['admin', 'roles'], queryFn: listRoles });
}

export function useRegions() {
  return useQuery({ queryKey: ['refs', 'regions'], queryFn: () => listRegions() });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AnnouncementCreateIn) => createAnnouncement(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function usePatchAnnouncement(announcementId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AnnouncementPatchIn) => {
      if (!announcementId) throw new Error('usePatchAnnouncement called without an id');
      return patchAnnouncement(announcementId, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'announcements', 'one', announcementId] });
    },
  });
}

export function usePublishAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (announcementId: string) => publishAnnouncement(announcementId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useArchiveAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (announcementId: string) => archiveAnnouncement(announcementId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}
