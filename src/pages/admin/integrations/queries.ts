/**
 * React Query layer for H10, in the style of `src/pages/permits/queries.ts`:
 * one hook per route, `placeholderData: (previous) => previous` on both paged
 * lists so paging and filtering do not blank the table between renders, and
 * both mutations invalidating their own list so the row's new state is
 * visible without the operator reloading the page.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  discardDeadLetter,
  listDeadLetters,
  listOutbox,
  requeueOutboxMessage,
  type DeadLetterListParams,
  type OutboxListParams,
} from './api';

const OUTBOX_KEY = ['admin', 'integrations', 'outbox'] as const;
const LETTERS_KEY = ['admin', 'integrations', 'dead-letters'] as const;

export function useOutboxList(params: OutboxListParams) {
  return useQuery({
    queryKey: [...OUTBOX_KEY, params],
    queryFn: () => listOutbox(params),
    placeholderData: (previous) => previous,
  });
}

export function useDeadLetterList(params: DeadLetterListParams) {
  return useQuery({
    queryKey: [...LETTERS_KEY, params],
    queryFn: () => listDeadLetters(params),
    placeholderData: (previous) => previous,
  });
}

/** Invalidates the WHOLE outbox key, not just the page in view: a requeued
 *  message leaves `dead` for `pending`, so under a status filter it also
 *  leaves the list it was requeued from — the cached `status=dead` page is
 *  stale the moment this succeeds, whichever page is on screen. */
export function useRequeueOutboxMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => requeueOutboxMessage(messageId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: OUTBOX_KEY });
    },
  });
}

export function useDiscardDeadLetter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (letterId: string) => discardDeadLetter(letterId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LETTERS_KEY });
    },
  });
}
