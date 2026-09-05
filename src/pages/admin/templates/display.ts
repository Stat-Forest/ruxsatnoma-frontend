/**
 * The three enum-ish strings this screen renders — channel, status, language
 * — turned into label text, plus the badge tone a status maps onto.
 *
 * `TemplateOut.channel` and `TemplateOut.status` are typed `string` in the
 * contract, so every one of these degrades to printing the raw value rather
 * than showing an empty cell for something the backend added yesterday.
 */
import type { StatusType } from '../../../components/ui/StatusBadge';
import type { TemplateLanguage } from './api';
import type { TemplateLabels } from './labels';

export function channelLabel(channel: string, L: TemplateLabels): string {
  switch (channel) {
    case 'inapp':
      return L.channelInapp;
    case 'sms':
      return L.channelSms;
    case 'email':
      return L.channelEmail;
    default:
      return channel;
  }
}

export function statusLabel(status: string, L: TemplateLabels): string {
  switch (status) {
    case 'active':
      return L.statusActive;
    case 'superseded':
      return L.statusSuperseded;
    case 'archived':
      return L.statusArchived;
    default:
      return status;
  }
}

export function statusTone(status: string): StatusType {
  switch (status) {
    case 'active':
      return 'approved';
    case 'superseded':
      return 'info';
    case 'archived':
      return 'draft';
    default:
      return 'draft';
  }
}

export function languageLabel(language: TemplateLanguage, L: TemplateLabels): string {
  switch (language) {
    case 'uz_latn':
      return L.langUzLatn;
    case 'uz_cyrl':
      return L.langUzCyrl;
    case 'ru':
      return L.langRu;
    case 'kaa':
      return L.langKaa;
    case 'en':
      return L.langEn;
  }
}

/** A `dict[str, Any]` off the wire read as `{lang: text}` — anything that is
 *  not a string is dropped rather than rendered as `[object Object]`. */
export function readLocalized(value: { [key: string]: unknown } | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!value) return out;
  for (const [key, text] of Object.entries(value)) {
    if (typeof text === 'string') out[key] = text;
  }
  return out;
}

/** Drops the empty languages: a template carrying `{"kaa": ""}` would tell
 *  the sender a Karakalpak text exists when it does not. */
export function trimLocalized(value: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(value).filter(([, text]) => text.trim() !== ''));
}
