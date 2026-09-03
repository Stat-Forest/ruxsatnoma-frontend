import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api, setCsrfToken } from '../api/client';
import { apiError } from '../api/errors';
import type { components } from '../api/schema';
import { AuthContext } from './AuthContext';

type MeOut = components['schemas']['MeOut'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeOut | null>(null);
  const [loading, setLoading] = useState(true);
  const mfaTokenRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await api.GET('/api/v1/auth/me', {});
      if (cancelled) return;
      if (error) {
        // ERR-AUTH-002 (no session) is the logged-out state, not an error
        // to surface — a page load with no cookie looks exactly like this.
        setMe(null);
      } else {
        setCsrfToken(data.csrf_token);
        setMe(data);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (loginId: string, password: string, code?: string) => {
    if (code === undefined) {
      const { data, error } = await api.POST('/api/v1/auth/login', {
        body: { login: loginId, password },
      });
      if (error) throw apiError(error);
      mfaTokenRef.current = data.mfa_token;
      return;
    }
    const { data, error } = await api.POST('/api/v1/auth/mfa/verify', {
      body: { mfa_token: mfaTokenRef.current ?? '', code },
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

  return <AuthContext.Provider value={{ me, loading, login, logout }}>{children}</AuthContext.Provider>;
}
