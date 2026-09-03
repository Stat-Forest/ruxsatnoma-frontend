import { createContext } from 'react';
import type { components } from '../api/schema';

type MeOut = components['schemas']['MeOut'];

export interface AuthContextValue {
  me: MeOut | null;
  loading: boolean;
  /**
   * Two-phase login sharing one signature. Called without `code` it is step
   * one — `POST /auth/login` — and only remembers the `mfa_token` it gets
   * back (in a ref, never in storage). Called again with `code` it is step
   * two — `POST /auth/mfa/verify` — which is where the session cookie and
   * the CSRF token actually arrive.
   */
  login: (login: string, password: string, code?: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
