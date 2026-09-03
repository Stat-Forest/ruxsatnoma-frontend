import { createBrowserRouter } from 'react-router';

/**
 * The route table. Task 5 adds `/login` and the auth guards; Task 6 adds the
 * shell and the rest of the routes appended here — every later stage grows
 * this table, it does not rewrite it.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <div>Ruxsatnoma — Adminka</div>,
  },
]);
