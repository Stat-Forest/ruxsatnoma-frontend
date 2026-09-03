export class ApiError extends Error {
  constructor(public code: string, message: string, public details?: unknown) { super(message); }
}

/** The backend always answers `{error: {code, message, details?}}` (design/03).
 *  openapi-fetch hands that body back as `error`; this turns it into one type
 *  screens can branch on. An unparseable body still yields an ApiError, never
 *  `undefined` — a screen that has to check for both is a screen that forgets. */
export function apiError(body: unknown): ApiError {
  const e = (body as { error?: { code?: string; message?: string; details?: unknown } })?.error;
  return new ApiError(e?.code ?? 'ERR-SYS-000', e?.message ?? 'Unexpected error', e?.details);
}

/** Handled once, in the shell, never per screen (ruling 10). */
export const SESSION_GONE = 'ERR-AUTH-002';
export const CSRF_REFUSED = 'ERR-AUTH-006';
export const RATE_LIMITED = 'ERR-SYS-006';
