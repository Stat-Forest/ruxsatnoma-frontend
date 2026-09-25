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
 * **This screen reads `GET /refs/activity-types/all`, never the plain
 * `GET /refs/activity-types`.** The plain route returns ACTIVE rows only —
 * the filter that feeds the public landing and the application wizard
 * (ruling #139a) — so a service switched off here vanished from this very
 * screen with no way to switch it back on. The `/all` route (gated by
 * `admin.classifiers.manage`) returns all six whatever their status, and the
 * switch on each card flips `status` both ways.
 */
import { api } from '../../../api/client';
import { apiError } from '../../../api/errors';
import type { components } from '../../../api/schema';

export type ActivityTypeOut = components['schemas']['ActivityTypeOut'];
export type ActivityTypePatch = components['schemas']['ActivityTypePatch'];
export type LocalizedName = components['schemas']['LocalizedName'];

/** All six activities, switched-off ones included (see module note above). */
export async function listActivityTypes(): Promise<ActivityTypeOut[]> {
  const { data, error } = await api.GET('/api/v1/refs/activity-types/all', {});
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
