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
/**
 * Where an ANONYMOUS visitor's choice lives. The login page has a language
 * switcher too (since 2026-09-10), but there is no `me` to write to yet —
 * `PUT /auth/me/language` needs a session — so the choice is kept in the
 * browser, the way the login page already remembers its tab. It applies only
 * while `me` is null: the moment someone signs in, their account's language
 * takes over (the reset below), and a mismatch is theirs to fix in the header.
 */
export const ANONYMOUS_LANGUAGE_KEY = 'ruxsatnoma.language';

function storedAnonymousLanguage(): BackendLanguage | null {
  try {
    const saved = localStorage.getItem(ANONYMOUS_LANGUAGE_KEY);
    return saved === null ? null : normalizeBackendLanguage(saved);
  } catch {
    return null;
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const [override, setOverride] = useState<BackendLanguage | null>(() =>
    me ? null : storedAnonymousLanguage(),
  );

  // A login/logout (a change of user identity) must not leak the previous
  // account's manually-picked language into the next one. Resetting state
  // during render (not in an effect) when an id we track changes is the
  // pattern React itself recommends for this — it avoids the extra
  // effect-then-setState render pass.
  // Signing OUT is the other identity change: the account's language must not
  // outlive the account on the login page either, so the anonymous choice (if
  // any) comes back instead.
  const seenUserId = useRef(me?.user?.id);
  if (seenUserId.current !== me?.user?.id) {
    seenUserId.current = me?.user?.id;
    const next = me ? null : storedAnonymousLanguage();
    if (override !== next) setOverride(next);
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

  const signedIn = me !== null;
  const setLanguage = useCallback(
    async (code: BackendLanguage) => {
      if (!signedIn) {
        try {
          localStorage.setItem(ANONYMOUS_LANGUAGE_KEY, code);
        } catch {
          // A browser that refuses storage still switches for this visit; it
          // just does not remember the choice next time.
        }
        setOverride(code);
        return;
      }
      const { error } = await api.PUT('/api/v1/auth/me/language', { body: { language: code } });
      if (error) throw apiError(error);
      setOverride(code);
    },
    [signedIn],
  );

  return (
    <I18nContext.Provider value={{ lang, backendLang, t, setLanguage }}>{children}</I18nContext.Provider>
  );
}
