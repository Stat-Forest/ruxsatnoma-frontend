/**
 * `decisionDocumentJson` must produce BYTE-IDENTICAL JSON to
 * `app/modules/permits/decisions.py::decision_document()` — a mismatch here
 * fails every suspend/resume/revoke with a bare `ERR-SIGN-001
 * signature_invalid` and no more specific reason, so this pins the exact
 * string rather than only checking that a signature gets produced.
 */
import { decisionDocumentJson } from './lifecycleDocument';

test('keys are alphabetical and separators are compact, matching sort_keys=True, separators=(",", ":")', () => {
  const json = decisionDocumentJson({
    permitId: 'p-1',
    series: 'А',
    number: 42,
    toStatus: 'suspended',
    reasonCode: 'PS-01',
    legalBasis: null,
    docFileId: 'f-1',
  });
  expect(json).toBe(
    '{"doc_file_id":"f-1","legal_basis":"","permit_id":"p-1","permit_number":"А № 000042","reason_code":"PS-01","to_status":"suspended"}',
  );
});

test('a null doc_file_id serializes as JSON null, not the string "null"', () => {
  const json = decisionDocumentJson({
    permitId: 'p-1',
    series: 'А',
    number: 42,
    toStatus: 'active',
    reasonCode: 'PS-06',
    legalBasis: null,
    docFileId: null,
  });
  expect(JSON.parse(json).doc_file_id).toBeNull();
});

test('legal_basis is trimmed, matching (legal_basis or "").strip()', () => {
  const json = decisionDocumentJson({
    permitId: 'p-1',
    series: 'А',
    number: 42,
    toStatus: 'revoked',
    reasonCode: 'PS-07',
    legalBasis: '  VMQ 278, 12-band  ',
    docFileId: 'f-2',
  });
  expect(JSON.parse(json).legal_basis).toBe('VMQ 278, 12-band');
});
