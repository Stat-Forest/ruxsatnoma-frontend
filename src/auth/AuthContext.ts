import { createContext } from 'react';
import type { ApiError } from '../api/errors';
import type { components } from '../api/schema';

type MeOut = components['schemas']['MeOut'];

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
  requestMfa: (login: string, password: string) => Promise<void>;
  verifyMfa: (code: string) => Promise<void>;
  /**
   * Sends the browser to OneID, remembering `next` in sessionStorage first —
   * the round trip leaves this origin entirely and comes back through the
   * backend's callback, so React state and router history do not survive it.
   */
  startOneId: (next: string) => Promise<void>;
  /**
   * Mock-mode E-IMZO login: fetch a challenge, build the envelope the mock
   * adapter verifies, exchange it for a session. A real E-IMZO key would
   * produce the envelope in its own plugin instead — stage 5.2.
   */
  loginViaEimzo: (pinfl: string, fullName: string) => Promise<void>;
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
}

export const AuthContext = createContext<AuthContextValue | null>(null);
