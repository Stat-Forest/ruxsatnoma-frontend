/**
 * react-query bindings for F6, mirroring `params/queries.ts`'s own shape
 * (one root key, invalidated whole on every write) — tariffs have no
 * banner, so there is only ever the one list query, but the invalidation
 * rule stays the same: a write invalidates `ROOT_KEY` itself so every
 * `[...ROOT_KEY, 'list', params]` variant (whatever filters are currently
 * applied) refetches, not just the one the mutation happened to be called
 * from.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  archiveTariff,
  createTariff,
  listBenefitCategories,
  listTariffs,
  patchTariff,
  publishTariff,
  type TariffIn,
  type TariffListParams,
  type TariffPatch,
} from './api';

const ROOT_KEY = ['norms', 'tariffs'] as const;

export function useTariffsList(params: TariffListParams, active: boolean) {
  return useQuery({
    queryKey: [...ROOT_KEY, 'list', params],
    queryFn: () => listTariffs(params),
    enabled: active,
    placeholderData: (previous) => previous,
  });
}

/** Feeds the create/edit form's benefit-modifier code picker. No `active`
 *  gate of its own, unlike the list query above: `TariffFormModal` is only
 *  ever mounted while its dialog is open (task 2's always-mounted-but-
 *  `hidden` design applies to the three TAB bodies, not to a modal a tab
 *  opens on demand), so there is no hidden-but-mounted state to guard
 *  against here. */
export function useBenefitCategories() {
  return useQuery({
    queryKey: ['norms', 'refs', 'benefit-categories'],
    queryFn: listBenefitCategories,
    staleTime: 5 * 60_000,
  });
}

export function useCreateTariff() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: TariffIn) => createTariff(body),
    onSuccess: () => client.invalidateQueries({ queryKey: ROOT_KEY }),
  });
}

export function useUpdateTariff() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: TariffPatch }) => patchTariff(id, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ROOT_KEY }),
  });
}

export function usePublishTariff() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => publishTariff(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ROOT_KEY }),
  });
}

export function useArchiveTariff() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveTariff(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ROOT_KEY }),
  });
}
