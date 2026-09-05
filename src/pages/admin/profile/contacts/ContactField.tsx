import { useState } from 'react';
import { ApiError } from '../../../../api/errors';
import { Button } from '../../../../components/ui/button';
import { FormField, Input } from '../../../../components/ui/FormControls';
import { useT } from '../../../../i18n/useT';
import { requestOtp, verifyOtp } from '../../../../lib/otpApi';
import { patchContact } from './api';
import type { components } from '../../../../api/schema';

type MeOut = components['schemas']['MeOut'];
type Kind = 'phone' | 'email';

const VALIDATORS: Record<Kind, RegExp> = {
  phone: /^\+998\d{9}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
};

function otpErrorMessage(err: unknown, t: (key: string) => string): string {
  if (err instanceof ApiError) {
    if (err.code === 'ERR-AUTH-009') return t('cabinet.otp.rateLimited');
    if (err.code === 'ERR-AUTH-010') return t('cabinet.otp.invalidCode');
  }
  return t('cabinet.registration.genericError');
}

/**
 * One row of B3's contacts section — phone or email, whichever `kind` says.
 * Both go through the SAME two-step OTP proof (`POST /auth/otp/request` then
 * `/verify`) `CompleteRegistrationGate` uses for phone during registration;
 * this is the same idiom applied to a value that already has one, changed
 * later from the profile screen (`PATCH /auth/me`, `ContactUpdateIn` — the
 * backend accepts exactly one of `phone`/`email` per call, never both).
 */
export function ContactField({
  kind,
  currentValue,
  onSaved,
}: {
  kind: Kind;
  currentValue: string | null;
  onSaved: (me: MeOut) => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = VALIDATORS[kind].test(value);
  const label = kind === 'phone' ? t('cabinet.profile.phoneLabel') : t('cabinet.profile.emailLabel');
  const newLabel = kind === 'phone' ? t('cabinet.profile.newPhoneLabel') : t('cabinet.profile.newEmailLabel');
  const purpose = kind === 'phone' ? 'phone_verify' : 'email_verify';

  function startEdit() {
    setEditing(true);
    setValue('');
    setSent(false);
    setCode('');
    setError(null);
  }

  function cancel() {
    setEditing(false);
    setValue('');
    setSent(false);
    setCode('');
    setError(null);
  }

  async function sendCode() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await requestOtp({ target_type: kind, target: value, purpose });
      setSent(true);
    } catch (err) {
      setError(otpErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function verifyAndSave() {
    setBusy(true);
    setError(null);
    try {
      const otpToken = await verifyOtp({ target: value, code, purpose });
      const me = await patchContact({
        phone: kind === 'phone' ? value : undefined,
        email: kind === 'email' ? value : undefined,
        otp_token: otpToken,
      });
      onSaved(me);
      setEditing(false);
    } catch (err) {
      setError(otpErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3 py-1.5">
        <div>
          <dt className="text-xs text-[#5A646D]">{label}</dt>
          <dd className="text-sm text-[#1A1F24] font-medium">{currentValue ?? t('cabinet.profile.notSet')}</dd>
        </div>
        <Button type="button" variant="outline" size="sm" data-testid={`${kind}-change`} onClick={startEdit}>
          {t('cabinet.profile.change')}
        </Button>
      </div>
    );
  }

  return (
    <div className="py-2 border-t border-[#E4E7EA] first:border-t-0 space-y-2">
      <div className="flex gap-2 items-start">
        <div className="flex-1">
          <FormField label={newLabel}>
            <Input
              data-testid={`${kind}-new-value`}
              value={value}
              disabled={sent}
              onChange={(e) => setValue(e.target.value)}
            />
          </FormField>
        </div>
        {!sent && (
          <Button
            type="button"
            data-testid={`${kind}-send-code`}
            disabled={!valid || busy}
            isLoading={busy}
            onClick={() => void sendCode()}
            className="mt-6 shrink-0"
          >
            {t('cabinet.otp.sendCode')}
          </Button>
        )}
      </div>

      {sent && (
        <div className="flex gap-2 items-start">
          <div className="flex-1">
            <FormField label={t('cabinet.otp.codeLabel')} helperText={t('cabinet.otp.codeSent')}>
              <Input
                data-testid={`${kind}-otp-code`}
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </FormField>
          </div>
          <Button
            type="button"
            data-testid={`${kind}-verify`}
            disabled={code.length !== 6 || busy}
            isLoading={busy}
            onClick={() => void verifyAndSave()}
            className="mt-6 shrink-0"
          >
            {t('cabinet.otp.verify')}
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-[#B91C1C]">
          {error}
        </p>
      )}

      <Button type="button" variant="ghost" size="sm" onClick={cancel} disabled={busy}>
        {t('cabinet.profile.cancel')}
      </Button>
    </div>
  );
}
