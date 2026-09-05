import { useState } from 'react';
import { Outlet } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Bell, LogOut, Menu, RefreshCw, Trees, X } from 'lucide-react';
import { api } from '../api/client';
import { apiError } from '../api/errors';
import { useAuth } from '../auth/useAuth';
import { LANGUAGES } from '../i18n/context';
import type { BackendLanguage, UiLanguage } from '../i18n/context';
import { useLanguage, useT } from '../i18n/useT';
import { Nav } from './Nav';

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
  const { lang, backendLang, setLanguage } = useLanguage();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Ruling 10's global rule ("any ERR-AUTH-002 clears the session") is wired
  // once, in `sessionMiddleware` (`src/api/client.ts`) — this query just
  // needs to reach `api.GET` and let a non-2xx response flow through, which
  // it does via `error` here or the thrown `ApiError` below.
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

        {/*
          A select rather than the two-button toggle this header used to carry:
          five 44px targets do not fit beside the burger, bell and logout at
          375px, which is the width decision #61 verified the shell against.
        */}
        <select
          data-testid="language-select"
          aria-label={t('shell.language')}
          value={backendLang}
          onChange={(event) => {
            // `setLanguage` throws on failure (see `I18nProvider`). The two
            // error codes ruling 10 requires be handled globally (session
            // gone, stale CSRF) are already caught by `sessionMiddleware` in
            // `src/api/client.ts` before they ever reach here; this catch is
            // the backstop against anything else turning into an unhandled
            // promise rejection.
            setLanguage(event.target.value as BackendLanguage).catch((err: unknown) => {
              console.error('Tilni almashtirishda xatolik:', err);
            });
          }}
          className="h-11 shrink-0 rounded-md border border-[#767F87] bg-white px-2 text-xs font-semibold text-[#5A646D] hover:bg-[#F8F9FA]"
        >
          {LANGUAGES.map(({ code, label, title }) => (
            <option key={code} value={code} title={title}>
              {label}
            </option>
          ))}
        </select>

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
