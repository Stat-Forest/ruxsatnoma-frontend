/**
 * React-query layer for the beekeeper register — the HTTP wrappers
 * themselves live in `./api.ts`, these hooks only decide what is cached,
 * under which key, and what a successful mutation invalidates. Style:
 * the now-retired `src/pages/benefits/queries.ts` (stage 9).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createBeekeeper,
  getBeekeepersSummary,
  getBeekeepingClaimsSummary,
  listBeekeepingClaims,
  listBeekeepers,
  patchBeekeeper,
  removeBeekeeper,
  type BeekeeperCreateIn,
  type BeekeeperListParams,
  type BeekeeperPatchIn,
  type BeekeepingClaimsParams,
} from './api';

const LIST_KEY = ['beekeepers', 'list'] as const;
// The home screen's register counts: every register write changes them, so
// every mutation below invalidates this key beside the list's own.
const SUMMARY_KEY = ['beekeepers', 'summary'] as const;

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
      void queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
    },
  });
}

export function usePatchBeekeeper(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: BeekeeperPatchIn) => patchBeekeeper(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
      void queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
    },
  });
}

export function useRemoveBeekeeper(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => removeBeekeeper(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
      void queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
    },
  });
}

const CLAIMS_KEY = ['beekeepers', 'claims'] as const;

export function useBeekeepingClaims(params: BeekeepingClaimsParams) {
  return useQuery({
    queryKey: [...CLAIMS_KEY, params],
    queryFn: () => listBeekeepingClaims(params),
    placeholderData: (previous) => previous,
  });
}

export function useBeekeepersSummary() {
  return useQuery({ queryKey: SUMMARY_KEY, queryFn: getBeekeepersSummary });
}

/** `year` undefined asks for the backend's current year. */
export function useBeekeepingClaimsSummary(year: number | undefined) {
  return useQuery({
    queryKey: ['beekeepers', 'claims-summary', year ?? null],
    queryFn: () => getBeekeepingClaimsSummary(year),
    placeholderData: (previous) => previous,
  });
}
