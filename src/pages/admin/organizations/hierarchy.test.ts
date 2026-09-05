import type { OrganizationOut } from '../api';
import {
  ALLOWED_PARENT_KINDS,
  buildOrganizationTree,
  childKindsOf,
  countOfKind,
  filterTree,
  subtreeIds,
  visibleRows,
} from './hierarchy';

function org(id: string, kind: string, parent: string | null, code = id): OrganizationOut {
  return {
    id,
    parent_id: parent,
    kind,
    code,
    name: { uz_cyrl: code, uz_latn: code },
    stir: null,
    region_id: null,
    district_id: null,
    status: 'active',
  };
}

const ROWS = [
  org('agency', 'agency', null),
  org('board', 'territorial', 'agency'),
  org('leshoz-a', 'leshoz', 'board'),
  org('leshoz-b', 'leshoz', 'agency'),
  org('bolim', 'bolim', 'leshoz-a'),
  org('aylanma', 'aylanma', 'bolim'),
  org('bolak', 'bolak', 'aylanma'),
];

test('nests by parent_id and numbers the depth of every level', () => {
  const roots = buildOrganizationTree(ROWS);
  const flat = visibleRows(roots, new Set());
  const depths = Object.fromEntries(flat.map((node) => [node.org.id, node.depth]));

  expect(roots).toHaveLength(1);
  expect(depths).toEqual({
    agency: 0,
    board: 1,
    'leshoz-a': 2,
    'leshoz-b': 1,
    bolim: 3,
    aylanma: 4,
    bolak: 5,
  });
});

test('a row whose parent is missing from the fetch is promoted, never dropped', () => {
  // A partial fetch (paging, a status filter) can deliver a child without its
  // parent. Losing an organization silently on the screen that decides who
  // sees what is worse than showing it at the top.
  const roots = buildOrganizationTree([org('agency', 'agency', null), org('orphan', 'leshoz', 'gone')]);
  expect(roots.map((node) => node.org.id).sort()).toEqual(['agency', 'orphan']);
});

test('a cycle in the data terminates instead of looping forever', () => {
  const rows = [org('a', 'leshoz', 'b'), org('b', 'bolim', 'a')];
  expect(visibleRows(buildOrganizationTree(rows), new Set())).toHaveLength(2);
  expect(subtreeIds(rows, 'a')).toEqual(new Set(['a', 'b']));
});

test('collapsing a node hides its whole subtree, not just its children', () => {
  const roots = buildOrganizationTree(ROWS);
  const ids = visibleRows(roots, new Set(['leshoz-a'])).map((node) => node.org.id);
  expect(ids).toContain('leshoz-a');
  expect(ids).not.toContain('bolim');
  expect(ids).not.toContain('bolak');
});

test('a search keeps the ancestors of every hit so the branch stays readable', () => {
  const roots = buildOrganizationTree(ROWS);
  const found = filterTree(roots, (node) => node.org.code === 'bolak');
  expect(visibleRows(found, new Set()).map((node) => node.org.id)).toEqual([
    'agency',
    'board',
    'leshoz-a',
    'bolim',
    'aylanma',
    'bolak',
  ]);
});

test('counts every leshoz wherever it hangs, including republic-subordinated ones', () => {
  expect(countOfKind(buildOrganizationTree(ROWS), 'leshoz')).toBe(2);
});

test('child kinds are the exact inverse of the allowed-parent map', () => {
  expect(childKindsOf('agency')).toEqual(['territorial', 'leshoz']);
  expect(childKindsOf('territorial')).toEqual(['leshoz']);
  expect(childKindsOf('bolak')).toEqual([]);
  expect(childKindsOf('nonsense')).toEqual([]);
  // The agency is the single root: nothing may be its parent.
  expect(ALLOWED_PARENT_KINDS.agency).toEqual([]);
});

test('subtreeIds covers the whole branch, which is what blocks a re-parent cycle', () => {
  expect(subtreeIds(ROWS, 'leshoz-a')).toEqual(new Set(['leshoz-a', 'bolim', 'aylanma', 'bolak']));
  expect(subtreeIds(ROWS, 'leshoz-b')).toEqual(new Set(['leshoz-b']));
});
