import { useState } from 'react';
import type { FormEvent } from 'react';
import { CheckCircle2, LogOut } from 'lucide-react';
import { ApiError } from '../../../api/errors';
import { Button } from '../../../components/ui/button';
import { Alert } from '../../../components/ui/Feedback';
import { FormField, Input } from '../../../components/ui/FormControls';
import { useAuth } from '../../../auth/useAuth';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useT } from '../../../i18n/useT';
import { requestOtp, verifyOtp } from '../../../lib/otpApi';
import { completeRegistration } from './api';

const PHONE_PATTERN = /^\+998\d{9}$/;
const PHONE_PREFIX = '+998';

/** Keeps the field as `+998` plus at most nine digits: the prefix is typed
 * in already and cannot be erased, a pasted full number (`+998901234567`,
 * `998901234567`) or a bare local one (`901234567`) both land as the same
 * value, and a keystroke that breaks into the prefix keeps the local part. */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  let local: string;
  if (raw.startsWith(PHONE_PREFIX)) local = digits.slice(3);
  else if (digits.length > 9) local = digits.slice(-9);
  else if ('998'.startsWith(digits)) local = '';
  else local = digits;
  if (local.length > 9 && local.startsWith('998')) local = local.slice(3);
  return PHONE_PREFIX + local.slice(0, 9);
}

type OtpStage = 'idle' | 'sent' | 'verified';

type ConsentVersions = { privacy_policy: string; offer: string };

const DEFAULT_CONSENTS: ConsentVersions = { privacy_policy: '1.0', offer: '1.0' };

/** The versions the server says are current, when it refused ours as stale. */
function staleConsents(err: unknown): Partial<ConsentVersions> | undefined {
  if (!(err instanceof ApiError) || err.code !== 'ERR-VAL-001') return undefined;
  return (err.details as { consents_current?: Partial<ConsentVersions> } | undefined)?.consents_current;
}

/** `ERR-AUTH-009` (rate limit) and `ERR-AUTH-010` (bad/expired code) get their
 * own copy; anything else falls back to a generic message — the same shape
 * `LoginPage`'s own `classify()` uses for its credential errors. */
function otpErrorMessage(err: unknown, t: (key: string) => string): string {
  if (err instanceof ApiError) {
    if (err.code === 'ERR-AUTH-009') return t('cabinet.otp.rateLimited');
    if (err.code === 'ERR-AUTH-010') return t('cabinet.otp.invalidCode');
  }
  return t('cabinet.registration.genericError');
}

/**
 * Screen B2 (С2 finish registration) — phone OTP, then
 * `POST /auth/complete-registration`. Rendered by `RequireAuth` in place of
 * `children` whenever `me.registration_complete` is false, the same shape it
 * already uses for `must_change_password` — see that gate's own comment for
 * why nothing here needs to decide "where to send the citizen next": nothing
 * ever navigated away from the URL they arrived on, so once
 * `applyMe(fresh me)` flips the gate, `RequireAuth` simply renders what was
 * already being asked for.
 *
 * Consents carry no checkboxes here (Oybek, 2026-09-24): the login page
 * already tells every visitor that signing in accepts the privacy policy and
 * the offer (`login.termsNotice`), so asking again after the ERI signature
 * was a second click on the same words. The request still sends `consents`,
 * and the server still writes `user_consents` with the version and the client
 * IP (#42 ruling 10) — only the redundant click is gone.
 *
 * Consent versions (ruling R3, `docs/plans/06.5-cabinet-tails.md`): there is
 * no route an ordinary applicant can call to read the CURRENT
 * `privacy_policy_version`/`offer_version` (`GET /admin/settings` needs
 * `admin.settings.manage`). Both default to `"1.0"` server-side
 * (`app/core/settings_store.py`), so that is what this form starts with; on
 * an `ERR-VAL-001` naming `details.consents_current`, the request is repeated
 * once with the versions the server named — the documents the login page
 * links to are always the current ones.
 */
