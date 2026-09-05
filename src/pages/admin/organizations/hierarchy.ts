/**
 * The shape of the hierarchy, and the pure functions that turn a flat list of
 * rows into it. No React, no fetching — so the rules that actually matter
 * (which kind may hang off which, what a search does to a tree) are testable
 * on their own.
 *
 * The kind chain and the allowed-parent map mirror
 * `backend/app/modules/admin/service.py::ALLOWED_PARENT_KINDS` and the
 * `kind_valid` / `root_is_agency` CHECK constraints. A form that lets an
 * administrator pick an illegal pairing only turns a 422 into a round trip.
 */
import type { OrganizationOut } from '../api';

export const ORGANIZATION_KINDS = [
  'agency',
  'territorial',
  'leshoz',
  'bolim',
  'aylanma',
  'bolak',
] as const;

export type OrganizationKind = (typeof ORGANIZATION_KINDS)[number];

/** `leshoz` accepts two parents because republic-subordinated leshozes report
 *  to the agency directly, while the rest hang off a territorial board. */
export const ALLOWED_PARENT_KINDS: Record<OrganizationKind, readonly OrganizationKind[]> = {
  agency: [],
  territorial: ['agency'],
  leshoz: ['agency', 'territorial'],
  bolim: ['leshoz'],
  aylanma: ['bolim'],
  bolak: ['aylanma'],
};

export function isOrganizationKind(value: string): value is OrganizationKind {
  return (ORGANIZATION_KINDS as readonly string[]).includes(value);
}

/** The kinds that may be created UNDER a row of this kind — the inverse of
 *  `ALLOWED_PARENT_KINDS`, used by the row's own "add child" action. */
export function childKindsOf(parentKind: string): OrganizationKind[] {
  if (!isOrganizationKind(parentKind)) return [];
  return ORGANIZATION_KINDS.filter((kind) => ALLOWED_PARENT_KINDS[kind].includes(parentKind));
}

export interface OrgNode {
  org: OrganizationOut;
  children: OrgNode[];
  /** 0 for the agency; used for the row's indent and its `aria-level`. */
  depth: number;
}

const KIND_ORDER = new Map<string, number>(ORGANIZATION_KINDS.map((kind, index) => [kind, index]));

function compare(a: OrgNode, b: OrgNode): number {
  const byKind = (KIND_ORDER.get(a.org.kind) ?? 99) - (KIND_ORDER.get(b.org.kind) ?? 99);
  return byKind !== 0 ? byKind : a.org.code.localeCompare(b.org.code);
}

/**
 * Nests a flat list by `parent_id`.
 *
 * A row whose parent is not in the list is promoted to the top rather than
 * dropped: the walk is paginated and status-filtered, so a subtree can arrive
 * without its parent (an archived board with active children cannot exist
 * today, but a partial fetch can), and silently hiding organizations from the
 * screen that decides who sees what is the worse failure.
 */
export function buildOrganizationTree(rows: OrganizationOut[]): OrgNode[] {
  const nodes = new Map<string, OrgNode>();
  for (const org of rows) nodes.set(org.id, { org, children: [], depth: 0 });

  const roots: OrgNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.org.parent_id ? nodes.get(node.org.parent_id) : undefined;
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }

  // Depth is assigned by descent, not by counting parents, so a cycle in the
  // data cannot loop: `visited` stops the second visit.
  const visited = new Set<OrgNode>();
  const assign = (node: OrgNode, depth: number) => {
    if (visited.has(node)) return;
    visited.add(node);
    node.depth = depth;
    node.children.sort(compare);
    for (const child of node.children) assign(child, depth + 1);
  };
  roots.sort(compare);
  for (const root of roots) assign(root, 0);

  // A cycle (A parents B, B parents A) leaves every node in it with a parent,
  // so none of them became a root above and the whole ring would vanish from
  // the screen. Promote the first node of each such ring, detaching it from
  // its parent so it is not also rendered as that parent's child; descending
  // from it marks the rest of the ring visited.
  for (const node of nodes.values()) {
    if (visited.has(node)) continue;
    const parent = node.org.parent_id ? nodes.get(node.org.parent_id) : undefined;
    if (parent) parent.children = parent.children.filter((child) => child !== node);
    roots.push(node);
    assign(node, 0);
  }
  roots.sort(compare);

  return roots;
}

export function countNodes(nodes: OrgNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countNodes(node.children), 0);
}

export function countOfKind(nodes: OrgNode[], kind: OrganizationKind): number {
  return nodes.reduce(
    (sum, node) => sum + (node.org.kind === kind ? 1 : 0) + countOfKind(node.children, kind),
    0,
  );
}

/** Depth-first order, skipping the subtree of anything the reader collapsed. */
export function visibleRows(nodes: OrgNode[], collapsed: ReadonlySet<string>): OrgNode[] {
  const out: OrgNode[] = [];
  const walk = (list: OrgNode[]) => {
    for (const node of list) {
      out.push(node);
      if (!collapsed.has(node.org.id)) walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

/**
 * Keeps every node that matches, plus every ancestor of a match — an
 * organization found three levels down is meaningless without the branch it
 * hangs off, which is the whole point of a hierarchy screen.
 */
export function filterTree(nodes: OrgNode[], matches: (node: OrgNode) => boolean): OrgNode[] {
  const out: OrgNode[] = [];
  for (const node of nodes) {
    const children = filterTree(node.children, matches);
    if (children.length > 0 || matches(node)) out.push({ ...node, children });
  }
  return out;
}

/**
 * Every id inside `orgId`'s subtree, `orgId` itself included — the parent
 * picker subtracts this set when editing, because re-parenting a board under
 * its own leshoz is the cycle `update_organization` refuses with
 * `ERR-VAL-001 {"reason": "cycle"}`.
 */
export function subtreeIds(rows: OrganizationOut[], orgId: string): Set<string> {
  const byParent = new Map<string, OrganizationOut[]>();
  for (const org of rows) {
    if (!org.parent_id) continue;
    const siblings = byParent.get(org.parent_id);
    if (siblings) siblings.push(org);
    else byParent.set(org.parent_id, [org]);
  }

  const ids = new Set<string>([orgId]);
  const queue = [orgId];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const child of byParent.get(current) ?? []) {
      if (ids.has(child.id)) continue;
      ids.add(child.id);
      queue.push(child.id);
    }
  }
  return ids;
}
