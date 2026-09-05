import type { RouteObject } from 'react-router';
import { routeConfig } from '../routes';
import { NAVIGATION, satisfies, visibleNav } from './navigation';

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

test("every gated navigation entry's route requires the same permission NAVIGATION declares", () => {
  // Reads the permission back off the actual React element the route table
  // builds (`routes.tsx` derives it from `NAVIGATION` — this is what makes a
  // future regression to hand-typing the same code in two places visible:
  // a typo in either copy fails this assertion, not just this test's peers).
  const layoutRoute = routeConfig.find((route) => route.children);
  const childByPath = new Map<string, RouteObject>();
  for (const child of layoutRoute?.children ?? []) {
    childByPath.set(child.index ? '/' : `/${child.path}`, child);
  }
  for (const item of NAVIGATION) {
    if (!item.permission) continue;
    const route = childByPath.get(item.to);
    expect(route).toBeDefined();
    const element = route?.element as { props?: { permission?: string } } | undefined;
    expect(element?.props?.permission).toEqual(item.permission);
  }
});


test('the approver reaches the worklist through his own permission, not the reviewer\'s', () => {
  // `executor_head` holds `applications.decide` and NOT `applications.review`
  // (migration 0015, left in place by 0016). Gating `/applications` on `review`
  // alone hid the page from the one person the workflow waits on — found on the
  // dev server, where he got "Sizda ushbu sahifaga kirish huquqi yo'q" and the
  // menu entry was simply absent, while the page itself handled him correctly.
  const approver = visibleNav({ permissions: ['applications.decide'], is_superuser: false });
  expect(approver.map((i) => i.to)).toContain('/applications');

  const reviewer = visibleNav({ permissions: ['applications.review'], is_superuser: false });
  expect(reviewer.map((i) => i.to)).toContain('/applications');

  // And neither code is a skeleton key for the other staff screens.
  expect(approver.map((i) => i.to)).not.toContain('/admin/users');
});

test('the norms menu entry appears for norms.manage alone', () => {
  const items = visibleNav({ permissions: ['norms.manage'], is_superuser: false });
  expect(items.map((i) => i.to)).toContain('/norms');
});

test('the norms menu entry appears for norms.tariffs.manage alone', () => {
  // The regression task 2 exists to prevent: before the array permission,
  // the account that maintains grazing coefficients (norms.tariffs.manage,
  // not norms.manage) could not see this entry at all.
  const items = visibleNav({ permissions: ['norms.tariffs.manage'], is_superuser: false });
  expect(items.map((i) => i.to)).toContain('/norms');
});

test('an array permission means ANY of them, never all', () => {
  const holdsOne = satisfies(['applications.review', 'applications.decide'], {
    permissions: ['applications.decide'],
    is_superuser: false,
  });
  const holdsNeither = satisfies(['applications.review', 'applications.decide'], {
    permissions: ['norms.manage'],
    is_superuser: false,
  });
  expect(holdsOne).toBe(true);
  expect(holdsNeither).toBe(false);
});
