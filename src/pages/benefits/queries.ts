/**
 * React-query layer for the benefit-verification office — the HTTP wrappers
 * themselves live in `./api.ts`, these hooks only decide what is cached,
 * under which key, and what a successful mutation invalidates. Style:
 * `src/pages/archive/queries.ts`.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getBenefitClaim,
  listBenefitClaims,
  rejectBenefitClaim,
  verifyBenefitClaim,
  type BenefitClaimListParams,
} from './api';

const LIST_KEY = ['benefits', 'verification', 'list'] as const;

function oneKey(applicationId: string) {
  return ['benefits', 'verification', 'one', applicationId] as const;
}

export function useBenefitClaims(params: BenefitClaimListParams) {
  return useQuery({
    queryKey: [...LIST_KEY, params],
    queryFn: () => listBenefitClaims(params),
    placeholderData: (previous) => previous,
  });
}

export function useBenefitClaim(applicationId: string | null) {
  return useQuery({
    queryKey: applicationId !== null ? oneKey(applicationId) : ['benefits', 'verification', 'one', null],
    queryFn: async () => {
      if (!applicationId) throw new Error('useBenefitClaim called without an id');
      return getBenefitClaim(applicationId);
    },
    enabled: applicationId !== null,
  });
}

/** Invalidates both the one-claim cache AND the list — a decision here moves
 *  the row out of the "pending" bucket the list's own default filter shows,
 *  so the queue must refetch, not just this claim's own drawer. */
export function useVerifyBenefitClaim(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => verifyBenefitClaim(applicationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: oneKey(applicationId) });
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useRejectBenefitClaim(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => rejectBenefitClaim(applicationId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: oneKey(applicationId) });
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}
