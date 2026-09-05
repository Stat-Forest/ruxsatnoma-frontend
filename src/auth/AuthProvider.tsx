import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api, setCsrfToken, setSessionGoneHandler } from '../api/client';
import { apiError, SESSION_GONE } from '../api/errors';
import type { ApiError } from '../api/errors';
import type { components } from '../api/schema';
import { buildMockSignedChallenge } from '../lib/eimzoMock';
import { navigation } from '../lib/navigation';
import { AuthContext } from './AuthContext';

type MeOut = components['schemas']['MeOut'];

/** Shared with `OneIdReturnPage`, which consumes what `startOneId` stores. */
export const ONEID_NEXT_KEY = 'ruxsatnoma.oneid.next';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<ApiError | null>(null);
  const mfaTokenRef = useRef<string | null>(null);

  // The local half of "session gone": clears React state without telling the
  // backend, because the backend is exactly who just said the session is
  // already gone — a `logout()` call from here would hit the same
  // `ERR-AUTH-002` again and, since that re-invokes this same handler, loop.
  const clearLocalSession = useCallback(() => {
    setMe(null);
    setCsrfToken(null);
    setAuthError(null);
  }, []);

  // Registered once so `src/api/client.ts`'s `sessionMiddleware` — which
  // covers every call site, not only TanStack Query — can react to
  // `ERR-AUTH-002` from anywhere (ruling 10). `client.ts` cannot import this
  // provider directly (it would cycle: this file already imports `api`), so
  // it exposes a setter of the same shape as `setCsrfToken` instead.
  useEffect(() => {
    setSessionGoneHandler(clearLocalSession);
    return () => setSessionGoneHandler(null);
  }, [clearLocalSession]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await api.GET('/api/v1/auth/me', {});
      if (cancelled) return;
      if (error) {
        const err = apiError(error);
        // ERR-AUTH-002 (no session) is the logged-out state, not an error to
        // surface — a page load with no cookie looks exactly like this.
        // Anything else (a 500, a transient outage, a CORS misconfiguration)
        // is NOT the same as logged-out and must stay visibly distinct, or a
        // still-logged-in user gets silently bounced with no explanation.
        setMe(null);
        setAuthError(err.code === SESSION_GONE ? null : err);
      } else {
        setCsrfToken(data.csrf_token);
        setMe(data);
        setAuthError(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Step 1 of login: POST /auth/login. Remembers the mfa_token in a ref
  // (React state, never storage) so `verifyMfa` can complete the flow.
  const requestMfa = useCallback(async (loginId: string, password: string) => {
    const { data, error } = await api.POST('/api/v1/auth/login', {
      body: { login: loginId, password },
    });
    if (error) throw apiError(error);
    mfaTokenRef.current = data.mfa_token;
  }, []);

  // Step 2 of login: POST /auth/mfa/verify. This is where the session cookie
  // and the CSRF token actually arrive. Calling this before `requestMfa` has
  // succeeded is a client bug, not a case to paper over with an empty token
  // sent to the server — it fails immediately and locally instead.
  const verifyMfa = useCallback(async (code: string) => {
    if (!mfaTokenRef.current) {
      throw new Error('verifyMfa called before requestMfa succeeded');
    }
    const { data, error } = await api.POST('/api/v1/auth/mfa/verify', {
      body: { mfa_token: mfaTokenRef.current, code },
    });
    if (error) throw apiError(error);
    setCsrfToken(data.csrf_token);
    setMe(data);
    // A prior boot's authError (a 500, a CORS blip during the initial
    // /auth/me) must not survive a login that just succeeded — otherwise
    // RequireAuth keeps showing "session check failed" forever, even though
    // `me` is now valid, until a full page reload clears React state.
    setAuthError(null);
  }, []);

  const startOneId = useCallback(async (next: string) => {
    const { data, error } = await api.GET('/api/v1/auth/oneid/authorize', {});
    if (error) throw apiError(error);
    // Stored only after the authorize call succeeded: a stale `next` left
    // behind by a failed attempt would hijack the NEXT successful login.
    try {
      sessionStorage.setItem(ONEID_NEXT_KEY, next);
    } catch {
      // Private mode or a storage quota — the login still works, it just
      // lands on the dashboard instead of the remembered page.
    }
    navigation.assign(data.redirect_url);
  }, []);

  const loginViaEimzo = useCallback(async (pinfl: string, fullName: string) => {
    const { data: challengeData, error: challengeError } = await api.POST(
      '/api/v1/auth/eimzo/challenge',
      {},
    );
    if (challengeError) throw apiError(challengeError);
    const signed = await buildMockSignedChallenge({
      challenge: challengeData.challenge,
      pinfl,
      fullName,
    });
    const { data, error } = await api.POST('/api/v1/auth/eimzo/login', {
      body: { signed_challenge: signed },
    });
    if (error) throw apiError(error);
    setCsrfToken(data.csrf_token);
    setMe(data);
    setAuthError(null);
  }, []);

  const logout = useCallback(async () => {
    await api.POST('/api/v1/auth/logout', {});
    clearLocalSession();
  }, [clearLocalSession]);

  return (
    <AuthContext.Provider
      value={{ me, loading, authError, requestMfa, verifyMfa, startOneId, loginViaEimzo, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
