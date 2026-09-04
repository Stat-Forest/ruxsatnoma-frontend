import { createContext } from 'react';
import type { components } from '../api/schema';
import { ru } from './ru';
import { uz_latn } from './uz_latn';

export type BackendLanguage = components['schemas']['LanguageIn']['language'];
export type UiLanguage = 'uz_latn' | 'ru';
export type TranslationKey = keyof typeof uz_latn;

// `Record<TranslationKey, string>` makes a key present in one map but missing
// from the other a compile error, not a silent runtime fallback.
export const DICTIONARIES: Record<UiLanguage, Record<TranslationKey, string>> = { uz_latn, ru };

/**
 * Maps all five backend language codes (`LanguageIn`) onto the two UI
 * dictionaries this stage ships (ruling R14). `uz_cyrl`, `kaa` and `en` fall
 * back to `uz_latn` until a later stage adds its own map — add a file next to
 * `uz_latn.ts` and one row here, nothing else changes shape.
 */
const LANGUAGE_MAP: Record<string, UiLanguage> = {
  uz_cyrl: 'uz_latn',
  uz_latn: 'uz_latn',
  ru: 'ru',
  kaa: 'uz_latn',
  en: 'uz_latn',
};

export function resolveLanguage(code: string): UiLanguage {
  return LANGUAGE_MAP[code] ?? 'uz_latn';
}

export interface I18nContextValue {
  lang: UiLanguage;
  t: (key: string) => string;
  setLanguage: (code: BackendLanguage) => Promise<void>;
}

export const I18nContext = createContext<I18nContextValue | null>(null);
