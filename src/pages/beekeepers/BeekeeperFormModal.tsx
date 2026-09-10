import { useState } from 'react';
import { Modal } from '../../components/ui/Overlay';
import { Button } from '../../components/ui/button';
import { FormField, Input } from '../../components/ui/FormControls';
import { Alert } from '../../components/ui/Feedback';
import { ApiError } from '../../api/errors';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { useT } from '../../i18n/useT';
import { PINFL_PATTERN } from '../../lib/eimzo';
import { lookupBeekeeper, type BeekeeperOut } from './api';
import { useCreateBeekeeper, usePatchBeekeeper } from './queries';

const STIR_PATTERN = /^\d{9}$/;

export interface BeekeeperFormModalProps {
  mode: 'create' | 'edit';
  beekeeper: BeekeeperOut | null;
  onClose: () => void;
}

interface FormState {
  pinfl: string;
  certificateNo: string;
  fullName: string;
  passportSeries: string;
  passportNumber: string;
  stir: string;
  farmName: string;
}

function emptyForm(): FormState {
  return { pinfl: '', certificateNo: '', fullName: '', passportSeries: '', passportNumber: '', stir: '', farmName: '' };
}

function formFrom(row: BeekeeperOut): FormState {
  return {
    pinfl: row.pinfl,
    certificateNo: row.certificate_no,
    fullName: row.full_name,
    passportSeries: row.passport_series,
    passportNumber: row.passport_number,
    stir: row.stir ?? '',
    farmName: row.farm_name ?? '',
  };
}

/**
 * Create/edit for one register row (rulings #181/#182). PINFL comes FIRST
 * on purpose (the plan's own ordering): on blur, once it is a complete
 * 14-digit number, `GET /beekeepers/lookup` fills `full_name`/
 * `passport_series`/`passport_number` from a OneID profile when one exists
 * for that PINFL — every field stays editable afterward, and a 404 (nobody
 * has signed in with that PINFL, by far the common case) changes nothing
 * and shows no error (`api.ts::lookupBeekeeper`'s own docstring).
 *
 * Never a DELETE — removal is `RemoveBeekeeperModal`'s own route
 * (`POST .../remove`), reached from `BeekeepersPage`, not from here.
 */
export function BeekeeperFormModal({ mode, beekeeper, onClose }: BeekeeperFormModalProps) {
  const t = useT();
  const errorText = useApiErrorText();
  const create = useCreateBeekeeper();
  const patch = usePatchBeekeeper(beekeeper?.id ?? '');

  const [form, setForm] = useState<FormState>(beekeeper ? formFrom(beekeeper) : emptyForm());
  const [looking, setLooking] = useState(false);
  const [lookupApplied, setLookupApplied] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handlePinflBlur() {
    setLookupApplied(false);
    if (!PINFL_PATTERN.test(form.pinfl)) return;
    setLooking(true);
    try {
      const found = await lookupBeekeeper(form.pinfl);
      if (found) {
        setForm((prev) => ({
          ...prev,
          fullName: found.full_name,
          passportSeries: found.passport_series ?? prev.passportSeries,
          passportNumber: found.passport_number ?? prev.passportNumber,
        }));
        setLookupApplied(true);
      }
      // A 404 (`lookupBeekeeper` -> `null`) changes nothing — the common
      // case, not an error the operator needs to see.
    } catch {
      // A real failure (network, 500): this is a convenience auto-fill, not
      // a value the form depends on — the operator keeps typing by hand.
    } finally {
      setLooking(false);
    }
  }

  const canSubmit =
    !looking &&
    PINFL_PATTERN.test(form.pinfl) &&
    form.certificateNo.trim().length > 0 &&
    form.fullName.trim().length > 0 &&
    form.passportSeries.trim().length > 0 &&
    form.passportNumber.trim().length > 0 &&
    (form.stir.trim().length === 0 || STIR_PATTERN.test(form.stir.trim()));

  function submit() {
    if (!canSubmit) return;
    const body = {
      certificate_no: form.certificateNo.trim(),
      pinfl: form.pinfl,
      passport_series: form.passportSeries.trim(),
      passport_number: form.passportNumber.trim(),
      stir: form.stir.trim() || null,
      full_name: form.fullName.trim(),
      farm_name: form.farmName.trim() || null,
    };
    if (mode === 'edit') patch.mutate(body, { onSuccess: onClose });
    else create.mutate(body, { onSuccess: onClose });
  }

  const saving = create.isPending || patch.isPending;
  const failure = create.error ?? patch.error;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={mode === 'edit' ? t('beekeepers.form.editTitle') : t('beekeepers.form.createTitle')}
      maxWidth="lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            {t('beekeepers.form.cancel')}
          </Button>
          <Button variant="primary" size="sm" isLoading={saving} disabled={!canSubmit} onClick={submit} data-testid="beekeeper-form-submit">
            {t('beekeepers.form.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label={t('beekeepers.form.fieldPinfl')} required helperText={t('beekeepers.form.pinflHint')}>
          <Input
            inputMode="numeric"
            value={form.pinfl}
            onChange={(e) => set('pinfl', e.target.value.replace(/\D/g, '').slice(0, 14))}
            onBlur={() => void handlePinflBlur()}
            placeholder="31207854315218"
            data-testid="beekeeper-form-pinfl"
          />
        </FormField>
        {lookupApplied && (
          <Alert variant="info">
            <span data-testid="beekeeper-lookup-applied">{t('beekeepers.form.lookupApplied')}</span>
          </Alert>
        )}

        <FormField label={t('beekeepers.form.fieldCertificateNo')} required>
          <Input
            value={form.certificateNo}
            onChange={(e) => set('certificateNo', e.target.value)}
            data-testid="beekeeper-form-certificate-no"
          />
        </FormField>

        <FormField label={t('beekeepers.form.fieldFullName')} required>
          <Input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} data-testid="beekeeper-form-full-name" />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('beekeepers.form.fieldPassportSeries')} required>
            <Input
              value={form.passportSeries}
              onChange={(e) => set('passportSeries', e.target.value)}
              data-testid="beekeeper-form-passport-series"
            />
          </FormField>
          <FormField label={t('beekeepers.form.fieldPassportNumber')} required>
            <Input
              value={form.passportNumber}
              onChange={(e) => set('passportNumber', e.target.value)}
              data-testid="beekeeper-form-passport-number"
            />
          </FormField>
        </div>

        <FormField label={t('beekeepers.form.fieldStir')}>
          <Input
            inputMode="numeric"
            value={form.stir}
            onChange={(e) => set('stir', e.target.value.replace(/\D/g, '').slice(0, 9))}
            data-testid="beekeeper-form-stir"
          />
        </FormField>

        <FormField label={t('beekeepers.form.fieldFarmName')}>
          <Input value={form.farmName} onChange={(e) => set('farmName', e.target.value)} data-testid="beekeeper-form-farm-name" />
        </FormField>

        {failure != null && (
          <Alert variant="danger">
            <span data-testid="beekeeper-form-error">{failure instanceof ApiError ? errorText(failure) : t('beekeepers.form.error')}</span>
          </Alert>
        )}
      </div>
    </Modal>
  );
}