export function CompleteRegistrationGate() {
  const { me, applyMe, logout } = useAuth();
  const t = useT();
  const errorText = useApiErrorText();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  const [phone, setPhone] = useState(PHONE_PREFIX);
  const [otpStage, setOtpStage] = useState<OtpStage>('idle');
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpBusy, setOtpBusy] = useState(false);

  const [touched, setTouched] = useState(false);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const phoneValid = PHONE_PATTERN.test(phone);
  const phoneLocked = otpStage !== 'idle';

  async function handleSendCode() {
    if (!phoneValid) return;
    setOtpBusy(true);
    setOtpError(null);
    try {
      await requestOtp({ target_type: 'phone', target: phone, purpose: 'phone_verify' });
      setOtpStage('sent');
    } catch (err) {
      setOtpError(otpErrorMessage(err, t));
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleVerifyCode() {
    setOtpBusy(true);
    setOtpError(null);
    try {
      const token = await verifyOtp({ target: phone, code, purpose: 'phone_verify' });
      setOtpToken(token);
      setOtpStage('verified');
    } catch (err) {
      setOtpError(otpErrorMessage(err, t));
    } finally {
      setOtpBusy(false);
    }
  }

  function changePhone() {
    setOtpStage('idle');
    setOtpToken(null);
    setCode('');
    setOtpError(null);
  }

  // Ruling #113 (`docs/decisions.md`): the address requisite is gated at
  // SUBMIT, not at registration, and `ApplicationWizardPage` asks for it
  // there. Registration used to ask for it anyway, together with an optional
  // email, region and district; Oybek, 2026-09-24, cut the screen down to the
  // phone alone — email is added and verified in the profile, and the address
  // is asked for once, at the first submission that actually needs it.
  const canSubmit = otpStage === 'verified' && otpToken !== null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!canSubmit || !otpToken) return;
    setSubmitting(true);
    setSubmitError(null);
    const send = (consents: ConsentVersions) =>
      completeRegistration({
        consents,
        phone,
        otp_token: otpToken,
      });
    try {
      let me;
      try {
        me = await send(DEFAULT_CONSENTS);
      } catch (err) {
        const current = staleConsents(err);
        if (!current) throw err;
        me = await send({
          privacy_policy: current.privacy_policy ?? DEFAULT_CONSENTS.privacy_policy,
          offer: current.offer ?? DEFAULT_CONSENTS.offer,
        });
      }
      applyMe(me);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err : new ApiError('ERR-SYS-000', t('cabinet.registration.genericError')),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div data-testid="registration-incomplete" className="min-h-screen bg-[#F8F9FA]">
      {/* F9 (`docs/plans/07.3-findings.md`): the gate used to render over
       * every URL with no header, no logout and no link back — the ONLY
       * exit was typing `/login` by hand. `RequireAuth` still holds every
       * other route shut until registration is complete, so this bar is not
       * a bypass of the gate, only a visible, honest way to abandon it. */}
      <header className="flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-[#E4E7EA]">
        <span className="text-sm font-bold text-[#1A1F24] truncate">{t('cabinet.registration.title')}</span>
        <div className="flex items-center gap-3 shrink-0">
          {me && <span className="hidden sm:inline text-xs text-[#5A646D] truncate max-w-[14rem]">{me.user.full_name}</span>}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leftIcon={<LogOut className="w-3.5 h-3.5" />}
            isLoading={loggingOut}
            onClick={() => void handleLogout()}
          >
            {t('shell.logout')}
          </Button>
        </div>
      </header>

      <div className="flex items-center justify-center px-4 py-10">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        noValidate
        className="w-full max-w-lg bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-5"
      >
        <div>
          <h1 className="text-base font-bold text-[#1A1F24]">{t('cabinet.registration.title')}</h1>
          <p className="mt-1 text-xs text-[#5A646D] leading-relaxed">{t('cabinet.registration.intro')}</p>
        </div>


        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#5A646D]">
            {t('cabinet.registration.phoneTitle')}
          </h2>
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <FormField label={t('cabinet.registration.phoneLabel')} required>
                <Input
                  data-testid="phone-input"
                  inputMode="tel"
                  placeholder={t('cabinet.registration.phonePlaceholder')}
                  value={phone}
                  disabled={phoneLocked}
                  onChange={(e) => setPhone(normalizePhone(e.target.value))}
                  onBlur={() => setTouched(true)}
                />
              </FormField>
            </div>
            {otpStage === 'idle' && (
              <Button
                type="button"
                variant="outline"
                data-testid="send-code"
                disabled={!phoneValid || otpBusy}
                isLoading={otpBusy}
                onClick={() => void handleSendCode()}
                className="mt-6 shrink-0"
              >
                {t('cabinet.otp.sendCode')}
              </Button>
            )}
            {otpStage !== 'idle' && (
              <Button
                type="button"
                variant="ghost"
                data-testid="change-phone"
                onClick={changePhone}
                className="mt-6 shrink-0"
              >
                {t('cabinet.otp.change')}
              </Button>
            )}
          </div>

          {touched && phone !== PHONE_PREFIX && !phoneValid && (
            <p className="text-xs text-[#B91C1C]">{t('cabinet.registration.invalidPhone')}</p>
          )}

          {otpStage === 'sent' && (
            <div className="flex gap-2 items-start">
              <div className="flex-1">
                <FormField label={t('cabinet.otp.codeLabel')} required helperText={t('cabinet.otp.codeSent')}>
                  <Input
                    data-testid="otp-code"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                </FormField>
              </div>
              <Button
                type="button"
                data-testid="verify-code"
                disabled={code.length !== 6 || otpBusy}
                isLoading={otpBusy}
                onClick={() => void handleVerifyCode()}
                className="mt-6 shrink-0"
              >
                {t('cabinet.otp.verify')}
              </Button>
            </div>
          )}

          {otpStage === 'verified' && (
            <p data-testid="phone-verified" className="flex items-center gap-1.5 text-xs text-[#15803D]">
              <CheckCircle2 className="w-3.5 h-3.5" /> {t('cabinet.otp.verified')}
            </p>
          )}

          {otpError && (
            <p role="alert" className="text-xs text-[#B91C1C]">
              {otpError}
            </p>
          )}

          {/* The submit button stays disabled until the phone is confirmed, so
              this is a standing hint saying why, not an error after a click. */}
          {otpStage !== 'verified' && (
            <p data-testid="need-phone-verified" className="text-xs text-[#5A646D]">
              {t('cabinet.registration.needPhoneVerified')}
            </p>
          )}
        </section>

        {submitError && (
          <div data-testid="submit-error">
            <Alert variant="danger">{errorText(submitError)}</Alert>
          </div>
        )}

        <Button
          type="submit"
          data-testid="submit"
          fullWidth
          disabled={!canSubmit || submitting}
          isLoading={submitting}
        >
          {submitting ? t('cabinet.registration.submitting') : t('cabinet.registration.submit')}
        </Button>
      </form>
      </div>
    </div>
  );
}
