/**
 * Small reference-data helpers for this screen's own display needs — this
 * track's own copy rather than an import from `pages/staff/queries.ts` or
 * `pages/search/refs.ts`, per this codebase's established per-track
 * duplication convention (see `pages/search/refs.ts`'s own header comment):
 * each screen keeps its own small copy of a reference-data hook rather than
 * reaching into a page tree another track owns.
 *
 * Both routes need no permission of their own — "form dictionaries for
 * every authenticated user" (`refs_router.py`'s own docstring) — so any
 * `benefits.verify` holder may resolve the activity/doc-type names this
 * screen shows.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { apiError } from '../../api/errors';
import type { components } from '../../api/schema';

export type ActivityTypeOut = components['schemas']['ActivityTypeOut'];
export type ClassifierItemOut = components['schemas']['ClassifierItemOut'];

export function useActivityTypes() {
  return useQuery({
    queryKey: ['benefits', 'refs', 'activity-types'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/refs/activity-types', {});
      if (error) throw apiError(error);
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

/** `doc_types` — the classifier `ApplicationDocumentOut.doc_type_item_id`
 *  belongs to, resolved so the documents list can name an attachment's kind
 *  instead of a bare classifier id (same read `staff/queries.ts::useDocTypes`
 *  makes, duplicated here per this file's own header comment). */
export function useDocTypes() {
  return useQuery({
    queryKey: ['benefits', 'refs', 'classifiers', 'doc_types'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/refs/classifiers/{code}/items', {
        params: { path: { code: 'doc_types' } },
      });
      if (error) throw apiError(error);
      return data;
    },
    staleTime: 10 * 60_000,
  });
}
