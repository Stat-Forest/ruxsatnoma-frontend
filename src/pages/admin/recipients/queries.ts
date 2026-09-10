/**
 * React-query layer for the receivers directory, in the style of
 * `admin/legalDocuments/queries.ts` — wrappers stay in `./api.ts`, these
 * hooks only decide what is cached, under which key, and what a mutation
 * invalidates.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createRecipient,
  listRecipients,
  patchRecipient,
  type PaymentRecipientIn,
  type PaymentRecipientPatch,
} from './api';

const LIST_KEY = ['admin', 'payment-recipients', 'list'] as const;

export function useRecipientsList() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: listRecipients,
  });
}

export function useCreateRecipient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: PaymentRecipientIn) => createRecipient(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function usePatchRecipient(recipientId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: PaymentRecipientPatch) => {
      if (!recipientId) throw new Error('usePatchRecipient called without an id');
      return patchRecipient(recipientId, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}
