/**
 * Saving the address of the applicant a filing is FOR, once that applicant's
 * record has none — ruling #113 (`docs/decisions.md`): a permit's address
 * requisite is gated at SUBMIT, not at registration, so the application
 * wizard is where an address-less applicant is asked to fill it in
 * (`ApplicationWizardPage.tsx`).
 *
 * The applicant is the signed-in citizen when filing for themselves and the
 * represented legal entity when filing on its behalf — the route addresses it
 * by path, and the backend accepts an applicant the caller owns or represents
 * (`PATCH /auth/applicants/{applicant_id}/address`, branch stage-7.4b). A
 * stranger's applicant answers 404, never 403.
 */
import { api } from './client';
import { apiError } from './errors';
import type { components } from './schema';

export type ApplicantOut = components['schemas']['ApplicantOut'];
type ApplicantAddressIn = components['schemas']['ApplicantAddressIn'];

export async function saveApplicantAddress(applicantId: string, address: string): Promise<ApplicantOut> {
  const body: ApplicantAddressIn = { address };
  const { data, error } = await api.PATCH('/api/v1/auth/applicants/{applicant_id}/address', {
    params: { path: { applicant_id: applicantId } },
    body,
  });
  if (error) throw apiError(error);
  return data;
}
