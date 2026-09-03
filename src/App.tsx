import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { AuthProvider } from './auth/AuthProvider';
import { I18nProvider } from './i18n';
import { router } from './routes';

/**
 * Ruling 10's global session/CSRF handling now lives in
 * `src/api/client.ts`'s `sessionMiddleware`, which wraps every `api.*` call —
 * a query, a mutation, or an ad-hoc call outside TanStack Query alike — so it
 * no longer needs a `QueryCache.onError` here to reach queries only. Keeping
 * both would risk the two mechanisms disagreeing about when the session is
 * gone; the middleware is the one place now.
 */
function Providers() {
  const [queryClient] = useState(() => new QueryClient());

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
