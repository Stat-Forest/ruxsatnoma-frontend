/**
 * Typed wrappers around the four `/applications/benefit-verifications*`
 * routes (`app/modules/applications/benefit_verification_router.py`,
 * decisions.md #179) — `openapi-fetch`, every type taken from the generated
 * `src/api/schema.d.ts`, never hand-written, in the style of
 * `src/pages/archive/api.ts`.
 *
 * Every route here answers to `benefits.verify` alone — no ownership check,
 * no ABAC zone (the router's own docstring: "a central office, several
 * users, one shared country-wide queue"). Which nav entry and route even
 * reach this screen is `shell/navigation.ts`/`routes.tsx`'s job, not this
 * file's — this is a plain HTTP layer.
 */
import { api } from '../../api/client';
import { apiError } from '../../api/errors';
import type { components } from '../../api/schema';

export type ApplicationOut = components['schemas']['ApplicationOut'];
export type BenefitClaimDetailOut = components['schemas']['BenefitClaimDetailOut'];
export type BenefitVerificationStatus = ApplicationOut['benefit_verification_status'];
export type ApplicationPage = components['schemas']['Page_ApplicationOut_'];

/** The three statuses this office may ever see — `not_required` is a valid
 *  value of the wire enum but can never match a row here (the router's own
 *  docstring), so every filter/state in this section is typed against this
 *  narrower union rather than the full `BenefitVerificationStatus`. */
export type CertificateBearingStatus = Exclude<BenefitVerificationStatus, 'not_required'>;

export interface BenefitClaimListParams {
  /** Omitted asks for every status this office may ever see —
   *  `pending`/`verified`/`rejected` — never a filter that always answers
   *  empty. */
  verification_status?: CertificateBearingStatus;
  page: number;
  page_size: number;
}

export async function listBenefitClaims(params: BenefitClaimListParams): Promise<ApplicationPage> {
  const { data, error } = await api.GET('/api/v1/applications/benefit-verifications', {
    params: {
      query: {
        verification_status: params.verification_status,
        page: params.page,
        page_size: params.page_size,
      },
    },
  });
  if (error) throw apiError(error);
  return data;
}

/** 404 `ERR-SYS-003` both for an id that does not exist and for a real
 *  application carrying no certificate-bearing claim — the router's own
 *  docstring: anything else would make this route an application-existence
 *  oracle for a document full of personal data. `getBenefitClaim` does not
 *  distinguish the two either; `apiError` surfaces the one code either way. */
export async function getBenefitClaim(applicationId: string): Promise<BenefitClaimDetailOut> {
  const { data, error } = await api.GET('/api/v1/applications/benefit-verifications/{application_id}', {
    params: { path: { application_id: applicationId } },
  });
  if (error) throw apiError(error);
  return data;
}

/** `pending -> verified`. 409 `ERR-APP-004` (`reason="not_pending"`) if this
 *  claim was already decided — by this office or by another verifier a
 *  moment earlier, since this is one shared queue, not a per-user one. */
export async function verifyBenefitClaim(applicationId: string): Promise<ApplicationOut> {
  const { data, error } = await api.POST('/api/v1/applications/benefit-verifications/{application_id}/verify', {
    params: { path: { application_id: applicationId } },
  });
  if (error) throw apiError(error);
  return data;
}

/** `pending -> rejected`. `reason` is MANDATORY at the wire
 *  (`BenefitClaimRejectIn.reason`, `min_length=1`) — this screen must never
 *  let an empty one reach this call (see `RejectClaimModal.tsx`), but the
 *  server refuses one too (422 `ERR-VAL-001`) as the actual backstop. */
export async function rejectBenefitClaim(applicationId: string, reason: string): Promise<ApplicationOut> {
  const { data, error } = await api.POST('/api/v1/applications/benefit-verifications/{application_id}/reject', {
    params: { path: { application_id: applicationId } },
    body: { reason },
  });
  if (error) throw apiError(error);
  return data;
}
