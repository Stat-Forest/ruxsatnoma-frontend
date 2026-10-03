import type { AuthContextValue } from './AuthContext';

/**
 * The auth actions a screen test never exercises directly — every
 * `authValue()` builder across the suite stubbed these seven as no-ops
 * identically before `applyMe`/`refreshMe` existed, so the duplication is
 * factored out here rather than repeated a fifth time. `signedOut` rides
 * along for the same reason: no screen test starts from a logout. Test only.
 */
export function stubAuthActions(): Omit<AuthContextValue, 'me' | 'loading' | 'authError'> {
  return {
    submitPassword: async () => 'mfa-required',
    verifyMfa: async () => {},
    startOneId: async () => {},
    loginViaEimzo: async () => {},
    logout: async () => {},
    signedOut: false,
    applyMe: () => {},
    refreshMe: async () => {},
  };
}
