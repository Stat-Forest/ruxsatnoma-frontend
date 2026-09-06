/**
 * The exact bytes an inspection act signs — mirrors
 * `app/modules/inspections/service.py::_act_package_bytes()` byte-for-byte:
 *
 *     payload = {
 *         "act_id": str(act.id),
 *         "inspector_id": str(act.inspector_id),
 *         "occurred_at": act.occurred_at.isoformat(),
 *         "checklist_id": str(act.checklist_id),
 *         "answers": act.answers,
 *         "facts": act.facts,
 *         "result": act.result,
 *     }
 *     return json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
 *
 * **This is NOT `permits/lifecycleDocument.ts`'s shape.** That module's
 * `decisionDocumentJson` overrides `separators=(",", ":")` (compact), which
 * `JSON.stringify`'s no-argument form already matches. `_act_package_bytes`
 * above does NOT override separators, so Python's default applies:
 * `(', ', ': ')` — comma-SPACE between items, colon-SPACE after every key.
 * `JSON.stringify` never produces those spaces, and there is no built-in way
 * to ask it to, so this file builds its own small recursive canonical-JSON
 * serializer instead of `JSON.stringify`+string-replace tricks that would
 * silently corrupt a space that happens to sit inside a string value.
 *
 * `sort_keys=True` in Python sorts every nesting level, not just the top —
 * `answers`/`facts` come back from the API as arbitrary key-ordered objects
 * (a checklist's own question order, or whatever order the facts editor
 * built them in), so the serializer below sorts recursively, at every
 * object it encounters.
 *
 * **If this ever drifts from the Python source, every act signature fails
 * with `ERR-SIGN-001 signature_invalid` and nothing more specific** —
 * `actPackage.test.ts` pins the exact JSON string this function builds, not
 * just that SOME signature gets produced, for exactly that reason.
 */

/** JSON-serializable values only — the same universe `answers`/`facts`
 *  values live in (booleans, numbers, strings, `null`, plus `Object`/`Array`
 *  nesting the API could in principle hand back even though a checklist's
 *  own `bool`/`number`/`text` question types and the facts editor's own
 *  name→text/number pairs never actually produce one in practice). */
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Renders `value` the way Python's `json.dumps(..., sort_keys=True,
 *  ensure_ascii=False)` would: object keys sorted (recursively, at every
 *  level), `", "` between array/object items, `": "` after every object
 *  key, and non-ASCII characters left literal (never `\uXXXX`-escaped —
 *  `JSON.stringify` already agrees with Python here, so no extra work is
 *  needed for that part). */
function canonicalJson(value: JsonValue): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(', ')}]`;
  }
  const keys = Object.keys(value).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}: ${canonicalJson(value[key])}`);
  return `{${entries.join(', ')}}`;
}

export interface ActPackageInput {
  id: string;
  inspectorId: string;
  /** `act.occurred_at.isoformat()`, already as the backend rendered it —
   *  the caller passes `ActOut`/`ActCardOut`'s own `occurred_at` string
   *  straight off the API response, never a freshly-constructed `Date`
   *  (a client-side reformat of an ISO timestamp is not guaranteed to be
   *  byte-identical to Python's own `.isoformat()`). */
  occurredAtIso: string;
  checklistId: string;
  answers: Record<string, unknown>;
  facts: Record<string, unknown>;
  result: string | null;
}

/** Top-level keys are written out in this exact alphabetical order —
 *  `act_id, answers, checklist_id, facts, inspector_id, occurred_at,
 *  result` — rather than relying on object insertion order for anything,
 *  matching `_act_package_bytes`'s own `sort_keys=True`. */
export function actPackageJson(act: ActPackageInput): string {
  const payload: Record<string, JsonValue> = {
    act_id: act.id,
    answers: act.answers as JsonValue,
    checklist_id: act.checklistId,
    facts: act.facts as JsonValue,
    inspector_id: act.inspectorId,
    occurred_at: act.occurredAtIso,
    result: act.result,
  };
  return canonicalJson(payload);
}

/** The UTF-8 bytes of `actPackageJson`, as an `ArrayBuffer` —
 *  `lib/eimzoMock.ts::buildMockSignature`'s own `documentBytes` shape. */
export function actPackageBytes(act: ActPackageInput): ArrayBuffer {
  return new TextEncoder().encode(actPackageJson(act)).buffer as ArrayBuffer;
}
