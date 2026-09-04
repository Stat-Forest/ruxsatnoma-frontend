/**
 * The mock E-IMZO envelope this environment's UI must build itself.
 *
 * E-IMZO is mocked end to end (project status, 2026-09): there is no real
 * signing plugin to call, and the backend's mock adapter
 * (`app/modules/integrations/adapters/eimzo.py`, `MockEimzo.verify_detached`)
 * "treats a base64url JSON envelope as a valid signature" — it decodes the
 * `pkcs7` string as base64url(JSON), reads a fixed set of keys off it, and
 * accepts it as a genuine PKCS#7 stand-in when:
 *   - `sha256(the permit's own stored PDF bytes) === payload.document_sha256`
 *     (never trusts the envelope's own claim of what it signed for anything
 *     but the ATTACHED path, which this UI never uses);
 *   - the serial does not start with `REVOKED-`/`EXPIRED-` (certificate
 *     status, by convention);
 *   - `valid_from <= signed_at <= valid_to`.
 * This module builds exactly that JSON, base64url-encoded the same way
 * Python's `base64.urlsafe_b64encode` does — WITH its `=` padding kept,
 * unlike the usual web convention of stripping it, because
 * `base64.urlsafe_b64decode` on the other end does not tolerate a shortened
 * string.
 *
 * `permits.service._signer_refusal`/`signatures.service._ownership_reason`
 * decide WHO may produce which purpose — this module only builds the
 * envelope; the two files below are what actually enforces identity:
 *   - `app/modules/permits/signers.py` (`PURPOSE_ROLES`, mirrored below)
 *   - `app/modules/signatures/service.py::_ownership_reason` (`pinfl_or_stir`
 *     must equal the signer's own 14-digit PINFL, or a 9-digit STIR the
 *     signer holds an effective representation for)
 */

/** `tz/13` requisites 20-23, in print order — mirrors
 *  `app/modules/permits/signers.py::PURPOSE_ROLES` verbatim. `null` marks the
 *  one purpose that is proven by ownership, not by role
 *  (`RECIPIENT_PURPOSE`). */
export const PURPOSE_ROLE: Record<string, string | null> = {
  permit_head: 'executor_head',
  permit_chief_forester: 'chief_forester',
  permit_accountant: 'accountant',
  permit_recipient: null,
};

export const RECIPIENT_PURPOSE = 'permit_recipient';

/** Display order — a signing UI's order, not a gate: signatures may be taken
 *  in any order (`permits/service.py::add_signature`'s own docstring). */
export const SIGNATURE_ORDER = [
  'permit_head',
  'permit_chief_forester',
  'permit_accountant',
  RECIPIENT_PURPOSE,
] as const;

export const PURPOSE_LABEL: Record<string, string> = {
  permit_head: "Xoʻjalik rahbari",
  permit_chief_forester: "Bosh oʻrmonchi",
  permit_accountant: 'Bosh buxgalter',
  permit_recipient: 'Foydalanuvchi / Arizachi',
};

/** Whether `meRoleCode`/`hasApplicant` gives this viewer any chance at all of
 *  satisfying `purpose` — a UI hint only. The backend re-checks the real
 *  thing (role AND organization for the three official lines; ownership of
 *  the application for the recipient line) on every call regardless. */
export function canAttemptPurpose(
  purpose: string,
  opts: { roleCode: string; isSuperuser: boolean; hasApplicant: boolean },
): boolean {
  if (purpose === RECIPIENT_PURPOSE) return opts.hasApplicant;
  const requiredRole = PURPOSE_ROLE[purpose];
  // No `is_superuser` bypass here, deliberately: `signers.py`'s own docstring
  // says a superuser is refused this check on purpose — "a superuser bypass
  // is about privilege, and this is identity."
  return requiredRole != null && opts.roleCode === requiredRole;
}

function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Standard base64 (`btoa` over the UTF-8 bytes), then swapped to the
 *  URL-safe alphabet — padding kept, matching
 *  `base64.urlsafe_b64encode`/`urlsafe_b64decode`'s own pairing. */
function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_');
}

export interface MockEnvelopeInput {
  /** 14-digit personal PINFL or 9-digit organisation STIR — see the module
   *  docstring; the ONE field a real E-IMZO dialog would ask the signer for. */
  pinflOrStir: string;
  /** The permit's own `doc_hash` — sha256 of the exact stored PDF bytes,
   *  frozen at issuance. This is what `verify_detached` compares against the
   *  bytes it re-hashes server-side; supplying anything else always fails. */
  documentSha256: string;
  subject: string;
}

/** Builds the mock PKCS#7 stand-in `POST /permits/{id}/signatures` expects. */
export function buildMockPkcs7({ pinflOrStir, documentSha256, subject }: MockEnvelopeInput): string {
  const now = new Date();
  const validFrom = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const validTo = new Date(now.getTime() + 365 * 24 * 3600 * 1000);
  const payload = {
    serial_number: `MOCK-CERT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    issuer: 'MOCK-CA',
    subject,
    pinfl_or_stir: pinflOrStir,
    valid_from: validFrom.toISOString(),
    valid_to: validTo.toISOString(),
    signed_at: now.toISOString(),
    timestamp_token: 'MOCK-TS',
    document_sha256: documentSha256,
  };
  return toBase64Url(utf8Bytes(JSON.stringify(payload)));
}

/** `14` for a personal PINFL, `9` for an organisation STIR — the only two
 *  valid lengths `signatures.service._ownership_reason` recognises. */
export function isPlausiblePinflOrStir(value: string): boolean {
  return /^[0-9]{9}$/.test(value) || /^[0-9]{14}$/.test(value);
}
