import type { ComponentType } from 'react';
import {
  Archive,
  Award,
  Bell,
  BookMarked,
  Building2,
  ClipboardList,
  ClipboardCheck,
  FileText,
  Home,
  Inbox,
  LifeBuoy,
  MailPlus,
  Map,
  Megaphone,
  Radio,
  Scale,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Stamp,
  Star,
  Trees,
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
 * `/my/permits` carries no permission code, deliberately: it is scoped by
 * ownership (the backend narrows the list to the caller), not by a code, so a
 * citizen always sees their own documents. `/applications` and `/permits` are
 * the staff equivalents — seeing *everyone's* is a different right from
 * seeing *one's own*, and merging the two pairs is a real defect in either
 * direction. `/applications` lists BOTH staff codes because the reviewer and
 * the approver are different people holding different rights.
 *
 * `/my/applications` DOES carry a code, `applications.create` — the demo of
 * 2026-09-10 (Odilxon's remark 1) found every staff role could open this
 * screen and its «New application» button, which then failed on the first
 * call the wizard makes with a 403: filing is the applicant's own action, not
 * something ownership-scoping narrows for a role that files nothing. The
 * card behind an existing application (`my/applications/:id`, `routes.tsx`)
 * stays ungated — a representative or a role reading a specific record by id
 * is a different question from seeing the whole list and its create button.
 */
export const NAVIGATION: NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: Home },
  { to: '/my/applications', labelKey: 'nav.myApplications', permission: 'applications.create', icon: FileText },
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
  // С22's read-only register (task 2, stage 6.7 J3) — `central_admin`,
  // `leadership`, `executor_head` (zone-scoped to their own organization) and
  // `prosecutor` all hold `oversight.view` (migration 0028); `sys_admin`
  // passes as superuser. No other code opens this screen — it is a single
  // gate, unlike `/applications`'s reviewer/approver pair above.
  { to: '/oversight', labelKey: 'nav.oversight', permission: 'oversight.view', icon: ShieldAlert },
  // Stage 6.9 (T69, `docs/plans/04.5-4.7-search-archive.md`) — cross-entity
  // search over applications/permits, one `kind` per call. `search.use` is
  // the module's one permission code (plan ruling 3), granted to
  // `central_admin`, `leadership`, `executor_head`, `executor_staff` and
  // `prosecutor` (migration 0029) — no narrower per-kind code exists.
  { to: '/search', labelKey: 'nav.search', permission: 'search.use', icon: Search },
  // F23 (`docs/plans/07.3-findings.md`, stage 6.9): `archive.manage` used to
  // gate BOTH the read (the register, one item) and the write (archiving,
  // verifying) — split so a read-only role (the prosecutor, decision #95)
  // can hold the read alone. This menu entry (and the route in
  // `routes.tsx`) gate on the new `archive.view`; `ArchivePage.tsx` itself
  // additionally checks `archive.manage` before offering the archive/verify
  // actions. `archive.view` is granted to `central_admin`, `executor_head`
  // (the roles `archive.manage` already reached) and `prosecutor`
  // (migration 0034).
  { to: '/archive', labelKey: 'nav.archive', permission: 'archive.view', icon: Archive },
  // J2 (stage 6.7) — `reports.view` alone is correct and sufficient:
  // `permissions.py`'s own docstring grants it to every role that holds ANY
  // other `reports.*` code (central_admin, executor_staff, executor_head,
  // accountant) plus two read-only roles (gis_specialist, prosecutor,
  // leadership) — there is no role with `reports.manage`/`.sign`/`.accept`/
  // `.forms.manage` that lacks `reports.view`.
  { to: '/reports', labelKey: 'nav.reports', permission: 'reports.view', icon: ClipboardList },
  // Stage 7.7, task 9 (rulings #140-#143) — the aggregate read over what
  // citizens leave on their own issued permits (`PermitRatingPanel.tsx`,
  // task 8). `ratings.view` is zone-scoped exactly like `dashboard.view`
  // (ruling #142) and held by `central_admin`, `leadership`, `executor_head`
  // and `prosecutor` — the same four roles `nav.oversight` above reaches,
  // for the same reason: a leshoz sees its own ratings, the Agency sees
  // all, the backend does the narrowing.
  { to: '/ratings', labelKey: 'nav.ratings', permission: 'ratings.view', icon: Star },
  // Five codes, any ONE of them (`NavItem.permission` semantics): the
  // inspector's own `inspections.acts.write` (checklists, acts, ERI
  // signing), `inspections.tasks.manage` for the executor_staff/
  // executor_head who assign and cancel field tasks, `inspections.cases
  // .manage` for the executor_head who decides violation cases,
  // `inspections.checklists.manage` for the central_admin who maintains
  // checklist versions, and `inspections.view_any` — oversight read access
  // to the whole zone (executor_head, central_admin, leadership,
  // prosecutor). Gating on the inspector's own code alone would hide this
  // entire menu entry from every other role the backend already lets see
  // or manage some part of it.
  {
    to: '/inspections',
    labelKey: 'nav.inspections',
    permission: [
      'inspections.acts.write',
      'inspections.tasks.manage',
      'inspections.cases.manage',
      'inspections.checklists.manage',
      'inspections.view_any',
    ],
    icon: ClipboardCheck,
  },
  { to: '/admin/users', labelKey: 'nav.users', permission: 'auth.users.manage', icon: Users },
  { to: '/admin/roles', labelKey: 'nav.roles', permission: 'auth.users.manage', icon: ShieldCheck },
  { to: '/admin/organizations', labelKey: 'nav.organizations', permission: 'admin.organizations.manage', icon: Building2 },
  { to: '/admin/classifiers', labelKey: 'nav.classifiers', permission: 'admin.classifiers.manage', icon: BookMarked },
  // Ruling #139 (stage 7.7): the six `activity_types` rows are fixed by law —
  // this screen edits copy and switches one off, never adds or removes one.
  // Same permission as `/admin/classifiers` above: `PATCH
  // /refs/activity-types/{id}` is gated on `admin.classifiers.manage`
  // (`refs_router.py`), not a permission of its own.
  { to: '/admin/activities', labelKey: 'nav.activityTypes', permission: 'admin.classifiers.manage', icon: Trees },
  { to: '/admin/settings', labelKey: 'nav.settings', permission: 'admin.settings.manage', icon: Settings },
  { to: '/admin/announcements', labelKey: 'nav.announcements', permission: 'admin.announcements.manage', icon: Megaphone },
  { to: '/admin/legal-documents', labelKey: 'nav.legalDocuments', permission: 'admin.legal_documents.manage', icon: Scale },
  { to: '/admin/notification-templates', labelKey: 'nav.templates', permission: 'notifications.templates.manage', icon: MailPlus },
  { to: '/admin/integrations', labelKey: 'nav.integrations', permission: 'admin.integrations.view', icon: Radio },
  // Stage 7.9, task 9 (decisions #154-#160): the configurable payment-split
  // directory. `payments.recipients.manage` is granted to no role today
  // (superuser only) — deliberately the WRITE code, not `payments.view`, so
  // an accountant who can only read the split sees it through the invoice
  // instead (`InvoiceDetailDrawer.tsx`), never this directory.
  { to: '/admin/payment-recipients', labelKey: 'nav.paymentRecipients', permission: 'payments.recipients.manage', icon: Wallet },
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
