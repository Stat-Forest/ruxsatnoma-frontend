/**
 * react-query bindings for F7, in the style of
 * `src/pages/admin/templates/queries.ts`: the route wrapper lives in
 * `./api`, the caching policy here.
 *
 * Two independent READ queries, not one:
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
 *
 * The four WRITE mutations (task 4) share one rule: invalidate `ROOT_KEY`
 * itself, not a leaf key. React Query treats `invalidateQueries` as a prefix
 * match, so invalidating `['norms', 'rule-parameters']` catches BOTH the
 * table's `[...ROOT_KEY, 'list', params]` (whatever params are currently
 * applied) and the banner's own `[...ROOT_KEY, 'draft-coefficients']` in one
 * call — a published `coef_sb:*` row has to drop out of the banner's count
 * without a reload, which a narrower invalidation would miss.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  archiveRuleParameter,
  createRuleParameter,
  listRuleParameters,
  patchRuleParameter,
  publishRuleParameter,
  type RuleParameterIn,
  type RuleParameterListParams,
  type RuleParameterPatch,
} from './api';

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

export function useCreateRuleParameter() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: RuleParameterIn) => createRuleParameter(body),
    onSuccess: () => client.invalidateQueries({ queryKey: ROOT_KEY }),
  });
}

export function useUpdateRuleParameter() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: RuleParameterPatch }) => patchRuleParameter(id, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ROOT_KEY }),
  });
}

/** Kept separate from `useArchiveRuleParameter` rather than one
 *  `useTransitionRuleParameter(action)` hook: the two answer DIFFERENT
 *  shapes (`PublishOut` vs a bare `RuleParameterOut`, brief's own callout),
 *  so a shared hook would have to union its return type for no real benefit
 *  — every caller already knows which action it is asking for. */
export function usePublishRuleParameter() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => publishRuleParameter(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ROOT_KEY }),
  });
}

export function useArchiveRuleParameter() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveRuleParameter(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ROOT_KEY }),
  });
}
