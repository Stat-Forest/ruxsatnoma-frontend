/**
 * React-query layer for the archive register, in the style of
 * `src/pages/support/tickets/queries.ts` — the HTTP wrappers themselves live
 * in `./api.ts`, these hooks only decide what is cached, under which key,
 * and what a successful mutation invalidates.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  archiveApplicationByNumber,
  archivePermitByNumber,
  getArchiveItem,
  listArchiveItems,
  verifyArchiveItem,
  type ArchiveListParams,
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

/**
 * Stage 14 (#205 R6) — archives by the number a person actually holds (an
 * application's or a permit's public number), never by the row's own id.
 */
export type ArchiveByNumberInput =
  | { objectType: 'application'; number: string; retentionUntil: string | null }
  | { objectType: 'permit'; series: string; number: number; retentionUntil: string | null };

export function useArchiveByNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ArchiveByNumberInput) =>
      input.objectType === 'application'
        ? archiveApplicationByNumber({ number: input.number, retention_until: input.retentionUntil })
        : archivePermitByNumber({ series: input.series, number: input.number, retention_until: input.retentionUntil }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['archive'] });
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
