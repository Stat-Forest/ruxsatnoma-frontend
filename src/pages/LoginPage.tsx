import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, ArrowRight, Clock, FileText, QrCode, ShieldCheck, Trees } from 'lucide-react';
import { Button } from '../components/ui/button';
import { FormField, Input } from '../components/ui/FormControls';
import { api } from '../api/client';
import { ApiError, RATE_LIMITED, apiError as apiErrorFrom } from '../api/errors';
import { FullPageSpinner } from '../auth/RequireAuth';
import { useAuth } from '../auth/useAuth';
import { useApiErrorText } from '../i18n/useApiErrorText';
import { useLanguage, useT } from '../i18n/useT';
import { LANDING_PATHS, landingUrl } from '../lib/landing';
import { LanguageMenu } from '../shell/LanguageMenu';
import { EimzoError, PINFL_PATTERN, eimzoErrorMessageKey, isEimzoMock, isProviderUnreachable } from '../lib/eimzo';
import { SUPPORT_EXTENSION, SUPPORT_PHONE, SUPPORT_PHONE_HREF } from '../shell/support';
import { peekStoredNext } from './oneIdReturnCache';

type ErrorKind = 'credentials' | 'blocked' | 'rate-limited' | 'connection' | 'oneid' | null;

// ERR-AUTH-001 (wrong credentials), ERR-AUTH-003 (locked out) and
// ERR-SYS-006 (rate limited) get three different messages on purpose — the
// brief's whole reason is that "wrong password" for a locked-out account
// sends the user in circles. Anything that is not even an ApiError (the
// backend never answered — a dropped connection, a CORS failure) is its own
// fourth case: telling someone their password is wrong when their
// connection dropped is that same defect in a different costume.
//
// `ERR-AUTH-003` is a TEMPORARY lockout — `login_max_attempts` failures put
// `locked_until` `login_lockout_minutes` into the future and it clears
// itself, so the copy must not send anyone to an administrator (it said
// exactly that until 2026-09-09, and the wait is 15 minutes by default). An
// account an administrator really did block (`users.status != 'active'`)
// never reaches this branch at all: `auth.service.login_password` answers it
// with `ERR-AUTH-001`, deliberately indistinguishable from a wrong password
// so the response is not a user-existence oracle.
function classify(err: unknown): Exclude<ErrorKind, null | 'oneid'> {
  if (!(err instanceof ApiError)) return 'connection';
  if (err.code === RATE_LIMITED) return 'rate-limited';
  if (err.code === 'ERR-AUTH-003') return 'blocked';
  return 'credentials';
}

type Method = 'oneid' | 'eimzo' | 'password';
// The password tab's own steps. `forgot-*` is the self-service reset
// (decision #208): the login is looked up, the code goes to the card's own
// phone or e-mail, then the code and the new password are sent together.
type Step = 'password' | 'code' | 'forgot-login' | 'forgot-channel' | 'forgot-code';
type Channel = 'phone' | 'email';
type Contacts = { phone: string | null; email: string | null };
const TAB_KEY = 'ruxsatnoma.login.tab';
const METHODS: readonly Method[] = ['oneid', 'eimzo', 'password'];

// Spelled out rather than built as `login.tab${...}`: `useT`'s key type is a
// union of the literal keys in the string maps, and a template literal is not
// assignable to it — a computed key compiles only by widening to `string`,
// which is exactly the check that catches a typo'd key at build time.
const TAB_LABEL: Record<Method, 'login.tabOneId' | 'login.tabEimzo' | 'login.tabPassword'> = {
  oneid: 'login.tabOneId',
  eimzo: 'login.tabEimzo',
  password: 'login.tabPassword',
};

function storedMethod(): Method {
  try {
    const saved = localStorage.getItem(TAB_KEY);
    return METHODS.includes(saved as Method) ? (saved as Method) : 'oneid';
  } catch {
    return 'oneid';
  }
}

