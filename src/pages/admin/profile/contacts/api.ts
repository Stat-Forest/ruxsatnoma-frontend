import { api } from '../../../../api/client';
import { apiError } from '../../../../api/errors';
import type { components } from '../../../../api/schema';

type MeOut = components['schemas']['MeOut'];
export type ContactUpdateIn = components['schemas']['ContactUpdateIn'];

/** `PATCH /auth/me` — exactly one of `phone`/`email` (schema-enforced), plus
 * the `otp_token` `POST /auth/otp/verify` minted for that same target. */
export async function patchContact(body: ContactUpdateIn): Promise<MeOut> {
  const { data, error } = await api.PATCH('/api/v1/auth/me', { body });
  if (error) throw apiError(error);
  return data;
}
