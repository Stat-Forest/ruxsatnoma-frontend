/**
 * Typed wrappers around the four FAQ routes (`help.router`/`help.admin_router`
 * — the reader's `GET /help/faq` is anonymous and rate-limited; the other
 * three sit behind `help.faq.manage`), in the style of
 * `src/pages/admin/announcements/api.ts` — `openapi-fetch`, every type taken
 * from the generated `src/api/schema.d.ts`, never hand-written.
 *
 * `FaqOut.question`/`.answer` are `LocalizedName` (`app.core.schemas`), whose
 * validator requires a non-blank `uz_cyrl` key — NOT `uz_latn`, unlike
 * `AnnouncementCreateIn.title`'s own convention. `FaqFormModal.tsx` mirrors
 * that rule client-side; nothing in this file needs to know it.
 */
import { api } from '../../../api/client';
import { apiError } from '../../../api/errors';
import type { components } from '../../../api/schema';

export type FaqOut = components['schemas']['FaqOut'];
export type FaqIn = components['schemas']['FaqIn'];
export type FaqPatch = components['schemas']['FaqPatch'];

/** `FaqOut.status`/`FaqPatch.status` are a bare `string` in the contract,
 *  not an enum — these are the three values the lifecycle produces
 *  (`help.schemas.FaqPatch.status`'s own regex). */
export type FaqStatus = 'draft' | 'published' | 'archived';

export async function listPublicFaq(category?: string): Promise<FaqOut[]> {
  const { data, error } = await api.GET('/api/v1/help/faq', {
    params: { query: { category: category || undefined } },
  });
  if (error) throw apiError(error);
  return data;
}

/** Omitted `status` means every status, not just drafts — the same
 *  no-filter-means-everything convention `AnnouncementListParams.status`
 *  documents for its own admin list. */
export async function listFaqAdmin(status?: string): Promise<FaqOut[]> {
  const { data, error } = await api.GET('/api/v1/admin/help/faq', {
    params: { query: { status: status || undefined } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function createFaq(body: FaqIn): Promise<FaqOut> {
  const { data, error } = await api.POST('/api/v1/admin/help/faq', { body });
  if (error) throw apiError(error);
  return data;
}

/** PATCH, not POST — and `exclude_unset=True` on the backend
 *  (`help.service.update_faq`), so only the keys actually present are
 *  touched. The quick "publish"/"archive" row actions rely on exactly this:
 *  `{status: 'published'}` alone, leaving `question`/`answer`/`category`
 *  untouched. */
export async function patchFaq(faqId: string, body: FaqPatch): Promise<FaqOut> {
  const { data, error } = await api.PATCH('/api/v1/admin/help/faq/{faq_id}', {
    params: { path: { faq_id: faqId } },
    body,
  });
  if (error) throw apiError(error);
  return data;
}
