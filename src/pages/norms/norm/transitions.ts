/**
 * The six-transition topology, in ONE table — the task-6 brief's own
 * instruction, "mirroring the backend's own transition tables are written."
 * This is the front-end's equivalent of `norms/service.py::NORM_TRANSITIONS`
 * (a bare `{(from, to)}` set there, since the backend tells two edges with
 * the same `(status, target)` apart by WHICH ROUTE is calling
 * `_assert_transition_from`, not by data) — here every row also carries the
 * action id and the permission its own route requires, because a screen has
 * no separate "route" to disambiguate by; the data has to say it.
 *
 * `review` is reachable from both `draft` (`submit-review`, `NORMS_MANAGE`)
 * and `approved` (`return-to-review`, `NORMS_PUBLISH`) — the exact
 * ambiguity `service.py::_assert_transition_from`'s own docstring warns
 * about. Two DISTINCT rows below, distinguished by their `from`, is how this
 * table encodes the same fact `_assert_transition_from` enforces at
 * runtime — never a bare `(from, to)` pair a generic
 * "can THIS status reach THAT status" helper could conflate.
 *
 * `archived` is reachable from `draft` OR `published` (`service.py`'s own
 * `NORM_TRANSITIONS` set), but NOT from `review` or `approved` — a norm
 * sitting in either of those must be sent back to `draft` (via `review`)
 * before it can be archived. This table has no `('review', 'archived')` or
 * `('approved', 'archived')` row for exactly that reason: the archive
 * button in those two statuses is correctly absent, not merely disabled.
 */
import { NORMS_APPROVE, NORMS_MANAGE, NORMS_PUBLISH } from './labels';
import type { NormTransitionAction } from './api';

export const NORM_STATUSES = ['draft', 'review', 'approved', 'published', 'archived'] as const;
export type NormStatus = (typeof NORM_STATUSES)[number];

export function statusLabelKey(status: string): string {
  return (NORM_STATUSES as readonly string[]).includes(status) ? `norms.norms.status.${status}` : status;
}

/** `approve` is its own action id here too (not a `NormTransitionAction`,
 *  which excludes it — `api.ts`'s own note on why): this table is the single
 *  source of truth for "which actions exist and where," and the screen
 *  reads `action` to decide whether to open `NormApproveDialog` (needs a
 *  document) or the plain `NormTransitionDialog` (does not). */
export interface NormActionSpec {
  action: NormTransitionAction | 'approve';
  from: NormStatus;
  to: NormStatus;
  permission: string;
}

export const NORM_ACTIONS: readonly NormActionSpec[] = [
  { action: 'submit-review', from: 'draft', to: 'review', permission: NORMS_MANAGE },
  { action: 'return-to-draft', from: 'review', to: 'draft', permission: NORMS_MANAGE },
  { action: 'approve', from: 'review', to: 'approved', permission: NORMS_APPROVE },
  { action: 'return-to-review', from: 'approved', to: 'review', permission: NORMS_PUBLISH },
  { action: 'publish', from: 'approved', to: 'published', permission: NORMS_PUBLISH },
  { action: 'archive', from: 'draft', to: 'archived', permission: NORMS_APPROVE },
  { action: 'archive', from: 'published', to: 'archived', permission: NORMS_APPROVE },
];

export function actionsFor(status: string): NormActionSpec[] {
  return NORM_ACTIONS.filter((spec) => spec.from === status);
}

/** `update_norm` allows PATCH only in `draft`/`review` (`service.py`'s own
 *  comment: "approved and beyond are a fact of record") — the same house
 *  rule that hides the archive button in `review`/`approved` hides the edit
 *  control past `review`. */
export const NORM_EDITABLE_STATUSES: readonly NormStatus[] = ['draft', 'review'];
