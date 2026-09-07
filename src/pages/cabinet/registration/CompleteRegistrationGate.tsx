import { useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, LogOut } from 'lucide-react';
import { ApiError } from '../../../api/errors';
import { Button } from '../../../components/ui/button';
import { Alert } from '../../../components/ui/Feedback';
import { Checkbox, FormField, Input, Select } from '../../../components/ui/FormControls';
import { useAuth } from '../../../auth/useAuth';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useT } from '../../../i18n/useT';
import { requestOtp, verifyOtp } from '../../../lib/otpApi';
import { completeRegistration, listDistricts, listRegions } from './api';

const PHONE_PATTERN = /^\+998\d{9}$/;

type OtpStage = 'idle' | 'sent' | 'verified';

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
 * Screen B2 (С2 finish registration) — consents, phone OTP, then
 * `POST /auth/complete-registration`. Rendered by `RequireAuth` in place of
 * `children` whenever `me.registration_complete` is false, the same shape it
 * already uses for `must_change_password` — see that gate's own comment for
 * why nothing here needs to decide "where to send the citizen next": nothing
 * ever navigated away from the URL they arrived on, so once
 * `applyMe(fresh me)` flips the gate, `RequireAuth` simply renders what was
 * already being asked for.
 *
 * Consent versions (ruling R3, `docs/plans/06.5-cabinet-tails.md`): there is
 * no route an ordinary applicant can call to read the CURRENT
 * `privacy_policy_version`/`offer_version` (`GET /admin/settings` needs
 * `admin.settings.manage`). Both default to `"1.0"` server-side
 * (`app/core/settings_store.py`), so that is what this form starts with; on
 * an `ERR-VAL-001` naming `details.consents_current`, the versions are
 * corrected from the error and the citizen is asked to re-accept, rather
 * than fail a second time with no way forward.
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

  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [offerChecked, setOfferChecked] = useState(false);
  const [consentVersions, setConsentVersions] = useState({ privacy_policy: '1.0', offer: '1.0' });
  const [staleNotice, setStaleNotice] = useState(false);

  const [phone, setPhone] = useState('');
  const [otpStage, setOtpStage] = useState<OtpStage>('idle');
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpBusy, setOtpBusy] = useState(false);

  const [email, setEmail] = useState('');
  const [regionId, setRegionId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [address, setAddress] = useState('');

  const [touched, setTouched] = useState(false);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const regionsQuery = useQuery({ queryKey: ['refs', 'regions'], queryFn: listRegions });
  const districtsQuery = useQuery({
    queryKey: ['refs', 'districts', regionId],
    queryFn: () => listDistricts(regionId),
    enabled: regionId !== '',
  });

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
  // SUBMIT, not at registration — a citizen may sign in and look around with
  // no address at all. Requiring it here anyway is a separate, forward-looking
  // choice: it is the right place for a NEW account, so a fresh registration
  // never lands in the state this ruling exists to unblock (`ApplicationWizardPage`
  // asks address-less EXISTING accounts for it at submission instead).
  const canSubmit =
    privacyChecked && offerChecked && otpStage === 'verified' && otpToken !== null && address.trim() !== '';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!canSubmit || !otpToken) return;
    setSubmitting(true);
    setSubmitError(null);
    setStaleNotice(false);
    try {
      const me = await completeRegistration({
        consents: consentVersions,
        phone,
        otp_token: otpToken,
        email: email.trim() ? email.trim() : null,
        region_id: regionId || null,
        district_id: districtId || null,
        // `canSubmit` already requires a non-empty address (ruling #113's
        // forward-looking choice for new accounts, see `canSubmit`'s own
        // comment above) — unlike `email`/`region_id`/`district_id`, this one
        // never has a `null` branch to fall into.
        address: address.trim(),
      });
      applyMe(me);
    } catch (err) {
      const details =
        err instanceof ApiError && err.code === 'ERR-VAL-001'
          ? (err.details as { consents_current?: { privacy_policy?: string; offer?: string } } | undefined)
              ?.consents_current
          : undefined;
      if (details) {
        setConsentVersions((prev) => ({
          privacy_policy: details.privacy_policy ?? prev.privacy_policy,
          offer: details.offer ?? prev.offer,
        }));
        setPrivacyChecked(false);
        setOfferChecked(false);
        setStaleNotice(true);
      } else {
        setSubmitError(
          err instanceof ApiError ? err : new ApiError('ERR-SYS-000', t('cabinet.registration.genericError')),
        );
      }
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

        {staleNotice && <Alert variant="warning">{t('cabinet.registration.consentsStale')}</Alert>}

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#5A646D]">
            {t('cabinet.registration.consentsTitle')}
          </h2>
          <Checkbox
            data-testid="consent-privacy"
            label={t('cabinet.registration.consentPrivacy')}
            checked={privacyChecked}
            onChange={(e) => setPrivacyChecked(e.target.checked)}
          />
          <Checkbox
            data-testid="consent-offer"
            label={t('cabinet.registration.consentOffer')}
            checked={offerChecked}
            onChange={(e) => setOfferChecked(e.target.checked)}
          />
          {touched && !(privacyChecked && offerChecked) && (
            <p className="text-xs text-[#B91C1C]" role="alert">
              {t('cabinet.registration.needConsents')}
            </p>
          )}
        </section>

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
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ''))}
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

          {touched && phone !== '' && !phoneValid && (
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

          {touched && otpStage !== 'verified' && (
            <p className="text-xs text-[#B91C1C]">{t('cabinet.registration.needPhoneVerified')}</p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#5A646D]">
            {t('cabinet.registration.detailsTitle')}
          </h2>
          <FormField label={t('cabinet.registration.emailLabel')} helperText={t('cabinet.registration.emailHint')}>
            <Input
              data-testid="email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('cabinet.registration.regionLabel')}>
              <Select
                data-testid="region-select"
                value={regionId}
                onChange={(e) => {
                  setRegionId(e.target.value);
                  setDistrictId('');
                }}
                options={[
                  { value: '', label: t('cabinet.registration.selectPlaceholder') },
                  ...(regionsQuery.data ?? []).map((r) => ({
                    value: r.id,
                    label: typeof r.name.uz_latn === 'string' ? r.name.uz_latn : String(r.code),
                  })),
                ]}
              />
            </FormField>
            <FormField label={t('cabinet.registration.districtLabel')}>
              <Select
                data-testid="district-select"
                value={districtId}
                disabled={regionId === ''}
                onChange={(e) => setDistrictId(e.target.value)}
                options={[
                  { value: '', label: t('cabinet.registration.selectPlaceholder') },
                  ...(districtsQuery.data ?? []).map((d) => ({
                    value: d.id,
                    label: typeof d.name.uz_latn === 'string' ? d.name.uz_latn : String(d.code),
                  })),
                ]}
              />
            </FormField>
          </div>
          <FormField label={t('cabinet.registration.addressLabel')} required>
            <Input data-testid="address-input" value={address} onChange={(e) => setAddress(e.target.value)} />
          </FormField>
          {touched && address.trim() === '' && (
            <p className="text-xs text-[#B91C1C]" role="alert">
              {t('cabinet.registration.needAddress')}
            </p>
          )}
        </section>

        {submitError && (
          <div data-testid="submit-error">
            <Alert variant="danger">{errorText(submitError)}</Alert>
          </div>
        )}

        <Button type="submit" data-testid="submit" fullWidth disabled={submitting} isLoading={submitting}>
          {submitting ? t('cabinet.registration.submitting') : t('cabinet.registration.submit')}
        </Button>
      </form>
      </div>
    </div>
  );
}
