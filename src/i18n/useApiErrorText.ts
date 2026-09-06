import { useCallback } from 'react';
import { apiErrorMessage, isCodedError } from './errorMessages';
import { useLanguage } from './useT';

/**
 * Drop-in replacement for the `error instanceof ApiError ? \`${code}: ${message}\`
 * : fallback` anti-pattern repeated across the app (F4,
 * `docs/plans/07.3-findings.md`): call `errorText(error, fallback)` where that
 * ternary used to sit.
 *
 * - A coded error (`ApiError`, or any `{code, message}`-shaped value) always
 *   renders through `apiErrorMessage` — localized copy for a known code, the
 *   server's own message for one this map doesn't know yet.
 * - Anything else (a network failure, `null`) renders `fallback` when the
 *   caller supplies one (most call sites already had a context-specific
 *   "failed to load" sentence for exactly this case), or the same generic
 *   sentence `apiErrorMessage` itself falls back to otherwise.
 */
export function useApiErrorText() {
  const { lang } = useLanguage();
  return useCallback(
    (error: unknown, fallback?: string): string => {
      if (fallback !== undefined && !isCodedError(error)) return fallback;
      return apiErrorMessage(error, lang);
    },
    [lang],
  );
}