// What the cabinet is for, in three lines beside the card. Until 2026-09-10
// the page was the card alone on a grey field — no header, no way back to the
// public site, nothing saying whose system this is — and a citizen arriving
// from the landing's "Kabinet" button had no way to tell a sign-in from a
// dead end. The frame around the card is the landing's own header and footer.
const BENEFITS = [
  { key: 'login.benefitApply', Icon: FileText },
  { key: 'login.benefitTrack', Icon: Clock },
  { key: 'login.benefitDownload', Icon: QrCode },
] as const;

function Benefits({ compact = false }: { compact?: boolean }) {
  const t = useT();
  return (
    <ul className={`flex flex-col ${compact ? 'gap-3' : 'gap-3.5'}`}>
      {BENEFITS.map(({ key, Icon }) => (
        <li key={key} className="flex items-center gap-3">
          {compact ? (
            <Icon className="w-4 h-4 text-[#2E7D4F] shrink-0" />
          ) : (
            <span className="w-9 h-9 rounded-[10px] bg-[#F0F7F1] border border-[#D9EBDC] text-[#2E7D4F] flex items-center justify-center shrink-0">
              <Icon className="w-[18px] h-[18px]" />
            </span>
          )}
          <span className={compact ? 'text-sm leading-5 text-[#5A646D]' : 'text-[15px] leading-[22px]'}>
            {t(key)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The landing's illustration language, quietly: a row of conifers in primary-100. */
function TreeLine({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 440 84"
      fill="none"
      className={`w-[440px] max-w-full h-[84px] ${className}`}
    >
      <g fill="#D9EBDC">
        <path d="M28 76 40 52h-6l10-16h-5l9-16 9 16h-5l10 16h-6l12 24Z" />
        <path d="M92 76 104 58h-6l10-14h-5l9-14 9 14h-5l10 14h-6l12 18Z" />
        <path d="M150 76 166 46h-8l13-20h-6l11-20 11 20h-6l13 20h-8l16 30Z" />
        <path d="M236 76 246 62h-5l8-11h-4l7-11 7 11h-4l8 11h-5l10 14Z" />
        <path d="M298 76 312 50h-7l11-18h-5l10-18 10 18h-5l11 18h-7l14 26Z" />
        <path d="M376 76 386 64h-5l8-10h-4l7-11 7 11h-4l8 10h-5l10 12Z" />
      </g>
      <g fill="#C3DEC8">
        {[46, 110, 174, 252, 318, 392].map((x) => (
          <rect key={x} x={x} y="76" width="4" height="7" rx="1" />
        ))}
      </g>
      <path d="M2 83h436" stroke="#D9EBDC" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function LoginPage() {
  const { me, loading, submitPassword, verifyMfa, startOneId, loginViaEimzo } = useAuth();
  const t = useT();
  const errorText = useApiErrorText();
  const { backendLang, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // `location.state.next` survives an in-app redirect (RequireAuth sending
  // an anonymous visitor here) but not a full page load — exactly what a
  // failed OneID round trip is: the provider's browser round trip and the
  // backend's `/login?error=oneid` redirect both leave and re-enter the SPA
  // from scratch. `peekStoredNext` recovers the same destination `startOneId`
  // wrote before leaving, without consuming it — consuming it is
  // `OneIdReturnPage`'s job, reached only on success.
  const next = (location.state as { next?: string } | null)?.next ?? peekStoredNext() ?? '/';

  const [method, setMethod] = useState<Method>(storedMethod);
  const [step, setStep] = useState<Step>('password');
  // Self-service reset state. `contacts` is what `/password/forgot/lookup`
  // answered — masked, or null where the card has no such contact; `channel`
  // is the one the code was sent to and must be repeated on the reset call,
  // because the server reads the target from the card by (login, channel)
  // rather than trusting anything the browser knows.
  const [contacts, setContacts] = useState<Contacts | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pinfl, setPinfl] = useState('');
  const [fullName, setFullName] = useState('');
  const [badPinfl, setBadPinfl] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Real mode only: the message key for one of task 11's five conditions.
  // Kept apart from `errorKind` above — that state carries a FIXED message
  // per kind, while an E-IMZO failure's text depends on which of `errors.ts`'s
  // kinds it was, so the KEY is what this page stores, resolved through `t()`
  // at render time same as everything else.
  const [eimzoErrorKey, setEimzoErrorKey] = useState<string | null>(null);
  // Read once, on mount: the backend redirects a failed OneID state check
  // (the `oneid_state` cookie expired — its `max_age` is 600s — or was lost)
  // to `/login?error=oneid`, a full page load. This is the only place that
  // failure ever surfaces — nothing else in this app reads `error` off the
  // query string.
  const [errorKind, setErrorKind] = useState<ErrorKind>(() =>
    searchParams.get('error') === 'oneid' ? 'oneid' : null,
  );

  // Placed after every hook above so the hook order is the same on every
  // render. A session still being checked gets the same spinner
  // `RequireAuth` shows, not the form: rendering the form first and swapping
  // it out a moment later would flash a sign-in screen at someone who is
  // already signed in. Once the check answers "signed in", the form is a
  // dead end — every route out of it re-signs them in — so they go where a
  // fresh login would have sent them: `next`, the dashboard by default.
  if (loading) return <FullPageSpinner />;
  if (me) return <Navigate to={next} replace />;

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorKind(null);
    setSubmitting(true);
    try {
      // Only the server knows whether a second factor is still in force
      // (`mfa_enabled`). When it is off the session already exists by the time
      // this resolves, so showing the code screen would strand a signed-in user
      // in front of a field nothing checks.
      if ((await submitPassword(loginId, password)) === 'signed-in') {
        navigate(next, { replace: true });
        return;
      }
      setStep('code');
    } catch (err) {
      setErrorKind(classify(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCodeSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorKind(null);
    setSubmitting(true);
    try {
      await verifyMfa(code);
      navigate(next, { replace: true });
    } catch (err) {
      setErrorKind(classify(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEimzoSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorKind(null);
    // Checked BEFORE the API call: a malformed PINFL would otherwise consume
    // a one-shot challenge from the rate-limited /eimzo/challenge route and
    // come back as a generic credentials error, which is not what went wrong.
    if (!PINFL_PATTERN.test(pinfl)) {
      setBadPinfl(true);
      return;
    }
    setBadPinfl(false);
    setSubmitting(true);
    try {
      await loginViaEimzo(pinfl, fullName);
      navigate(next, { replace: true });
    } catch (err) {
      setErrorKind(classify(err));
    } finally {
      setSubmitting(false);
    }
  }

  // Real mode: no PINFL/name to validate first — there is nothing typed
  // into this page at all, the certificate the signer picks in E-IMZO's own
  // dialog carries the identity. `EimzoError`/`ERR-INT-001`/`ERR-INT-002`
  // (task 11's five conditions) get their own message; anything else falls
  // through to the same `classify()` the password/OneID flows already use.
  async function handleEimzoRealSubmit() {
    setErrorKind(null);
    setEimzoErrorKey(null);
    setSubmitting(true);
    try {
      await loginViaEimzo();
      navigate(next, { replace: true });
    } catch (err) {
      if (err instanceof EimzoError || isProviderUnreachable(err)) {
        setEimzoErrorKey(eimzoErrorMessageKey(err));
      } else {
        setErrorKind(classify(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function openForgot() {
    setErrorKind(null);
    setForgotError(null);
    setResetDone(false);
    setContacts(null);
    setChannel(null);
    setStep('forgot-login');
  }

  function backToPassword() {
    setForgotError(null);
    setErrorKind(null);
    setPassword('');
    setCode('');
    setNewPassword('');
    setRepeatPassword('');
    setStep('password');
  }

  async function handleForgotLookup(e: FormEvent) {
    e.preventDefault();
    setForgotError(null);
    setSubmitting(true);
    try {
      const { data, error } = await api.POST('/api/v1/auth/password/forgot/lookup', {
        body: { login: loginId },
      });
      if (error) throw apiErrorFrom(error);
      // Nothing to send a code to — an unknown login answers exactly like a
      // card with no contacts (decision #208), and the person should learn
      // that here, not on a step whose two buttons are both greyed out.
      if (data.phone === null && data.email === null) {
        setForgotError(t('login.forgotNoContacts'));
        return;
      }
      setContacts(data);
      setStep('forgot-channel');
    } catch (err) {
      setForgotError(errorText(err, t('login.connectionError')));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotSend(next: Channel) {
    setForgotError(null);
    setSubmitting(true);
    try {
      const { error } = await api.POST('/api/v1/auth/password/forgot/send', {
        body: { login: loginId, channel: next },
      });
      if (error) throw apiErrorFrom(error);
      setChannel(next);
      setCode('');
      setStep('forgot-code');
    } catch (err) {
      setForgotError(errorText(err, t('login.connectionError')));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotReset(e: FormEvent) {
    e.preventDefault();
    setForgotError(null);
    if (newPassword !== repeatPassword) {
      setForgotError(t('login.forgotMismatch'));
      return;
    }
    if (channel === null) return;
    setSubmitting(true);
    try {
      const { error } = await api.POST('/api/v1/auth/password/forgot/reset', {
        body: { login: loginId, channel, code, new_password: newPassword },
      });
      if (error) throw apiErrorFrom(error);
      backToPassword();
      setResetDone(true);
    } catch (err) {
      // `ERR-VAL-001` here is only ever the password policy (the code has
      // its own `ERR-AUTH-010`), and the generic "validation failed" text
      // would not tell the person what to change.
      setForgotError(
        err instanceof ApiError && err.code === 'ERR-VAL-001'
          ? t('login.forgotWeakPassword')
          : errorText(err, t('login.connectionError')),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const homeUrl = landingUrl(LANDING_PATHS.home);

  return (
    <div
      data-testid="login-page"
      data-next={next}
      className="min-h-screen flex flex-col bg-[#F8F9FA] text-[#1A1F24]"
    >
      {/* The landing's header (`PublicLayout.tsx` there), reduced to what an
          anonymous visitor needs here: the brand as a way home, an explicit
          way home, and the language. No nav — this page has one job. */}
      <header className="bg-[#17331B] border-b border-white/15 shadow-md text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <a href={homeUrl} className="flex items-center gap-3 shrink-0 focus:outline-none">
            <span className="w-10 h-10 rounded-xl bg-[#2E7D4F] border border-white/20 shadow-md flex items-center justify-center shrink-0">
              <Trees className="w-5.5 h-5.5" />
            </span>
            <span className="hidden sm:block leading-tight whitespace-nowrap">
              <span className="block text-base font-bold tracking-tight">{t('login.brandName')}</span>
              <span className="block text-[11px] text-gray-200">{t('login.brandTagline')}</span>
            </span>
          </a>
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href={homeUrl}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#E4E7EA] px-3 sm:px-4 text-xs font-bold text-white hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t('login.backHome')}</span>
            </a>
            <LanguageMenu
              tone="dark"
              value={backendLang}
              label={t('shell.language')}
              onSelect={(code) => {
                // Anonymous here, so `setLanguage` only writes the browser
                // (see `I18nProvider`) — the catch is the same backstop the
                // shell header keeps, for the day this page has a session.
                setLanguage(code).catch((err: unknown) => {
                  console.error('Tilni almashtirishda xatolik:', err);
                });
              }}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 lg:py-14 grid gap-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-20 items-center">
          <section className="flex flex-col gap-4 lg:gap-6 max-w-[600px]">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#2E7D4F]">
              {t('login.eyebrow')}
            </span>
            <h1 className="text-[28px] leading-9 lg:text-4xl lg:leading-[44px] font-bold text-[#1A1F24] text-balance">
              {t('login.heading')}
            </h1>
            <p className="text-[15px] leading-[22px] lg:text-base lg:leading-6 text-[#5A646D] max-w-[520px]">
              {t('login.lead')}
            </p>
            <div className="hidden lg:block mt-2">
              <Benefits />
            </div>
            <TreeLine className="hidden lg:block mt-4" />
          </section>

          <section className="flex flex-col gap-4">
      {/* The card is indented one level less than its position suggests so
          the sign-in forms below it — the part of this file every test and
          every earlier fix is about — keep their lines unchanged. */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-5 sm:p-8 shadow-sm space-y-5">
        <div className="space-y-1.5">
          <h2 className="text-[22px] leading-[30px] font-bold text-[#1A1F24]">{t('login.cardTitle')}</h2>
          <p className="text-sm text-[#5A646D]">{t('login.cardSubtitle')}</p>
        </div>

        <div
          role="tablist"
          className="grid grid-cols-3 gap-1 bg-[#F8F9FA] p-1 border border-[#E4E7EA] rounded-xl text-xs font-semibold"
        >
          {METHODS.map((m) => (
            <button
              key={m}
              role="tab"
              type="button"
              aria-selected={method === m}
              onClick={() => {
                setMethod(m);
                setErrorKind(null);
                setStep('password');
                setCode('');
                // Also cleared here, not just on submit: a stale "PINFL must
                // be 14 digits" alert must not survive a trip to another tab
                // and back for a form that was never resubmitted.
                setBadPinfl(false);
                setEimzoErrorKey(null);
                try {
                  localStorage.setItem(TAB_KEY, m);
                } catch {
                  // A browser that refuses storage still switches tabs; it
                  // just does not remember the choice next time.
                }
              }}
              className={`py-2 px-1 rounded-lg min-h-11 transition-colors ${
                method === m ? 'bg-[#2E7D4F] text-white' : 'text-[#5A646D] hover:text-[#1A1F24]'
              }`}
            >
              {t(TAB_LABEL[m])}
            </button>
          ))}
        </div>

        {errorKind === 'credentials' && (
          <p data-testid="login-error" role="alert" className="text-sm text-[#B91C1C]">
            {t('login.badCredentials')}
          </p>
        )}
        {errorKind === 'blocked' && (
          <p data-testid="account-blocked" role="alert" className="text-sm text-[#B91C1C]">
            {t('login.blockedAccount')}
          </p>
        )}
        {errorKind === 'rate-limited' && (
          <p data-testid="rate-limited" role="alert" className="text-sm text-[#B91C1C]">
            {t('login.rateLimited')}
          </p>
        )}
        {errorKind === 'connection' && (
          <p data-testid="connection-error" role="alert" className="text-sm text-[#B91C1C]">
            {t('login.connectionError')}
          </p>
        )}
        {errorKind === 'oneid' && (
          <p data-testid="oneid-error" role="alert" className="text-sm text-[#B91C1C]">
            {t('login.oneidFailed')}
          </p>
        )}

        {method === 'oneid' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 text-[13px] leading-5 text-[#123522] bg-[#F0F7F1] border border-[#D9EBDC] rounded-xl p-4">
              <ShieldCheck className="w-[18px] h-[18px] text-[#2E7D4F] shrink-0 mt-px" />
              <p>{t('login.oneidHint')}</p>
            </div>
            <Button
              type="button"
              variant="primary"
              fullWidth
              size="touch"
              isLoading={submitting}
              onClick={async () => {
                setErrorKind(null);
                setSubmitting(true);
                try {
                  await startOneId(next);
                } catch {
                  // No `finally`: on success this page is already gone, and
                  // clearing the spinner would flash the idle button over a
                  // navigating page.
                  setErrorKind('oneid');
                  setSubmitting(false);
                }
              }}
            >
              {t('login.oneidButton')}
            </Button>
            {/* Citizens only: a member of staff on the password tab has an
                account already, and "register through OneID" would send them
                the wrong way. */}
            <div className="flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-[#E4E7EA]" />
              <span className="text-xs text-[#767F87]">{t('login.firstTime')}</span>
              <span className="h-px flex-1 bg-[#E4E7EA]" />
            </div>
            <p className="text-[13px] leading-5 text-[#5A646D] text-center">{t('login.firstTimeHint')}</p>
          </div>
        )}

        {method === 'eimzo' &&
          (isEimzoMock() ? (
            <form onSubmit={handleEimzoSubmit} className="space-y-4">
              <p className="text-xs text-[#8A6D00] bg-[#FFF8E1] border border-[#FFE082] rounded-xl p-3">
                {t('login.eimzoMockNotice')}
              </p>
              {badPinfl && (
                <p data-testid="eimzo-bad-pinfl" role="alert" className="text-sm text-[#B91C1C]">
                  {t('login.eimzoBadPinfl')}
                </p>
              )}
              <FormField
                label={t('login.eimzoPinflLabel')}
                htmlFor="pinfl"
                required
                helperText={t('login.eimzoPinflHelp')}
              >
                <Input
                  id="pinfl"
                  inputMode="numeric"
                  touchSize
                  value={pinfl}
                  onChange={(e) => {
                    setPinfl(e.target.value);
                    setBadPinfl(false);
                  }}
                />
              </FormField>
              <FormField label={t('login.eimzoNameLabel')} htmlFor="full-name" required>
                <Input
                  id="full-name"
                  touchSize
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </FormField>
              <Button type="submit" variant="primary" fullWidth size="touch" isLoading={submitting}>
                {t('login.eimzoButton')}
              </Button>
            </form>
          ) : (
            // Real mode: no PINFL/name box — task 10's own rule, since a
            // real certificate carries the identity a mock has none to read
            // (`AuthContextValue.loginViaEimzo`'s own doc comment). Just the
            // one action a citizen can take: hand the sign to their own
            // connected E-IMZO key.
            <div className="space-y-4">
              <p className="text-xs text-[#123522] bg-[#F0F7F1] border border-[#D9EBDC] rounded-xl p-4 leading-relaxed">
                {t('login.eimzoRealHint')}
              </p>
              {eimzoErrorKey && (
                <p data-testid="eimzo-real-error" role="alert" className="text-sm text-[#B91C1C]">
                  {t(eimzoErrorKey)}
                </p>
              )}
              <Button
                type="button"
                variant="primary"
                fullWidth
                size="touch"
                isLoading={submitting}
                onClick={() => void handleEimzoRealSubmit()}
              >
                {t('login.eimzoButton')}
              </Button>
            </div>
          ))}

        {method === 'password' && step === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {resetDone && (
              <p data-testid="reset-done" role="status" className="text-sm text-[#2E7D4F]">
                {t('login.forgotDone')}
              </p>
            )}
            <FormField label={t('login.loginLabel')} htmlFor="login" required>
              <Input
                id="login"
                touchSize
                autoComplete="username"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
              />
            </FormField>
            <FormField label={t('login.passwordLabel')} htmlFor="password" required>
              <Input
                id="password"
                type="password"
                touchSize
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </FormField>
            <Button type="submit" variant="primary" fullWidth size="touch" isLoading={submitting}>
              {t('login.submitPassword')}
            </Button>
            <div className="text-center">
              <button
                type="button"
                onClick={openForgot}
                className="text-sm font-medium text-[#2E7D4F] hover:underline min-h-11 px-2"
              >
                {t('login.forgotLink')}
              </button>
            </div>
            <AdminContact />
          </form>
        )}

        {method === 'password' && step === 'code' && (
          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <FormField
              label={t('login.codeLabel')}
              htmlFor="code"
              required
              helperText={t('login.codeHelp')}
            >
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                touchSize
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </FormField>
            <Button type="submit" variant="primary" fullWidth size="touch" isLoading={submitting}>
              {t('login.submitCode')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              size="touch"
              disabled={submitting}
              onClick={() => {
                setStep('password');
                setCode('');
                setErrorKind(null);
              }}
            >
              {t('login.back')}
            </Button>
          </form>
        )}

        {method === 'password' && step.startsWith('forgot-') && (
          <div className="space-y-4" data-testid="forgot-flow">
            <h2 className="text-base font-semibold text-[#1A1F24]">{t('login.forgotTitle')}</h2>
            {forgotError && (
              <p data-testid="forgot-error" role="alert" className="text-sm text-[#B91C1C]">
                {forgotError}
              </p>
            )}

            {step === 'forgot-login' && (
              <form onSubmit={handleForgotLookup} className="space-y-4">
                <FormField label={t('login.loginLabel')} htmlFor="forgot-login" required>
                  <Input
                    id="forgot-login"
                    touchSize
                    autoComplete="username"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                  />
                </FormField>
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  size="touch"
                  isLoading={submitting}
                  disabled={loginId.trim() === ''}
                >
                  {t('login.forgotNext')}
                </Button>
              </form>
            )}

            {step === 'forgot-channel' && contacts && (
              <div className="space-y-3">
                <p className="text-sm text-[#5A646D]">{t('login.forgotChannelTitle')}</p>
                {(['phone', 'email'] as const).map((c) => {
                  const masked = contacts[c];
                  return (
                    <Button
                      key={c}
                      type="button"
                      variant="secondary"
                      fullWidth
                      size="touch"
                      disabled={masked === null || submitting}
                      onClick={() => handleForgotSend(c)}
                      data-testid={`forgot-channel-${c}`}
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span>{t(c === 'phone' ? 'login.forgotPhone' : 'login.forgotEmail')}</span>
                        <span
                          className={
                            masked === null ? 'text-[#8A949C]' : 'font-mono text-[#1A1F24]'
                          }
                        >
                          {masked ?? t('login.forgotNotFilled')}
                        </span>
                      </span>
                    </Button>
                  );
                })}
              </div>
            )}

            {step === 'forgot-code' && (
              <form onSubmit={handleForgotReset} className="space-y-4">
                <FormField
                  label={t('login.forgotCodeLabel')}
                  htmlFor="forgot-code"
                  required
                  helperText={t('login.forgotCodeHelp')}
                >
                  <Input
                    id="forgot-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    touchSize
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </FormField>
                <FormField
                  label={t('login.forgotNewPassword')}
                  htmlFor="forgot-new-password"
                  required
                  helperText={t('login.forgotPolicyHelp')}
                >
                  <Input
                    id="forgot-new-password"
                    type="password"
                    touchSize
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </FormField>
                <FormField label={t('login.forgotRepeatPassword')} htmlFor="forgot-repeat" required>
                  <Input
                    id="forgot-repeat"
                    type="password"
                    touchSize
                    autoComplete="new-password"
                    value={repeatPassword}
                    onChange={(e) => setRepeatPassword(e.target.value)}
                  />
                </FormField>
                <Button type="submit" variant="primary" fullWidth size="touch" isLoading={submitting}>
                  {t('login.forgotSubmit')}
                </Button>
              </form>
            )}

            <Button
              type="button"
              variant="secondary"
              fullWidth
              size="touch"
              disabled={submitting}
              onClick={backToPassword}
            >
              {t('login.back')}
            </Button>
            <AdminContact />
          </div>
        )}
      </div>

            <a
              href={landingUrl(LANDING_PATHS.verify)}
              className="inline-flex items-center justify-center gap-2 min-h-11 text-sm font-semibold text-[#2E7D4F] hover:text-[#23653F]"
            >
              <span>{t('login.verifyWithoutLogin')}</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <div className="lg:hidden mt-1">
              <Benefits compact />
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-[#E4E7EA] bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#767F87]">
          <span className="text-center sm:text-left">{t('login.footerCopyright')}</span>
          <nav className="flex items-center gap-6 font-semibold text-[#5A646D]">
            <a href={landingUrl(LANDING_PATHS.about)} className="hover:text-[#1A1F24]">
              {t('login.footerHelp')}
            </a>
            <a href={landingUrl(LANDING_PATHS.contact)} className="hover:text-[#1A1F24]">
              {t('login.footerContacts')}
            </a>
            <a href={landingUrl(LANDING_PATHS.documents)} className="hover:text-[#1A1F24]">
              {t('login.footerDocuments')}
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

// Where to turn when the self-service path cannot help — no contact filled
// in on the card, no access to that phone any more, an account an
// administrator blocked. Same line the header advertises (`shell/support.ts`).
function AdminContact() {
  const t = useT();
  return (
    <p data-testid="admin-contact" className="text-xs text-[#5A646D] text-center leading-relaxed">
      {t('login.adminContact')}{' '}
      <a href={SUPPORT_PHONE_HREF} className="font-medium text-[#1A1F24] whitespace-nowrap">
        {SUPPORT_PHONE}
      </a>
      , {t('shell.extension')} {SUPPORT_EXTENSION}
    </p>
  );
}
