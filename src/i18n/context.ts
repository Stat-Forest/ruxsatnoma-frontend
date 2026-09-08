import { createContext } from 'react';
import type { components } from '../api/schema';
import { en } from './en';
import { kaa } from './kaa';
import { ru } from './ru';
import { uz_cyrl } from './uz_cyrl';
import { uz_latn } from './uz_latn';

export type BackendLanguage = components['schemas']['LanguageIn']['language'];
export type UiLanguage = 'uz_latn' | 'uz_cyrl' | 'ru' | 'kaa' | 'en';
export type TranslationKey = keyof typeof uz_latn;

// `Record<TranslationKey, string>` makes a key present in one map but missing
// from the other a compile error, not a silent runtime fallback.
export const DICTIONARIES: Record<UiLanguage, Record<TranslationKey, string>> = {
  uz_latn,
  uz_cyrl,
  ru,
  kaa,
  en,
};

/**
 * Maps all five backend language codes (`LanguageIn`) onto the UI dictionaries.
 */
const LANGUAGE_MAP: Record<string, UiLanguage> = {
  uz_cyrl: 'uz_cyrl',
  uz_latn: 'uz_latn',
  ru: 'ru',
  kaa: 'kaa',
  en: 'en',
};

export function resolveLanguage(code: string): UiLanguage {
  return LANGUAGE_MAP[code] ?? 'uz_latn';
}

/**
 * Every language the backend accepts (`LanguageIn`), in the order the header
 * switcher offers them, with the short label it renders. Decision #18 requires
 * all five to be offered from V1; only `uz_latn` and `ru` have a string map of
 * their own, so the other three render translated copy through
 * `resolveLanguage()`'s fallback while still being the user's stored language —
 * which is what makes server-side text (notifications, documents) arrive in it.
 */
export const LANGUAGES: { code: BackendLanguage; label: string; title: string }[] = [
  { code: 'uz_cyrl', label: 'ЎЗ', title: 'Ўзбекча (кирилл)' },
  { code: 'uz_latn', label: 'UZ', title: 'Oʻzbekcha (lotin)' },
  { code: 'ru', label: 'RU', title: 'Русский' },
  { code: 'kaa', label: 'ҚҚ', title: 'Qaraqalpaqsha' },
  { code: 'en', label: 'EN', title: 'English' },
];

/**
 * `MeOut.language` is typed as a plain `string`, so an unknown code (an older
 * account, a language added server-side before a map exists here) must not
 * become a `<select>` value that matches no option — the browser would render
 * an empty box. Anything unrecognised normalises to `uz_latn`, the same
 * fallback `resolveLanguage()` applies to the dictionary.
 */
export function normalizeBackendLanguage(code: string | undefined): BackendLanguage {
  return LANGUAGES.some((language) => language.code === code)
    ? (code as BackendLanguage)
    : 'uz_latn';
}

export interface I18nContextValue {
  /** The dictionary in use — a fallback of `backendLang`, never a superset of it. */
  lang: UiLanguage;
  /** The user's own stored code, which the switcher shows as selected. */
  backendLang: BackendLanguage;
  t: (key: string) => string;
  setLanguage: (code: BackendLanguage) => Promise<void>;
}

export const I18nContext = createContext<I18nContextValue | null>(null);
