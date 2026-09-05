import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from './api';

const NOTIFICATIONS_KEY = ['notifications'] as const;
/** The SAME key `AppShell.tsx`'s header badge queries — invalidating this
 * one on every read/read-all is what makes the badge count drop the moment
 * this screen marks something read, without a manual poll. */
const UNREAD_COUNT_KEY = ['notifications', 'unread-count'] as const;

export function useNotifications(params: { unread: boolean; page: number; pageSize: number }) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'list', params],
    queryFn: () => listNotifications(params),
  });
}

function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    void queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
  };
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({ mutationFn: markNotificationRead, onSuccess: invalidate });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({ mutationFn: markAllNotificationsRead, onSuccess: invalidate });
}
