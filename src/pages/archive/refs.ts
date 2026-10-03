/**
 * Small reference-data helpers for the archive screen's own filter selects —
 * this track's own copy rather than an import from `pages/norms/refs.ts` or
 * `pages/permits/useRefsLookup.ts`, per this codebase's established
 * per-track duplication convention (see `pages/norms/refs.ts`'s own header
 * comment): each screen keeps its own small copy of a reference-data hook
 * rather than reaching into a page tree another track owns.
 *
 * Both routes need no permission code — "form dictionaries for every
 * authenticated user" (`refs_router.py`'s own docstring).
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { apiError } from '../../api/errors';
import type { components } from '../../api/schema';
import type { UiLanguage } from '../../i18n/context';

export type ActivityTypeOut = components['schemas']['ActivityTypeOut'];
export type OrganizationOut = components['schemas']['OrganizationOut'];

export function useActivityTypes() {
  return useQuery({
    queryKey: ['archive', 'refs', 'activity-types'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/refs/activity-types', {});
      if (error) throw apiError(error);
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

// `kind=leshoz`: the organization an archived record belongs to is always a
// leshoz (`Application.assigned_org_id`/`Permit.organization_id`), same
// reasoning `pages/permits/useRefsLookup.ts::useLeshozOrganizations`
// documents for the identical filter. This file moved here from
// `pages/search/refs.ts` when the search screen was dropped — archive was its
// only other reader.
export function useLeshozOrganizations() {
  return useQuery({
    queryKey: ['archive', 'refs', 'organizations', 'leshoz'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/refs/organizations', {
        params: { query: { kind: 'leshoz', page_size: 100 } },
      });
      if (error) throw apiError(error);
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

/** A `dict[str, Any]` localized name straight off the backend — duplicated
 *  from `pages/norms/refs.ts::pickLocalizedName`'s exact logic per this
 *  codebase's per-track duplication convention. */
export function pickLocalizedName(name: Record<string, unknown> | null | undefined, lang: UiLanguage): string {
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
