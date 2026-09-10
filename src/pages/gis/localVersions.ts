/**
 * Mitigation for a real backend gap (plan `06.5-gis-screens.md` ruling 2):
 * there is no `GET .../versions` or `GET .../versions/{id}` route anywhere in
 * `gis/router.py` — a version is visible to the frontend ONLY as the return
 * value of the call that created or last transitioned it. Once a specialist
 * submits a draft for review and reloads the page, or a rahbar is handed the
 * job of approving it, nothing in the API can find that version again until
 * it reaches `published` (`GET /gis/contours/{id}` finally surfaces it then).
 *
 * This is a stopgap, not a fix: it remembers every version response THIS
 * BROWSER has seen, per contour, in `localStorage`, so the panel can
 * reconstruct "the version I was last working on" across a reload in the
 * SAME browser. It does nothing for a rahbar approving from a different
 * machine than the specialist who submitted — the realistic case — which is
 * exactly why the real fix belongs on the backend (a list route, and
 * probably a notification on submit-review the way `import_service` already
 * fires one on parse-finished).
 *
 * A second, smaller gap this same cache papers over: `VersionOut` carries no
 * geometry field at all (confirmed against `gis/schemas.py`) — there is no
 * route that ever hands geometry back for a version that is not yet
 * published (`GET /gis/contours/{id}` answers only the published one). So
 * "show the draft's own shape as a guide while re-drawing it" would be
 * impossible even WITHIN one page session without keeping the geometry the
 * browser itself sent on `POST .../versions` — this cache keeps that too.
 */
import type { Geometry } from 'geojson';
import type { VersionOut } from './api';

export interface RecalledVersion {
  version: VersionOut;
  /** The geometry this browser sent when it created the version — never a
   * value read back from the server, since none exists for anything short
   * of `published`. */
  geometry: Geometry;
}

const PREFIX = 'gis.contour-versions.v1.';

function key(contourId: string): string {
  return `${PREFIX}${contourId}`;
}

/** Every read is wrapped: a private window, cleared site data, or a browser
 * that blocks storage must still render the screen — just with no memory. */
function safeGet(storageKey: string): string | null {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function safeSet(storageKey: string, value: string): void {
  try {
    localStorage.setItem(storageKey, value);
  } catch {
    // Storage full or blocked — the version response the caller already has
    // in memory still works for the rest of this page's lifetime.
  }
}

function readAll(contourId: string): Record<string, RecalledVersion> {
  const raw = safeGet(key(contourId));
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, RecalledVersion>;
  } catch {
    return {};
  }
}

/** Records a version JUST CREATED, together with the geometry this browser
 * sent for it — the only copy of that geometry that will ever exist outside
 * the drawing session, since nothing short of `published` reads it back. */
export function rememberNewVersion(contourId: string, version: VersionOut, geometry: Geometry): void {
  const byId = readAll(contourId);
  byId[version.id] = { version, geometry };
  safeSet(key(contourId), JSON.stringify(byId));
}

/** Records a version's updated fields after a lifecycle transition
 * (submit-review, approve, publish, ...) — none of which change geometry, so
 * the geometry already on file for this id (if any) is kept as-is. Silently
 * a no-op for a version this browser never saw created (nothing to update);
 * that can only happen for a version recalled by some OTHER mechanism this
 * cache does not yet have, which today is none. */
export function rememberVersionUpdate(contourId: string, version: VersionOut): void {
  const byId = readAll(contourId);
  const existing = byId[version.id];
  if (!existing) return;
  byId[version.id] = { version, geometry: existing.geometry };
  safeSet(key(contourId), JSON.stringify(byId));
}

/** Every version this browser has ever recorded for the contour, most
 * recently touched first — "touched" meaning last WRITTEN here, which lines
 * up with the lifecycle order since every transition re-records its result. */
export function recalledVersions(contourId: string): RecalledVersion[] {
  return Object.values(readAll(contourId)).sort((a, b) => (a.version.id < b.version.id ? 1 : -1));
}

/** The one version worth defaulting the panel to: whichever recalled version
 * is NOT terminal (published/archived), so a specialist reopening the page
 * lands back on the version still moving through the lifecycle rather than
 * an old finished one. `undefined` when there is nothing to recall or every
 * recalled version has already reached a terminal state. */
export function activeRecalledVersion(contourId: string): RecalledVersion | undefined {
  return recalledVersions(contourId).find(
    (entry) => entry.version.status !== 'published' && entry.version.status !== 'archived',
  );
}

export interface RecalledPendingVersion {
  contourId: string;
  version: VersionOut;
}

/** Recalls all non-terminal versions awaiting review/approval across all contours
 * recorded in this browser's localStorage cache. */
export function recalledPendingReviewVersions(): RecalledPendingVersion[] {
  const result: RecalledPendingVersion[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) {
        const contourId = k.slice(PREFIX.length);
        const versions = recalledVersions(contourId);
        for (const entry of versions) {
          if (entry.version.status === 'review') {
            result.push({ contourId, version: entry.version });
          }
        }
      }
    }
  } catch {
    // localStorage unavailable
  }
  return result.sort((a, b) => (a.version.id < b.version.id ? 1 : -1));
}
