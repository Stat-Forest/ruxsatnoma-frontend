/**
 * React-query layer for the beekeeper register — the HTTP wrappers
 * themselves live in `./api.ts`, these hooks only decide what is cached,
 * under which key, and what a successful mutation invalidates. Style:
 * the now-retired `src/pages/benefits/queries.ts` (stage 9).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createBeekeeper,
  listBeekeepers,
  patchBeekeeper,
  removeBeekeeper,
  type BeekeeperCreateIn,
  type BeekeeperListParams,
  type BeekeeperPatchIn,
} from './api';

const LIST_KEY = ['beekeepers', 'list'] as const;

export function useBeekeepersList(params: BeekeeperListParams) {
  return useQuery({
    queryKey: [...LIST_KEY, params],
    queryFn: () => listBeekeepers(params),
    placeholderData: (previous) => previous,
  });
}

export function useCreateBeekeeper() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: BeekeeperCreateIn) => createBeekeeper(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function usePatchBeekeeper(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: BeekeeperPatchIn) => patchBeekeeper(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useRemoveBeekeeper(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => removeBeekeeper(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}
