/**
 * Renders one `ChecklistOut`'s `items` as controlled inputs for an
 * inspection act's `answers`. A `bool` question models THREE real states —
 * unanswered (the code simply absent from `answers`), true, false — rather
 * than defaulting to one of the two real values: a default would hide a
 * skipped question from `_assert_checklist_answers`'s required-field check
 * behind a value the inspector never actually entered.
 */
import { useLanguage, useT } from '../../../i18n/useT';
import { Button } from '../../../components/ui/button';
import { FormField, Input, Textarea } from '../../../components/ui/FormControls';
import { pickLocalizedName } from '../format';
import type { ChecklistOut } from '../queries';

export interface ChecklistFieldsProps {
  checklist: ChecklistOut;
  answers: Record<string, unknown>;
  onChange: (code: string, value: unknown) => void;
  /** Question codes named in `ERR-INSP-002`'s `details.missing` — rendered
   *  as a field-level error against exactly those items, never a generic
   *  toast. */
  errors?: string[];
  readOnly?: boolean;
}

export function ChecklistFields({ checklist, answers, onChange, errors, readOnly = false }: ChecklistFieldsProps) {
  const t = useT();
  const { lang } = useLanguage();

  return (
    <div className="space-y-4">
      {checklist.items.map((item) => {
        const value = answers[item.code];
        const hasError = errors?.includes(item.code) ?? false;
        const label = pickLocalizedName(item.question, lang) || item.code;

        return (
          <FormField
            key={item.code}
            label={label}
            required={item.required}
            error={hasError ? t('inspector.actForm.requiredField') : undefined}
          >
            {item.type === 'bool' ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="touch"
                  fullWidth
                  variant={value === true ? 'primary' : 'outline'}
                  disabled={readOnly}
                  onClick={() => onChange(item.code, true)}
                >
                  {t('inspector.actForm.checklist.yes')}
                </Button>
                <Button
                  type="button"
                  size="touch"
                  fullWidth
                  variant={value === false ? 'danger' : 'outline'}
                  disabled={readOnly}
                  onClick={() => onChange(item.code, false)}
                >
                  {t('inspector.actForm.checklist.no')}
                </Button>
              </div>
            ) : item.type === 'number' ? (
              <Input
                touchSize
                type="number"
                inputMode="numeric"
                disabled={readOnly}
                value={typeof value === 'number' ? String(value) : ''}
                onChange={(e) => onChange(item.code, e.target.value === '' ? undefined : Number(e.target.value))}
              />
            ) : (
              <Textarea
                disabled={readOnly}
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => onChange(item.code, e.target.value === '' ? undefined : e.target.value)}
              />
            )}
          </FormField>
        );
      })}
    </div>
  );
}
