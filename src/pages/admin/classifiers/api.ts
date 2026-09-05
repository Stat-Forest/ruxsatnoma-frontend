/**
 * Data layer for H6 — the classifier routes of `app/modules/admin`, in the
 * same shape as `src/pages/admin/api.ts` (openapi-fetch, `if (error) throw
 * apiError(error)`, every type read out of the generated schema).
 *
 * Kept next to the screen rather than added to `src/pages/admin/api.ts`: that
 * module is owned by another worker this sprint, and these six wrappers are
 * used by exactly one screen.
 *
 * TWO FACTS ABOUT THE CONTRACT THAT SHAPE THE WHOLE SCREEN
 *
 * 1. **There is no route that lists classifiers.** `POST /admin/classifiers`
 *    creates one and `GET /refs/classifiers/{code}/items` reads one by code,
 *    but nothing enumerates them — so the code is picked from a known list
 *    (`KNOWN_CLASSIFIER_CODES`, the six the migrations seed) or typed.
 *
 * 2. **`GET /refs/classifiers/{code}/items` is a point-in-time read, and it
 *    never returns archived rows for today.** `admin/repo.py::list_classifier_items`
 *    filters to `valid_from <= day <= valid_to` and, when `on_date` is omitted
 *    or is today-or-later, additionally to `status = 'active'`. Only a PAST
 *    `on_date` drops the status filter — which is precisely how a superseded
 *    (now `archived`) version becomes visible again: as what WAS in force that
 *    day. `include_archived` exists in the repo but is not exposed on the
 *    route, so "show me everything ever" is not something this screen can ask
 *    for; back-dating is the whole mechanism, and the screen says so.
 */
import { api } from '../../../api/client';
import { apiError } from '../../../api/errors';
import type { components } from '../../../api/schema';

export type ClassifierItemOut = components['schemas']['ClassifierItemOut'];
export type ClassifierItemIn = components['schemas']['ClassifierItemIn'];
export type ClassifierItemPatch = components['schemas']['ClassifierItemPatch'];
export type ClassifierIn = components['schemas']['ClassifierIn'];
export type LocalizedName = components['schemas']['LocalizedName'];

/**
 * Items of one classifier as of `onDate` (omitted = today, active only).
 * A past date returns the rows that were in force then, archived ones
 * included — see the module note above.
 */
export async function listClassifierItems(
  code: string,
  onDate?: string,
): Promise<ClassifierItemOut[]> {
  const { data, error } = await api.GET('/api/v1/refs/classifiers/{code}/items', {
    params: { path: { code }, query: { on_date: onDate || undefined } },
  });
  if (error) throw apiError(error);
  return data;
}

/** Creates the classifier itself — no items. 201 with an untyped body
 *  (`dict[str, Any]` on the route), which the screen does not read. */
export async function createClassifier(body: ClassifierIn): Promise<void> {
  const { error } = await api.POST('/api/v1/admin/classifiers', { body });
  if (error) throw apiError(error);
}

export async function addClassifierItem(
  code: string,
  body: ClassifierItemIn,
): Promise<ClassifierItemOut> {
  const { data, error } = await api.POST('/api/v1/admin/classifiers/{code}/items', {
    params: { path: { code } },
    body,
  });
  if (error) throw apiError(error);
  return data;
}

/** Presentation only. `code` and `valid_from` are absent from
 *  `ClassifierItemPatch` by design: changing what a code MEANS is a supersede,
 *  not an update (`admin/service.py::update_classifier_item`, ruling 7). */
export async function patchClassifierItem(
  itemId: string,
  body: ClassifierItemPatch,
): Promise<ClassifierItemOut> {
  const { data, error } = await api.PATCH('/api/v1/admin/classifier-items/{item_id}', {
    params: { path: { item_id: itemId } },
    body,
  });
  if (error) throw apiError(error);
  return data;
}

/** Closes the item: `status` becomes `archived` and `valid_to` is set to
 *  yesterday (clamped to never precede `valid_from`). The row is never
 *  deleted — a permit issued under it still has to resolve. */
export async function archiveClassifierItem(itemId: string): Promise<ClassifierItemOut> {
  const { data, error } = await api.POST('/api/v1/admin/classifier-items/{item_id}/archive', {
    params: { path: { item_id: itemId } },
  });
  if (error) throw apiError(error);
  return data;
}

/**
 * The successor, NOT an edit of `itemId`.
 *
 * The body is a whole `ClassifierItemIn` — the new version — and the route
 * returns **201 with the NEW item**, not the old one. The service
 * (`admin/service.py::supersede_classifier_item`) closes the old row at
 * `valid_from - 1 day`, archives it, then inserts the new row, all in one
 * transaction so the partial unique index never sees two active rows for the
 * same code. It refuses when the old row is already archived, when
 * `body.code !== old.code`, and when `body.valid_from <= (old.valid_to ??
 * old.valid_from)` — so the successor's code is fixed and its start date must
 * be strictly later than the predecessor's close.
 */
export async function supersedeClassifierItem(
  itemId: string,
  body: ClassifierItemIn,
): Promise<ClassifierItemOut> {
  const { data, error } = await api.POST('/api/v1/admin/classifier-items/{item_id}/supersede', {
    params: { path: { item_id: itemId } },
    body,
  });
  if (error) throw apiError(error);
  return data;
}
