/**
 * React-query layer for the archive register, in the style of
 * `src/pages/support/tickets/queries.ts` — the HTTP wrappers themselves live
 * in `./api.ts`, these hooks only decide what is cached, under which key,
 * and what a successful mutation invalidates.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  archiveObject,
  getArchiveItem,
  listArchiveItems,
  verifyArchiveItem,
  type ArchiveListParams,
  type ArchiveObjectType,
} from './api';

const LIST_KEY = ['archive', 'list'] as const;

function oneKey(itemId: string) {
  return ['archive', 'one', itemId] as const;
}

export function useArchiveItems(params: ArchiveListParams) {
  return useQuery({
    queryKey: [...LIST_KEY, params],
    queryFn: () => listArchiveItems(params),
    placeholderData: (previous) => previous,
  });
}

export function useArchiveItem(itemId: string | null) {
  return useQuery({
    queryKey: itemId !== null ? oneKey(itemId) : ['archive', 'one', null],
    queryFn: async () => {
      if (!itemId) throw new Error('useArchiveItem called without an id');
      return getArchiveItem(itemId);
    },
    enabled: itemId !== null,
  });
}

export function useArchiveObject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      objectType,
      objectId,
      retentionUntil,
    }: {
      objectType: ArchiveObjectType;
      objectId: string;
      retentionUntil: string | null;
    }) => archiveObject(objectType, objectId, retentionUntil),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useVerifyArchiveItem(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => verifyArchiveItem(itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: oneKey(itemId) });
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}
