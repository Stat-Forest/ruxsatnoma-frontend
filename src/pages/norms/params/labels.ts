/**
 * F7's status vocabulary and the `coef_sb:` prefix constant.
 *
 * The copy itself is NOT local to this folder, unlike every other H-section
 * screen (`src/pages/admin/settings/labels.ts` and its siblings each carry a
 * full `uz_latn`/`ru` dictionary): task 2 put this track's strings in the
 * shared `src/i18n/ru.ts` / `uz_latn.ts` instead, namespaced under
 * `norms.params.*`, because `/norms` is ONE page whose three tabs are built
 * by four different tasks (3-6) — a shared page-level dictionary is what
 * lets task 2's tab labels and this task's copy coexist without each tab
 * inventing its own file that the others never see. This file holds only
 * what is not text: the enum backing the status filter's options, and the
 * prefix the banner keys on.
 */
export const RULE_PARAMETER_STATUSES = ['draft', 'published', 'archived'] as const;
export type RuleParameterStatus = (typeof RULE_PARAMETER_STATUSES)[number];

/** The prefix migration 0012 gives the ten conditional-head coefficients —
 *  see `ParamsTab`'s banner, which keys on this and status ALONE, never on
 *  `basis` (free text an operator can edit without changing what is
 *  actually blocking the calculation engine). */
export const COEF_SB_PREFIX = 'coef_sb:';

/** A status this screen does not recognise still needs a key `t()` can miss
 *  on and fall back to printing verbatim (`i18n/index.tsx`'s `dict[key] ??
 *  key`) — the same degrade-gracefully rule `templates/display.ts`'s
 *  `statusLabel` applies with a plain `default: return status`. */
export function statusLabelKey(status: string): string {
  return (RULE_PARAMETER_STATUSES as readonly string[]).includes(status)
    ? `norms.params.status.${status}`
    : status;
}
