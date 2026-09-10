import { satisfies } from '../../shell/navigation';

/** The `notifications.object_type` values the inbox can open a page for, and
 * the permissions that send a viewer to the staff screen rather than the
 * citizen's own. The codes mirror `NAVIGATION` in `shell/navigation.ts`
 * (`/applications`, `/permits`) — the same gate that shows the staff list
 * decides which card a staff member lands on. `sys_admin` passes `satisfies`
 * as a superuser and is routed as staff regardless of what codes it holds. */
const STAFF_APPLICATION_PERMISSIONS = [
  'applications.review',
  'applications.decide',
  'applications.view_any',
] as const;
const STAFF_PERMIT_PERMISSION = 'permits.view_any';
const STAFF_PAYMENT_PERMISSIONS = ['payments.view', 'payments.confirm'] as const;

export interface NotificationSubject {
  object_type: string | null;
  object_id: string | null;
}

export type Held = { permissions: string[]; is_superuser: boolean };

/** Where clicking the notification goes, or `null` when it is about nothing
 * the cabinet has a page for (an announcement, a template edit). A staff
 * invoice notification is `null` too: the staff side has an invoice LIST and
 * no card, so there is nothing to open. */
export function notificationTarget(n: NotificationSubject, held: Held): string | null {
  if (!n.object_type || !n.object_id) return null;
  const id = encodeURIComponent(n.object_id);
  switch (n.object_type) {
    case 'application':
      return satisfies(STAFF_APPLICATION_PERMISSIONS, held) ? `/applications/${id}` : `/my/applications/${id}`;
    case 'permit':
      return satisfies(STAFF_PERMIT_PERMISSION, held) ? `/permits/${id}` : `/my/permits/${id}`;
    case 'invoice':
      return satisfies(STAFF_PAYMENT_PERMISSIONS, held) ? null : `/my/invoices/${id}`;
    case 'inspection_task':
      return `/inspections/tasks/${id}`;
    case 'violation_case':
      return `/inspections/cases/${id}`;
    default:
      return null;
  }
}
