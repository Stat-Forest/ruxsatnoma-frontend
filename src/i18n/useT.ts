import { useContext } from 'react';
import { I18nContext } from './context';

import { uz_latn } from './uz_latn';

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) return (key: string) => (uz_latn as Record<string, string>)[key] ?? key;
  return ctx.t;
}

export function useLanguage() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      lang: 'uz_latn' as const,
      backendLang: 'uz_latn' as const,
      setLanguage: async () => {},
    };
  }
  return { lang: ctx.lang, backendLang: ctx.backendLang, setLanguage: ctx.setLanguage };
}
