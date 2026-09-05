/**
 * A narrow, hand-typed escape hatch for backend routes that exist on
 * `origin/dev` (`ruxsatnoma-core`) but are missing from `src/api/schema.d.ts`
 * because that file was generated when 3.9a-flow/3.11a merged, before
 * 3.9b/3.11b added them — confirmed by reading `app/modules/applications/
 * router.py` (tasks 3-5: `return`, `request-info`, `conclusion`) and
 * `app/modules/permits/lifecycle_router.py` (`suspend`/`resume`/`revoke`)
 * straight from `git show origin/dev:...`, not from plan prose
 * (`docs/plans/06.5-staff-tails.md`).
 *
 * The fleet contract (`docs/plans/04-06-parallel-run.md`) forbids
 * regenerating `schema.d.ts` in this sprint — no other track expects new
 * routes, and a stale regeneration mid-fleet would be a bigger, riskier diff
 * than this track's own screens. So these routes reach the SAME `api`
 * client instance (same session cookie, the same CSRF/session-refresh
 * middleware, the same base URL) through a hand-typed wrapper instead of
 * widening `paths` itself.
 *
 * Every request/response shape a caller passes through `rawPost` is typed
 * BY HAND against the backend's own Pydantic schemas, not generated, and can
 * silently drift if either side changes — mitigated by transcribing field
 * for field with a comment naming the backend file each shape mirrors, and
 * by this sprint's own tests asserting the exact body sent/received.
 *
 * **Delete this file's entries one by one** the day `schema.d.ts` is next
 * regenerated and `paths` carries these routes for real.
 */
import { api } from './client';

interface RawResult<T> {
  data?: T;
  error?: unknown;
}

/**
 * `api.POST`'s own runtime implementation does not care whether the URL is a
 * key of `paths` — that check is TypeScript-only. Casting the client to this
 * narrower shape keeps every OTHER call site in the app fully typed against
 * `paths` while letting these specific, verified-to-exist routes through.
 */
interface RawClient {
  POST: (url: string, options?: Record<string, unknown>) => Promise<RawResult<unknown>>;
}
const raw = api as unknown as RawClient;

/**
 * `url` must be a literal path with no `{placeholder}` segments — build it
 * with the real id already interpolated (the same way `queries.ts::fileUrl`
 * builds a URL by hand elsewhere in this codebase). `options` is whatever
 * `api.POST` itself accepts (`{ body }` is all every caller here needs; none
 * of these routes carry path or query parameters beyond the id already in
 * the URL).
 */
export async function rawPost<T>(url: string, options: Record<string, unknown>): Promise<RawResult<T>> {
  return raw.POST(url, options) as Promise<RawResult<T>>;
}
