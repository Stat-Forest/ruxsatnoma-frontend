import { api } from '../../api/client';
import { apiError } from '../../api/errors';
import type { components } from '../../api/schema';

export type NotificationOut = components['schemas']['NotificationOut'];
export type NotificationsPage = components['schemas']['Page_NotificationOut_'];

export async function listNotifications(params: {
  unread: boolean;
  page: number;
  pageSize: number;
}): Promise<NotificationsPage> {
  const { data, error } = await api.GET('/api/v1/notifications', {
    params: { query: { unread: params.unread, page: params.page, page_size: params.pageSize } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function markNotificationRead(notificationId: string): Promise<NotificationOut> {
  const { data, error } = await api.POST('/api/v1/notifications/{notification_id}/read', {
    params: { path: { notification_id: notificationId } },
  });
  if (error) throw apiError(error);
  return data;
}

export async function markAllNotificationsRead(): Promise<number> {
  const { data, error } = await api.POST('/api/v1/notifications/read-all', {});
  if (error) throw apiError(error);
  return data.updated;
}
