/** Two vocabularies name the same checks, and neither is optional:
 *
 *   - `application_checks.check_type` (ruling 21, `applications/checks.py`)
 *     is what `POST /applications/{id}/precheck` and the card answer with —
 *     `gis_validity`, `norm_season`, etc.
 *   - `norms.checks.CheckResult.check` (`norms/checks.py`) is the RAW,
 *     UNMAPPED name `POST /calculations/preview` answers with instead —
 *     `season`, `rotation`, `norm`, `fire_ban`, `restrictions`, `limit`, with
 *     no `gis_*` entries at all (the live preview never runs GIS's checks,
 *     only `norms.service.preview`'s own). Ruling 21's mapping is applied
 *     inside `applications.checks.run_all`, which the live preview never
 *     calls — so a client reading `POST /calculations/preview` sees the
 *     PRE-mapping vocabulary, not the one `design/03` documents for the
 *     card.
 *
 * Both sets of keys live in one map so `ChecksList` can render either
 * response without knowing which endpoint produced it. */
export const CHECK_TYPE_LABELS: Record<string, string> = {
  gis_validity: 'Kontur geometriyasi toʻgʻriligi',
  gis_within_fund: "Oʻrmon fondi chegarasida ekanligi",
  gis_overlap: "Boshqa ruxsatnoma bilan kesishuv",
  norm_available: "Me'yoriy parametr mavjudligi",
  norm_season: 'Mavsumga mosligi',
  norm_rotation: 'Almashlab foydalanish qoidasi',
  norm_fire_ban: "Yong'in xavfi taqiqi",
  norm_restrictions: 'Cheklovlar (ogohlantirish)',
  norm_limit: 'Yuklama chegarasi (MaxSB)',
  // The live preview's own, unmapped names (`norms/checks.py`'s `"check"` field):
  norm: "Me'yoriy parametr mavjudligi",
  season: 'Mavsumga mosligi',
  rotation: 'Almashlab foydalanish qoidasi',
  fire_ban: "Yong'in xavfi taqiqi",
  restrictions: 'Cheklovlar (ogohlantirish)',
  limit: 'Yuklama chegarasi (MaxSB)',
};

export const CHECK_RESULT_LABELS: Record<string, string> = {
  pass: "Oʻtdi",
  fail: 'Rad etildi',
  warning: 'Ogohlantirish',
  skipped: "Oʻtkazib yuborildi",
};

/** One check, in the shape `ChecksList` (a component file, and so — per
 * `react-refresh/only-export-components` — barred from also exporting plain
 * functions) actually renders. Kept here, next to the two vocabularies it
 * reconciles, rather than in `ChecksList.tsx` itself. */
export interface NormalizedCheck {
  key: string;
  type: string;
  result: string;
  details: unknown;
}

export function fromApplicationChecks(
  checks: { id: string; check_type: string; result: string; details: unknown }[],
): NormalizedCheck[] {
  return checks.map((c) => ({ key: c.id, type: c.check_type, result: c.result, details: c.details }));
}

export function fromPreviewChecks(
  checks: { check: string; result: string; details: unknown }[],
): NormalizedCheck[] {
  return checks.map((c, index) => ({ key: `${c.check}-${index}`, type: c.check, result: c.result, details: c.details }));
}
