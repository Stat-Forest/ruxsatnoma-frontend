/**
 * `actPackageJson` must produce BYTE-IDENTICAL JSON to
 * `app/modules/inspections/service.py::_act_package_bytes()` — a mismatch
 * here fails every act signature with a bare `ERR-SIGN-001
 * signature_invalid` and no more specific reason, so this pins the exact
 * string (spaces included) rather than only checking that a signature gets
 * produced.
 */
import { actPackageJson } from './actPackage';

test('keys are alphabetical and separators match sort_keys=True, ensure_ascii=False (default separators)', () => {
  const json = actPackageJson({
    id: 'a-1',
    inspectorId: 'i-1',
    occurredAtIso: '2026-09-01T10:00:00+05:00',
    checklistId: 'c-1',
    answers: { q2: true, q1: 12 },
    facts: { area_ha: 3.5 },
    result: 'compliant',
  });
  expect(json).toBe(
    '{"act_id": "a-1", "answers": {"q1": 12, "q2": true}, "checklist_id": "c-1", ' +
      '"facts": {"area_ha": 3.5}, "inspector_id": "i-1", ' +
      '"occurred_at": "2026-09-01T10:00:00+05:00", "result": "compliant"}',
  );
});

test('a null result serializes as JSON null, not the string "null"', () => {
  const json = actPackageJson({
    id: 'a-1',
    inspectorId: 'i-1',
    occurredAtIso: '2026-09-01T10:00:00+05:00',
    checklistId: 'c-1',
    answers: {},
    facts: {},
    result: null,
  });
  expect(JSON.parse(json).result).toBeNull();
  expect(json).toContain('"result": null');
  expect(json).not.toContain('"result": "null"');
});

test('a non-ASCII value inside answers appears literally, matching ensure_ascii=False', () => {
  const json = actPackageJson({
    id: 'a-1',
    inspectorId: 'i-1',
    occurredAtIso: '2026-09-01T10:00:00+05:00',
    checklistId: 'c-1',
    answers: { note: 'наблюдение' },
    facts: {},
    result: 'warning',
  });
  expect(json).toContain('"наблюдение"');
  expect(json).not.toContain('\\u');
});

test('nested keys inside answers are sorted too, not just the top level', () => {
  const json = actPackageJson({
    id: 'a-1',
    inspectorId: 'i-1',
    occurredAtIso: '2026-09-01T10:00:00+05:00',
    checklistId: 'c-1',
    answers: { zeta: 1, alpha: 2, middle: 3 },
    facts: {},
    result: null,
  });
  const answersStart = json.indexOf('"answers": {');
  const answersSlice = json.slice(answersStart, json.indexOf('}', answersStart) + 1);
  expect(answersSlice).toBe('"answers": {"alpha": 2, "middle": 3, "zeta": 1}');
});

/**
 * The stage 7.3 defect (finding F18): every act signature was refused with
 * `ERR-SIGN-001 signature_invalid`, on dev and everywhere else, because the
 * API publishes `occurred_at` in the `Z` form while the backend signs
 * `datetime.isoformat()`, which renders a UTC offset as `+00:00`. The column
 * is `DateTime(timezone=True)` (`0026_inspections.py`), so SQLAlchemy hands
 * the service an AWARE datetime and the two renderings differ by four
 * characters — enough to change the sha256 and nothing else.
 *
 * Every test above fed this function an offset string (`+05:00`), which is
 * what Python produces and NOT what the API serves, so the mirror was pinned
 * against the right string for an input the client never receives.
 */
test('a Z timestamp — what the API actually serves — is rendered the way isoformat() does', () => {
  const json = actPackageJson({
    id: 'a-1',
    inspectorId: 'i-1',
    occurredAtIso: '2026-09-06T16:34:37.126000Z',
    checklistId: 'c-1',
    answers: {},
    facts: {},
    result: 'compliant',
  });
  expect(json).toContain('"occurred_at": "2026-09-06T16:34:37.126000+00:00"');
  expect(json).not.toContain('Z"');
});

test('an offset the API already renders as an offset is left exactly as it is', () => {
  const json = actPackageJson({
    id: 'a-1',
    inspectorId: 'i-1',
    occurredAtIso: '2026-09-01T10:00:00+05:00',
    checklistId: 'c-1',
    answers: {},
    facts: {},
    result: null,
  });
  expect(json).toContain('"occurred_at": "2026-09-01T10:00:00+05:00"');
});

test('a Z inside a VALUE is untouched — only the timestamp is rewritten', () => {
  const json = actPackageJson({
    id: 'a-1',
    inspectorId: 'i-1',
    occurredAtIso: '2026-09-06T16:34:37Z',
    checklistId: 'c-1',
    answers: { note: 'GAZ na uchastke' },
    facts: {},
    result: null,
  });
  expect(json).toContain('"occurred_at": "2026-09-06T16:34:37+00:00"');
  expect(json).toContain('"note": "GAZ na uchastke"');
});
