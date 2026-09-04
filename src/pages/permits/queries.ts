/**
 * Data layer for the permit list screens (`MyPermitsPage`, `PermitsPage`) —
 * `GET /permits` with exactly the filters that route accepts
 * (`app/modules/permits/router.py::list_permits`): `status`, `series`,
 * `number`, `organization_id`, plus paging. `applicant_id`/`contour_id` are
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

export type PermitOut = components['schemas']['PermitOut'];
export type PermitStatus = PermitOut['status'];

export interface PermitListFilters {
  status?: PermitStatus | '';
  series?: string;
  /** Kept as a string in the filter form; parsed to a bounded integer (or
   *  dropped entirely) below — never sent to the API as typed by the user. */
  number?: string;
  organization_id?: string;
  page: number;
  page_size: number;
}

export function usePermitsList(filters: PermitListFilters) {
  const parsedNumber = filters.number ? Number(filters.number) : undefined;
  const number = parsedNumber !== undefined && Number.isInteger(parsedNumber) && parsedNumber > 0 ? parsedNumber : undefined;

  const query = {
    status: filters.status || undefined,
    series: filters.series || undefined,
    number,
    organization_id: filters.organization_id || undefined,
    page: filters.page,
    page_size: filters.page_size,
  };

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
