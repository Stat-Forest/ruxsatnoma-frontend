/**
 * F7 write — create and edit, one form. `code` is the only field that
 * differs between the two modes: `RuleParameterIn` carries it,
 * `RuleParameterPatch` has no such field AT ALL (task-4 brief: "code is not
 * patchable at all"), so edit mode never renders the input rather than
 * rendering a disabled one — a disabled control still implies the value is
 * part of the request, which it is not.
 *
 * This form is NOT one of the two dialogs task 5 reuses
 * (`PublishConfirmDialog`/`ArchiveConfirmDialog`, in `../components/`):
 * `RuleParameterIn`/`Patch` and `TariffIn`/`Patch` are different shapes
 * (`TariffOut` has no free-form `value`, no `unit`), so a shared create/edit
 * form would have to branch on entity type internally, which is exactly the
 * "hard-wired" coupling the brief asks the REUSED components to avoid. This
 * one stays local to `params/` on purpose.
 */
import { useState } from 'react';
import { FormField, Input, Checkbox, Textarea } from '../../../components/ui/FormControls';
import { Alert } from '../../../components/ui/Feedback';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/Overlay';
import { ApiError } from '../../../api/errors';
import { useT } from '../../../i18n/useT';
import {
  RULE_PARAMETER_BASIS_MAX_LENGTH,
  RULE_PARAMETER_CODE_MAX_LENGTH,
  RULE_PARAMETER_CODE_PATTERN,
} from './labels';
import { parseValueDraft, valueEditorKind, valueToEditorText } from './valueEditor';
import { useCreateRuleParameter, useUpdateRuleParameter } from './queries';
import type { RuleParameterOut } from './api';

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? `${error.code}: ${error.message}` : fallback;
}

export type RuleParameterFormMode = 'create' | 'edit';

export interface RuleParameterFormModalProps {
  mode: RuleParameterFormMode;
  /** Required (and read-only past initial state) in `edit` mode; ignored in
   *  `create` mode — a discriminated union keyed on `mode` would be more
   *  precise, but every call site already knows which it has, and the
   *  extra type ceremony bought nothing a runtime check here does not. */
  row?: RuleParameterOut;
  onClose: () => void;
  /** Fires with the saved row on success — the caller uses it to close the
   *  modal AND to record "I edited this row in this session" for ruling R3,
   *  which is exactly why this callback hands back the row rather than
   *  nothing. */
  onSaved: (row: RuleParameterOut) => void;
}

