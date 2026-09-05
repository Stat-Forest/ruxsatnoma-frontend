/**
 * H5's data layer — `@tanstack/react-query` in the style of
 * `src/pages/permits/queries.ts`: one key factory, thin `queryFn`s over the
 * wrappers, and mutations that invalidate the tree rather than patch it by
 * hand (a create or a re-parent moves a whole branch, which is not something
 * a local cache edit gets right).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listDistricts, listRegions } from '../api';
import {
  archiveOrganization,
  createOrganization,
  fetchOrganizationTree,
  getOrganization,
  patchOrganization,
  type OrganizationIn,
  type OrganizationPatch,
} from './api';

export const organizationKeys = {
  all: ['admin', 'organizations'] as const,
  tree: () => [...organizationKeys.all, 'tree'] as const,
  detail: (orgId: string) => [...organizationKeys.all, 'detail', orgId] as const,
};

export const territoryKeys = {
  regions: ['refs', 'regions'] as const,
  districts: (regionId?: string) => ['refs', 'districts', regionId ?? 'all'] as const,
};

export function useOrganizationTree() {
  return useQuery({
    queryKey: organizationKeys.tree(),
    queryFn: fetchOrganizationTree,
  });
}

export function useOrganizationDetail(orgId: string | undefined) {
  return useQuery({
    queryKey: organizationKeys.detail(orgId ?? ''),
    queryFn: () => getOrganization(orgId!),
    enabled: Boolean(orgId),
  });
}

export function useRegions() {
  return useQuery({
    queryKey: territoryKeys.regions,
    queryFn: listRegions,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Districts for ONE region. Disabled until a region is picked, deliberately:
 * `GET /refs/districts` with no `region_id` answers with all ~208 districts of
 * the country, which is not a list anybody scrolls to find a neighbouring
 * district in — and picking a district outside the chosen region is exactly
 * the mistake the narrowing exists to prevent.
 */
export function useDistricts(regionId: string | undefined) {
  return useQuery({
    queryKey: territoryKeys.districts(regionId),
    queryFn: () => listDistricts(regionId),
    enabled: Boolean(regionId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateOrganization() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: OrganizationIn) => createOrganization(body),
    onSuccess: () => client.invalidateQueries({ queryKey: organizationKeys.all }),
  });
}

export function useUpdateOrganization() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, body }: { orgId: string; body: OrganizationPatch }) =>
      patchOrganization(orgId, body),
    onSuccess: () => client.invalidateQueries({ queryKey: organizationKeys.all }),
  });
}

export function useArchiveOrganization() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (orgId: string) => archiveOrganization(orgId),
    onSuccess: () => client.invalidateQueries({ queryKey: organizationKeys.all }),
  });
}
