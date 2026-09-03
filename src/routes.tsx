import { createBrowserRouter } from 'react-router';
import { AppShell } from './app/AppShell';
import { RequireAuth } from './auth/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { UsersPage } from './pages/UsersPage';

/**
 * The route table. Task 5 adds `/login` and the auth guards; Task 6 adds the
 * shell and the rest of the routes appended here — every later stage grows
 * this table, it does not rewrite it.
 *
 * `/admin/users` and the `/applications/:id` placeholder exist only so
 * `RequireAuth`'s own tests have real routes to navigate to; Task 6 replaces
 * their elements with the real screens.
 */
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
  },
  {
    path: '/admin/users',
    element: (
      <RequireAuth permission="auth.users.manage">
        <UsersPage />
      </RequireAuth>
    ),
  },
  {
    path: '/applications/:id',
    element: (
      <RequireAuth>
        <div data-testid="application-page" />
      </RequireAuth>
    ),
  },
]);
