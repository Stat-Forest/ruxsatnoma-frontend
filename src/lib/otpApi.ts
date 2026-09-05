/**
 * `POST /auth/otp/request` and `POST /auth/otp/verify` — shared by the
 * registration screen (B2, phone) and the profile contacts section (B3,
 * phone or email), the only two places in this app that need a one-time
 * code. Kept as a small `src/lib/` module rather than duplicated per screen:
 * unlike the display helpers in `applicant/format.ts` (deliberately
 * duplicated per parallel track — see that file's own docstring), this is
 * one exact API shape with no per-screen variation, and the two callers are
 * both inside this same track's own commits, not two different parallel
 * sessions that would fight over the file.
 */
import { api } from '../api/client';
import { apiError } from '../api/errors';

export type OtpPurpose = 'phone_verify' | 'email_verify';

export async function requestOtp(input: {
  target_type: 'phone' | 'email';
  target: string;
  purpose: OtpPurpose;
}): Promise<void> {
  const { error } = await api.POST('/api/v1/auth/otp/request', { body: input });
  if (error) throw apiError(error);
}

/** Returns the `otp_token` a caller burns exactly once, against the same
 * `target` and `purpose`, inside the follow-up write (`complete-registration`,
 * `PATCH /auth/me`). */
export async function verifyOtp(input: {
  target: string;
  code: string;
  purpose: OtpPurpose;
}): Promise<string> {
  const { data, error } = await api.POST('/api/v1/auth/otp/verify', { body: input });
  if (error) throw apiError(error);
  return data.otp_token;
}
