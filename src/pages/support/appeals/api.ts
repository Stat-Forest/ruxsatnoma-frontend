/**
 * Typed wrappers around the four staff-side `/admin/public/appeals*` routes
 * (`public.admin_router`) — `openapi-fetch`, every type taken from the
 * generated `src/api/schema.d.ts`, never hand-written, in the style of
 * `src/pages/admin/announcements/api.ts`.
 *
 * The anonymous `GET /public/appeals/check` and the citizen's own filing
 * form (`POST /public/appeals`) are deliberately absent — those shipped on
 * the public landing site already, not this track.
 *
 * `GET /admin/public/appeals` is paged via `page`/`page_size`
 * (`app/core/schemas.py::PageParams`), the same convention `tickets/api.ts`
 * uses — NOT `limit`/`offset`.
 */
import { api } from '../../../api/client';
import { apiError } from '../../../api/errors';
import type { components } from '../../../api/schema';

export type AppealAdminOut = components['schemas']['AppealAdminOut'];
export type AppealPage = components['schemas']['Page_AppealAdminOut_'];

/** `AppealAdminOut.status` is a bare `string` in the contract, not an enum —
 *  these are the four values `public.models.APPEAL_STATUSES` produces. */
export type AppealStatus = 'new' | 'in_progress' | 'answered' | 'closed';

export interface AppealListParams {
  /** Omitted means every status. Never send `''` — the status-filter
   *  gotcha `announcements/api.ts` documents for its own list. */
  status?: AppealStatus | '';
  page: number;
  page_size: number;
}

export async function listAppeals(params: AppealListParams): Promise<AppealPage> {
  const { data, error } = await api.GET('/api/v1/admin/public/appeals', {
    params: { query: { status: params.status || undefined, page: params.page, page_size: params.page_size } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function getAppeal(appealId: string): Promise<AppealAdminOut> {
  const { data, error } = await api.GET('/api/v1/admin/public/appeals/{appeal_id}', {
    params: { path: { appeal_id: appealId } },
  });
  if (error) throw apiError(error);
  return data;
}

/** `to_status` is narrowed to `in_progress|closed` server-side
 *  (`AppealStatusIn`'s own pattern) — `answered` is reachable only through
 *  `answerAppeal` below, which is what keeps the `answered_fields_
 *  consistent` CHECK constraint satisfied on every row that reaches it. */
export async function advanceAppealStatus(
  appealId: string,
  toStatus: 'in_progress' | 'closed',
): Promise<AppealAdminOut> {
  const { data, error } = await api.POST('/api/v1/admin/public/appeals/{appeal_id}/status', {
    params: { path: { appeal_id: appealId } },
    body: { to_status: toStatus },
  });
  if (error) throw apiError(error);
  return data;
}

export async function answerAppeal(appealId: string, answerText: string): Promise<AppealAdminOut> {
  const { data, error } = await api.POST('/api/v1/admin/public/appeals/{appeal_id}/answer', {
    params: { path: { appeal_id: appealId } },
    body: { answer_text: answerText },
  });
  if (error) throw apiError(error);
  return data;
}

/** `contact` is an untyped `Record<string, unknown>` (jsonb) — read
 *  defensively, matching `applicant/format.ts::pickName`'s own defensive
 *  style rather than trusting the shape. */
export function readContact(contact: AppealAdminOut['contact']): { phone: string | null; email: string | null } {
  const phone = contact?.phone;
  const email = contact?.email;
  return {
    phone: typeof phone === 'string' ? phone : null,
    email: typeof email === 'string' ? email : null,
  };
}
