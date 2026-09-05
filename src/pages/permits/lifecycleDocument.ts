/**
 * The exact bytes a permit lifecycle decision (suspend/resume/revoke) signs
 * — mirrors `app/modules/permits/decisions.py::decision_document()`
 * byte-for-byte, since (unlike `submit`/`approve`/`reject`) there is no
 * `/package`-style route that serves them ready-made: `decide()` builds
 * `document` from data it already has and hands it straight to
 * `signatures.service.sign()`, which re-hashes it server-side and compares
 * that hash to the envelope's own `document_sha256` — the client's job is
 * to reconstruct the SAME bytes independently, not to fetch them.
 *
 * `decision_document()`'s own Python:
 *
 *     json.dumps(
 *         {
 *             "permit_id": str(permit.id),
 *             "permit_number": service._permit_number(permit.series, permit.number),
 *             "to_status": to_status,
 *             "reason_code": reason_code,
 *             "legal_basis": (legal_basis or "").strip(),
 *             "doc_file_id": None if doc_file_id is None else str(doc_file_id),
 *         },
 *         sort_keys=True, ensure_ascii=False, separators=(",", ":"),
 *     ).encode("utf-8")
 *
 * Reproduced here by building a plain object with its keys ALREADY in
 * alphabetical order (`doc_file_id, legal_basis, permit_id, permit_number,
 * reason_code, to_status`) — `JSON.stringify` preserves string-key
 * insertion order, and its no-argument form already matches Python's
 * `separators=(",", ":")` (no extra whitespace). `permit_number` reuses the
 * EXISTING `formatPermitNumber()` (`${series} № ${number.padStart(6,'0')}`),
 * already byte-identical to Python's `f"{series} № {number:06d}"`.
 *
 * **If this ever drifts from the Python source, every suspend/resume/revoke
 * fails with `ERR-SIGN-001 signature_invalid` and nothing more specific** —
 * `lifecycleDocument.test.ts` pins the exact JSON string this function
 * builds, not just that SOME signature gets produced, for exactly that
 * reason.
 */
import { formatPermitNumber } from './format';

export interface DecisionDocumentInput {
  permitId: string;
  series: string;
  number: number;
  toStatus: 'suspended' | 'active' | 'revoked';
  reasonCode: string;
  legalBasis: string | null;
  docFileId: string | null;
}

export function decisionDocumentJson(input: DecisionDocumentInput): string {
  const ordered: Record<string, string | null> = {
    doc_file_id: input.docFileId,
    legal_basis: (input.legalBasis ?? '').trim(),
    permit_id: input.permitId,
    permit_number: formatPermitNumber(input.series, input.number),
    reason_code: input.reasonCode,
    to_status: input.toStatus,
  };
  return JSON.stringify(ordered);
}

/** The UTF-8 bytes of `decisionDocumentJson`, as an `ArrayBuffer` —
 *  `lib/eimzoMock.ts::buildMockSignature`'s own `documentBytes` shape. */
export function decisionDocumentBytes(input: DecisionDocumentInput): ArrayBuffer {
  return new TextEncoder().encode(decisionDocumentJson(input)).buffer as ArrayBuffer;
}
