/**
 * Typed wrappers around the four `/admin/integrations/*` routes screen H10
 * calls (`app/modules/admin/integrations_router.py`), in the same shape as
 * `src/pages/admin/api.ts`: one thin `async` function per route, every type
 * taken from the generated `src/api/schema.d.ts`, every failure turned into
 * an `ApiError` by `apiError` at the call site rather than in each screen.
 *
 * Kept local to `src/pages/admin/integrations/` rather than folded into the
 * area-wide `admin/api.ts`: that file is owned by another worker this
 * sprint, and the queue is the one admin surface whose two actions mutate
 * real delivery rather than reference data.
 *
 * NOTE ON THE PAYLOAD. Neither `OutboxMessageOut` nor `DeadLetterOut`
 * carries the message body — the backend strips `payload` from both
 * ("it may carry OTP codes, so listings never expose it"). There is no
 * detail route that returns it either. So the screen's detail view shows
 * every field the API *does* return, plus the error text; it cannot show a
 * payload that never crosses the wire, and it says so rather than rendering
 * an empty box.
 */
import { api } from '../../../api/client';
import { apiError } from '../../../api/errors';
import type { components } from '../../../api/schema';

export type OutboxMessageOut = components['schemas']['OutboxMessageOut'];
export type DeadLetterOut = components['schemas']['DeadLetterOut'];
export type PageOutboxMessageOut = components['schemas']['Page_OutboxMessageOut_'];
export type PageDeadLetterOut = components['schemas']['Page_DeadLetterOut_'];

/**
 * `list_outbox`'s whole query surface: `status`, `destination` and paging.
 * There is no free-text search, no date range and no `correlation_id`
 * filter — the route accepts none, so the screen offers none.
 */
export interface OutboxListParams {
  status?: string;
  destination?: string;
  page?: number;
  page_size?: number;
}

/** `list_dead_letters` accepts `status` and paging — and, unlike the outbox,
 *  no `source` filter, so the screen must not offer one. */
export interface DeadLetterListParams {
  status?: string;
  page?: number;
  page_size?: number;
}

export async function listOutbox(params: OutboxListParams): Promise<PageOutboxMessageOut> {
  const { data, error } = await api.GET('/api/v1/admin/integrations/outbox', {
    params: { query: params },
  });
  if (error) throw apiError(error);
  return data;
}

/** Sends a `dead` row back to the front of the queue: status becomes
 *  `pending`, `attempts` resets to 0 and the "already alerted" stamp is
 *  cleared. The backend refuses anything that is not `dead`
 *  (`ERR-VAL-001`, `reason: not_dead`) — a `pending` row is not stuck, so
 *  requeuing it would claim an action that did not happen. */
export async function requeueOutboxMessage(messageId: string): Promise<OutboxMessageOut> {
  const { data, error } = await api.POST('/api/v1/admin/integrations/outbox/{message_id}/requeue', {
    params: { path: { message_id: messageId } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function listDeadLetters(params: DeadLetterListParams): Promise<PageDeadLetterOut> {
  const { data, error } = await api.GET('/api/v1/admin/integrations/dead-letters', {
    params: { query: params },
  });
  if (error) throw apiError(error);
  return data;
}

/** Marks an inbound letter `discarded` and stamps the actor and the time.
 *  Irreversible: there is no un-discard route, and the backend refuses a
 *  second attempt (`ERR-VAL-001`, `reason: not_new`) precisely so the triage
 *  trail cannot be overwritten. The screen confirms it by name. */
export async function discardDeadLetter(letterId: string): Promise<DeadLetterOut> {
  const { data, error } = await api.POST('/api/v1/admin/integrations/dead-letters/{letter_id}/discard', {
    params: { path: { letter_id: letterId } },
  });
  if (error) throw apiError(error);
  return data;
}
