/**
 * react-query bindings for F7's read screen, in the style of
 * `src/pages/admin/templates/queries.ts`: the route wrapper lives in
 * `./api`, the caching policy here.
 *
 * Two independent queries, not one:
 *
 *  - `useRuleParametersList` backs the table — whatever `code`/`status`/
 *    `limit`/`offset` the operator's own filters and paging currently ask
 *    for. `placeholderData` keeps the previous page's rows on screen while a
 *    new filter/page is loading, instead of collapsing to the table's empty
 *    loading state on every click.
 *
 *  - `useDraftCoefficients` backs the banner ONLY. It always asks for
 *    `status=draft` at the contract's own page-size ceiling (200) and never
 *    for the operator's own `code` filter or page — the banner reports a
 *    systemic condition ("a grazing fee cannot be computed for anyone in the
 *    country"), so an operator who has filtered the table down to
 *    `archived` rows, or paged past the coefficients, must still see it.
 *    Ten `coef_sb:*` rows exist today (migration 0012); 200 is the
 *    contract's own `limit` ceiling, so one request covers every draft row
 *    in the system unless a later stage seeds far more drafts than that —
 *    see the task-3 report for this trade-off.
 *
 * Both are gated by the caller's `active` flag: `NormsPage` mounts every tab
 * body up front and only toggles `hidden` (see its file header), so a query
 * with no gate of its own would fire on page load even while another tab is
 * showing.
 */
import { useQuery } from '@tanstack/react-query';
import { listRuleParameters, type RuleParameterListParams } from './api';

const ROOT_KEY = ['norms', 'rule-parameters'] as const;

export function useRuleParametersList(params: RuleParameterListParams, active: boolean) {
  return useQuery({
    queryKey: [...ROOT_KEY, 'list', params],
    queryFn: () => listRuleParameters(params),
    enabled: active,
    placeholderData: (previous) => previous,
  });
}

const DRAFT_COEFFICIENTS_PARAMS: RuleParameterListParams = { status: 'draft', limit: 200, offset: 0 };

export function useDraftCoefficients(active: boolean) {
  return useQuery({
    queryKey: [...ROOT_KEY, 'draft-coefficients'],
    queryFn: () => listRuleParameters(DRAFT_COEFFICIENTS_PARAMS),
    enabled: active,
  });
}
