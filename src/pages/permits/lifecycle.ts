/**
 * Data layer for E3 — permit lifecycle (suspend/resume/revoke, С13, plan
 * `03.11b-permits-lifecycle`). Kept in its own file rather than appended to
 * `queries.ts` (scoped to the list screens by its own docstring) or inlined
 * in the panel, the same split `eimzo.ts` (data/crypto helpers) and
 * `PermitSignaturesPanel.tsx` (the component, its own inline mutation)
 * already use one file over for the permit document page's other action.
 *
 * The three write routes (`/permits/{id}/{suspend,resume,revoke}`) live in
 * the backend's own `lifecycle_router.py`, added by 3.11b — now present in
 * `schema.d.ts` since its regeneration, reached through the ordinary typed
 * `api.POST` the rest of the app uses.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { apiError } from '../../api/errors';
import type { components } from '../../api/schema';

export type PermitCardOut = components['schemas']['PermitCardOut'];
export type ClassifierItemOut = components['schemas']['ClassifierItemOut'];

export type LifecycleAct = 'suspend' | 'resume' | 'revoke';

/** `grounds.CLASSIFIER_CODE` — `permit_status_reasons`, seeded by migration
 *  0023 with PS-01…PS-07 (`app/modules/permits/grounds.py`). Shares the
 *  generic classifier-items route every other reference list in this app
 *  already uses (`staff/queries.ts::useRejectionReasons`, same shape). */
export function usePermitStatusReasons() {
  return useQuery({
    queryKey: ['refs', 'classifiers', 'permit_status_reasons'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/refs/classifiers/{code}/items', {
        params: { path: { code: 'permit_status_reasons' } },
      });
      if (error) throw apiError(error);
      return data;
    },
    staleTime: 10 * 60_000,
  });
}

/** `grounds._kinds` — an item's `props.kinds` names which of
 *  suspend/resume/revoke it applies to; defensively read (an admin-editable
 *  classifier, same defensiveness the backend's own `_kinds` applies). */
export function reasonAppliesTo(item: ClassifierItemOut, act: LifecycleAct): boolean {
  const props = item.props as Record<string, unknown> | null;
  const kinds = props?.kinds;
  return Array.isArray(kinds) && kinds.includes(act);
}

/** `grounds.EXPLANATION_REQUIRED` — PS-07 is the one ground whose
 *  `legal_basis` is not optional. Matched by CODE, mirroring the backend's
 *  own constant exactly (a `props` flag would be a second place to encode
 *  the same fact and could drift from it). */
export const EXPLANATION_REQUIRED_CODE = 'PS-07';

export type DecisionInput = components['schemas']['app__modules__permits__schemas__DecisionIn'];

/** The three routes share one request shape (`DecisionIn`) and one response
 *  shape (`PermitOut` — the permit's own columns, NOT the fuller
 *  `PermitCardOut` with `signatures`/`history`/`missing_signatures`; no
 *  caller here reads the mutation's own response, only invalidates and
 *  re-fetches the card). */
const LIFECYCLE_PATH = {
  suspend: '/api/v1/permits/{permit_id}/suspend',
  resume: '/api/v1/permits/{permit_id}/resume',
  revoke: '/api/v1/permits/{permit_id}/revoke',
} as const;

function useLifecycleMutation(permitId: string, act: LifecycleAct) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DecisionInput) => {
      const { data, error } = await api.POST(LIFECYCLE_PATH[act], {
        params: { path: { permit_id: permitId } },
        body: input,
      });
      if (error) throw apiError(error);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['permit', permitId] });
    },
  });
}

export function useSuspendPermit(permitId: string) {
  return useLifecycleMutation(permitId, 'suspend');
}
export function useResumePermit(permitId: string) {
  return useLifecycleMutation(permitId, 'resume');
}
export function useRevokePermit(permitId: string) {
  return useLifecycleMutation(permitId, 'revoke');
}

/** `POST /files`, the same two-step upload every attachment in this app
 *  goes through — duplicated in miniature rather than imported from
 *  `applicant/api.ts` (a different track's file; nothing in this app
 *  reaches across that boundary today, `staff/format.ts`'s own comment
 *  gives the same reason for its own duplication). Any authenticated user
 *  may call it (`app/files_router.py::upload_file` takes `get_current_user`
 *  alone), so `executor_head` uploading the suspend/revoke order needs
 *  nothing beyond being signed in. */
export async function uploadDecisionDocument(file: File): Promise<{ id: string }> {
  const form = new FormData();
  form.append('file', file);
  const { data, error } = await api.POST('/api/v1/files', {
    body: form as unknown as { file: string },
  });
  if (error) throw apiError(error);
  return data;
}
