/**
 * A browser-side stand-in for E-IMZO document signing, matching the mock
 * adapter's own wire format exactly (`backend/app/modules/integrations
 * /adapters/eimzo.py::_verify_envelope`, `encode_mock_signature`): a
 * base64url-encoded JSON envelope carrying the certificate identity and the
 * sha256 of the bytes that were signed. `EIMZO_MODE=mock` everywhere this
 * runs (decision #46) — the real adapter is stage 5.2, behind a VPN reachable
 * only from inside Uzbekistan. There is no HTTP endpoint that hands a browser
 * a mock PKCS#7 for arbitrary bytes — `encode_mock_signature` in that adapter
 * is a pytest-only helper, never reachable over the API — so this module is
 * the only way to exercise a document-signing route end to end against the
 * mock ERI gate: it builds the exact envelope `MockEimzo.verify_attached`/
 * `verify_detached` expect, here, matching their shape byte for byte.
 *
 * **Why a PINFL field asks the operator to type it.** A real E-IMZO client
 * reads the signer's identity off their own inserted key; nothing here has
 * one to read, and `GET /auth/me` does not expose the caller's own `pinfl`
 * (`UserOut` — `app/modules/auth/schemas.py` — carries only
 * `full_name/login/phone/email/must_change_password/language`). Ownership is
 * proven on the backend by comparing this value against `users.pinfl`
 * (`signatures/service.py::_ownership_reason`) — a personal (14-digit)
 * certificate whose PINFL does not match the signed-in user's own is refused
 * as `signer_pinfl_unknown`/`certificate_pinfl_mismatch`, same as a real
 * mismatched key would be. This module never fakes that verdict: it builds
 * an honest envelope and lets the API decide.
 */

const CODEC_UTF8 = new TextEncoder();

/** `hashlib.sha256(...).hexdigest()`, computed over the exact bytes handed
 * in — never re-encoded — so it matches whatever `verify_detached` hashes
 * server-side. */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** `base64.urlsafe_b64encode(json.dumps(data).encode()).decode()` — the
 * mock codec both `oneid.py` and `eimzo.py` share (`mock_codec.py`). JS's
 * `btoa` works on a binary string, not UTF-8 text directly, hence the escape
 * dance; every field this module writes is ASCII, but the general form is
 * kept honest rather than assuming that stays true forever. */
function base64UrlEncodeJson(data: Record<string, unknown>): string {
  const json = JSON.stringify(data);
  const bytes = CODEC_UTF8.encode(json);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_');
}

export interface MockSignatureInput {
  /** The signer's own personal PINFL — 14 digits, `users.pinfl`. */
  pinfl: string;
  /** The exact bytes `GET /applications/{id}/package` served. */
  documentBytes: ArrayBuffer;
}

/**
 * Builds a detached-signature envelope: `document_b64` is deliberately
 * omitted (the DECISION routes call `signatures.service.sign()` ->
 * `adapter.verify_detached(document=..., pkcs7=...)`, which hashes the
 * caller-supplied `document` and never reads `document_b64` at all — that
 * key only matters for `verify_attached`). A fresh `serial_number` is minted
 * per signature so this never collides with a certificate somebody else's
 * mock session already bound.
 */
export async function buildMockSignature({ pinfl, documentBytes }: MockSignatureInput): Promise<string> {
  const now = new Date();
  const validFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const validTo = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const documentSha256 = await sha256Hex(documentBytes);
  const serial = `MOCK-${crypto.randomUUID()}`;
  return base64UrlEncodeJson({
    serial_number: serial,
    issuer: 'MOCK-CA-DEMO',
    subject: `PINFL=${pinfl}`,
    pinfl_or_stir: pinfl,
    valid_from: validFrom.toISOString(),
    valid_to: validTo.toISOString(),
    signed_at: now.toISOString(),
    timestamp_token: 'MOCK-TS',
    document_sha256: documentSha256,
  });
}

export const PINFL_PATTERN = /^\d{14}$/;

/**
 * The login envelope, which is NOT the document-signing envelope above.
 * `auth.service.login_via_eimzo` calls `verify_signed_challenge`, whose mock
 * is `EimzoIdentity.from_payload(decode_payload(...))` — a dataclass
 * constructor, so an unexpected key raises and a missing optional one must be
 * present as null rather than absent. The fields are exactly
 * `EimzoIdentity`'s: challenge, pinfl, full_name, tin, legal_name,
 * cert_serial, cert_expires_at.
 *
 * `cert_expires_at` is deliberately null: `login_via_eimzo` refuses a
 * certificate whose expiry is in the past, and treats null as "no expiry
 * claimed" rather than expired. A mock that invented a date would be
 * asserting something the mock key cannot know.
 */
export interface MockChallengeInput {
  challenge: string;
  pinfl: string;
  fullName: string;
}

export async function buildMockSignedChallenge({
  challenge,
  pinfl,
  fullName,
}: MockChallengeInput): Promise<string> {
  return base64UrlEncodeJson({
    challenge,
    pinfl,
    full_name: fullName,
    tin: null,
    legal_name: null,
    cert_serial: 'MOCK-CERT',
    cert_expires_at: null,
  });
}
