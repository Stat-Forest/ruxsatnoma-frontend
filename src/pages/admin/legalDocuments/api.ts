/**
 * Typed wrappers around the six `/admin/legal-documents` routes this screen
 * calls, in the style of `announcements/api.ts` — `openapi-fetch`, every type
 * taken from the generated `src/api/schema.d.ts`, never hand-written.
 *
 * The anonymous `/public/legal-documents` pair is deliberately absent: it
 * carries neither `status` nor `sort_order`, and those two are what this
 * screen exists to manage.
 */
import { api } from '../../../api/client';
import { apiError } from '../../../api/errors';
import type { components } from '../../../api/schema';

export type LegalDocumentAdminOut = components['schemas']['LegalDocumentAdminOut'];
export type LegalDocumentCreateIn = components['schemas']['LegalDocumentCreateIn'];
export type LegalDocumentPatchIn = components['schemas']['LegalDocumentPatchIn'];
export type LegalDocumentPage = components['schemas']['Page_LegalDocumentAdminOut_'];
export type LocalizedName = components['schemas']['LocalizedName'];
export type FileOut = components['schemas']['FileOut'];

export type BackendLanguage = components['schemas']['LanguageIn']['language'];
/** `uz_latn` leads: it is the primary language of the system and the one
 *  `LocalizedName` requires (core decision #90). */
export const DOCUMENT_LANGUAGES: readonly BackendLanguage[] = [
  'uz_latn',
  'uz_cyrl',
  'ru',
  'kaa',
  'en',
];

/** `status` is a bare `string` in the contract — these are the three values
 *  the lifecycle produces. */
export type LegalDocumentStatus = 'draft' | 'published' | 'archived';

export interface LegalDocumentListParams {
  status?: LegalDocumentStatus | '';
  page: number;
  page_size: number;
}

export async function listLegalDocuments(
  params: LegalDocumentListParams,
): Promise<LegalDocumentPage> {
  const { data, error } = await api.GET('/api/v1/admin/legal-documents', {
    params: {
      query: {
        status: params.status || undefined,
        page: params.page,
        page_size: params.page_size,
      },
    },
  });
  if (error) throw apiError(error);
  return data;
}

export async function getLegalDocument(docId: string): Promise<LegalDocumentAdminOut> {
  const { data, error } = await api.GET('/api/v1/admin/legal-documents/{doc_id}', {
    params: { path: { doc_id: docId } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function createLegalDocument(
  body: LegalDocumentCreateIn,
): Promise<LegalDocumentAdminOut> {
  const { data, error } = await api.POST('/api/v1/admin/legal-documents', { body });
  if (error) throw apiError(error);
  return data;
}

/** PATCH with `exclude_unset=True` on the backend: only the keys actually
 *  present are touched, so an edit cannot silently blank a field this form
 *  did not show. */
export async function patchLegalDocument(
  docId: string,
  body: LegalDocumentPatchIn,
): Promise<LegalDocumentAdminOut> {
  const { data, error } = await api.PATCH('/api/v1/admin/legal-documents/{doc_id}', {
    params: { path: { doc_id: docId } },
    body,
  });
  if (error) throw apiError(error);
  return data;
}

/** The one action that reaches citizens: a published row appears on the
 *  public site's /documents page. The backend refuses it when the row has
 *  neither a file nor a link (`ERR-VAL-001 nothing_to_open`). */
export async function publishLegalDocument(docId: string): Promise<LegalDocumentAdminOut> {
  const { data, error } = await api.POST('/api/v1/admin/legal-documents/{doc_id}/publish', {
    params: { path: { doc_id: docId } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function archiveLegalDocument(docId: string): Promise<LegalDocumentAdminOut> {
  const { data, error } = await api.POST('/api/v1/admin/legal-documents/{doc_id}/archive', {
    params: { path: { doc_id: docId } },
  });
  if (error) throw apiError(error);
  return data;
}

/** `POST /files` is multipart — the same cast-through-FormData idiom
 *  `admin/profile/representation/api.ts::uploadPoaFile` uses. */
export async function uploadDocumentFile(file: File): Promise<FileOut> {
  const form = new FormData();
  form.append('file', file);
  const { data, error } = await api.POST('/api/v1/files', {
    body: form as unknown as { file: string },
  });
  if (error) throw apiError(error);
  return data;
}
