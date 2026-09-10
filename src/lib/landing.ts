/**
 * The only place this application knows where the public site lives — the
 * mirror image of the landing's `lib/cabinet.ts`, which is the only place the
 * landing knows where this cabinet lives.
 *
 * `VITE_LANDING_BASE_URL` is baked into the bundle at build time like
 * `VITE_API_BASE`; the fallback is the landing's `vite` dev port, so a local
 * `npm run dev` beside a local landing links up with no configuration.
 */
const LANDING_BASE_URL: string = import.meta.env.VITE_LANDING_BASE_URL ?? 'http://localhost:5173';

export const LANDING_PATHS = {
  home: '/',
  /** Public permit verification — the thing a citizen most often mistakes the login for. */
  verify: '/check',
  about: '/about',
  contact: '/contact',
  documents: '/documents',
} as const;

export function landingUrl(path: (typeof LANDING_PATHS)[keyof typeof LANDING_PATHS]): string {
  return `${LANDING_BASE_URL.replace(/\/+$/, '')}${path}`;
}
