import { useState } from 'react';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { ApiError, SESSION_GONE } from './api/errors';
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/useAuth';
import { I18nProvider } from './i18n';
import { router } from './routes';

/**
 * Task 6 step 4's global rule: any `ERR-AUTH-002` surfacing from ANY
 * TanStack Query anywhere in the authenticated app clears the session once,
 * here, rather than in every screen a later stage adds (ruling 10's first
 * half). `RequireAuth` reacts to `me` becoming `null` on its own and
 * redirects to `/login` — no imperative navigation needed here.
 *
 * The `QueryClient` is built inside this component (a child of `AuthProvider`,
 * not a sibling of it) specifically so its `QueryCache.onError` can close over
 * a real `logout` — `logout` is a `useCallback` with no dependencies in
 * `AuthProvider`, so its identity never changes and the client never needs
 * rebuilding.
 */
function Providers() {
  const { logout } = useAuth();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            if (error instanceof ApiError && error.code === SESSION_GONE) void logout();
          },
        }),
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <RouterProvider router={router} />
      </I18nProvider>
    </QueryClientProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <Providers />
    </AuthProvider>
  );
}

export default App;
