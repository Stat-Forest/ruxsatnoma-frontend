import { useState } from 'react';
import { Link, Outlet } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Bell, LogOut, Menu, RefreshCw, Trees, X } from 'lucide-react';
import { api } from '../api/client';
import { apiError } from '../api/errors';
import { useAuth } from '../auth/useAuth';
import type { UiLanguage } from '../i18n/context';
import { useLanguage, useT } from '../i18n/useT';
import { translateTerm } from '../i18n/terms';
import { LanguageMenu } from './LanguageMenu';
import { Nav } from './Nav';

/**
 * `role.name` (`LocalizedName`) is a validated `{backend_lang_code: text}`
 * map. Ruling R14 once accepted a `uz_latn` UI reading the `uz_cyrl` source
 * text here, because `uz_latn` was optional and often unpopulated — decision
 * #90 superseded that: `uz_latn` is now REQUIRED (backfilled first), so it
 * is always there for its own UI to read. F14
 * (`docs/plans/07.3-findings.md`): this stale preference is why the role
 * name in this very header rendered in Cyrillic on an otherwise Uzbek-Latin
 * page.
 */
function pickLocalizedName(name: Record<string, unknown>, uiLang: UiLanguage): string {
  const preferred = name[uiLang] ?? (uiLang === 'ru' ? name.ru : uiLang === 'uz_cyrl' ? name.uz_cyrl : name.uz_latn);
  const candidate = preferred ?? name.uz_latn ?? name.uz_cyrl ?? name.ru ?? Object.values(name)[0];
  const raw = typeof candidate === 'string' ? candidate : '';
  return translateTerm(raw, uiLang);
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

        <LanguageMenu
          value={backendLang}
          label={t('shell.language')}
          onSelect={(code) => {
            // `setLanguage` throws on failure (see `I18nProvider`). The two
            // error codes ruling 10 requires be handled globally (session
            // gone, stale CSRF) are already caught by `sessionMiddleware` in
            // `src/api/client.ts` before they ever reach here; this catch is
            // the backstop against anything else turning into an unhandled
            // promise rejection.
            setLanguage(code).catch((err: unknown) => {
              console.error('Tilni almashtirishda xatolik:', err);
            });
          }}
        />

        {/* C4: the bell now opens the inbox it has always counted for
            (`/notifications` was already a real, ungated `NAVIGATION` entry
            reachable from the side menu — this just makes the header's own
            icon do what it looks like it should). */}
        <Link
          to="/notifications"
          aria-label={t('cabinet.notifications.title')}
          className="relative flex items-center justify-center h-11 w-11 text-[#5A646D] hover:bg-[#F8F9FA] rounded-md shrink-0"
        >
          <Bell className="w-5 h-5" />
          {unreadQuery.data !== undefined && (
            <span
              data-testid="unread-badge"
              className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 bg-[#B91C1C] text-white text-[10px] font-bold rounded-full flex items-center justify-center"
            >
              {unreadCount}
            </span>
          )}
        </Link>
        <button
          type="button"
          data-testid="refresh-notifications"
          aria-label={t('shell.refresh')}
          onClick={() => void unreadQuery.refetch()}
          className="flex items-center justify-center h-11 w-11 rounded-md text-[#5A646D] hover:bg-[#F8F9FA] shrink-0"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <Link
          to="/profile"
          aria-label={t('nav.profile')}
          data-testid="header-profile-link"
          className="hidden sm:flex flex-col items-end shrink-0 pl-3 border-l border-[#E4E7EA] max-w-[12rem] py-1 px-2 rounded-md hover:bg-[#F8F9FA] transition-colors"
        >
          <span className="text-xs font-semibold text-[#1A1F24] hover:text-[#2E7D4F] leading-tight truncate w-full text-right transition-colors">
            {me.user.full_name}
          </span>
          <span className="text-[11px] text-[#5A646D] truncate w-full text-right">{roleName}</span>
        </Link>

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
