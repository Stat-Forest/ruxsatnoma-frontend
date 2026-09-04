import { ApiError } from '../../api/errors';

/**
 * Normalizes anything a `try { await api.X(...) } catch` can produce into an
 * `ApiError`. An awaited `api.*` call whose response carries `{error}` is
 * already turned into a real `ApiError` by `src/api/errors.ts::apiError`
 * (every call site in this track does `if (error) throw apiError(error)`) —
 * but a network-level failure (no response at all: a dropped connection, a
 * CORS misconfiguration) throws a plain `TypeError` instead, and a `catch`
 * block should not have to tell the two apart before reading
 * `.code`/`.message`.
 */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  return new ApiError('ERR-SYS-000', err instanceof Error ? err.message : 'Kutilmagan xatolik yuz berdi');
}
