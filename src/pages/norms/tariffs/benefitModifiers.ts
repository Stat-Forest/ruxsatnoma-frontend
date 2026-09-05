/**
 * `TariffIn.benefit_modifiers` / `TariffPatch.benefit_modifiers` — a map of
 * `benefit_categories` classifier code to a `0 <= modifier <= 1` string
 * multiplier (`schemas.py::_benefit_modifiers`'s own docstring: "a benefit
 * REDUCES a fee"). The form edits it as a list of `{code, modifier}` DRAFT
 * rows (an ordinary `Record` cannot hold an in-progress "code not chosen
 * yet" row while the operator is still picking one), converted to the wire
 * shape only on submit.
 *
 * Two of the server's three refusals are made UNREACHABLE by construction
 * here — the code picker only offers `benefit_categories` codes the tab
 * already fetched (so `unknown_benefit_category`, `ERR-VAL-001`, cannot fire
 * from a code chosen through this UI) and this same 0..1 bound is checked
 * before submit (so the raw, un-enveloped 422 `_benefit_modifiers` raises
 * for an out-of-range value is avoided in the common case). Both guards stay
 * in place because a classifier item can be archived, or another operator's
 * change can land, between this tab's fetch and the submit — the SAME class
 * of race `RuleParameterFormModal`'s client checks already accept as a gap
 * a fresh fetch would close (see its own "Deliberately not done" notes).
 */
export interface BenefitModifierRow {
  /** Empty until the operator picks a code — a row in this state is
   *  DROPPED, not submitted, so a half-filled "add" click cannot silently
   *  create a `benefit_modifiers` key of `""`. */
  code: string;
  modifier: string;
}

export type ModifierError = 'required' | 'invalid' | 'outOfRange';

export function modifierError(text: string): ModifierError | null {
  const trimmed = text.trim();
  if (trimmed === '') return 'required';
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return 'invalid';
  if (parsed < 0 || parsed > 1) return 'outOfRange';
  return null;
}

/** `undefined` (RuleParameter's own convention for "field omitted") for an
 *  empty list — `TariffIn.benefit_modifiers` defaults to `None`, and this
 *  screen never sends an empty `{}` where "no benefits at all" is meant.
 *
 *  Only drops a row with NO code chosen yet (an "add" click the operator
 *  never finished) — it does NOT re-check `modifierError` here, on purpose:
 *  the form validates every code-bearing row's modifier before this is ever
 *  called (the same "check, then convert" split `parseValueDraft` uses), so
 *  a silent drop here would hide a real validation bug instead of surfacing
 *  it as a blocked submit. */
export function rowsToBenefitModifiers(rows: BenefitModifierRow[]): Record<string, string> | undefined {
  const entries = rows.filter((row) => row.code !== '');
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries.map((row) => [row.code, row.modifier.trim()]));
}

export function benefitModifiersToRows(value: Record<string, string> | null | undefined): BenefitModifierRow[] {
  if (!value) return [];
  return Object.entries(value).map(([code, modifier]) => ({ code, modifier }));
}
