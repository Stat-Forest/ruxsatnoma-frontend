import type { ReactNode } from 'react';
import type { RouteObject } from 'react-router';
import { createBrowserRouter } from 'react-router';
import { AppShell } from './shell/AppShell';
import { NAVIGATION } from './shell/navigation';
import { RequireAuth } from './auth/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { OneIdReturnPage } from './pages/OneIdReturnPage';
import { UsersPage } from './pages/UsersPage';
import { BeekeepersPage } from './pages/beekeepers/BeekeepersPage';
import { AnnouncementsPage } from './pages/admin/announcements/AnnouncementsPage';
import { LegalDocumentsPage } from './pages/admin/legalDocuments/LegalDocumentsPage';
import { ActivityTypesPage } from './pages/admin/activities/ActivityTypesPage';
import { ClassifiersPage } from './pages/admin/classifiers/ClassifiersPage';
import { IntegrationsPage } from './pages/admin/integrations/IntegrationsPage';
import { OrganizationsPage } from './pages/admin/organizations/OrganizationsPage';
import { RecipientsPage } from './pages/admin/recipients/RecipientsPage';
import { RolesPage } from './pages/admin/roles/RolesPage';
import { SettingsPage } from './pages/admin/settings/SettingsPage';
import { TemplatesPage } from './pages/admin/templates/TemplatesPage';
import { OversightPage } from './pages/oversight/OversightPage';
import { RatingsPage } from './pages/ratings/RatingsPage';
import { SearchPage } from './pages/search/SearchPage';
import { ArchivePage } from './pages/archive/ArchivePage';
import { SupportPage } from './pages/support/SupportPage';
import { InspectionsPage } from './pages/inspector/InspectionsPage';
import { TaskDetailPage } from './pages/inspector/TaskDetailPage';
import { ActFormPage } from './pages/inspector/ActFormPage';
import { CaseDetailPage } from './pages/inspector/CaseDetailPage';
import {
  ApplicationsPage,
  ApplicationWizardPage,
  DashboardPage,
  GisPage,
  InvoicesPage,
  MyApplicationCardPage,
  MyApplicationsPage,
  MyInvoicePage,
  MyPermitPage,
  MyPermitsPage,
  NormsPage,
  NotificationsPage,
  PermitDocumentPage,
  PermitsPage,
  ProfilePage,
  ReportDetailPage,
  ReportsPage,
  StaffApplicationCardPage,
} from './pages/placeholders';

/**
 * The page each `NAVIGATION` entry routes to, keyed by `NavItem.to`. This is
 * the only place a path string is paired with its page component — the
 * permission that gates a path is never retyped here, it is read straight
 * off `NAVIGATION` below, so the menu's visibility and the route's actual
 * gate cannot drift apart. Hand-typing the same six permission codes in both
 * `navigation.ts` and this file was the defect an earlier review of this
 * task flagged as its central risk: nothing kept the two copies in step, and
 * a code that does not exist hides its menu entry silently and forever.
 */
const CHILD_PAGES: Record<string, ReactNode> = {
  '/': <DashboardPage />,
  '/my/applications': <MyApplicationsPage />,
  '/my/permits': <MyPermitsPage />,
  '/applications': <ApplicationsPage />,
  '/gis': <GisPage />,
  '/norms': <NormsPage />,
  '/invoices': <InvoicesPage />,
  '/permits': <PermitsPage />,
  '/oversight': <OversightPage />,
  '/search': <SearchPage />,
  '/archive': <ArchivePage />,
  '/reports': <ReportsPage />,
  '/ratings': <RatingsPage />,
  '/inspections': <InspectionsPage />,
  '/beekeepers': <BeekeepersPage />,
  '/admin/users': <UsersPage />,
  '/admin/roles': <RolesPage />,
  '/admin/organizations': <OrganizationsPage />,
  '/admin/classifiers': <ClassifiersPage />,
  '/admin/activities': <ActivityTypesPage />,
  '/admin/settings': <SettingsPage />,
  '/admin/announcements': <AnnouncementsPage />,
  '/admin/legal-documents': <LegalDocumentsPage />,
  '/admin/notification-templates': <TemplatesPage />,
  '/admin/integrations': <IntegrationsPage />,
  '/admin/payment-recipients': <RecipientsPage />,
  '/notifications': <NotificationsPage />,
  '/profile': <ProfilePage />,
  '/support': <SupportPage />,
};

/** Generated from `NAVIGATION`, not hand-written — see `CHILD_PAGES` above. */
const navigationChildren: RouteObject[] = NAVIGATION.map((item) => {
  const page = CHILD_PAGES[item.to];
  const element = item.permission ? <RequireAuth permission={item.permission}>{page}</RequireAuth> : page;
  return item.to === '/' ? { index: true, element } : { path: item.to.slice(1), element };
});

