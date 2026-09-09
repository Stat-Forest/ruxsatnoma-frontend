import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { Button } from '../components/ui/button';
import { FormField, Input } from '../components/ui/FormControls';
import { ApiError, RATE_LIMITED } from '../api/errors';
import { useAuth } from '../auth/useAuth';
import { useT } from '../i18n/useT';
import { EimzoError, PINFL_PATTERN, eimzoErrorMessageKey, isEimzoMock, isProviderUnreachable } from '../lib/eimzo';
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

export function LoginPage() {
  const { submitPassword, verifyMfa, startOneId, loginViaEimzo } = useAuth();
  const t = useT();
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
  const [step, setStep] = useState<'password' | 'code'>('password');
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

  return (
    <div
      data-testid="login-page"
      data-next={next}
      className="min-h-screen flex items-center justify-center bg-[#F8F9FA] px-4"
    >
      <div className="w-full max-w-sm bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-sm space-y-5">
        <div className="text-center">
          <h1 className="text-xl font-bold text-[#1A1F24]">{t('login.title')}</h1>
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
          <div className="space-y-4 text-center">
            <p className="text-xs text-[#123522] bg-[#F0F7F1] border border-[#D9EBDC] rounded-xl p-4 leading-relaxed">
              {t('login.oneidHint')}
            </p>
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

        {method === 'password' &&
          (step === 'password' ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
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
            </form>
          ) : (
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
            </form>
          ))}
      </div>
    </div>
  );
}
