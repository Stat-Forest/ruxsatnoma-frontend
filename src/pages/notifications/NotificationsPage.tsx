import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight, Bell, Check, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Pagination, Tabs } from '../../components/ui/Navigation';
import { useAuth } from '../../auth/useAuth';
import { useLanguage, useT } from '../../i18n/useT';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { ApiError } from '../../api/errors';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from './queries';
import { formatDateTime } from './format';
import { notificationTarget } from './target';
import { NotificationText } from './NotificationText';
import { TransitionChips } from './TransitionChips';
import { translateNotification, translateNotificationSubject } from './translateNotification';

const PAGE_SIZE = 20;

type Filter = 'all' | 'unread';

/**
 * C4 — notifications inbox. `GET /notifications` (`unread` filter, paged),
 * `POST /notifications/{id}/read`, `POST /notifications/read-all`
 * (`notifications/router.py`). Was a one-line placeholder
 * (`src/pages/placeholders.tsx`); `/notifications` was already a real,
 * ungated `NAVIGATION` entry with nothing behind it.
 *
 * Marking something read here invalidates the SAME query key
 * (`['notifications', 'unread-count']`) `AppShell.tsx`'s header badge polls
 * — see `queries.ts` — so the badge count drops immediately, not on its
 * next 30-second refetch.
 *
 * A row is a link to what it is about (`target.ts` — the citizen's card or
 * the staff one, by permission); opening an unread row marks it read on the
 * way. The "from -> to" chips under the text come from
 * `params.status_from`/`status_to` (`TransitionChips.tsx`).
 */
export function NotificationsPage() {
  const t = useT();
  const { lang } = useLanguage();
  const { me } = useAuth();
  const held = { permissions: me?.permissions ?? [], is_superuser: me?.is_superuser ?? false };
  const errorText = useApiErrorText();
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);

  const query = useNotifications({ unread: filter === 'unread', page, pageSize: PAGE_SIZE });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function changeFilter(id: string) {
    setFilter(id as Filter);
    setPage(1);
  }

  return (
    <div className="max-w-2xl space-y-4 pb-8" data-testid="notifications-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-[#1A1F24]">{t('cabinet.notifications.title')}</h1>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="mark-all-read"
          disabled={markAllRead.isPending}
          isLoading={markAllRead.isPending}
          onClick={() => markAllRead.mutate()}
          className="w-full sm:w-auto justify-center"
        >
          {markAllRead.isPending ? t('cabinet.notifications.markingAll') : t('cabinet.notifications.markAllRead')}
        </Button>
      </div>

      <Tabs
        tabs={[
          { id: 'all', label: t('cabinet.notifications.filterAll') },
          { id: 'unread', label: t('cabinet.notifications.filterUnread') },
        ]}
        activeTabId={filter}
        onChange={changeFilter}
      />

      {markAllRead.isError && (
        <div
          role="alert"
          data-testid="notifications-action-error"
          className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] p-3 text-xs text-[#991B1B]"
        >
          {markAllRead.error instanceof ApiError ? errorText(markAllRead.error) : t('cabinet.notifications.actionFailed')}
        </div>
      )}

      {query.isError && (
        <div
          role="alert"
          data-testid="notifications-error"
          className="rounded-2xl border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]"
        >
          {query.error instanceof ApiError ? errorText(query.error) : t('cabinet.notifications.loadFailed')}
        </div>
      )}

      {query.isLoading && (
        <div
          data-testid="notifications-loading"
          className="flex flex-col items-center gap-2 py-12 text-center text-[#5A646D]"
        >
          <Loader2 className="w-8 h-8 animate-spin text-[#2E7D4F]" />
          <p className="text-sm">{t('cabinet.notifications.loading')}</p>
        </div>
      )}

      {!query.isLoading && !query.isError && items.length === 0 && (
        <div
          data-testid="notifications-empty"
          className="flex flex-col items-center gap-2 py-12 text-center text-[#5A646D]"
        >
          <Bell className="w-8 h-8 opacity-40" />
          <p className="text-sm">{t('cabinet.notifications.empty')}</p>
        </div>
      )}

      {items.length > 0 && (
        <ul className="bg-white border border-[#E4E7EA] rounded-2xl divide-y divide-[#E4E7EA] overflow-hidden">
          {items.map((n) => {
            const target = notificationTarget(n, held);
            const body = (
              <>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {n.subject && (
                    <p className="text-sm font-semibold text-[#1A1F24]">
                      {translateNotificationSubject(n.subject, lang)}
                    </p>
                  )}
                  {!n.read_at && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-[#DCFCE7] text-[#15803D]">
                      {t('cabinet.notifications.filterUnread')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#1A1F24] break-words">
                  <NotificationText text={translateNotification(n.text, lang)} params={n.params} />
                </p>
                <TransitionChips
                  objectType={n.object_type}
                  params={n.params}
                  lang={lang}
                  testId={`notification-transition-${n.id}`}
                />
                <p className="text-xs text-[#5A646D] mt-1">{formatDateTime(n.created_at)}</p>
              </>
            );
            return (
              <li
                key={n.id}
                data-testid={`notification-${n.id}`}
                className={`p-3.5 sm:p-4 flex items-start justify-between gap-3 transition-colors ${
                  n.read_at ? '' : 'bg-[#F0F7F1] border-l-4 border-l-[#2E7D4F]'
                } ${target ? 'hover:bg-[#F8F9FA]' : ''}`}
              >
                {target ? (
                  <Link
                    to={target}
                    data-testid={`notification-link-${n.id}`}
                    // Fire-and-forget: the card is what the click is for, and
                    // the badge/list invalidation in `queries.ts` catches up
                    // on its own. A failure here only leaves the row unread.
                    onClick={() => {
                      if (!n.read_at) markRead.mutate(n.id);
                    }}
                    className="min-w-0 flex-1 flex items-start justify-between gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D4F] rounded-md"
                  >
                    <div className="min-w-0 flex-1">{body}</div>
                    <ArrowUpRight className="w-4 h-4 mt-0.5 text-[#9AA3AB] shrink-0" aria-hidden="true" />
                  </Link>
                ) : (
                  <div className="min-w-0 flex-1">{body}</div>
                )}
                {!n.read_at && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    data-testid={`mark-read-${n.id}`}
                    aria-label={t('cabinet.notifications.markRead')}
                    title={t('cabinet.notifications.markRead')}
                    disabled={markRead.isPending}
                    isLoading={markRead.isPending && markRead.variables === n.id}
                    onClick={() => markRead.mutate(n.id)}
                    className="shrink-0 !px-2 rounded-full"
                  >
                    {!(markRead.isPending && markRead.variables === n.id) && <Check className="w-4 h-4" aria-hidden="true" />}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {items.length > 0 && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalRecords={total} />
      )}
    </div>
  );
}
