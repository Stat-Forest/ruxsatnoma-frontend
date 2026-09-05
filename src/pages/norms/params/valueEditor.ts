/**
 * `RuleParameterIn.value`/`RuleParameterPatch.value` are `unknown` on the
 * wire, exactly like `SettingOut.value` — there is no per-code type in the
 * contract, so the write form infers its own editor from the value's
 * RUNTIME type, the same idiom `SettingsPage.tsx`'s private
 * `editorKind`/`toEditorText`/`parseDraft` already worked out for that
 * screen. Duplicated here rather than imported (those are not exported, and
 * `applicant/format.ts`'s own precedent is that each track keeps its own
 * copy of a small format/parse helper rather than reaching across tracks
 * for one) — this copy is scoped to what a rule parameter's `value` needs,
 * with the two parse-error strings passed in rather than a whole `Copy`
 * dictionary, since this module has no dictionary of its own to reuse.
 */
export type ValueEditorKind = 'boolean' | 'number' | 'string' | 'json';

/** No existing value to infer from on a CREATE form (`current` is always
 *  `undefined` there) — falls to the `json` case, the same fallback
 *  `SettingsPage.tsx` applies when both the value and its default are
 *  absent, so a brand-new row still lets the operator express any JSON
 *  shape explicitly (`"0.8"` a string, `10` a number, `true` a boolean). */
export function valueEditorKind(current: unknown): ValueEditorKind {
  switch (typeof current) {
    case 'boolean':
      return 'boolean';
    case 'number':
      return 'number';
    case 'string':
      return 'string';
    default:
      return 'json';
  }
}

/** The value as the editor's initial text — raw for a string (an operator
 *  editing a coefficient should see `0.8`, not `"0.8"`), pretty JSON for
 *  anything else.
 *
 *  `undefined` (fix, review round 1) prints as EMPTY, not `'null'`: a fresh
 *  CREATE form has no value yet at all, and defaulting the JSON editor's
 *  text to the literal `'null'` let a required field parse cleanly while
 *  never actually being filled in — `parseValueDraft` below now refuses
 *  that same empty text as a required-field error rather than a successful
 *  parse of `null`. A value that IS explicitly stored as `null` (editing an
 *  existing row) is a real value, not an unfilled field, and still renders
 *  as the text `null` so the operator can see and change it. */
export function valueToEditorText(value: unknown, kind: ValueEditorKind): string {
  if (kind === 'string') return typeof value === 'string' ? value : '';
  if (kind === 'number') return typeof value === 'number' ? String(value) : '';
  if (value === undefined) return '';
  return JSON.stringify(value, null, 2);
}

export type ValueParseResult = { value: unknown } | { error: string };

export function parseValueDraft(
  kind: ValueEditorKind,
  text: string,
  flag: boolean,
  invalidNumberMessage: string,
  invalidJsonPrefix: string,
  requiredMessage: string,
): ValueParseResult {
  switch (kind) {
    case 'boolean':
      return { value: flag };
    case 'string':
      return { value: text };
    case 'number': {
      const trimmed = text.trim();
      const parsed = Number(trimmed);
      if (trimmed === '' || !Number.isFinite(parsed)) return { error: invalidNumberMessage };
      return { value: parsed };
    }
    case 'json':
      // An untouched CREATE form's JSON editor starts empty (see
      // `valueToEditorText`) — refused here as "required", not handed to
      // `JSON.parse` (which would either throw a confusing "unexpected end
      // of input" or, for the OLD default text `'null'`, succeed and quietly
      // save `null` for a field marked required). A value the operator
      // legitimately wants to be JSON `null` is still typed as the four
      // characters `null`, which is non-empty text and parses normally.
      if (text.trim() === '') return { error: requiredMessage };
      try {
        return { value: JSON.parse(text) as unknown };
      } catch (error) {
        return { error: `${invalidJsonPrefix}: ${(error as Error).message}` };
      }
  }
}
