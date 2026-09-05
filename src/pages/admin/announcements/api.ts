/**
 * Typed wrappers around the six `/admin/announcements` routes screen H8 calls,
 * in the style of `src/pages/admin/api.ts` — `openapi-fetch`, every type taken
 * from the generated `src/api/schema.d.ts`, never hand-written.
 *
 * Kept local to this folder rather than added to the area module: the six
 * routes are this screen's alone, and the announcements track is built in
 * parallel with the other eight admin screens.
 *
 * The reader-facing `GET /announcements` pair is deliberately absent — the
 * admin list is the only one that carries `status`, `audience` and
 * `created_by`, and those three are what this screen exists to manage.
 */
import { api } from '../../../api/client';
import { apiError } from '../../../api/errors';
import type { components } from '../../../api/schema';

export type AnnouncementAdminOut = components['schemas']['AnnouncementAdminOut'];
export type AnnouncementCreateIn = components['schemas']['AnnouncementCreateIn'];
export type AnnouncementPatchIn = components['schemas']['AnnouncementPatchIn'];
export type AnnouncementPage = components['schemas']['Page_AnnouncementAdminOut_'];
export type LocalizedName = components['schemas']['LocalizedName'];
/** `{role_codes?, region_ids?}` — the WHOLE targeting vocabulary the backend
 *  has (`Announcement.audience` jsonb). No organizations, no per-user lists. */
export type AudienceIn = components['schemas']['AudienceIn'];

/**
 * The five codes the contract enumerates (`LanguageIn.language`) — the only
 * place in the schema where the languages are named at all, since
 * `LocalizedName` itself is an open `{[key: string]: string}` map. Typed
 * against that union, so a code the backend drops becomes a compile error
 * here rather than a silently unsent field.
 *
 * `uz_latn` leads: Latin-script Uzbek is the primary language of the system,
 * and it is the one the form marks required.
 */
export type BackendLanguage = components['schemas']['LanguageIn']['language'];
export const ANNOUNCEMENT_LANGUAGES: readonly BackendLanguage[] = [
  'uz_latn',
  'uz_cyrl',
  'ru',
  'kaa',
  'en',
];

/** `AnnouncementAdminOut.status` is a bare `string` in the contract, not an
 *  enum — these are the three values the lifecycle produces. */
export type AnnouncementStatus = 'draft' | 'published' | 'archived';

export interface AnnouncementListParams {
  /** The route's one filter. Omitted means every status, not just drafts. */
  status?: AnnouncementStatus | '';
  page: number;
  page_size: number;
}

export async function listAnnouncements(params: AnnouncementListParams): Promise<AnnouncementPage> {
  const { data, error } = await api.GET('/api/v1/admin/announcements', {
    params: { query: { status: params.status || undefined, page: params.page, page_size: params.page_size } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function getAnnouncement(announcementId: string): Promise<AnnouncementAdminOut> {
  const { data, error } = await api.GET('/api/v1/admin/announcements/{announcement_id}', {
    params: { path: { announcement_id: announcementId } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function createAnnouncement(body: AnnouncementCreateIn): Promise<AnnouncementAdminOut> {
  const { data, error } = await api.POST('/api/v1/admin/announcements', { body });
  if (error) throw apiError(error);
  return data;
}

/** PATCH, not POST — and `exclude_unset=True` on the backend, so only the keys
 *  actually present are touched. `file_ids` is never sent by this screen,
 *  which is what keeps an edit from wiping an announcement's attachments. */
export async function patchAnnouncement(
  announcementId: string,
  body: AnnouncementPatchIn,
): Promise<AnnouncementAdminOut> {
  const { data, error } = await api.PATCH('/api/v1/admin/announcements/{announcement_id}', {
    params: { path: { announcement_id: announcementId } },
    body,
  });
  if (error) throw apiError(error);
  return data;
}

/** The one action that reaches real people — bodyless, irreversible in the
 *  sense that matters (the readers have already seen it). */
export async function publishAnnouncement(announcementId: string): Promise<AnnouncementAdminOut> {
  const { data, error } = await api.POST('/api/v1/admin/announcements/{announcement_id}/publish', {
    params: { path: { announcement_id: announcementId } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function archiveAnnouncement(announcementId: string): Promise<AnnouncementAdminOut> {
  const { data, error } = await api.POST('/api/v1/admin/announcements/{announcement_id}/archive', {
    params: { path: { announcement_id: announcementId } },
  });
  if (error) throw apiError(error);
  return data;
}

/**
 * `AnnouncementAdminOut.audience` comes back as an untyped `{[key: string]:
 * unknown} | null` (jsonb), so it is read defensively rather than cast — the
 * same defensive posture `applicant/format.ts::pickName` takes with names.
 * `null`, `{}` and a rule with two empty lists all mean the same thing:
 * everybody.
 */
export function readAudience(audience: AnnouncementAdminOut['audience']): {
  roleCodes: string[];
  regionIds: string[];
} {
  const roleCodes = stringList(audience?.role_codes);
  const regionIds = stringList(audience?.region_ids);
  return { roleCodes, regionIds };
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item !== '');
}
