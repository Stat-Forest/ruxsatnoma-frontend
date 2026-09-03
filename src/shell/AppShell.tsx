import { useState } from 'react';
import { Outlet } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Bell, LogOut, Menu, RefreshCw, Trees, X } from 'lucide-react';
import { api } from '../api/client';
import { apiError } from '../api/errors';
import { useAuth } from '../auth/useAuth';
import type { UiLanguage } from '../i18n/context';
import { useLanguage, useT } from '../i18n/useT';
import { Nav } from './Nav';

const LANGUAGES: { code: 'uz_latn' | 'ru'; label: string }[] = [
  { code: 'uz_latn', label: 'UZ' },
  { code: 'ru', label: 'RU' },
];

/**
 * `role.name` (`LocalizedName`) is a validated `{backend_lang_code: text}` map —
 * keyed by `uz_cyrl`/`ru`, not by the two UI languages this stage resolves to.
 * There is no stored `uz_latn` translation yet, so the `uz_latn` UI reads the
 * `uz_cyrl` (Cyrillic) source text; ruling R14 accepts this for the two-map stage.
 */
function pickLocalizedName(name: Record<string, unknown>, uiLang: UiLanguage): string {
  const preferred = uiLang === 'ru' ? name.ru : name.uz_cyrl;
  const candidate = preferred ?? name.ru ?? name.uz_cyrl ?? Object.values(name)[0];
  return typeof candidate === 'string' ? candidate : '';
}

/**
 * The shell every authenticated route renders inside (`routes.tsx`): a header,
 * a persistent sidebar at `md` and up, a drawer below it, and the unread-count
 * badge. `RequireAuth` (this component's parent route element) already
 * guarantees `me` is non-null, not blocked, and not mid-MFA before this ever
 * mounts.
 */
export function AppShell() {
  const { me, logout } = useAuth();
  const t = useT();
  const { lang, setLanguage } = useLanguage();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Ruling 10 / task 6 step 4's global rule ("any ERR-AUTH-002 from any query
  // clears the session") is wired once, in `App.tsx`'s `QueryCache.onError` —
  // this query just needs to throw an `ApiError` on failure, which it does.
  const unreadQuery = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/notifications/unread-count', {});
      if (error) throw apiError(error);
      return data;
    },
    retry: false,
    refetchInterval: 30_000,
  });

  if (!me) return null;

  const roleName = pickLocalizedName(me.role.name, lang);
  const unreadCount = unreadQuery.data?.count ?? 0;

  return (
    <div data-testid="app-shell" className="min-h-screen bg-[#F8F9FA] flex flex-col">
      <header className="h-16 bg-white border-b border-[#E4E7EA] sticky top-0 z-40 flex items-center gap-2 px-3 md:px-6 shadow-xs">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label={t('shell.openMenu')}
          className="md:hidden flex items-center justify-center h-11 w-11 rounded-md text-[#5A646D] hover:bg-[#F8F9FA] shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-[#2E7D4F] text-white flex items-center justify-center shadow-xs">
            <Trees className="w-5 h-5" />
          </div>
          <span className="hidden sm:block text-sm font-bold text-[#1A1F24]">ruxsatnoma-urmon.uz</span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center border border-[#767F87] rounded-md overflow-hidden text-xs shrink-0">
          {LANGUAGES.map(({ code, label }) => (
            <button
              key={code}
              type="button"
              onClick={() => void setLanguage(code)}
              aria-pressed={lang === code}
              className={`h-11 min-w-11 px-3 font-semibold ${
                lang === code ? 'bg-[#2E7D4F] text-white' : 'text-[#5A646D] hover:bg-[#F8F9FA]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative flex items-center justify-center h-11 w-11 text-[#5A646D] shrink-0">
          <Bell className="w-5 h-5" />
          {unreadQuery.data !== undefined && (
            <span
              data-testid="unread-badge"
              className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 bg-[#B91C1C] text-white text-[10px] font-bold rounded-full flex items-center justify-center"
            >
              {unreadCount}
            </span>
          )}
        </div>
        <button
          type="button"
          data-testid="refresh-notifications"
          aria-label={t('shell.refresh')}
          onClick={() => void unreadQuery.refetch()}
          className="flex items-center justify-center h-11 w-11 rounded-md text-[#5A646D] hover:bg-[#F8F9FA] shrink-0"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <div className="hidden sm:flex flex-col items-end shrink-0 pl-3 border-l border-[#E4E7EA] max-w-[12rem]">
          <span className="text-xs font-semibold text-[#1A1F24] leading-tight truncate w-full text-right">
            {me.user.full_name}
          </span>
          <span className="text-[11px] text-[#5A646D] truncate w-full text-right">{roleName}</span>
        </div>

        <button
          type="button"
          onClick={() => void logout()}
          aria-label={t('shell.logout')}
          className="flex items-center justify-center h-11 w-11 rounded-md text-[#B91C1C] hover:bg-[#FEF2F2] shrink-0"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <div className="flex flex-1 min-w-0">
        {/* Persistent sidebar — pure CSS (`hidden md:flex`), unaffected by `drawerOpen`. */}
        <aside className="hidden md:flex md:flex-col w-[260px] shrink-0 bg-white border-r border-[#E4E7EA] sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
          <Nav me={me} />
        </aside>

        {/* Mobile drawer — always in the DOM; the `hidden` attribute is the sole
            visibility switch, driven by `drawerOpen` alone (ruling R5). `md:hidden`
            additionally keeps it off at desktop widths in a real browser. */}
        <div data-testid="nav-drawer" hidden={!drawerOpen} className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div className="relative w-72 max-w-[80%] bg-white h-full shadow-2xl flex flex-col">
            <div className="h-16 flex items-center justify-between px-4 border-b border-[#E4E7EA] shrink-0">
              <span className="text-sm font-bold text-[#1A1F24]">ruxsatnoma-urmon.uz</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label={t('shell.closeMenu')}
                className="flex items-center justify-center h-11 w-11 rounded-md text-[#767F87] hover:bg-[#F8F9FA]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Nav me={me} onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        </div>

        <main className="flex-1 min-w-0 p-4 md:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
