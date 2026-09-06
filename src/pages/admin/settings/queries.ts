/**
 * Data layer for H7, in the style of `src/pages/permits/queries.ts`: the
 * hooks live here, the raw route wrappers in `./api.ts`.
 *
 * `useUpdateSetting` is called once PER ROW, not once for the screen. Each
 * row therefore owns its own `isPending` and its own `error`, which is what
 * makes a refused save a defect of that one row instead of a banner over a
 * table whose other rows are perfectly fine.
 *
 * On success the one changed row is patched into the cached list with
 * `setQueryData` rather than invalidated: a refetch would be a second round
 * trip for an answer the PUT already gave, and — more to the point — it
 * would replace the array while a neighbouring row may be holding an
 * unsaved edit. Patching keeps every other row's identity, and its state,
 * exactly where it was.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listSettings, updateSetting, type SettingOut } from './api';

export const SETTINGS_QUERY_KEY = ['admin', 'settings'] as const;

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: listSettings,
  });
}

export function useUpdateSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) => updateSetting(key, value),
    onSuccess: (updated) => {
      queryClient.setQueryData<SettingOut[]>(SETTINGS_QUERY_KEY, (previous) =>
        previous?.map((setting) => (setting.key === updated.key ? updated : setting)),
      );
    },
  });
}
