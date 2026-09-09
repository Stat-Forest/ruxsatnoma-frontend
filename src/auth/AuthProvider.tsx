import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api, setCsrfToken, setSessionGoneHandler } from '../api/client';
import { ApiError, apiError, SESSION_GONE } from '../api/errors';
import type { components } from '../api/schema';
import { buildMockSignedChallenge, isEimzoMock, signAttached } from '../lib/eimzo';
import { navigation } from '../lib/navigation';
import { AuthContext } from './AuthContext';
import type { PasswordStepOutcome } from './AuthContext';

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
      try {
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
      } catch (err) {
        if (cancelled) return;
        setMe(null);
        setAuthError(
          new ApiError(
            'NETWORK_ERROR',
            err instanceof Error ? err.message : 'Tarmoq xatosi',
          ),
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The moment a session starts, wherever it started: the CSRF token the client
  // replays, the profile every screen reads, and the clearing of a prior boot's
  // authError (a 500, a CORS blip during the initial /auth/me) — which must not
  // survive a login that just succeeded, or RequireAuth keeps showing "session
  // check failed" over a valid `me` until a full page reload clears it.
  const applySession = useCallback((next: MeOut) => {
    setCsrfToken(next.csrf_token);
    setMe(next);
    setAuthError(null);
  }, []);

  // Step 1 of login: POST /auth/login. Two outcomes, and the CALLER must branch
  // on the returned one rather than assume a code screen comes next: with the
  // server's `mfa_enabled` switch off there is no second step at all — the
  // session cookies and the profile arrive on this very response — and asking
  // for a code then would block the login on a field nothing verifies.
  const submitPassword = useCallback(
    async (loginId: string, password: string): Promise<PasswordStepOutcome> => {
      const { data, error } = await api.POST('/api/v1/auth/login', {
        body: { login: loginId, password },
      });
      if (error) throw apiError(error);
      if (!data.mfa_required && data.me) {
        applySession(data.me);
        return 'signed-in';
      }
      // Held in a ref (React state, never storage) so `verifyMfa` can finish.
      mfaTokenRef.current = data.mfa_token ?? null;
      return 'mfa-required';
    },
    [applySession],
  );

  // Step 2 of login: POST /auth/mfa/verify. This is where the session cookie
  // and the CSRF token arrive when a second factor IS required. Calling it
  // before `submitPassword` has succeeded is a client bug, not a case to paper
  // over with an empty token sent to the server — it fails locally instead.
  const verifyMfa = useCallback(
    async (code: string) => {
      if (!mfaTokenRef.current) {
        throw new Error('verifyMfa called before submitPassword succeeded');
      }
      const { data, error } = await api.POST('/api/v1/auth/mfa/verify', {
        body: { mfa_token: mfaTokenRef.current, code },
      });
      if (error) throw apiError(error);
      applySession(data);
    },
    [applySession],
  );

  const startOneId = useCallback(async (next: string) => {
    const { data, error } = await api.GET('/api/v1/auth/oneid/authorize', {});
    if (error) throw apiError(error);
    // Stored only after the authorize call itself succeeds: a FAILED
    // authorize round trip (a dropped connection, before the browser ever
    // leaves this origin) never touches storage, so it cannot leave a stale
    // value behind.
    //
    // That is the one thing this ordering protects — it does NOT mean the
    // stored value is wiped by every other kind of failure. Once storage IS
    // written, an attempt the citizen abandons, or one that fails downstream
    // (a stale `oneid_state` cookie, `/login?error=oneid`), leaves this same
    // value alive on purpose: `LoginPage`'s own `next` falls back to reading
    // it (`oneIdReturnCache.ts::peekStoredNext`) precisely so a retry does
    // not lose the citizen's destination. It is cleared only by
    // `OneIdReturnPage`'s `takeNext()`, reached solely by a successful
    // return — an unrelated LATER login (password, E-IMZO) never reads this
    // key at all, so there is no hijack risk left to guard against.
    try {
      sessionStorage.setItem(ONEID_NEXT_KEY, next);
    } catch {
      // Private mode or a storage quota — the login still works, it just
      // lands on the dashboard instead of the remembered page.
    }
    navigation.assign(data.redirect_url);
  }, []);

  // Real mode: `POST /auth/eimzo/challenge` mints the PROVIDER's own
  // challenge (120s TTL) — signed ATTACHED, never timestamped (`signAttached`'s
  // own docstring: `login_via_eimzo`/`verify_signed_challenge` is not
  // `signatures.service.sign()`, so ruling R5's mandatory timestamp does not
  // gate it). Mock mode keeps building the same JSON envelope it always did,
  // from the pinfl/fullName the caller supplies — see this method's own
  // doc comment on `AuthContextValue` for why real mode ignores both.
  const loginViaEimzo = useCallback(async (pinfl?: string, fullName?: string) => {
    const { data: challengeData, error: challengeError } = await api.POST(
      '/api/v1/auth/eimzo/challenge',
      {},
    );
    if (challengeError) throw apiError(challengeError);
    const signed = isEimzoMock()
      ? await buildMockSignedChallenge({
          challenge: challengeData.challenge,
          pinfl: pinfl ?? '',
          fullName: fullName ?? '',
        })
      : await signAttached(new TextEncoder().encode(challengeData.challenge));
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

  // See `AuthContextValue.applyMe`'s own docstring for why this exists
  // instead of every screen re-implementing "set `me` from a response I
  // already have".
  const applyMe = useCallback((next: MeOut) => setMe(next), []);

  // See `AuthContextValue.refreshMe`'s own docstring: for the writes that
  // hand back something narrower than a whole `MeOut`.
  const refreshMe = useCallback(async () => {
    const { data, error } = await api.GET('/api/v1/auth/me', {});
    if (error) throw apiError(error);
    setCsrfToken(data.csrf_token);
    setMe(data);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        me,
        loading,
        authError,
        submitPassword,
        verifyMfa,
        startOneId,
        loginViaEimzo,
        logout,
        applyMe,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
