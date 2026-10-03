/**
 * Data layer for the permit list screens (`MyPermitsPage`, `PermitsPage`) —
 * `GET /permits` with exactly the filters that route accepts
 * (`app/modules/permits/router.py::list_permits`): `status`, `series`,
 * `number` (both read out of one typed permit number, `lib/permitNumber.ts`),
 * `organization_id`, plus paging. `applicant_id`/`contour_id` are
 * real parameters too, but neither screen sends them: the applicant's own
 * scope is narrowed server-side to their own permits without asking
 * (`permits/service.py::list_permits`'s own `own_applicant_ids` union), and a
 * raw-UUID contour box is not a filter a human can type — the same reasoning
 * `staff/ApplicationsListPage.tsx` already applies to `contour_id` /
 * `applicant_id` on the applications list.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { apiError } from '../../api/errors';
import type { components } from '../../api/schema';
import { parsePermitNo } from '../../lib/permitNumber';

export type PermitOut = components['schemas']['PermitOut'];
export type PermitStatus = PermitOut['status'];

export interface PermitListFilters {
  status?: PermitStatus | '';
  q?: string;
  /** The permit number as typed («А 000002») — split into `series` and
   *  `number` below, never sent to the API as typed by the user. */
  permit_no?: string;
  organization_id?: string;
  page: number;
  page_size: number;
}

/** The `FilterFormState` -> real query mapping `GET /permits` accepts —
 *  pulled out so I1's CSV export (`PermitsListPage.tsx::exportCsv`) can
 *  build the identical query for every page it fetches without
 *  re-deriving (and risking drifting from) this parsing by hand. */
export function toPermitsQuery(filters: PermitListFilters) {
  // An unreadable number sends neither half: the screen says the box is
  // wrong (`PermitsListPage.tsx`), and the list stays the unfiltered one.
  const permitNo = parsePermitNo(filters.permit_no ?? '') ?? {};

  return {
    status: filters.status || undefined,
    q: filters.q || undefined,
    series: permitNo.series,
    number: permitNo.number,
    organization_id: filters.organization_id || undefined,
    page: filters.page,
    page_size: filters.page_size,
  };
}

export function usePermitsList(filters: PermitListFilters) {
  const query = toPermitsQuery(filters);

  return useQuery({
    queryKey: ['permits', 'list', query],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/permits', { params: { query } });
      if (error) throw apiError(error);
      return data;
    },
    placeholderData: (previous) => previous,
  });
}
