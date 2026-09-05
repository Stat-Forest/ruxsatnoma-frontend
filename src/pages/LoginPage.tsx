import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { FormField, Input } from '../components/ui/FormControls';
import { ApiError, RATE_LIMITED } from '../api/errors';
import { useAuth } from '../auth/useAuth';
import { useT } from '../i18n/useT';
import { PINFL_PATTERN } from '../lib/eimzoMock';

type ErrorKind = 'credentials' | 'blocked' | 'rate-limited' | 'connection' | 'oneid' | null;

// ERR-AUTH-001 (wrong credentials), ERR-AUTH-003 (blocked account) and
// ERR-SYS-006 (rate limited) get three different messages on purpose — the
// brief's whole reason is that "wrong password" for a locked-out account
// sends the user in circles. Anything that is not even an ApiError (the
// backend never answered — a dropped connection, a CORS failure) is its own
// fourth case: telling someone their password is wrong when their
// connection dropped is that same defect in a different costume.
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
  const { requestMfa, verifyMfa, startOneId, loginViaEimzo } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const next = (location.state as { next?: string } | null)?.next ?? '/';

  const [method, setMethod] = useState<Method>(storedMethod);
  const [step, setStep] = useState<'password' | 'code'>('password');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pinfl, setPinfl] = useState('');
  const [fullName, setFullName] = useState('');
  const [badPinfl, setBadPinfl] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorKind, setErrorKind] = useState<ErrorKind>(null);

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorKind(null);
    setSubmitting(true);
    try {
      await requestMfa(loginId, password);
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
          (import.meta.env.VITE_EIMZO_MOCK === 'true' ? (
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
            <p className="text-sm text-[#5A646D]">{t('login.eimzoUnavailable')}</p>
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