/**
 * Detail and action routes: reached by following a link from an
 * already-rendered screen (an application id, an invoice id, a permit id),
 * never from the left menu, so they carry no `NAVIGATION` entry — but a
 * gated one still needs its permission generated from a single declared
 * value, for the same reason `navigationChildren` above is generated rather
 * than hand-written: a permission literal copied a second time is exactly
 * how an earlier draft of this table drifted from the backend's registry.
 *
 * `my/applications/new` is the only gated entry here. `POST /applications`
 * and every other route the wizard calls (`PATCH`, `/documents`,
 * `/precheck`, `/submit`) require `applications.create` on the backend
 * ("File and edit one's own application (applicant)" —
 * `app/modules/applications/permissions.py`, checked 2026-09-04), so a role
 * without it is refused here instead of failing confusingly on first submit.
 *
 * The rest are read-only and carry no permission on purpose: `GET
 * /applications/{id}`, `GET /invoices/{id}` and `GET /permits/{id}` all gate
 * on ownership inside the service layer — for staff, on holding one of
 * `applications.view_any` / `.review` / `.decide` (`applications/service.py`),
 * not on a `require_permission` dependency. Gating them here too would add a
 * stricter frontend rule the backend does not enforce, and could lock out a
 * legitimate reader the backend would have served — `executor_head` holds
 * `applications.decide` but not `applications.review`, and still has to open
 * an application card to approve it.
 *
 * The four `inspections/*` entries follow the same read-only reasoning:
 * `GET /inspections/tasks/{id}` / `/acts/{id}` / `/cases/{id}` all gate on
 * ownership or zone inside `service.py` (own `assigned_to`/`inspector_id`,
 * `view_any`, or — for a case — the case's own applicant), never a
 * `require_permission` dependency, and `POST /inspections/acts` (the
 * `acts/new` entry) is reached only from `InspectionsPage`'s own "New
 * inspection" button, which is itself gated on `inspections.acts.write`
 * (`ActsTab.tsx`) — a route-level permission here would just double-gate
 * the same check with a second, drift-prone copy.
 */
const DETAIL_ROUTES: { path: string; element: ReactNode; permission?: string }[] = [
  { path: 'my/applications/new', element: <ApplicationWizardPage />, permission: 'applications.create' },
  { path: 'my/applications/:id', element: <MyApplicationCardPage /> },
  { path: 'my/invoices/:id', element: <MyInvoicePage /> },
  { path: 'my/permits/:id', element: <MyPermitPage /> },
  { path: 'applications/:id', element: <StaffApplicationCardPage /> },
  { path: 'permits/:id', element: <PermitDocumentPage /> },
  // J2 (stage 6.7) — same reasoning as `permits/:id`/`applications/:id`
  // above: `GET /reports/{report_id}` gates on `reports.view` inside the
  // service layer, not a `require_permission` dependency, so this route
  // carries no `permission` here either.
  { path: 'reports/:id', element: <ReportDetailPage /> },
  { path: 'inspections/tasks/:id', element: <TaskDetailPage /> },
  { path: 'inspections/acts/new', element: <ActFormPage /> },
  { path: 'inspections/acts/:id', element: <ActFormPage /> },
  { path: 'inspections/cases/:id', element: <CaseDetailPage /> },
  // Where `GET /auth/oneid/callback` (backend) redirects once the session
  // cookies are set — part of that cross-repo contract, not a private path.
  // Registered inside the `RequireAuth`-wrapped subtree so an unauthenticated
  // arrival (a stale bookmark, a failed callback) is bounced to `/login`
  // rather than looping.
  { path: 'auth/oneid/return', element: <OneIdReturnPage /> },
  // Route alias for /admin/system-settings -> SettingsPage
  { path: 'admin/system-settings', element: <SettingsPage />, permission: 'admin.settings.manage' },
];

const detailRouteChildren: RouteObject[] = DETAIL_ROUTES.map(({ path, element, permission }) => ({
  path,
  element: permission ? <RequireAuth permission={permission}>{element}</RequireAuth> : element,
}));

/**
 * The route table. `AppShell` is the layout for every authenticated route —
 * one outer `RequireAuth` (no permission) gates the whole subtree on "logged
 * in and not blocked". Every child route is generated from `NAVIGATION`
 * (`navigationChildren`, above) rather than hand-written, so there is exactly
 * one place that says which permission gates which path. Every later stage
 * (6.1-6.5) grows the shell by appending to `NAVIGATION` and to
 * `CHILD_PAGES` — nothing else about this file's shape changes.
 *
 * `routeConfig` is exported as plain data (not just the built `router`) so
 * `shell/navigation.test.tsx` can walk it and assert every `NAVIGATION.to`
 * resolves to a real route, without depending on the router's internal shape.
 * `detailRouteChildren` (above) adds every non-menu detail/action route the
 * same generated way.
 */
export const routeConfig: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [...navigationChildren, ...detailRouteChildren],
  },
];

export const router = createBrowserRouter(routeConfig);
