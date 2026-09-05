import { api } from '../../../../api/client';
import { apiError } from '../../../../api/errors';
import type { components } from '../../../../api/schema';

export type AttachLegalIn = components['schemas']['AttachLegalIn'];
export type AttachLegalOut = components['schemas']['AttachLegalOut'];
export type AddRepresentationIn = components['schemas']['AddRepresentationIn'];
export type RepresentationOut = components['schemas']['RepresentationOut'];
type FileOut = components['schemas']['FileOut'];

/** `POST /auth/applicants` — become a legal entity's FIRST representative,
 * on one of three bases (`org_eri` | `director_registry` | `poa`). Creates
 * the `applicants` row for that STIR if none exists yet. */
export async function attachLegal(body: AttachLegalIn): Promise<AttachLegalOut> {
  const { data, error } = await api.POST('/api/v1/auth/applicants', { body });
  if (error) throw apiError(error);
  return data;
}

/** `POST /auth/applicants/{id}/representations` — add a SECOND representative
 * (by PINFL) to a legal entity the caller already represents via `org_eri`
 * or `director_registry` (the backend refuses a `poa`-based caller here). */
export async function addRepresentation(
  applicantId: string,
  body: AddRepresentationIn,
): Promise<RepresentationOut> {
  const { data, error } = await api.POST('/api/v1/auth/applicants/{applicant_id}/representations', {
    params: { path: { applicant_id: applicantId } },
    body,
  });
  if (error) throw apiError(error);
  return data;
}

/** `POST /auth/eimzo/challenge` — the same one-shot challenge login's own
 * `org_eri` step consumes, reused here for `org_eri`-basis attach/add: both
 * eventually call `auth.service._verify_org_challenge`, which redeems a row
 * this same route inserts. */
export async function issueEimzoChallenge(): Promise<string> {
  const { data, error } = await api.POST('/api/v1/auth/eimzo/challenge', {});
  if (error) throw apiError(error);
  return data.challenge;
}

/** `POST /files` is multipart — same cast-through-FormData idiom
 * `applicant/api.ts::uploadFile` uses; duplicated here rather than imported,
 * per this fleet's own convention of one small helper per track/screen
 * folder instead of a shared module every parallel session has to merge
 * around. */
export async function uploadPoaFile(file: File): Promise<FileOut> {
  const form = new FormData();
  form.append('file', file);
  const { data, error } = await api.POST('/api/v1/files', {
    body: form as unknown as { file: string },
  });
  if (error) throw apiError(error);
  return data;
}
