/**
 * Name resolution for the permit's own frozen id columns (`activity_type_id`,
 * `organization_id`, `contour_id`) — all three ref/read routes admit ANY
 * authenticated user (`refs_router.py`'s own docstring: "form dictionaries
 * for every authenticated user … no permission code and no zone filtering";
 * `gis/router.py::get_contour_card` gates on nothing but `get_current_user`
 * either), so these hooks work the same on the applicant's own permit page
 * and the staff one.
 *
 * This is NOT "re-reading the application" (the task's own instruction to
 * avoid): `permits.activity_type_id`/`organization_id`/`contour_id` are the
 * PERMIT's own columns, frozen at issuance — these hooks only turn an id the
 * permit itself carries into a human name, the same way a `<select>` full of
 * ids needs its options' labels from somewhere.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { apiError } from '../../api/errors';
import { pickLocalizedName } from './format';
import type { UiLanguage } from '../../i18n/context';

export function useActivityTypeName(activityTypeId: string | undefined, lang: UiLanguage): string | null {
  const query = useQuery({
    queryKey: ['refs', 'activity-types'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/refs/activity-types', {});
      if (error) throw apiError(error);
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
  const found = query.data?.find((item) => item.id === activityTypeId);
  return found ? pickLocalizedName(found.name, lang) : null;
}

export function useOrganizationName(organizationId: string | undefined, lang: UiLanguage): string | null {
  // `kind=leshoz`, not an unfiltered fetch: `admin/repo.py::_organizations_query`
  // documents "no filter at all -> the root only" (ruling 11) -- the endpoint is
  // built to be walked level by level (root, then children by `parent_id`), not
  // flattened in one call, so an unfiltered page_size=100 fetch silently returns
  // just the agency root and never finds a leshoz. `permits/service.py`'s own
  // docstring says today's `permits.organization_id` "is always the contour's
  // leshoz" (nothing populates a sub-leshoz organization yet), which is the one
  // fact that makes this filter correct rather than a coincidence.
  const query = useQuery({
    queryKey: ['refs', 'organizations', 'leshoz'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/refs/organizations', {
        params: { query: { kind: 'leshoz', page_size: 100 } },
      });
      if (error) throw apiError(error);
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
  const found = query.data?.items.find((item) => item.id === organizationId);
  return found ? pickLocalizedName(found.name, lang) : null;
}

export function useContourNumber(contourId: string | undefined): string | null {
  const query = useQuery({
    queryKey: ['gis', 'contour', contourId],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/gis/contours/{contour_id}', {
        params: { path: { contour_id: contourId! } },
      });
      if (error) throw apiError(error);
      return data;
    },
    enabled: !!contourId,
    staleTime: 5 * 60 * 1000,
  });
  return query.data?.number ?? null;
}
