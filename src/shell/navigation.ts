import type { ComponentType } from 'react';
import {
  Award,
  Bell,
  BookMarked,
  Building2,
  FileText,
  Home,
  Inbox,
  LifeBuoy,
  MailPlus,
  Map,
  Megaphone,
  Radio,
  Scale,
  Settings,
  ShieldCheck,
  Stamp,
  User,
  Users,
  Wallet,
} from 'lucide-react';

export type NavItem = {
  to: string;
  labelKey: string;
  /**
   * The permission(s) that open this entry. An ARRAY means "any one of these
   * is enough" — never "all of them". Two roles reach the same staff screen
   * through different rights far more often than the singular field suggested:
   * `executor_head` holds `applications.decide` and NOT `applications.review`,
   * so a lone `review` code hid the worklist from the very person whose
   * approval the workflow waits on, while the page itself handled him fine.
   */
  permission?: string | readonly string[];
  icon: ComponentType<{ className?: string }>;
};

/** True when `held` satisfies `required` — any one of them, or no requirement. */
export function satisfies(
  required: string | readonly string[] | undefined,
  held: { permissions: string[]; is_superuser: boolean },
): boolean {
  if (!required) return true;
  if (held.is_superuser) return true;
  const needed = typeof required === 'string' ? [required] : required;
  return needed.some((code) => held.permissions.includes(code));
}

/**
 * Every later stage (6.1-6.5) adds its screens by appending an entry here and a
 * matching child route in `routes.tsx` — nothing else about the shell changes shape.
 *
 * Every `permission` code below was checked against `app/modules/*permissions.py`
 * on 2026-09-03 and exists (`GET /api/v1/admin/permissions` is the live source of
 * truth). A code that does not exist hides its menu entry from everyone, silently
 * and forever, because `visibleNav` simply never matches it and nothing throws.
 *
 * `/my/applications` and `/my/permits` carry no permission code, deliberately:
 * they are scoped by ownership (the backend narrows the list to the caller), not
 * by a code, so a citizen always sees their own documents. `/applications` and
 * `/permits` are the staff equivalents — seeing *everyone's* is a different
 * right from seeing *one's own*, and merging the two pairs is a real defect in
 * either direction. `/applications` lists BOTH staff codes because the reviewer
 * and the approver are different people holding different rights.
 */
export const NAVIGATION: NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: Home },
  { to: '/my/applications', labelKey: 'nav.myApplications', icon: FileText },
  { to: '/my/permits', labelKey: 'nav.myPermits', icon: Award },
  {
    to: '/applications',
    labelKey: 'nav.applications',
    // Both the reviewer and the approver, who hold DIFFERENT codes — see
    // `NavItem.permission`. The backend agrees: `applications.decide` is
    // `executor_head`'s (migration 0015, left in place by 0016). Plus
    // `applications.view_any` (I1, migration 0015 grants it to `prosecutor`
    // alone): `service._holds_staff_read`/`list_applications` already zone-
    // scope and serve that caller, so leaving this array at just the two
    // review codes hid a screen the backend already supported — the same
    // omission `/permits` below did NOT make for its own `.view_any`.
    permission: ['applications.review', 'applications.decide', 'applications.view_any'],
    icon: Inbox,
  },
  // Any ONE of the three (`NavItem.permission` semantics): the GIS
  // specialist holds `contours.manage`, the rahbar/chief_forester who
  // approves versions and import batches holds only `contours.approve`, and
  // a `central_admin` who only maintains layer objects holds only
  // `layers.manage` (`gis/permissions.py`) — gating on the specialist's code
  // alone would hide the whole page, approve buttons included, from the
  // other two (stage 6.5, track F1).
  {
    to: '/gis',
    labelKey: 'nav.gis',
    permission: ['gis.contours.manage', 'gis.contours.approve', 'gis.layers.manage'],
    icon: Map,
  },
  // Two DIFFERENT permissions reach the three tabs behind this one entry:
  // rule parameters and tariffs are gated on `norms.tariffs.manage`, not
  // `norms.manage` — see `NavItem.permission`. Before this array, the
  // account that maintains grazing coefficients held only the tariffs code
  // and could not see this menu entry at all (ruling R1, task 2).
  { to: '/norms', labelKey: 'nav.norms', permission: ['norms.manage', 'norms.tariffs.manage'], icon: Scale },
  // `payments.confirm` is `executor_head`'s own code (migration 0022), NOT
  // `payments.view` — the same reviewer/approver asymmetry `/applications`
  // already documents below. Without it here, the checker half of G4's
  // manual-PAID maker-checker flow and G5's refund approval have no page to
  // stand on at all (06.5-accountant.md ruling R4).
  { to: '/invoices', labelKey: 'nav.invoices', permission: ['payments.view', 'payments.confirm'], icon: Wallet },
  { to: '/permits', labelKey: 'nav.permits', permission: 'permits.view_any', icon: Stamp },
  { to: '/admin/users', labelKey: 'nav.users', permission: 'auth.users.manage', icon: Users },
  { to: '/admin/roles', labelKey: 'nav.roles', permission: 'auth.users.manage', icon: ShieldCheck },
  { to: '/admin/organizations', labelKey: 'nav.organizations', permission: 'admin.organizations.manage', icon: Building2 },
  { to: '/admin/classifiers', labelKey: 'nav.classifiers', permission: 'admin.classifiers.manage', icon: BookMarked },
  { to: '/admin/settings', labelKey: 'nav.settings', permission: 'admin.settings.manage', icon: Settings },
  { to: '/admin/announcements', labelKey: 'nav.announcements', permission: 'admin.announcements.manage', icon: Megaphone },
  { to: '/admin/notification-templates', labelKey: 'nav.templates', permission: 'notifications.templates.manage', icon: MailPlus },
  { to: '/admin/integrations', labelKey: 'nav.integrations', permission: 'admin.integrations.view', icon: Radio },
  { to: '/notifications', labelKey: 'nav.notifications', icon: Bell },
  { to: '/support', labelKey: 'nav.support', icon: LifeBuoy },
  { to: '/profile', labelKey: 'nav.profile', icon: User },
];

/**
 * The backend answers `GET /auth/me` with the caller's *effective* permissions
 * (role grants plus personal grants — 3.3b) and `is_superuser`, true only for
 * `sys_admin`, whose gate passes without consulting codes at all. Building the
 * menu from anything else (a hard-coded per-role table, the way the design
 * reference's `lib/permissions.ts` does it) cannot express either.
 */
export function visibleNav(me: { permissions: string[]; is_superuser: boolean }): NavItem[] {
  return NAVIGATION.filter((item) => satisfies(item.permission, me));
}
