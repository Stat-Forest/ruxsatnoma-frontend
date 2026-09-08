/**
 * Reference-data helpers shared by tasks 5 and 6's OWN subfolders
 * (`tariffs/`, `norm/`) — both need activity-type names, so this one file
 * sits directly under `pages/norms/` (a sibling of `ParamsTab.tsx`, not
 * inside either subfolder) rather than being duplicated twice. This is
 * narrower than the cross-TRACK duplication convention `params/valueEditor.ts`
 * documents (each of tasks 2-6 keeps its own copy of a small helper rather
 * than reaching into `applicant/`/`admin/`/etc.): sharing between two
 * subfolders of the SAME page this track owns is not that case, the same
 * reasoning that already put `components/PublishConfirmDialog.tsx` one
 * level up for tasks 4 and 5 to share.
 *
 * `GET /api/v1/refs/activity-types` needs no permission code — "form
 * dictionaries for every authenticated user" (`refs_router.py`'s own
 * docstring, quoted in `pages/permits/useRefsLookup.ts`) — so this hook
 * works the same for whichever of `norms.tariffs.manage`/`norms.manage`
 * actually opened this tab.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { apiError } from '../../api/errors';
import type { components } from '../../api/schema';

export type ActivityTypeOut = components['schemas']['ActivityTypeOut'];

/**
 * `enabled` defaults to `true` for `TariffFormModal`/`NormFormModal` (a
 * dialog that is only ever mounted while open, so it has no hidden-but-
 * mounted state to guard against — see `tariffs/queries.ts::useBenefitCategories`'s
 * identical note). `TariffsTab`/`NormsTab` pass their own `active` prop
 * explicitly instead, the same `enabled`-gate-fed-by-a-parent-prop pattern
 * `params/queries.ts` established for the reason task 3's report documents:
 * every tab body mounts up front and only toggles `hidden`. */
export function useActivityTypes(enabled = true) {
  return useQuery({
    queryKey: ['norms', 'refs', 'activity-types'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/refs/activity-types', {});
      if (error) throw apiError(error);
      return data;
    },
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** A `dict[str, Any]` localized name straight off the backend — duplicated
 *  from `applicant/format.ts::pickName`'s exact logic rather than imported,
 *  per this track's own precedent (`params/valueEditor.ts`'s file header):
 *  each track keeps its own copy of a small format helper. */
export function pickLocalizedName(
  name: Record<string, unknown> | null | undefined,
  lang: string = 'uz_latn',
): string {
  if (!name) return '';
  const direct = name[lang];
  if (typeof direct === 'string' && direct) return direct;
  for (const key of ['uz_latn', 'uz_cyrl', 'ru', 'en', 'kaa']) {
    const value = name[key];
    if (typeof value === 'string' && value) return value;
  }
  const first = Object.values(name).find((v) => typeof v === 'string' && v);
  return typeof first === 'string' ? first : '';
}
