import { useContext } from 'react';
import { I18nContext } from './context';

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used within an I18nProvider');
  return ctx.t;
}

export function useLanguage() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      lang: 'uz_latn' as const,
      backendLang: 'uz' as const,
      setLanguage: () => {},
    };
  }
  return { lang: ctx.lang, backendLang: ctx.backendLang, setLanguage: ctx.setLanguage };
}
