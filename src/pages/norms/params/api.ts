/**
 * F7 — rule parameters, the register every fee calculation multiplies
 * through. A typed wrapper around the one route this task reads
 * (`GET /rule-parameters`), in the style of `src/pages/admin/settings/api.ts`:
 * one function per route, every type read out of the generated
 * `src/api/schema.d.ts`, every failure turned into an `ApiError` so the
 * screen branches on a code rather than on a response shape.
 *
 * `RuleParameterOut.value` is `unknown` on the wire, exactly like
 * `SettingOut.value` — the contract declares no per-code type, so the caller
 * (`ParamsTab`) renders it by its RUNTIME type rather than assuming a shape.
 *
 * The write routes (`PATCH`, `publish`, `archive`) are task 4's — not
 * wrapped here, so this module cannot tempt a read screen into offering an
 * action it has no UI for.
 */
import { api } from '../../../api/client';
import { apiError } from '../../../api/errors';
import type { components } from '../../../api/schema';

export type RuleParameterOut = components['schemas']['RuleParameterOut'];
export type RuleParameterPage = components['schemas']['Page_RuleParameterOut_'];

export interface RuleParameterListParams {
  code?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export async function listRuleParameters(
  params: RuleParameterListParams,
): Promise<RuleParameterPage> {
  const { data, error } = await api.GET('/api/v1/rule-parameters', {
    params: { query: params },
  });
  if (error) throw apiError(error);
  return data;
}
