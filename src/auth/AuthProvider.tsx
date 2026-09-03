import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api, setCsrfToken } from '../api/client';
import { apiError, SESSION_GONE } from '../api/errors';
import type { ApiError } from '../api/errors';
import type { components } from '../api/schema';
import { AuthContext } from './AuthContext';

type MeOut = components['schemas']['MeOut'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<ApiError | null>(null);
  const mfaTokenRef = useRef<string | null>(null);

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
  }, []);

  const logout = useCallback(async () => {
    await api.POST('/api/v1/auth/logout', {});
    setMe(null);
    setCsrfToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ me, loading, authError, requestMfa, verifyMfa, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
