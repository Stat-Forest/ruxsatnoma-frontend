/**
 * F6 write — create and edit, one form (mirrors `params/RuleParameterFormModal.tsx`'s
 * own split of concerns). `activity_type_id`/`livestock_group` are identity
 * (`TariffPatch` carries neither — `service._Versioned.key_filters` matches
 * a tariff by them), so edit mode renders both as READ-ONLY facts, not as
 * disabled selects: a disabled control still implies the value is part of
 * the request, which it is not.
 *
 * NOT one of the two dialogs this task reuses as-is
 * (`PublishConfirmDialog`/`ArchiveConfirmDialog`, in `../components/`):
 * `TariffIn`/`Patch` is a different shape from `RuleParameterIn`/`Patch`
 * (no free-form `value`, but a `coefficient`, a `quantity_unit` enum and
 * `benefit_modifiers`), so this form stays local to `tariffs/`, the same way
 * `RuleParameterFormModal` stays local to `params/`.
 */
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { FormField, Input, Select, Textarea } from '../../../components/ui/FormControls';
import { Alert } from '../../../components/ui/Feedback';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/Overlay';
import { ApiError } from '../../../api/errors';
import { useLanguage, useT } from '../../../i18n/useT';
import { useActivityTypes, pickLocalizedName } from '../refs';
import {
  benefitModifiersToRows,
  modifierError,
  rowsToBenefitModifiers,
  type BenefitModifierRow,
} from './benefitModifiers';
import { coefficientError } from './coefficient';
import {
  LIVESTOCK_GROUPS,
  QUANTITY_UNITS,
  TARIFF_BASIS_MAX_LENGTH,
  livestockGroupLabelKey,
  quantityUnitLabelKey,
  type LivestockGroup,
  type QuantityUnit,
} from './labels';
import { useBenefitCategories, useCreateTariff, useUpdateTariff } from './queries';
import type { TariffOut } from './api';

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? `${error.code}: ${error.message}` : fallback;
}

/** `service._assert_benefit_codes` refuses an unknown `benefit_modifiers`
 *  key with `ERR-VAL-001` and `details.reason === 'unknown_benefit_category'`
 *  (`details.codes` names every offending one) — task-5 brief: "render that
 *  refusal rather than swallowing it." The code picker only ever offers
 *  codes this same tab already fetched, so this branch fires only on a race
 *  (the classifier changed between fetch and submit, or the id/set of items
 *  shifted under another operator's own change) — rare, but still named
 *  explicitly rather than falling through to the generic `errorText` above,
 *  which would show the server's own (English) message text verbatim. */
function benefitCodeErrorText(error: unknown, t: (key: string) => string): string | null {
  if (!(error instanceof ApiError) || error.code !== 'ERR-VAL-001') return null;
  const details = error.details as { reason?: string; codes?: string[] } | undefined;
  if (details?.reason !== 'unknown_benefit_category') return null;
  const codes = details.codes ?? [];
  return `${t('norms.tariffs.form.unknownBenefitCategory')}${codes.length ? ': ' + codes.join(', ') : ''}`;
}

export type TariffFormMode = 'create' | 'edit';

export interface TariffFormModalProps {
  mode: TariffFormMode;
  /** Required in `edit` mode, ignored in `create` mode — the same
   *  optional-and-mode-checked shape `RuleParameterFormModalProps.row`
   *  uses. */
  row?: TariffOut;
  onClose: () => void;
  /** Fires with the saved row on success — the caller uses it to close the
   *  modal and to record "I edited this row in this session" (ruling R3),
   *  the identical reason `RuleParameterFormModal.onSaved` hands back the
   *  row rather than nothing. */
  onSaved: (row: TariffOut) => void;
}

