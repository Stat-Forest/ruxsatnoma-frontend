/** Mirrors `app/modules/permits/permissions.py` — verified against that file,
 *  not plan prose, per the project's own lesson on permission codes. Not
 *  imported from `shell/navigation.ts`: that file's codes are the ones a
 *  `NAVIGATION` entry gates, and `permits.issue` gates an ACTION inside an
 *  already-open detail route, never a menu entry. */
export const PERMITS_ISSUE = 'permits.issue';
export const PERMITS_SIGN = 'permits.sign';
export const PERMITS_VIEW_ANY = 'permits.view_any';
