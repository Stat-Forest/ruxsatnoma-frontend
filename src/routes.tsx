import type { ReactNode } from 'react';
import type { RouteObject } from 'react-router';
import { createBrowserRouter } from 'react-router';
import { AppShell } from './shell/AppShell';
import { NAVIGATION } from './shell/navigation';
import { RequireAuth } from './auth/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { UsersPage } from './pages/UsersPage';
import {
  ApplicationsPage,
  DashboardPage,
  GisPage,
  InvoicesPage,
  MyApplicationsPage,
  MyPermitsPage,
  NormsPage,
  NotificationsPage,
  PermitsPage,
  ProfilePage,
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
  '/admin/users': <UsersPage />,
  '/notifications': <NotificationsPage />,
  '/profile': <ProfilePage />,
};

/** Generated from `NAVIGATION`, not hand-written — see `CHILD_PAGES` above. */
const navigationChildren: RouteObject[] = NAVIGATION.map((item) => {
  const page = CHILD_PAGES[item.to];
  const element = item.permission ? <RequireAuth permission={item.permission}>{page}</RequireAuth> : page;
  return item.to === '/' ? { index: true, element } : { path: item.to.slice(1), element };
});

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
 */
export const routeConfig: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [...navigationChildren, { path: 'applications/:id', element: <div data-testid="application-page" /> }],
  },
];

export const router = createBrowserRouter(routeConfig);
