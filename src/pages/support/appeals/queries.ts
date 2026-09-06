/**
 * React-query layer for the appeals tab, in the style of
 * `src/pages/support/tickets/queries.ts` — the wrappers themselves live in
 * `./api.ts`, these hooks only decide what is cached, under which key, and
 * what a successful mutation invalidates.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { advanceAppealStatus, answerAppeal, getAppeal, listAppeals, type AppealListParams } from './api';

const LIST_KEY = ['support', 'appeals', 'list'] as const;

function oneKey(appealId: string) {
  return ['support', 'appeals', 'one', appealId] as const;
}

export function useAppealsList(params: AppealListParams) {
  return useQuery({
    queryKey: [...LIST_KEY, params],
    queryFn: () => listAppeals(params),
    placeholderData: (previous) => previous,
  });
}

export function useAppeal(appealId: string | null) {
  return useQuery({
    queryKey: appealId !== null ? oneKey(appealId) : ['support', 'appeals', 'one', null],
    queryFn: async () => {
      if (!appealId) throw new Error('useAppeal called without an id');
      return getAppeal(appealId);
    },
    enabled: appealId !== null,
  });
}

export function useAdvanceAppealStatus(appealId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (toStatus: 'in_progress' | 'closed') => advanceAppealStatus(appealId, toStatus),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: oneKey(appealId) });
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useAnswerAppeal(appealId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (answerText: string) => answerAppeal(appealId, answerText),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: oneKey(appealId) });
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}
