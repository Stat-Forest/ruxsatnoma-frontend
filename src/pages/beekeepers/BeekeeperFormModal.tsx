import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
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

/** `BeekeeperCreateIn`/`BeekeeperPatchIn` — `certificate_no`, `passport_series`,
 *  `passport_number` (`CodeStr`, `app/core/schemas.py`). */
const BEEKEEPER_CODE_MAX_LENGTH = 64;
/** `BeekeeperCreateIn`/`BeekeeperPatchIn` — `full_name` (`NameStr`). */
const BEEKEEPER_NAME_MAX_LENGTH = 255;

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
  validTo: string;
}

/** Which identity fields the OneID profile filled — those are shown locked,
 *  and the server overwrites them from the same profile anyway
 *  (`beekeepers.service._identity_from`, the one rule behind both). */
interface Locked {
  fullName: boolean;
  passport: boolean;
}

const UNLOCKED: Locked = { fullName: false, passport: false };

type LookupState = 'idle' | 'loading' | 'done';

function emptyForm(): FormState {
  return { pinfl: '', certificateNo: '', fullName: '', passportSeries: '', passportNumber: '', stir: '', validTo: '' };
}

function formFrom(row: BeekeeperOut): FormState {
  return {
    pinfl: row.pinfl,
    certificateNo: row.certificate_no,
    fullName: row.full_name,
    passportSeries: row.passport_series,
    passportNumber: row.passport_number,
    stir: row.stir ?? '',
    validTo: row.valid_to ?? '',
  };
}

