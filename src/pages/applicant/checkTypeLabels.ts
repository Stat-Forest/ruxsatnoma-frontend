import { useT } from '../../i18n/useT';

/** Two vocabularies name the same checks, and neither is optional:
 *
 *   - `application_checks.check_type` (ruling 21, `applications/checks.py`)
 *     is what `POST /applications/precheck` (plan 12, R3 — the wizard's
 *     stateless pre-check over a filing that has no row yet) and the card
 *     answer with — `gis_validity`, `norm_season`, etc.
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
  norm_min_term: 'Minimal muddat',
  // The live preview's own, unmapped names (`norms/checks.py`'s `"check"` field):
  norm: "Me'yoriy parametr mavjudligi",
  season: 'Mavsumga mosligi',
  rotation: 'Almashlab foydalanish qoidasi',
  fire_ban: "Yong'in xavfi taqiqi",
  restrictions: 'Cheklovlar (ogohlantirish)',
  limit: 'Yuklama chegarasi (MaxSB)',
  // Ruling #177 task 3 — the leshoz dictionary's `min_term_days`. Today the
  // live preview is the ONLY place it is seen: `applications.checks.
  // NORM_CHECK_TYPES` has no entry for it, so the recorded pre-check drops
  // the row. `norm_min_term` is the name it will carry once that map (and
  // `CHECK_TYPES`) learns it, listed now so the label does not lapse again.
  min_term: 'Minimal muddat',
};

export const CHECK_RESULT_LABELS: Record<string, string> = {
  pass: "Oʻtdi",
  fail: 'Rad etildi',
  warning: 'Ogohlantirish',
  skipped: "Oʻtkazib yuborildi",
};

export const CHECK_TYPE_I18N_KEYS: Record<string, string> = {
  gis_validity: 'wizard.checks.gis_validity',
  gis_within_fund: 'wizard.checks.gis_within_fund',
  gis_overlap: 'wizard.checks.gis_overlap',
  norm_available: 'wizard.checks.norm_available',
  norm_season: 'wizard.checks.norm_season',
  norm_rotation: 'wizard.checks.norm_rotation',
  norm_fire_ban: 'wizard.checks.norm_fire_ban',
  norm_restrictions: 'wizard.checks.norm_restrictions',
  norm_limit: 'wizard.checks.norm_limit',
  norm_min_term: 'wizard.checks.norm_min_term',
  // The live preview's own, unmapped names (`norms/checks.py`'s `"check"` field):
  norm: 'wizard.checks.norm_available',
  season: 'wizard.checks.norm_season',
  rotation: 'wizard.checks.norm_rotation',
  fire_ban: 'wizard.checks.norm_fire_ban',
  restrictions: 'wizard.checks.norm_restrictions',
  limit: 'wizard.checks.norm_limit',
  min_term: 'wizard.checks.norm_min_term',
};

export const CHECK_RESULT_I18N_KEYS: Record<string, string> = {
  pass: 'wizard.checks.pass',
  fail: 'wizard.checks.fail',
  warning: 'wizard.checks.warning',
  skipped: 'wizard.checks.skipped',
};

export function getCheckTypeLabel(type: string, t: (key: string) => string): string {
  const key = CHECK_TYPE_I18N_KEYS[type];
  return key ? t(key) : (CHECK_TYPE_LABELS[type] ?? type);
}

export function getCheckResultLabel(result: string, t: (key: string) => string): string {
  const key = CHECK_RESULT_I18N_KEYS[result];
  return key ? t(key) : (CHECK_RESULT_LABELS[result] ?? result);
}

export function useCheckLabels() {
  const t = useT();
  return {
    getCheckTypeLabel: (type: string) => getCheckTypeLabel(type, t),
    getCheckResultLabel: (result: string) => getCheckResultLabel(result, t),
  };
}

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

/** Plan 12, R3: a pre-check writes nothing any more, so its rows
 * (`PrecheckCheckOut`) carry no id — keyed by index instead, the same idiom
 * `fromPreviewChecks` below already uses for the live preview's own
 * row-less checks. */
export function fromPrecheckChecks(
  checks: { check_type: string; result: string; details: unknown }[],
): NormalizedCheck[] {
  return checks.map((c, index) => ({ key: `${c.check_type}-${index}`, type: c.check_type, result: c.result, details: c.details }));
}

export function fromPreviewChecks(
  checks: { check: string; result: string; details: unknown }[],
): NormalizedCheck[] {
  return checks.map((c, index) => ({ key: `${c.check}-${index}`, type: c.check, result: c.result, details: c.details }));
}
