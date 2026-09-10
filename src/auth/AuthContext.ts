import { createContext } from 'react';
import type { ApiError } from '../api/errors';
import type { components } from '../api/schema';

type MeOut = components['schemas']['MeOut'];

/** What `submitPassword` produced — see its doc comment. */
export type PasswordStepOutcome = 'mfa-required' | 'signed-in';

export interface AuthContextValue {
  me: MeOut | null;
  loading: boolean;
  /**
   * Set when the initial `GET /auth/me` fails with anything other than
   * `ERR-AUTH-002` (no session) — a 500, a transient outage, a CORS
   * misconfiguration. Distinct from `me === null`, which means "no session,
   * this is the ordinary logged-out state". A consumer that only checks `me`
   * would otherwise bounce a possibly-still-logged-in user to `/login` with
   * no visible reason.
   */
  authError: ApiError | null;
  /**
   * The password step. Its RESULT decides what happens next, and a caller may
   * not assume: with the second factor required it returns `'mfa-required'`
   * and only remembers the handoff token; with the server's `mfa_enabled`
   * switch off the session is already open on that same response, `me` is
   * already set here, and the caller must navigate rather than ask for a code
   * nobody will check.
   */
  submitPassword: (login: string, password: string) => Promise<PasswordStepOutcome>;
  verifyMfa: (code: string) => Promise<void>;
  /**
   * Sends the browser to OneID, remembering `next` in sessionStorage first —
   * the round trip leaves this origin entirely and comes back through the
   * backend's callback, so React state and router history do not survive it.
   */
  startOneId: (next: string) => Promise<void>;
  /**
   * ERI login: fetch a challenge, sign it, exchange the signed challenge for
   * a session. `pinfl`/`fullName` are used ONLY in mock mode, to build the
   * envelope `buildMockSignedChallenge` needs since a mock has no real key
   * to read an identity from (`src/lib/eimzo/eimzoMock.ts`'s own docstring);
   * in real mode they are ignored — the signer's identity comes from their
   * actual certificate, read server-side out of the signed PKCS7 itself, so
   * `LoginPage`'s real-mode branch calls this with no arguments at all.
   */
  loginViaEimzo: (pinfl?: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Adopts a fresh `MeOut` a screen already holds — `complete-registration`,
   * `PATCH /auth/me` and `PUT /auth/me/language` all return the caller's
   * whole session shape in the response body, unlike `POST
   * /auth/password/change` (204, no body), which is why THAT gate reloads
   * the page instead (`ChangePasswordForm`'s own `onChanged`). Calling this
   * needs no extra round trip and, for a screen `RequireAuth` gates on a
   * field of `me` (`registration_complete`, `must_change_password`), lifts
   * the gate in place — nothing ever navigated away, so there is nothing to
   * navigate back to.
   */
  applyMe: (next: MeOut) => void;
  /**
   * Re-fetches `GET /auth/me` and adopts the result — for a write that does
   * NOT hand back a fresh `MeOut` the way `applyMe`'s callers do:
   * `POST /auth/applicants`, `POST /auth/applicants/{id}/representations`
   * (B4, each returns only the one representation/applicant they touched,
   * not the caller's whole session) and `POST`/`DELETE /certificates` (B5,
   * `signatures` owns no `MeOut` shape to return at all). Throws on failure
   * the same way every other method here does — the caller already holds a
   * valid session (a mutation on it just succeeded), so a failure here is
   * a real error, not an ordinary logged-out state to special-case.
   */
  refreshMe: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
