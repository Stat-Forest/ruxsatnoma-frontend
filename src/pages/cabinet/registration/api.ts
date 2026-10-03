import { api } from '../../../api/client';
import { apiError } from '../../../api/errors';
import type { components } from '../../../api/schema';

type MeOut = components['schemas']['MeOut'];
export type CompleteRegistrationIn = components['schemas']['CompleteRegistrationIn'];

export async function completeRegistration(body: CompleteRegistrationIn): Promise<MeOut> {
  const { data, error } = await api.POST('/api/v1/auth/complete-registration', { body });
  if (error) throw apiError(error);
  return data;
}