export function TariffFormModal({ mode, row, onClose, onSaved }: TariffFormModalProps) {
  const t = useT();
  const { lang } = useLanguage();
  const activityTypes = useActivityTypes();
  const benefitCategories = useBenefitCategories();
  const create = useCreateTariff();
  const update = useUpdateTariff();
  const mutation = mode === 'create' ? create : update;

  const [activityTypeId, setActivityTypeId] = useState(row?.activity_type_id ?? '');
  // Cast from the wire's plain `string` to the narrower literal union: both
  // always originate from a row the server itself produced against the same
  // enum, so this is a display-time widening back to what it always was,
  // not an unchecked assumption about user input (the SELECT below only
  // ever offers these same literals).
  const [livestockGroup, setLivestockGroup] = useState<LivestockGroup | ''>(
    (row?.livestock_group as LivestockGroup | null) ?? '',
  );
  const [coefficient, setCoefficient] = useState(row?.coefficient ?? '');
  const [quantityUnit, setQuantityUnit] = useState<QuantityUnit>(
    (row?.quantity_unit as QuantityUnit | undefined) ?? QUANTITY_UNITS[0],
  );
  const [benefitRows, setBenefitRows] = useState<BenefitModifierRow[]>(() =>
    benefitModifiersToRows(row?.benefit_modifiers),
  );
  const [effectiveFrom, setEffectiveFrom] = useState(row?.effective_from ?? '');
  const [effectiveTo, setEffectiveTo] = useState(row?.effective_to ?? '');
  const [basis, setBasis] = useState(row?.basis ?? '');
  const [touched, setTouched] = useState(false);

  const activityTypeValid = mode === 'edit' || activityTypeId !== '';
  const coefError = coefficientError(coefficient);
  const basisValid = basis.trim().length > 0 && basis.length <= TARIFF_BASIS_MAX_LENGTH;
  const effectiveFromValid = effectiveFrom.length > 0;
  // A row with a code chosen but an invalid modifier blocks submit; a row
  // with NO code chosen yet (the operator clicked "add" and has not picked
  // one) is silently dropped by `rowsToBenefitModifiers`, never treated as
  // an error of its own — nothing was actually asked for yet.
  const benefitRowErrors = benefitRows.map((r) => (r.code !== '' ? modifierError(r.modifier) : null));
  const benefitRowsValid = benefitRowErrors.every((e) => e === null);

  const usedCodes = new Set(benefitRows.map((r) => r.code).filter((c) => c !== ''));
  const availableCategories = (benefitCategories.data ?? []).filter((c) => !usedCodes.has(c.code));

  function addBenefitRow() {
    setBenefitRows((rows) => [...rows, { code: '', modifier: '' }]);
  }

  function removeBenefitRow(index: number) {
    setBenefitRows((rows) => rows.filter((_, i) => i !== index));
  }

  function updateBenefitRow(index: number, patch: Partial<BenefitModifierRow>) {
    setBenefitRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function submit() {
    setTouched(true);
    if (!activityTypeValid || coefError !== null || !basisValid || !effectiveFromValid || !benefitRowsValid) return;

    const shared = {
      coefficient,
      quantity_unit: quantityUnit,
      benefit_modifiers: rowsToBenefitModifiers(benefitRows) ?? null,
      effective_from: effectiveFrom,
      effective_to: effectiveTo || null,
      basis,
    };
    if (mode === 'create') {
      create.mutate(
        {
          activity_type_id: activityTypeId,
          livestock_group: livestockGroup === '' ? null : livestockGroup,
          ...shared,
        },
        { onSuccess: onSaved },
      );
    } else {
      update.mutate({ id: row!.id, body: shared }, { onSuccess: onSaved });
    }
  }

  const activityTypeName = (id: string) => {
    const found = activityTypes.data?.find((a) => a.id === id);
    return found ? pickLocalizedName(found.name, lang) || found.code : id;
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={mode === 'create' ? t('norms.tariffs.form.createTitle') : t('norms.tariffs.form.editTitle')}
      maxWidth="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            {t('norms.tariffs.form.cancel')}
          </Button>
          <Button type="button" variant="primary" isLoading={mutation.isPending} onClick={submit}>
            {t('norms.tariffs.form.save')}
          </Button>
        </>
      }
    >
      <div data-testid="tariff-form" className="space-y-4">
        {mode === 'create' ? (
          <FormField
            label={t('norms.tariffs.form.activityType')}
            required
            htmlFor="tariff-activity-type"
            error={touched && !activityTypeValid ? t('norms.tariffs.form.activityTypeRequired') : undefined}
          >
            <Select
              id="tariff-activity-type"
              data-testid="tariff-activity-type"
              value={activityTypeId}
              onChange={(event) => setActivityTypeId(event.target.value)}
              options={[
                { value: '', label: t('norms.tariffs.form.activityTypePlaceholder') },
                ...(activityTypes.data ?? []).map((a) => ({
                  value: a.id,
                  label: pickLocalizedName(a.name, lang) || a.code,
                })),
              ]}
            />
          </FormField>
        ) : (
          <FormField label={t('norms.tariffs.form.activityType')}>
            <p className="text-sm font-medium text-[#1A1F24]" data-testid="tariff-activity-type-readonly">
              {activityTypeName(row!.activity_type_id)}
            </p>
          </FormField>
        )}

        {mode === 'create' ? (
          <FormField
            label={t('norms.tariffs.form.livestockGroup')}
            helperText={t('norms.tariffs.form.livestockGroupHint')}
            htmlFor="tariff-livestock-group"
          >
            <Select
              id="tariff-livestock-group"
              data-testid="tariff-livestock-group"
              value={livestockGroup}
              onChange={(event) => setLivestockGroup(event.target.value as typeof livestockGroup)}
              options={[
                { value: '', label: t('norms.tariffs.form.livestockGroupNone') },
                ...LIVESTOCK_GROUPS.map((group) => ({ value: group, label: t(livestockGroupLabelKey(group)) })),
              ]}
            />
          </FormField>
        ) : (
          row!.livestock_group && (
            <FormField label={t('norms.tariffs.form.livestockGroup')}>
              <p className="text-sm font-medium text-[#1A1F24]" data-testid="tariff-livestock-group-readonly">
                {t(livestockGroupLabelKey(row!.livestock_group))}
              </p>
            </FormField>
          )
        )}

        <FormField
          label={t('norms.tariffs.form.coefficient')}
          required
          helperText={t('norms.tariffs.form.coefficientHint')}
          htmlFor="tariff-coefficient"
          error={
            touched && coefError !== null
              ? t(`norms.tariffs.form.coefficientError.${coefError}`)
              : undefined
          }
        >
          <Input
            id="tariff-coefficient"
            data-testid="tariff-coefficient"
            className="font-mono"
            value={coefficient}
            onChange={(event) => setCoefficient(event.target.value)}
            placeholder="1.5"
          />
        </FormField>

        <FormField label={t('norms.tariffs.form.quantityUnit')} required htmlFor="tariff-quantity-unit">
          <Select
            id="tariff-quantity-unit"
            data-testid="tariff-quantity-unit"
            value={quantityUnit}
            onChange={(event) => setQuantityUnit(event.target.value as typeof quantityUnit)}
            options={QUANTITY_UNITS.map((unit) => ({ value: unit, label: t(quantityUnitLabelKey(unit)) }))}
          />
        </FormField>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#5A646D]">
              {t('norms.tariffs.form.benefitModifiers')}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="tariff-benefit-add"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              disabled={availableCategories.length === 0}
              onClick={addBenefitRow}
            >
              {t('norms.tariffs.form.benefitAdd')}
            </Button>
          </div>
          {benefitRows.length === 0 && (
            <p className="text-xs text-[#5A646D]">{t('norms.tariffs.form.benefitEmpty')}</p>
          )}
          {benefitRows.map((benefitRow, index) => {
            const rowError = benefitRowErrors[index];
            const codeOptions = (benefitCategories.data ?? []).filter(
              (c) => c.code === benefitRow.code || !usedCodes.has(c.code),
            );
            return (
              <div key={index} className="flex items-start gap-2" data-testid={`tariff-benefit-row-${index}`}>
                <Select
                  data-testid={`tariff-benefit-code-${index}`}
                  className="flex-1"
                  value={benefitRow.code}
                  onChange={(event) => updateBenefitRow(index, { code: event.target.value })}
                  options={[
                    { value: '', label: t('norms.tariffs.form.benefitCodePlaceholder') },
                    ...codeOptions.map((c) => ({ value: c.code, label: pickLocalizedName(c.name, lang) || c.code })),
                  ]}
                />
                <FormField
                  className="w-28"
                  error={touched && rowError !== null ? t(`norms.tariffs.form.benefitModifierError.${rowError}`) : undefined}
                >
                  <Input
                    data-testid={`tariff-benefit-modifier-${index}`}
                    value={benefitRow.modifier}
                    placeholder="0.5"
                    onChange={(event) => updateBenefitRow(index, { modifier: event.target.value })}
                  />
                </FormField>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid={`tariff-benefit-remove-${index}`}
                  onClick={() => removeBenefitRow(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            label={t('norms.tariffs.form.effectiveFrom')}
            required
            htmlFor="tariff-effective-from"
            error={touched && !effectiveFromValid ? t('norms.tariffs.form.effectiveFromRequired') : undefined}
          >
            <Input
              id="tariff-effective-from"
              data-testid="tariff-effective-from"
              type="date"
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
            />
          </FormField>
          <FormField label={t('norms.tariffs.form.effectiveTo')} htmlFor="tariff-effective-to">
            <Input
              id="tariff-effective-to"
              data-testid="tariff-effective-to"
              type="date"
              value={effectiveTo}
              onChange={(event) => setEffectiveTo(event.target.value)}
            />
          </FormField>
        </div>

        <FormField
          label={t('norms.tariffs.form.basis')}
          required
          helperText={t('norms.tariffs.form.basisHint')}
          htmlFor="tariff-basis"
          error={touched && !basisValid ? t('norms.tariffs.form.basisRequired') : undefined}
        >
          <Textarea
            id="tariff-basis"
            data-testid="tariff-basis"
            value={basis}
            maxLength={TARIFF_BASIS_MAX_LENGTH}
            onChange={(event) => setBasis(event.target.value)}
          />
        </FormField>

        {mutation.isError && (
          <Alert variant="danger">
            <span data-testid="tariff-form-error">
              {benefitCodeErrorText(mutation.error, t) ?? errorText(mutation.error, t('norms.tariffs.form.saveFailed'))}
            </span>
          </Alert>
        )}
      </div>
    </Modal>
  );
}
