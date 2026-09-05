/**
 * F6 — tariffs. Same five shapes as `params/api.ts`'s rule parameters, one
 * typed wrapper per route, every type read out of `schema.d.ts`.
 *
 * `TariffOut.coefficient` is a STRING on the wire (`field_serializer` in
 * `schemas.py` says why) — every function below treats it as opaque text,
 * never `Number(...)`/`parseFloat(...)`, so a value like `"1.500000"` is
 * neither rounded nor re-formatted on its way through this screen.
 */
import { api } from '../../../api/client';
import { apiError } from '../../../api/errors';
import type { components } from '../../../api/schema';

export type TariffOut = components['schemas']['TariffOut'];
export type TariffPage = components['schemas']['Page_TariffOut_'];
export type TariffIn = components['schemas']['TariffIn'];
export type TariffPatch = components['schemas']['TariffPatch'];
// Shared with `params/api.ts`: `PublishOut.item` is `Any` on the wire
// precisely because BOTH `/rule-parameters/{id}/publish` and
// `/tariffs/{id}/publish` answer with it. Re-declared here rather than
// imported from `../params/api` — a wire type from the shared schema, not a
// value with behaviour, so restating it costs nothing and keeps this folder
// independent of `params/`'s own file (the same reasoning `labels.ts`
// documents for the two permission constants).
export type PublishOut = components['schemas']['PublishOut'];
export type ClassifierItemOut = components['schemas']['ClassifierItemOut'];

export interface TariffListParams {
  activity_type_id?: string;
  status?: string;
  on_date?: string;
  limit?: number;
  offset?: number;
}

export async function listTariffs(params: TariffListParams): Promise<TariffPage> {
  const { data, error } = await api.GET('/api/v1/tariffs', { params: { query: params } });
  if (error) throw apiError(error);
  return data;
}

export async function createTariff(body: TariffIn): Promise<TariffOut> {
  const { data, error } = await api.POST('/api/v1/tariffs', { body });
  if (error) throw apiError(error);
  return data;
}

/** `TariffPatch` carries neither `activity_type_id` nor `livestock_group` —
 *  `service._Versioned.key_filters` matches a tariff BY those two columns,
 *  so they are identity, not editable state (the same reason
 *  `RuleParameterPatch` excludes `code`). The edit form never renders them. */
export async function patchTariff(tariffId: string, body: TariffPatch): Promise<TariffOut> {
  const { data, error } = await api.PATCH('/api/v1/tariffs/{tariff_id}', {
    params: { path: { tariff_id: tariffId } },
    body,
  });
  if (error) throw apiError(error);
  return data;
}

/** Answers `{ item, warnings }` (ruling R4) — see `params/api.ts`'s own note
 *  on `publishRuleParameter` for why `warnings` is the only field this
 *  screen reads off the response. */
export async function publishTariff(tariffId: string): Promise<PublishOut> {
  const { data, error } = await api.POST('/api/v1/tariffs/{tariff_id}/publish', {
    params: { path: { tariff_id: tariffId } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function archiveTariff(tariffId: string): Promise<TariffOut> {
  const { data, error } = await api.POST('/api/v1/tariffs/{tariff_id}/archive', {
    params: { path: { tariff_id: tariffId } },
  });
  if (error) throw apiError(error);
  return data;
}

/** `benefit_categories` — the classifier `TariffIn.benefit_modifiers`' KEYS
 *  belong to (`service._assert_benefit_codes`). Resolved through
 *  `GET /refs/classifiers/{code}/items`, the same route
 *  `staff/queries.ts::useBenefitCategories` already reads for the
 *  application side — duplicated here, not imported, per this track's own
 *  "each screen keeps its own copy of a small reference read" precedent
 *  (`params/valueEditor.ts`'s file header). */
export async function listBenefitCategories(): Promise<ClassifierItemOut[]> {
  const { data, error } = await api.GET('/api/v1/refs/classifiers/{code}/items', {
    params: { path: { code: 'benefit_categories' } },
  });
  if (error) throw apiError(error);
  return data;
}
