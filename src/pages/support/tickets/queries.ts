/**
 * React-query layer for the tickets tab, in the style of
 * `src/pages/admin/announcements/queries.ts` — the wrappers themselves live
 * in `./api.ts`, these hooks only decide what is cached, under which key,
 * and what a successful mutation invalidates.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addTicketMessage,
  assignTicket,
  closeTicket,
  createTicket,
  getTicket,
  listTickets,
  resolveTicket,
  type TicketIn,
  type TicketListParams,
  type TicketMessageIn,
} from './api';

const LIST_KEY = ['support', 'tickets', 'list'] as const;

function oneKey(ticketId: string) {
  return ['support', 'tickets', 'one', ticketId] as const;
}

export function useTicketsList(params: TicketListParams) {
  return useQuery({
    queryKey: [...LIST_KEY, params],
    queryFn: () => listTickets(params),
    // Keeps the previous page on screen while the next one loads, rather
    // than blanking the table under the reader's cursor.
    placeholderData: (previous) => previous,
  });
}

/** Fires only once a ticket is actually open (`ticketId !== null`) — same
 *  `enabled` gate `announcements/queries.ts::useAnnouncement` uses. */
export function useTicket(ticketId: string | null) {
  return useQuery({
    queryKey: ticketId !== null ? oneKey(ticketId) : ['support', 'tickets', 'one', null],
    queryFn: async () => {
      if (!ticketId) throw new Error('useTicket called without an id');
      return getTicket(ticketId);
    },
    enabled: ticketId !== null,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: TicketIn) => createTicket(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useAddTicketMessage(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: TicketMessageIn) => addTicketMessage(ticketId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: oneKey(ticketId) });
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useAssignTicket(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assigneeId: string) => assignTicket(ticketId, assigneeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: oneKey(ticketId) });
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useResolveTicket(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => resolveTicket(ticketId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: oneKey(ticketId) });
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useCloseTicket(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => closeTicket(ticketId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: oneKey(ticketId) });
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}
