import type { RouteObject } from 'react-router';
import { routeConfig } from '../routes';
import { NAVIGATION, visibleNav } from './navigation';

function joinPaths(parent: string, child: string): string {
  if (child.startsWith('/')) return child;
  const base = parent.endsWith('/') ? parent : `${parent}/`;
  return `${base}${child}`;
}

/** Walks a react-router `RouteObject[]` tree and returns every full path it
 *  resolves — including index routes (which inherit the parent's own path)
 *  and pathless layout routes (which contribute nothing themselves but still
 *  pass their path down to their children). */
function flattenRoutes(routes: RouteObject[], parentPath = ''): string[] {
  const paths: string[] = [];
  for (const route of routes) {
    let full = parentPath;
    if (route.index) {
      full = parentPath || '/';
      paths.push(full);
    } else if (route.path) {
      full = joinPaths(parentPath, route.path);
      paths.push(full);
    }
    if (route.children) paths.push(...flattenRoutes(route.children, full));
  }
  return paths;
}

test('a user sees only what their permissions allow', () => {
  const items = visibleNav({ permissions: ['applications.review'], is_superuser: false });
  expect(items.map((i) => i.to)).toContain('/applications');
  expect(items.map((i) => i.to)).not.toContain('/admin/users');
});

test('a personal grant outside the role opens the screen', () => {
  // 3.3b lets an admin grant one code to one user; the menu must honour it
  const items = visibleNav({ permissions: ['norms.manage'], is_superuser: false });
  expect(items.map((i) => i.to)).toContain('/norms'); // norms.manage, not norms.approve
});

test('the superuser sees everything, including items granted to nobody', () => {
  const items = visibleNav({ permissions: [], is_superuser: true });
  expect(items.length).toBe(NAVIGATION.length);
});

test('items with no permission code are always visible', () => {
  const items = visibleNav({ permissions: [], is_superuser: false });
  expect(items.map((i) => i.to)).toEqual(expect.arrayContaining(['/profile', '/notifications']));
});

test('every navigation entry points at a route that exists', () => {
  const paths = new Set(flattenRoutes(routeConfig));
  for (const item of NAVIGATION) expect(paths).toContain(item.to);
});
