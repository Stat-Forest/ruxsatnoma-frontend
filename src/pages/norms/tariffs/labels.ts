/**
 * F6's status vocabulary, permission codes and the two enums `TariffIn`
 * carries (`livestock_group`, `quantity_unit`) — the non-text half of this
 * screen, matching `params/labels.ts`'s own split between this file (enums,
 * patterns, permission codes) and the shared `i18n/ru.ts`/`uz_latn.ts` for
 * copy.
 */
export const TARIFF_STATUSES = ['draft', 'published', 'archived'] as const;
export type TariffStatus = (typeof TARIFF_STATUSES)[number];

export function statusLabelKey(status: string): string {
  return (TARIFF_STATUSES as readonly string[]).includes(status)
    ? `norms.tariffs.status.${status}`
    : status;
}

/** Rule parameters and tariffs are the SAME `_Versioned` lifecycle in
 *  `norms/service.py`, gated by the SAME two permission codes
 *  (`TARIFFS_MANAGE`/`TARIFFS_PUBLISH` in `norms/permissions.py`) —
 *  `params/labels.ts` defines the identical two strings for the exact same
 *  reason. Duplicated here rather than imported across the two subfolders
 *  (unlike `../refs.ts`, which is a genuinely shared lookup): a permission
 *  CODE is a leaf constant every screen in this codebase states for itself
 *  (`grep`-ability, per `params/labels.ts`'s own comment), not a value with
 *  behaviour worth sharing a module for. */
export const MANAGE_PERMISSION = 'norms.tariffs.manage';
export const PUBLISH_PERMISSION = 'norms.tariffs.publish';

/** `TariffIn.livestock_group` (`schemas.py::LivestockGroup`) — `null` for
 *  every non-grazing activity. VMQ 278's own split: crupny/melkiy skot
 *  (large/small stock), each взрослый/молодняк (adult/young). */
export const LIVESTOCK_GROUPS = ['large_adult', 'large_young', 'small_adult', 'small_young'] as const;
export type LivestockGroup = (typeof LIVESTOCK_GROUPS)[number];

export function livestockGroupLabelKey(group: string): string {
  return (LIVESTOCK_GROUPS as readonly string[]).includes(group)
    ? `norms.tariffs.livestockGroup.${group}`
    : group;
}

/** `TariffIn.quantity_unit` (`schemas.py::QuantityUnit`) — the VMQ 278 unit
 *  each activity is billed in. */
export const QUANTITY_UNITS = ['head', 'ton', 'hive', 'ha', 'person_day', 'm3', 'unit'] as const;
export type QuantityUnit = (typeof QUANTITY_UNITS)[number];

export function quantityUnitLabelKey(unit: string): string {
  return (QUANTITY_UNITS as readonly string[]).includes(unit)
    ? `norms.tariffs.quantityUnit.${unit}`
    : unit;
}

/** `TariffIn.basis`/`TariffPatch.basis` — 1..500 chars server-side, the
 *  exact bound `RuleParameterIn.basis` carries. */
export const TARIFF_BASIS_MAX_LENGTH = 500;
