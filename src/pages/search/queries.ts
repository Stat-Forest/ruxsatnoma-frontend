/**
 * React-query layer for the search screen, in the style of
 * `src/pages/support/tickets/queries.ts` — the HTTP wrappers themselves live
 * in `./api.ts`, these hooks only decide what is cached, under which key,
 * and what a successful mutation invalidates.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProfile,
  deleteProfile,
  listProfiles,
  search,
  updateProfile,
  type SavedFilterIn,
  type SavedFilterPatch,
  type SearchParams,
} from './api';

const PROFILES_KEY = ['search', 'profiles'] as const;

export function useSearchResults(params: SearchParams) {
  return useQuery({
    queryKey: ['search', 'results', params],
    queryFn: () => search(params),
    // Keeps the previous page on screen while the next one loads, rather
    // than blanking the table under the reader's cursor.
    placeholderData: (previous) => previous,
  });
}

export function useSavedFilters() {
  return useQuery({
    queryKey: PROFILES_KEY,
    queryFn: () => listProfiles(),
  });
}

export function useCreateSavedFilter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SavedFilterIn) => createProfile(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROFILES_KEY });
    },
  });
}

export function useUpdateSavedFilter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, patch }: { profileId: string; patch: SavedFilterPatch }) =>
      updateProfile(profileId, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROFILES_KEY });
    },
  });
}

export function useDeleteSavedFilter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profileId: string) => deleteProfile(profileId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROFILES_KEY });
    },
  });
}
