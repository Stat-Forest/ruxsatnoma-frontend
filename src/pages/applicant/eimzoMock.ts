/**
 * A CLIENT-SIDE stand-in for the E-IMZO desktop/browser plugin, for this demo
 * environment ONLY (`eimzo_mode=mock`, `backend/app/modules/integrations/
 * adapters/eimzo.py`). There is no HTTP endpoint that hands a browser a mock
 * PKCS#7 for arbitrary bytes — `encode_mock_signature` in that adapter is a
 * pytest-only helper, never reachable over the API — so the only way to
 * exercise `POST /applications/{id}/submit` end to end against a real ERI
 * gate is to build the exact envelope `MockEimzo.verify_detached` expects,
 * here, matching its shape byte for byte:
 *
 *   base64url( JSON.stringify({serial_number, issuer, subject, pinfl_or_stir,
 *   valid_from, valid_to, signed_at, timestamp_token, document_sha256}) )
 *
 * `document_sha256` is compared against the SHA-256 of the bytes the caller
 * hands the backend's own `verify_detached(document, pkcs7)` — the backend
 * recomputes the package itself at submit time (ruling 23) rather than
 * trusting a client-supplied copy, so this must be the hash of the EXACT
 * bytes `GET /applications/{id}/package` served a moment before the POST.
 *
 * `pinfl_or_stir` must equal the signer's own `users.pinfl` for a personal
 * (14-digit) certificate (`signatures/service.py::_ownership_reason`) — for
 * this system's individual applicants that is exactly `me.applicant.pinfl`
 * (`auth.service.complete_registration` copies `user.pinfl` there verbatim).
 * A REAL E-IMZO integration replaces this whole file; nothing else in the
 * wizard depends on its internals beyond `buildMockSignature`'s signature.
 */

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_');
}

function encodeMockPayload(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  return toBase64Url(new TextEncoder().encode(json));
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface MockSignatureInput {
  /** The exact bytes just fetched from `GET /applications/{id}/package`. */
  document: ArrayBuffer;
  /** The signer's own personal PINFL (14 digits) — `me.applicant.pinfl`. */
  pinfl: string;
  /** A human name for the mock certificate's `subject` field; cosmetic only. */
  fullName?: string;
}

/** Builds a fresh mock PKCS#7 envelope over `input.document`, good for one
 * `verify_detached` call. A new random serial per call — nothing here binds
 * the certificate to a previous submission attempt, which is fine: the
 * signer's own PINFL is what `_ownership_reason` actually checks. */
export async function buildMockSignature(input: MockSignatureInput): Promise<string> {
  const documentSha256 = await sha256Hex(input.document);
  const now = new Date();
  const validFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const validTo = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const serial = `MOCK-${crypto.randomUUID()}`;
  return encodeMockPayload({
    serial_number: serial,
    issuer: 'MOCK-CA',
    subject: input.fullName ? `CN=${input.fullName}` : `PINFL=${input.pinfl}`,
    pinfl_or_stir: input.pinfl,
    valid_from: validFrom.toISOString(),
    valid_to: validTo.toISOString(),
    signed_at: now.toISOString(),
    timestamp_token: 'MOCK-TS',
    document_sha256: documentSha256,
  });
}
