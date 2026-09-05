/**
 * The two routes screen H7 (system settings) calls, wrapped in the style of
 * `src/pages/admin/api.ts`: one function per route, every type read out of
 * the generated `src/api/schema.d.ts`, every failure turned into an
 * `ApiError` by `apiError` so a screen branches on a code rather than on a
 * response shape.
 *
 * There is no reset route. `PUT /admin/settings/{key}` is the whole write
 * surface, so returning a setting to its default means sending that default
 * back as an ordinary value — which is why the screen shows the default
 * beside the current value instead of offering a button it cannot honour.
 */
import { api } from '../../../api/client';
import { apiError } from '../../../api/errors';
import type { components } from '../../../api/schema';

export type SettingOut = components['schemas']['SettingOut'];
export type SettingIn = components['schemas']['SettingIn'];

export async function listSettings(): Promise<SettingOut[]> {
  const { data, error } = await api.GET('/api/v1/admin/settings', {});
  if (error) throw apiError(error);
  return data;
}

/**
 * `value` is `unknown` on the wire in both directions (`SettingIn.value`,
 * `SettingOut.value`): the backend stores a JSON document per key and the
 * contract declares no per-key type. Nothing here narrows it — the screen
 * infers an editor from the CURRENT value's runtime type and is responsible
 * for handing this function a parsed value of that same type, never the text
 * a user typed.
 */
export async function updateSetting(key: string, value: unknown): Promise<SettingOut> {
  const { data, error } = await api.PUT('/api/v1/admin/settings/{key}', {
    params: { path: { key } },
    body: { value },
  });
  if (error) throw apiError(error);
  return data;
}
