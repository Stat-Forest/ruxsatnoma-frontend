/**
 * Saving the citizen's own address once their account has none — ruling #113
 * (`docs/decisions.md`): a permit's address requisite is gated at SUBMIT, not
 * at registration, so the application wizard is where an address-less
 * account is asked to fill it in (`ApplicationWizardPage.tsx`).
 *
 * `PATCH /auth/applicants/{applicant_id}/address` is added by branch
 * stage-7.4b and is deliberately NOT yet in the generated
 * `src/api/schema.d.ts` — that file is regenerated from a live server
 * (`scripts/gen-types.sh`), and the server only gains this route once
 * stage-7.4b merges. The request/response shapes below are declared by hand
 * for exactly that reason, isolated to this one file: once the schema is
 * regenerated at integration, only this module needs to change — swap the
 * hand-written types for `components['schemas'][...]` and drop the cast.
 */
import { api } from './client';
import { apiError } from './errors';
import type { components } from './schema';

export type ApplicantOut = components['schemas']['ApplicantOut'];

interface ApplicantAddressIn {
  address: string;
}

type PatchAddressResult = { data: ApplicantOut; error?: undefined } | { data?: undefined; error: unknown };

type PatchApplicantAddress = (
  path: '/api/v1/auth/applicants/{applicant_id}/address',
  init: { params: { path: { applicant_id: string } }; body: ApplicantAddressIn },
) => Promise<PatchAddressResult>;

export async function saveApplicantAddress(applicantId: string, address: string): Promise<ApplicantOut> {
  const patch = api.PATCH as unknown as PatchApplicantAddress;
  const { data, error } = await patch('/api/v1/auth/applicants/{applicant_id}/address', {
    params: { path: { applicant_id: applicantId } },
    body: { address },
  });
  if (error) throw apiError(error);
  return data as ApplicantOut;
}
