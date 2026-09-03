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
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
