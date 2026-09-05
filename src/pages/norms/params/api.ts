/**
 * F7 — rule parameters, the register every fee calculation multiplies
 * through. A typed wrapper, in the style of `src/pages/admin/settings/api.ts`:
 * one function per route, every type read out of the generated
 * `src/api/schema.d.ts`, every failure turned into an `ApiError` so the
 * screen branches on a code rather than on a response shape.
 *
 * `RuleParameterOut.value` is `unknown` on the wire, exactly like
 * `SettingOut.value` — the contract declares no per-code type, so the caller
 * (`ParamsTab`) renders it by its RUNTIME type rather than assuming a shape.
 *
 * Task 3 left the write routes unwrapped on purpose ("a read screen should
 * not import a mutation it has no UI for"); task 4 is that UI, so all four
 * write routes join the one read route here.
 */
import { api } from '../../../api/client';
import { apiError } from '../../../api/errors';
import type { components } from '../../../api/schema';

export type RuleParameterOut = components['schemas']['RuleParameterOut'];
export type RuleParameterPage = components['schemas']['Page_RuleParameterOut_'];
export type RuleParameterIn = components['schemas']['RuleParameterIn'];
export type RuleParameterPatch = components['schemas']['RuleParameterPatch'];
// Shared with the tariffs route (task 5): `PublishOut.item` is typed `Any` on
// the wire precisely because BOTH `/rule-parameters/{id}/publish` and
// `/tariffs/{id}/publish` answer with it (schema.d.ts's own docstring). This
// screen invalidates and refetches on success rather than reading `item`, so
// only `warnings` is ever consumed here.
export type PublishOut = components['schemas']['PublishOut'];

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

export async function createRuleParameter(body: RuleParameterIn): Promise<RuleParameterOut> {
  const { data, error } = await api.POST('/api/v1/rule-parameters', { body });
  if (error) throw apiError(error);
  return data;
}

/** `RuleParameterPatch` has no `code` field at all — the contract's own way
 *  of saying it is immutable after creation (brief: "code is not patchable
 *  at all"), which is why the edit form never renders one. */
export async function patchRuleParameter(
  parameterId: string,
  body: RuleParameterPatch,
): Promise<RuleParameterOut> {
  const { data, error } = await api.PATCH('/api/v1/rule-parameters/{parameter_id}', {
    params: { path: { parameter_id: parameterId } },
    body,
  });
  if (error) throw apiError(error);
  return data;
}

/** Answers `{ item, warnings }`, not a bare row (ruling R4) — `warnings` is
 *  the AUTHORITATIVE set the server computed (e.g. `RI-04` for a retroactive
 *  `effective_from`), read by the publish dialog only after the client's own
 *  prediction of the same condition already warned the operator BEFORE the
 *  call — see `PublishConfirmDialog`. */
export async function publishRuleParameter(parameterId: string): Promise<PublishOut> {
  const { data, error } = await api.POST('/api/v1/rule-parameters/{parameter_id}/publish', {
    params: { path: { parameter_id: parameterId } },
  });
  if (error) throw apiError(error);
  return data;
}

/** Archiving an already-archived row is a no-op on the server, not an
 *  error — this screen never offers the action on an archived row in the
 *  first place (nothing left to close), so that branch is reachable only by
 *  a direct API call, never through this UI. */
export async function archiveRuleParameter(parameterId: string): Promise<RuleParameterOut> {
  const { data, error } = await api.POST('/api/v1/rule-parameters/{parameter_id}/archive', {
    params: { path: { parameter_id: parameterId } },
  });
  if (error) throw apiError(error);
  return data;
}
