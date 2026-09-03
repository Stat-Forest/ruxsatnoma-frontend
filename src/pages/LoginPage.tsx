import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { FormField, Input } from '../components/ui/FormControls';
import { ApiError, RATE_LIMITED } from '../api/errors';
import { useAuth } from '../auth/useAuth';
import { useT } from '../i18n/useT';

type ErrorKind = 'credentials' | 'blocked' | 'rate-limited' | 'connection' | null;

// ERR-AUTH-001 (wrong credentials), ERR-AUTH-003 (blocked account) and
// ERR-SYS-006 (rate limited) get three different messages on purpose — the
// brief's whole reason is that "wrong password" for a locked-out account
// sends the user in circles. Anything that is not even an ApiError (the
// backend never answered — a dropped connection, a CORS failure) is its own
// fourth case: telling someone their password is wrong when their
// connection dropped is that same defect in a different costume.
function classify(err: unknown): Exclude<ErrorKind, null> {
  if (!(err instanceof ApiError)) return 'connection';
  if (err.code === RATE_LIMITED) return 'rate-limited';
  if (err.code === 'ERR-AUTH-003') return 'blocked';
  return 'credentials';
}

export function LoginPage() {
  const { requestMfa, verifyMfa } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const next = (location.state as { next?: string } | null)?.next ?? '/';

  const [step, setStep] = useState<'password' | 'code'>('password');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
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

        {step === 'password' ? (
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
            <FormField label={t('login.codeLabel')} htmlFor="code" required helperText={t('login.codeHelp')}>
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
        )}
      </div>
    </div>
  );
}
