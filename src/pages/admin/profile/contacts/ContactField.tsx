import { useState } from 'react';
import { Phone, Mail, Pencil, CheckCircle2 } from 'lucide-react';
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
      <div className="p-5 rounded-2xl border border-[#E4E7EA] bg-[#F8F9FA]/60 hover:bg-[#F8F9FA] hover:border-[#CBD5E1] transition-all duration-150 flex flex-col justify-between gap-4 shadow-2xs">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              kind === 'phone' ? 'bg-emerald-100/80 text-[#2E7D4F]' : 'bg-blue-100/80 text-blue-600'
            }`}
          >
            {kind === 'phone' ? <Phone className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <dt className="text-xs font-semibold uppercase tracking-wider text-[#5A646D] mb-1">{label}</dt>
            <dd className="text-sm sm:text-base font-semibold text-[#1A1F24] truncate">
              {currentValue ? (
                <span className="flex items-center gap-1.5">
                  {currentValue}
                  <CheckCircle2 className="w-4 h-4 text-[#2E7D4F] shrink-0" />
                </span>
              ) : (
                <span className="inline-block text-xs font-normal text-[#767F87] bg-white border border-[#E4E7EA] px-2.5 py-0.5 rounded-md">
                  {t('cabinet.profile.notSet')}
                </span>
              )}
            </dd>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-[#E4E7EA]/60">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid={`${kind}-change`}
            onClick={startEdit}
            leftIcon={<Pencil className="w-3.5 h-3.5" />}
          >
            {t('cabinet.profile.change')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl border border-[#2E7D4F]/40 bg-emerald-50/25 space-y-4 shadow-xs">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#2E7D4F]">
        {kind === 'phone' ? <Phone className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
        <span>{newLabel}</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 items-start">
        <div className="flex-1 w-full">
          <FormField label={newLabel}>
            <Input
              data-testid={`${kind}-new-value`}
              value={value}
              disabled={sent}
              placeholder={kind === 'phone' ? '+998901234567' : 'pochta@misol.uz'}
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
            className="mt-6 shrink-0 w-full sm:w-auto"
          >
            {t('cabinet.otp.sendCode')}
          </Button>
        )}
      </div>

      {sent && (
        <div className="flex flex-col sm:flex-row gap-2 items-start">
          <div className="flex-1 w-full">
            <FormField label={t('cabinet.otp.codeLabel')} helperText={t('cabinet.otp.codeSent')}>
              <Input
                data-testid={`${kind}-otp-code`}
                inputMode="numeric"
                value={code}
                placeholder="6 xonali kod"
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
            className="mt-6 shrink-0 w-full sm:w-auto"
          >
            {t('cabinet.otp.verify')}
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-[#B91C1C] font-medium">
          {error}
        </p>
      )}

      <div className="flex justify-end pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={cancel} disabled={busy}>
          {t('cabinet.profile.cancel')}
        </Button>
      </div>
    </div>
  );
}
