/**
 * H-services — the `activity_types` catalog (rulings #138, #139, #139a).
 *
 * Typed wrappers around the two routes this screen drives, in the shape of
 * `src/pages/admin/classifiers/api.ts`: one thin `openapi-fetch` call per
 * route, `if (error) throw apiError(error)`, every type read out of the
 * generated `src/api/schema.d.ts` rather than hand-written.
 *
 * **The catalog is fixed by law (ruling #139): `PATCH` is the only write.**
 * There is no `POST` and no `DELETE` here on purpose — the six activities'
 * codes are what the tariffs and the price calculator resolve by
 * (`norms.service._resolve_activity_code`), so a seventh row with no tariff
 * would break the calculator for everyone, silently. `ActivityTypeIn` does
 * not exist as a type for the same reason: nothing on this screen may ever
 * construct one.
 *
 * **`GET /refs/activity-types` returns ACTIVE rows only** (`admin/repo.py`'s
 * `list_activity_types`, `status = 'active'`) — the same filter that feeds
 * the public landing and the application wizard (ruling #139a). A row this
 * screen just archived disappears from its own next fetch, not because it
 * was deleted, but because the read never shows an archived one in the first
 * place. There is no companion route that lists archived rows, so this
 * screen offers no way back in — reactivating one is a database operation,
 * not a screen action, exactly like the catalog's missing create/delete.
 */
import { api } from '../../../api/client';
import { apiError } from '../../../api/errors';
import type { components } from '../../../api/schema';

export type ActivityTypeOut = components['schemas']['ActivityTypeOut'];
export type ActivityTypePatch = components['schemas']['ActivityTypePatch'];
export type LocalizedName = components['schemas']['LocalizedName'];

/** Active activities only (see module note above) — always six or fewer. */
export async function listActivityTypes(): Promise<ActivityTypeOut[]> {
  const { data, error } = await api.GET('/api/v1/refs/activity-types', {});
  if (error) throw apiError(error);
  return data;
}

/**
 * The catalog's one write. `patch` carries only the keys that changed —
 * `processing_days`/`sort_order`/`status` may never be sent as an explicit
 * `null` (the backend 422s: those three back NOT-NULL columns), so a caller
 * that has nothing to say about one of them must omit the key rather than
 * set it to `null`. `description` is genuinely nullable and may be sent as
 * `null` to clear it.
 */
export async function updateActivityType(
  activityTypeId: string,
  patch: ActivityTypePatch,
): Promise<ActivityTypeOut> {
  const { data, error } = await api.PATCH('/api/v1/refs/activity-types/{activity_type_id}', {
    params: { path: { activity_type_id: activityTypeId } },
    body: patch,
  });
  if (error) throw apiError(error);
  return data;
}
