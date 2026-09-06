/**
 * Typed wrappers around the seven `/help/tickets*` routes (`help.router`) —
 * `openapi-fetch`, every type taken from the generated `src/api/schema.d.ts`,
 * never hand-written, in the style of `src/pages/admin/announcements/api.ts`.
 *
 * `GET /help/tickets` is paged via `page`/`page_size` (`app/core/schemas.py::
 * PageParams`), NOT `limit`/`offset` — the other paging convention in this
 * backend, used only by `norms`. Getting this wrong would not raise an
 * error (FastAPI silently ignores unknown query params) — it would just
 * always return page one.
 */
import { api } from '../../../api/client';
import { apiError } from '../../../api/errors';
import type { components } from '../../../api/schema';

export type TicketOut = components['schemas']['TicketOut'];
export type TicketIn = components['schemas']['TicketIn'];
export type TicketMessageIn = components['schemas']['TicketMessageIn'];
export type TicketMessageOut = components['schemas']['TicketMessageOut'];
export type TicketWithMessagesOut = components['schemas']['TicketWithMessagesOut'];
export type TicketPage = components['schemas']['Page_TicketOut_'];

/** `TicketOut.status` is a bare `string` in the contract, not an enum — these
 *  are the four values `help.models.TICKET_STATUSES` produces. */
export type TicketStatus = 'new' | 'in_progress' | 'resolved' | 'closed';

export interface TicketListParams {
  /** Omitted means every status. Never send `''` — see the status-filter
   *  gotcha in `announcements/api.ts`'s own comment on this bug class. */
  status?: TicketStatus | '';
  page: number;
  page_size: number;
}

export async function listTickets(params: TicketListParams): Promise<TicketPage> {
  const { data, error } = await api.GET('/api/v1/help/tickets', {
    params: { query: { status: params.status || undefined, page: params.page, page_size: params.page_size } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function createTicket(body: TicketIn): Promise<TicketOut> {
  const { data, error } = await api.POST('/api/v1/help/tickets', { body });
  if (error) throw apiError(error);
  return data;
}

export async function getTicket(ticketId: string): Promise<TicketWithMessagesOut> {
  const { data, error } = await api.GET('/api/v1/help/tickets/{ticket_id}', {
    params: { path: { ticket_id: ticketId } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function addTicketMessage(ticketId: string, body: TicketMessageIn): Promise<TicketMessageOut> {
  const { data, error } = await api.POST('/api/v1/help/tickets/{ticket_id}/messages', {
    params: { path: { ticket_id: ticketId } },
    body,
  });
  if (error) throw apiError(error);
  return data;
}

/** `help.tickets.manage` only. This screen offers just "assign to me" — no
 *  route exists to list candidate assignees scoped to that permission (see
 *  `TicketDetailPanel.tsx`'s own header comment). */
export async function assignTicket(ticketId: string, assigneeId: string): Promise<TicketOut> {
  const { data, error } = await api.POST('/api/v1/help/tickets/{ticket_id}/assign', {
    params: { path: { ticket_id: ticketId } },
    body: { assignee_id: assigneeId },
  });
  if (error) throw apiError(error);
  return data;
}

/** `help.tickets.manage` only, and only reachable from `in_progress`
 *  (`help.models.TICKET_TRANSITIONS`). */
export async function resolveTicket(ticketId: string): Promise<TicketOut> {
  const { data, error } = await api.POST('/api/v1/help/tickets/{ticket_id}/resolve', {
    params: { path: { ticket_id: ticketId } },
  });
  if (error) throw apiError(error);
  return data;
}

/** Any authenticated user who can see the ticket (owner, assignee, or a
 *  `help.tickets.manage` holder) — not gated on the manage permission
 *  itself (`help.service.close_ticket` only calls `_assert_visible`). */
export async function closeTicket(ticketId: string): Promise<TicketOut> {
  const { data, error } = await api.POST('/api/v1/help/tickets/{ticket_id}/close', {
    params: { path: { ticket_id: ticketId } },
  });
  if (error) throw apiError(error);
  return data;
}
