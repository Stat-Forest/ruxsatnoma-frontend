import { ShieldAlert } from 'lucide-react';
import { useLanguage } from '../i18n/useT';

const FORBIDDEN_I18N = {
  uz_latn: {
    title: 'Kirish cheklangan',
    message: "Sizda ushbu sahifaga kirish huquqi yo'q.",
    home: 'Bosh sahifaga qaytish',
  },
  uz_cyrl: {
    title: 'Кириш чекланган',
    message: 'Сизда ушбу саҳифага кириш ҳуқуқи йўқ.',
    home: 'Бош саҳифага қайтиш',
  },
  ru: {
    title: 'Доступ ограничен',
    message: 'У вас нет доступа к этой странице.',
    home: 'Вернуться на главную',
  },
  en: {
    title: 'Access restricted',
    message: 'You do not have permission to access this page.',
    home: 'Return to home',
  },
  kaa: {
    title: 'Kiriw sheklengen',
    message: 'Sizde bul betke kiriw huqıqı joq.',
    home: 'Bas betke qaytıw',
  },
};

/** Rendered by RequireAuth when the signed-in user lacks the required permission. */
export function Forbidden() {
  const { lang } = useLanguage();
  const text = FORBIDDEN_I18N[lang as keyof typeof FORBIDDEN_I18N] || FORBIDDEN_I18N.uz_latn;

  return (
    <div className="min-h-[50vh] flex items-center justify-center px-4 py-12 font-sans">
      <div
        data-testid="forbidden"
        className="max-w-md w-full bg-white border border-[#E4E7EA] rounded-2xl p-8 text-center shadow-xs space-y-4"
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FEF2F2] border border-[#FEE2E2] flex items-center justify-center text-[#DC2626]">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#1A1F24]">{text.title}</h2>
          <p className="mt-2 text-sm text-[#5A646D] leading-relaxed">{text.message}</p>
        </div>
        <div className="pt-2">
          <a
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-white bg-[#2E7D4F] hover:bg-[#25633F] rounded-lg transition-colors shadow-xs"
          >
            {text.home}
          </a>
        </div>
      </div>
    </div>
  );
}

