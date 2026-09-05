/**
 * react-query bindings for F5. `useNormTransition` backs all FIVE
 * no-body transitions (`api.ts::transitionNorm`'s own note explains why one
 * hook is correct here, unlike F6/F7's deliberately separate publish/archive
 * hooks) — `approve` keeps its own `useApproveNorm` because it alone carries
 * a body.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useQueries } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { apiError } from '../../../api/errors';
import {
  approveNorm,
  createNorm,
  listContours,
  listNorms,
  patchNorm,
  transitionNorm,
  type ContourListParams,
  type NormIn,
  type NormListParams,
  type NormPatch,
  type NormTransitionAction,
} from './api';

const ROOT_KEY = ['norms', 'norms'] as const;

export function useNormsList(params: NormListParams, active: boolean) {
  return useQuery({
    queryKey: [...ROOT_KEY, 'list', params],
    queryFn: () => listNorms(params),
    enabled: active,
    placeholderData: (previous) => previous,
  });
}

export function useCreateNorm() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: NormIn) => createNorm(body),
    onSuccess: () => client.invalidateQueries({ queryKey: ROOT_KEY }),
  });
}

export function useUpdateNorm() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: NormPatch }) => patchNorm(id, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ROOT_KEY }),
  });
}

export function useNormTransition() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ action, id }: { action: NormTransitionAction; id: string }) => transitionNorm(action, id),
    onSuccess: () => client.invalidateQueries({ queryKey: ROOT_KEY }),
  });
}

export function useApproveNorm() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approvalDocId }: { id: string; approvalDocId: string }) => approveNorm(id, approvalDocId),
    onSuccess: () => client.invalidateQueries({ queryKey: ROOT_KEY }),
  });
}

/** Feeds the create form's contour picker. No `active` gate: only mounted
 *  while `NormFormModal` is open, same reasoning as
 *  `tariffs/queries.ts::useBenefitCategories`. */
export function useContourSearch(params: ContourListParams) {
  return useQuery({
    queryKey: ['norms', 'refs', 'contours', params],
    queryFn: () => listContours(params),
    staleTime: 60_000,
  });
}

/** Resolves many contour ids to their display number in parallel — the
 *  identical `useQueries`/`combine` pattern
 *  `dashboard/queries.ts::useContourNumbers` already established, duplicated
 *  per this track's own convention (`params/valueEditor.ts`'s file header)
 *  rather than imported across tracks. */
export function useContourNumbers(contourIds: string[]) {
  return useQueries({
    queries: contourIds.map((contourId) => ({
      queryKey: ['norms', 'refs', 'contour', contourId],
      queryFn: async () => {
        const { data, error } = await api.GET('/api/v1/gis/contours/{contour_id}', {
          params: { path: { contour_id: contourId } },
        });
        if (error) throw apiError(error);
        return { id: contourId, number: data.number };
      },
      staleTime: 5 * 60_000,
    })),
    combine: (results: { data?: { id: string; number: string } }[]) =>
      new Map(results.flatMap((result) => (result.data ? [[result.data.id, result.data.number] as const] : []))),
  });
}
