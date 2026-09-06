/**
 * The exact bytes `POST /reports/{id}/sign` signs — mirrors
 * `app/modules/reports/service.py::_report_bytes` byte for byte. There is no
 * `/package`-style route that serves them ready-made (unlike
 * `applications`' decision routes): `sign_report` builds `document` from the
 * report row it already has and hands it straight to
 * `signatures.service.sign()`, which re-hashes it server-side and compares
 * that hash to the mock envelope's own `document_sha256` — this module's job
 * is to reconstruct the SAME bytes independently, not to fetch them.
 *
 * Safe to build from the currently-loaded `ReportOut` (never a fresh fetch):
 * a report's `data` cannot change between `submitted` and `sign`/`return` —
 * `service._assert_editable` blocks `generate`/`PATCH data` outside
 * `created`/`returned` — so whatever this screen already has loaded for a
 * `submitted` report is exactly what the server will read at sign time.
 *
 * **If this ever drifts from the Python source, every sign attempt fails
 * with `ERR-SIGN-001 signer_not_authorized`** — no, wait: it fails with a
 * signature-verification mismatch inside `sign()`, surfaced as whatever
 * `signatures.service.sign()` raises for a hash mismatch — either way, an
 * opaque failure with no clue this file is the cause. `reportDocument.test.ts`
 * pins the exact JSON string this function builds for that reason.
 */

export interface ReportDocumentInput {
  reportId: string;
  formId: string;
  organizationId: string;
  /** `YYYY-MM-DD`, the wire value straight from `ReportOut` — Python's
   *  `date.isoformat()` produces exactly this shape already. */
  periodStart: string;
  periodEnd: string;
  versionNo: number;
  /** `ReportOut.data` verbatim — whatever the API last returned. */
  data: Record<string, unknown>;
}

/** Recursively sorts object keys (never array order) with no whitespace —
 *  `json.dumps(..., sort_keys=True, separators=(",", ":"), ensure_ascii=False)`'s
 *  exact shape. `null`/`undefined` both serialize to `null` (Python `None`);
 *  `typeof null === 'object'` in JS, so the null/undefined check MUST run
 *  before the array/object branches, not after. */
function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(obj[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

export function reportDocumentJson(input: ReportDocumentInput): string {
  const payload = {
    report_id: input.reportId,
    form_id: input.formId,
    organization_id: input.organizationId,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    version_no: input.versionNo,
    data: input.data,
  };
  return canonicalJson(payload);
}

/** The UTF-8 bytes of `reportDocumentJson` — `eimzoMock.ts::buildMockSignature`'s
 *  own `documentBytes` shape. */
export function reportDocumentBytes(input: ReportDocumentInput): ArrayBuffer {
  return new TextEncoder().encode(reportDocumentJson(input)).buffer as ArrayBuffer;
}
