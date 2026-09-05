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

/** Task 4 — the two permission codes the write routes are gated on (task-4
 *  brief's own contract table). Named constants rather than inline string
 *  literals scattered across `ParamsTab`/`RuleParameterFormModal`: a typo in
 *  either place would silently hide or wrongly expose a control, and
 *  `grep`ping one constant finds every gate at once. */
export const MANAGE_PERMISSION = 'norms.tariffs.manage';
export const PUBLISH_PERMISSION = 'norms.tariffs.publish';

/** `code` is validated server-side against this exact pattern (task-4
 *  brief), max 100 chars — checked client-side in the create form so a typo
 *  reads as a field error instead of a 422 round trip. Not applied to `code`
 *  on PATCH: `RuleParameterPatch` has no such field at all, so there is
 *  nothing here for the edit form to validate. */
export const RULE_PARAMETER_CODE_PATTERN = /^[a-z0-9_]+(:[a-z0-9_]+)?$/;
export const RULE_PARAMETER_CODE_MAX_LENGTH = 100;

/** `basis` (`RuleParameterIn.basis`/`.RuleParameterPatch.basis`) is 1..500
 *  chars server-side — checked client-side for the same reason as the code
 *  pattern above. */
export const RULE_PARAMETER_BASIS_MAX_LENGTH = 500;
