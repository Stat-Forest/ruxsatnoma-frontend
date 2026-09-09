import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Pagination, Tabs } from '../../components/ui/Navigation';
import { useT } from '../../i18n/useT';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from './queries';
import { formatDateTime } from './format';

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
 */
export function NotificationsPage() {
  const t = useT();
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
    <div className="max-w-2xl space-y-4 pb-8">
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

      {!query.isLoading && items.length === 0 && (
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
          {items.map((n) => (
            <li
              key={n.id}
              data-testid={`notification-${n.id}`}
              className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 transition-colors ${
                n.read_at ? '' : 'bg-[#F0F7F1] border-l-4 border-l-[#2E7D4F]'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {n.subject && <p className="text-sm font-semibold text-[#1A1F24]">{n.subject}</p>}
                  {!n.read_at && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-[#DCFCE7] text-[#15803D]">
                      {t('cabinet.notifications.filterUnread')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#1A1F24] break-words">{n.text}</p>
                <p className="text-xs text-[#5A646D] mt-1">{formatDateTime(n.created_at)}</p>
              </div>
              {!n.read_at && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid={`mark-read-${n.id}`}
                  disabled={markRead.isPending}
                  onClick={() => markRead.mutate(n.id)}
                  className="shrink-0 self-end sm:self-auto w-full sm:w-auto justify-center"
                >
                  {t('cabinet.notifications.markRead')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalRecords={total} />
      )}
    </div>
  );
}
