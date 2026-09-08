/**
 * Data layer for the Agency's ratings screen (rulings #140-#143, stage 7.7,
 * task 9). Two thin `openapi-fetch` wrappers, in the shape of
 * `pages/admin/activities/api.ts`: one call per route, `if (error) throw
 * apiError(error)`, every type read out of the generated
 * `src/api/schema.d.ts` rather than hand-written.
 *
 * **Both routes are zone-scoped server-side (ruling #142) — this file adds
 * no filtering of its own.** A leshoz's `executor_head` sees only their own
 * organization's ratings, the Agency's `central_admin`/`leadership` see
 * every zone; `organization_id`/`activity_type_id` on the summary only
 * narrow that zone further, they never widen it.
 *
 * `avg_score` on every shape below is the backend's own serialized decimal
 * string, or `null` when the slice held zero ratings (ruling #143: a portal
 * may not state a number it cannot produce) — never re-parsed through
 * `Number` here, so a caller renders exactly what the backend sent.
 */
import { api } from '../../api/client';
import { apiError } from '../../api/errors';
import type { components } from '../../api/schema';

export type RatingsSummaryOut = components['schemas']['RatingsSummaryOut'];
export type RatingsBreakdownRow = components['schemas']['RatingsBreakdownRow'];
export type RatingCommentRow = components['schemas']['RatingCommentRow'];
export type PageRatingCommentRow = components['schemas']['Page_RatingCommentRow_'];

export interface RatingsSummaryParams {
  period_from: string;
  period_to: string;
  organization_id?: string;
  activity_type_id?: string;
}

/** `GET /admin/ratings/summary` — the overall average and count over the
 *  caller's own zone and the given period, plus the same pair broken down
 *  by organization and by activity type. */
export async function getRatingsSummary(params: RatingsSummaryParams): Promise<RatingsSummaryOut> {
  const { data, error } = await api.GET('/api/v1/admin/ratings/summary', {
    params: { query: params },
  });
  if (error) throw apiError(error);
  return data;
}

export interface RatingsListParams {
  period_from: string;
  period_to: string;
  page?: number;
  page_size?: number;
}

/** `GET /admin/ratings` — the anonymous comment feed (ruling #141): date,
 *  service, leshoz, score, text, never who left it. Takes no
 *  `organization_id`/`activity_type_id` of its own — the route offers no
 *  narrowing beyond the period and the caller's own zone. */
export async function listRatings(params: RatingsListParams): Promise<PageRatingCommentRow> {
  const { data, error } = await api.GET('/api/v1/admin/ratings', {
    params: { query: params },
  });
  if (error) throw apiError(error);
  return data;
}
