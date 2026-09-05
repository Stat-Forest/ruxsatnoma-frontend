import type { CheckResultOut } from '../api';

/** `gis/checks.py::BLOCKING` mirrored client-side (re-checked against the
 * backend file, not memorised): `validity`/`within_fund`/`overlap` are data
 * defects that block publication; `restrictions` is ALWAYS a warning — an
 * intersection with a restriction/protection/fire-ban layer means grazing
 * there is limited, not impossible, and the decision belongs to `norms`
 * (3.7) and the application review (3.9), which read these same rows. Never
 * move a check between the two sets here without the same move landing in
 * `checks.py` first — this list exists to RENDER the backend's own split,
 * not to invent one. */
export const BLOCKING_CHECKS = new Set(['validity', 'within_fund', 'overlap']);

export const CHECK_LABEL_KEYS: Record<string, string> = {
  validity: 'gis.versions.checks.validity',
  within_fund: 'gis.versions.checks.withinFund',
  overlap: 'gis.versions.checks.overlap',
  restrictions: 'gis.versions.checks.restrictions',
};

export function isBlockedByChecks(checks: CheckResultOut[]): boolean {
  return checks.some((c) => BLOCKING_CHECKS.has(c.check) && c.result === 'fail');
}