/**
 * Create/edit for one register row (rulings #181/#182). The certificate and
 * its term come first, then the PINFL: once it holds 14 digits,
 * `GET /beekeepers/lookup` runs on its own (a spinner in the field) and only
 * then do the name and passport appear. A PINFL that has signed in through
 * OneID fills them and locks whatever the profile actually carries; a 404
 * (nobody has signed in with it, the common case) shows them empty to type.
 * Edit mode runs the same lookup for the row's PINFL on open, so a member
 * who signed in after being registered sees the profile's values locked.
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
  const [lookup, setLookup] = useState<LookupState>('idle');
  const [locked, setLocked] = useState<Locked>(UNLOCKED);
  const [lookupError, setLookupError] = useState<string | null>(null);
  // A newer PINFL supersedes a lookup still in flight; its answer is dropped.
  const lookupSeq = useRef(0);
  const openedLookup = useRef(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function runLookup(pinfl: string) {
    const seq = ++lookupSeq.current;
    setLookup('loading');
    setLookupError(null);
    try {
      const found = await lookupBeekeeper(pinfl);
      if (seq !== lookupSeq.current) return;
      if (found) {
        const next: Locked = {
          fullName: found.full_name.trim().length > 0,
          passport: found.passport_series != null && found.passport_number != null,
        };
        setForm((prev) => ({
          ...prev,
          fullName: next.fullName ? found.full_name : prev.fullName,
          passportSeries: next.passport ? (found.passport_series ?? '') : prev.passportSeries,
          passportNumber: next.passport ? (found.passport_number ?? '') : prev.passportNumber,
        }));
        setLocked(next);
      }
      // A 404 (`lookupBeekeeper` -> `null`) is the common case, not an
      // error: the fields open empty for the registrar to type.
    } catch (err) {
      if (seq !== lookupSeq.current) return;
      // A real failure (403, 500, network) is SAID, under the field — the
      // stage 10 review found it swallowed, indistinguishable from "nobody
      // with this PINFL has signed in". The fields still open to type.
      setLookupError(errorText(err));
    } finally {
      if (seq === lookupSeq.current) setLookup('done');
    }
  }

  useEffect(() => {
    // Edit: the row's PINFL is already complete — ask once on open (the
    // ref keeps StrictMode's double effect from asking twice).
    if (mode !== 'edit' || !beekeeper || openedLookup.current) return;
    openedLookup.current = true;
    void runLookup(beekeeper.pinfl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePinflChange(raw: string) {
    const pinfl = raw.replace(/\D/g, '').slice(0, 14);
    if (pinfl === form.pinfl) return;
    lookupSeq.current += 1;
    // Values the previous PINFL's profile filled belong to that person, not
    // to this one; what the registrar typed by hand stays.
    setForm((prev) => ({
      ...prev,
      pinfl,
      fullName: locked.fullName ? '' : prev.fullName,
      passportSeries: locked.passport ? '' : prev.passportSeries,
      passportNumber: locked.passport ? '' : prev.passportNumber,
    }));
    setLocked(UNLOCKED);
    setLookupError(null);
    setLookup('idle');
    if (PINFL_PATTERN.test(pinfl)) void runLookup(pinfl);
  }

  const identityShown = lookup === 'done';

  const canSubmit =
    identityShown &&
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
      // Ruling #217: the certificate's own term («Действует до 31.12.2025»);
      // blank means "no term known", never a date this form invents.
      valid_to: form.validTo || null,
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label={t('beekeepers.form.fieldCertificateNo')} required>
            <Input
              value={form.certificateNo}
              onChange={(e) => set('certificateNo', e.target.value)}
              data-testid="beekeeper-form-certificate-no"
              maxLength={BEEKEEPER_CODE_MAX_LENGTH}
            />
          </FormField>
          <FormField label={t('beekeepers.form.fieldValidTo')}>
            <Input type="date" value={form.validTo} onChange={(e) => set('validTo', e.target.value)} data-testid="beekeeper-form-valid-to" />
          </FormField>
        </div>

        <FormField
          label={t('beekeepers.form.fieldPinfl')}
          required
          helperText={t('beekeepers.form.pinflHint')}
          error={lookupError ?? undefined}
        >
          <Input
            inputMode="numeric"
            value={form.pinfl}
            onChange={(e) => handlePinflChange(e.target.value)}
            placeholder="31207854315218"
            data-testid="beekeeper-form-pinfl"
            rightIcon={
              lookup === 'loading' ? (
                <Loader2
                  className="w-4 h-4 animate-spin text-[#2E7D4F]"
                  aria-label={t('dash.loading')}
                  data-testid="beekeeper-lookup-loading"
                />
              ) : undefined
            }
          />
        </FormField>

        {identityShown && (
          <>
            {(locked.fullName || locked.passport) && (
              <Alert variant="info">
                <span data-testid="beekeeper-lookup-applied">{t('beekeepers.form.lookupApplied')}</span>
              </Alert>
            )}

            <FormField label={t('beekeepers.form.fieldFullName')} required>
              <Input
                value={form.fullName}
                onChange={(e) => set('fullName', e.target.value)}
                disabled={locked.fullName}
                data-testid="beekeeper-form-full-name"
                maxLength={BEEKEEPER_NAME_MAX_LENGTH}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label={t('beekeepers.form.fieldPassportSeries')} required>
                <Input
                  value={form.passportSeries}
                  onChange={(e) => set('passportSeries', e.target.value)}
                  disabled={locked.passport}
                  data-testid="beekeeper-form-passport-series"
                  maxLength={BEEKEEPER_CODE_MAX_LENGTH}
                />
              </FormField>
              <FormField label={t('beekeepers.form.fieldPassportNumber')} required>
                <Input
                  value={form.passportNumber}
                  onChange={(e) => set('passportNumber', e.target.value)}
                  disabled={locked.passport}
                  data-testid="beekeeper-form-passport-number"
                  maxLength={BEEKEEPER_CODE_MAX_LENGTH}
                />
              </FormField>
            </div>
          </>
        )}

        <FormField label={t('beekeepers.form.fieldStir')}>
          <Input
            inputMode="numeric"
            value={form.stir}
            onChange={(e) => set('stir', e.target.value.replace(/\D/g, '').slice(0, 9))}
            data-testid="beekeeper-form-stir"
          />
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
