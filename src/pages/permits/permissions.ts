/** Mirrors `app/modules/permits/permissions.py` — verified against that file,
 *  not plan prose, per the project's own lesson on permission codes. Not
 *  imported from `shell/navigation.ts`: that file's codes are the ones a
 *  `NAVIGATION` entry gates, and `permits.issue` gates an ACTION inside an
 *  already-open detail route, never a menu entry. */
export const PERMITS_ISSUE = 'permits.issue';
export const PERMITS_SIGN = 'permits.sign';
export const PERMITS_VIEW_ANY = 'permits.view_any';
/** E3 (3.11b) — suspend/resume/revoke, `executor_head` alone (migration
 *  0019's own reservation; `_decision_signer_refusal` additionally checks
 *  the signer's role AND organization match the permit's own). */
export const PERMITS_MANAGE = 'permits.manage';
