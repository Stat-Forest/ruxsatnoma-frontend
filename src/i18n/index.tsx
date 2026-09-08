import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/client';
import { apiError } from '../api/errors';
import { useAuth } from '../auth/useAuth';
import { DICTIONARIES, I18nContext, normalizeBackendLanguage, resolveLanguage } from './context';
import type { BackendLanguage } from './context';

/**
 * Reads the active language from `me.user.language` and writes changes
 * through `PUT /api/v1/auth/me/language` (ruling R14). The write is reflected
 * locally the moment it succeeds — `me` itself is `AuthProvider`'s state, not
 * this provider's, and a page reload re-derives the same value from a fresh
 * `/auth/me` anyway, since the PUT already persisted it server-side.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const [override, setOverride] = useState<BackendLanguage | null>(null);

  // A login/logout (a change of user identity) must not leak the previous
  // account's manually-picked language into the next one. Resetting state
  // during render (not in an effect) when an id we track changes is the
  // pattern React itself recommends for this — it avoids the extra
  // effect-then-setState render pass.
  const seenUserId = useRef(me?.user?.id);
  if (seenUserId.current !== me?.user?.id) {
    seenUserId.current = me?.user?.id;
    if (override !== null) setOverride(null);
  }

  const backendLang = override ?? normalizeBackendLanguage(me?.user?.language);
  const lang = resolveLanguage(backendLang);
  const dict = DICTIONARIES[lang];

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  // `NavItem.labelKey` (and any future caller) is a plain `string`, not the
  // literal union that gates `DICTIONARIES` itself — a key missing from
  // either map is a compile error there; this cast only widens the lookup,
  // with `?? key` as a last-resort fallback.
  const t = useCallback((key: string) => (dict as Record<string, string>)[key] ?? key, [dict]);

  const setLanguage = useCallback(async (code: BackendLanguage) => {
    const { error } = await api.PUT('/api/v1/auth/me/language', { body: { language: code } });
    if (error) throw apiError(error);
    setOverride(code);
  }, []);

  return (
    <I18nContext.Provider value={{ lang, backendLang, t, setLanguage }}>{children}</I18nContext.Provider>
  );
}
