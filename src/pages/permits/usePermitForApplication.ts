/**
 * Finds the permit already issued for one application, if one exists yet.
 *
 * `GET /permits` has no `application_id` filter at all
 * (`app/modules/permits/router.py::list_permits`'s own parameter list) —
 * `permits.application_id` is unique (`permits/repo.py::permit_by_application`'s
 * own docstring), but nothing exposes a lookup by it to a client. This
 * narrows with the two filters the route DOES accept — `applicant_id` and
 * `contour_id`, both real columns the calling application already carries —
 * and picks the one row whose `application_id` matches. A given
 * applicant+contour pair realistically carries very few permits ever issued,
 * so one page at the API's own `page_size` cap is enough without inventing a
 * filter the backend does not have.
 *
 * Used by both application cards (`applicant/MyApplicationCardPage.tsx`,
 * `staff/components/DecisionPanel.tsx`) to offer "open the permit" once one
 * exists — the natural path the missing list screens had stranded.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { apiError } from '../../api/errors';
import type { PermitOut } from './queries';

export function usePermitForApplication(params: {
  applicationId: string;
  applicantId: string | undefined;
  contourId: string | null | undefined;
  /** Only worth asking once the application could plausibly have a permit.
   *  Issuance requires a PAID application (`permits/service.py::issue`), and
   *  a paid-but-unsigned permit does NOT move the application out of PAID
   *  (`docs/status.md`'s "a paid, unsigned permit is stuck forever") — so
   *  both `PAID` and `PERMIT_ISSUED` must be checked, never `PERMIT_ISSUED`
   *  alone, or the link would stay hidden for exactly the state most worth
   *  surfacing. */
  enabled: boolean;
}) {
  const { applicationId, applicantId, contourId, enabled } = params;
  return useQuery<PermitOut | null>({
    queryKey: ['permits', 'for-application', applicationId, applicantId, contourId],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/permits', {
        params: { query: { applicant_id: applicantId, contour_id: contourId ?? undefined, page_size: 100 } },
      });
      if (error) throw apiError(error);
      return data.items.find((item) => item.application_id === applicationId) ?? null;
    },
    enabled: enabled && !!applicantId && !!contourId,
    staleTime: 30_000,
    retry: false,
  });
}
