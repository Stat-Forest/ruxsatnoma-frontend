import type { RouteObject } from 'react-router';
import { createBrowserRouter } from 'react-router';
import { AppShell } from './shell/AppShell';
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
 * The route table. `AppShell` is the layout for every authenticated route —
 * one outer `RequireAuth` (no permission) gates the whole subtree on "logged
 * in and not blocked"; a child route that also needs a specific permission
 * (e.g. `/admin/users`) adds its own inner `RequireAuth` around just that
 * page. Every later stage (6.1-6.5) grows `children` below by appending one
 * entry per `NAVIGATION` item it adds — nothing else about this file's shape
 * changes.
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
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'my/applications', element: <MyApplicationsPage /> },
      { path: 'my/permits', element: <MyPermitsPage /> },
      {
        path: 'applications',
        element: (
          <RequireAuth permission="applications.review">
            <ApplicationsPage />
          </RequireAuth>
        ),
      },
      { path: 'applications/:id', element: <div data-testid="application-page" /> },
      {
        path: 'gis',
        element: (
          <RequireAuth permission="gis.contours.manage">
            <GisPage />
          </RequireAuth>
        ),
      },
      {
        path: 'norms',
        element: (
          <RequireAuth permission="norms.manage">
            <NormsPage />
          </RequireAuth>
        ),
      },
      {
        path: 'invoices',
        element: (
          <RequireAuth permission="payments.view">
            <InvoicesPage />
          </RequireAuth>
        ),
      },
      {
        path: 'permits',
        element: (
          <RequireAuth permission="permits.view_any">
            <PermitsPage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/users',
        element: (
          <RequireAuth permission="auth.users.manage">
            <UsersPage />
          </RequireAuth>
        ),
      },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'profile', element: <ProfilePage /> },
    ],
  },
];

export const router = createBrowserRouter(routeConfig);
