/**
 * H9 — notification templates. Typed wrappers around the five
 * `/admin/notification-templates` routes, in the style of
 * `src/pages/admin/api.ts`: one thin `openapi-fetch` call per route,
 * `if (error) throw apiError(error)`, every type read out of the generated
 * `src/api/schema.d.ts` rather than hand-written.
 *
 * The one thing worth knowing before reading further: **a template is
 * versioned, never overwritten.** The update route is
 * `POST /notification-templates/{template_id}` — the contract calls its
 * operation `supersede_template`, and this module keeps that name, because
 * `updateTemplate` would invite the caller (and the screen's copy) to
 * describe it as editing a row in place. It is not: the old version stays,
 * a new one is created with `version + 1`.
 */
import { api } from '../../../api/client';
import { apiError } from '../../../api/errors';
import type { components } from '../../../api/schema';

export type TemplateOut = components['schemas']['TemplateOut'];
export type TemplateIn = components['schemas']['TemplateIn'];
/** `"inapp" | "sms" | "email"` — declared on the REQUEST body, not on
 *  `TemplateOut`, whose `channel` is a plain `string`. */
export type TemplateChannel = TemplateIn['channel'];
export type LocalizedName = components['schemas']['LocalizedName'];
export type TemplatePage = components['schemas']['Page_TemplateOut_'];

export const TEMPLATE_CHANNELS: readonly TemplateChannel[] = ['inapp', 'sms', 'email'];

/**
 * `TemplateOut.status` is typed `string`, so these three are the register's
 * vocabulary rather than a compiler-checked enum: a template is `active`
 * until a newer version supersedes it or an operator archives it. An unknown
 * value still renders — the screen falls back to printing it verbatim rather
 * than hiding a status it does not recognise.
 */
export const TEMPLATE_STATUSES = ['active', 'superseded', 'archived'] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

type BackendLanguage = components['schemas']['LanguageIn']['language'];

/**
 * Every language the contract declares (`LanguageIn`), Latin-script Uzbek
 * first because that is the primary language of the administration UI.
 * `LocalizedName` itself is `{[key: string]: string}` — it constrains
 * nothing — so the list of languages an editor must offer can only come from
 * `LanguageIn`, the one place the contract names them.
 */
export const TEMPLATE_LANGUAGES = ['uz_latn', 'uz_cyrl', 'ru', 'kaa', 'en'] as const satisfies readonly BackendLanguage[];
export type TemplateLanguage = (typeof TEMPLATE_LANGUAGES)[number];

/** Compile-time guard: the day the contract grows a sixth language, this
 *  alias stops resolving to `true` and the build fails here — rather than the
 *  editor silently dropping a language the backend now expects. */
type _EveryLanguageOffered = Exclude<BackendLanguage, TemplateLanguage> extends never ? true : never;
const _everyLanguageOffered: _EveryLanguageOffered = true;
void _everyLanguageOffered;

export interface TemplateListParams {
  event_code?: string;
  channel?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

export async function listTemplates(params: TemplateListParams): Promise<TemplatePage> {
  const { data, error } = await api.GET('/api/v1/admin/notification-templates', {
    params: { query: params },
  });
  if (error) throw apiError(error);
  return data;
}

export async function getTemplate(templateId: string): Promise<TemplateOut> {
  const { data, error } = await api.GET('/api/v1/admin/notification-templates/{template_id}', {
    params: { path: { template_id: templateId } },
  });
  if (error) throw apiError(error);
  return data;
}

/** Version 1 of a new template. May answer with a `warning` — see below. */
export async function createTemplate(body: TemplateIn): Promise<TemplateOut> {
  const { data, error } = await api.POST('/api/v1/admin/notification-templates', { body });
  if (error) throw apiError(error);
  return data;
}

/**
 * The UPDATE verb — `POST`, not `PATCH`, and it supersedes rather than
 * mutates: the answer is a NEW row with `version + 1`, and the version passed
 * in `template_id` stays exactly as it was.
 *
 * Both this and `createTemplate` may return `warning` — a non-fatal complaint
 * about the template the author just wrote (a placeholder that will not
 * resolve at send time, most often). The save SUCCEEDED; the warning is the
 * backend's only channel for telling the author their text is wrong, so a
 * caller that ignores the field publishes a broken template silently.
 */
export async function supersedeTemplate(templateId: string, body: TemplateIn): Promise<TemplateOut> {
  const { data, error } = await api.POST('/api/v1/admin/notification-templates/{template_id}', {
    params: { path: { template_id: templateId } },
    body,
  });
  if (error) throw apiError(error);
  return data;
}

export async function archiveTemplate(templateId: string): Promise<TemplateOut> {
  const { data, error } = await api.POST('/api/v1/admin/notification-templates/{template_id}/archive', {
    params: { path: { template_id: templateId } },
  });
  if (error) throw apiError(error);
  return data;
}