export function RuleParameterFormModal({ mode, row, onClose, onSaved }: RuleParameterFormModalProps) {
  const t = useT();
  const create = useCreateRuleParameter();
  const update = useUpdateRuleParameter();
  const mutation = mode === 'create' ? create : update;

  const [code, setCode] = useState(row?.code ?? '');
  // The value editor's `kind` is fixed at mount from the row it opened
  // with — switching representation mid-edit (e.g. string to JSON) is not a
  // case the contract or the brief asks for, and re-deriving it on every
  // keystroke would fight whatever the operator is currently typing, the
  // same reasoning `SettingsPage.tsx`'s own `SettingRow` documents.
  const [kind] = useState(() => valueEditorKind(row?.value));
  const [text, setText] = useState(() => valueToEditorText(row?.value, kind));
  const [flag, setFlag] = useState(() => row?.value === true);
  const [unit, setUnit] = useState(row?.unit ?? '');
  const [effectiveFrom, setEffectiveFrom] = useState(row?.effective_from ?? '');
  const [effectiveTo, setEffectiveTo] = useState(row?.effective_to ?? '');
  const [basis, setBasis] = useState(row?.basis ?? '');
  const [touched, setTouched] = useState(false);

  const draft = parseValueDraft(
    kind,
    text,
    flag,
    t('norms.params.form.valueInvalidNumber'),
    t('norms.params.form.valueInvalidJson'),
    t('norms.params.form.valueRequired'),
  );
  const codeValid = mode === 'edit' || (RULE_PARAMETER_CODE_PATTERN.test(code) && code.length <= RULE_PARAMETER_CODE_MAX_LENGTH);
  const basisValid = basis.trim().length > 0 && basis.length <= RULE_PARAMETER_BASIS_MAX_LENGTH;
  const effectiveFromValid = effectiveFrom.length > 0;

  function submit() {
    setTouched(true);
    if (!codeValid || !basisValid || !effectiveFromValid) return;
    // A separate check from the three above (rather than folded into one
    // `||` chain): TypeScript narrows `draft` to `{ value: unknown }` for
    // everything below ONLY when this `in` check is its own guard clause,
    // the same shape `SettingsPage.tsx::save()` uses for the identical
    // union.
    if ('error' in draft) return;

    const shared = {
      value: draft.value,
      unit: unit.trim() ? unit.trim() : null,
      effective_from: effectiveFrom,
      effective_to: effectiveTo || null,
      basis,
    };
    if (mode === 'create') {
      create.mutate({ code, ...shared }, { onSuccess: onSaved });
    } else {
      update.mutate({ id: row!.id, body: shared }, { onSuccess: onSaved });
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={mode === 'create' ? t('norms.params.form.createTitle') : t('norms.params.form.editTitle')}
      maxWidth="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            {t('norms.params.form.cancel')}
          </Button>
          <Button type="button" variant="primary" isLoading={mutation.isPending} onClick={submit}>
            {t('norms.params.form.save')}
          </Button>
        </>
      }
    >
      <div data-testid="rule-parameter-form" className="space-y-4">
        {mode === 'create' && (
          <FormField
            label={t('norms.params.form.code')}
            required
            helperText={t('norms.params.form.codeHint')}
            htmlFor="rp-code"
            error={touched && !codeValid ? t('norms.params.form.codeInvalid') : undefined}
          >
            <Input
              id="rp-code"
              data-testid="rp-code"
              value={code}
              className="font-mono"
              placeholder="coef_sb:qoramol"
              onChange={(event) => setCode(event.target.value)}
            />
          </FormField>
        )}

        <FormField
          label={t('norms.params.form.value')}
          required
          helperText={t('norms.params.form.valueHint')}
          htmlFor="rp-value"
          error={touched && 'error' in draft ? draft.error : undefined}
        >
          {kind === 'boolean' ? (
            <Checkbox
              id="rp-value"
              data-testid="rp-value"
              label={flag ? 'true' : 'false'}
              checked={flag}
              onChange={(event) => setFlag(event.target.checked)}
            />
          ) : kind === 'json' ? (
            <Textarea
              id="rp-value"
              data-testid="rp-value"
              value={text}
              spellCheck={false}
              className="font-mono text-xs"
              onChange={(event) => setText(event.target.value)}
            />
          ) : (
            <Input
              id="rp-value"
              data-testid="rp-value"
              type={kind === 'number' ? 'number' : 'text'}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          )}
        </FormField>

        <FormField label={t('norms.params.form.unit')} htmlFor="rp-unit">
          <Input id="rp-unit" value={unit} onChange={(event) => setUnit(event.target.value)} />
        </FormField>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            label={t('norms.params.form.effectiveFrom')}
            required
            htmlFor="rp-effective-from"
            error={touched && !effectiveFromValid ? t('norms.params.form.effectiveFromRequired') : undefined}
          >
            <Input
              id="rp-effective-from"
              data-testid="rp-effective-from"
              type="date"
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
            />
          </FormField>
          <FormField label={t('norms.params.form.effectiveTo')} htmlFor="rp-effective-to">
            <Input
              id="rp-effective-to"
              data-testid="rp-effective-to"
              type="date"
              value={effectiveTo}
              onChange={(event) => setEffectiveTo(event.target.value)}
            />
          </FormField>
        </div>

        <FormField
          label={t('norms.params.form.basis')}
          required
          helperText={t('norms.params.form.basisHint')}
          htmlFor="rp-basis"
          error={touched && !basisValid ? t('norms.params.form.basisRequired') : undefined}
        >
          <Textarea
            id="rp-basis"
            data-testid="rp-basis"
            value={basis}
            maxLength={RULE_PARAMETER_BASIS_MAX_LENGTH}
            onChange={(event) => setBasis(event.target.value)}
          />
        </FormField>

        {mutation.isError && (
          <Alert variant="danger">
            <span data-testid="rp-form-error">{errorText(mutation.error, t('norms.params.form.saveFailed'))}</span>
          </Alert>
        )}
      </div>
    </Modal>
  );
}
