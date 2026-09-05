import { api } from '../../../api/client';
import { apiError } from '../../../api/errors';
import type { components } from '../../../api/schema';

type MeOut = components['schemas']['MeOut'];
type RegionOut = components['schemas']['RegionOut'];
type DistrictOut = components['schemas']['DistrictOut'];
export type CompleteRegistrationIn = components['schemas']['CompleteRegistrationIn'];

export async function completeRegistration(body: CompleteRegistrationIn): Promise<MeOut> {
  const { data, error } = await api.POST('/api/v1/auth/complete-registration', { body });
  if (error) throw apiError(error);
  return data;
}

export async function listRegions(): Promise<RegionOut[]> {
  const { data, error } = await api.GET('/api/v1/refs/regions', {});
  if (error) throw apiError(error);
  return data;
}

export async function listDistricts(regionId: string): Promise<DistrictOut[]> {
  const { data, error } = await api.GET('/api/v1/refs/districts', {
    params: { query: { region_id: regionId } },
  });
  if (error) throw apiError(error);
  return data;
}
