/**
 * Data layer for the inspector's screens (J1, stage 6.7) — `app/modules
 * /inspections`: checklists, tasks, acts and violation cases (tz/04 С15/С16).
 * Follows `permits/queries.ts`'s own shape (imports, `apiError`, `useQuery`/
 * `useMutation` from `@tanstack/react-query`).
 *
 * Query keys are namespaced under `'inspector'` and, for the three list/
 * detail pairs, built through the exported `taskKeys`/`actKeys`/`caseKeys`
 * helpers below so every later screen invalidates (and matches) the exact
 * same shapes this file writes — the same reasoning `['refs','contour',
 * contourId]`-style keys already get elsewhere in this app.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { apiError, type ApiError } from '../../api/errors';
import type { components } from '../../api/schema';

export type GpsPoint = components['schemas']['GpsPoint'];
export type ChecklistQuestion = components['schemas']['ChecklistQuestion'];
export type ChecklistOut = components['schemas']['ChecklistOut'];
export type TaskOut = components['schemas']['TaskOut'];
export type ActCreateIn = components['schemas']['ActCreateIn'];
export type ActUpdateIn = components['schemas']['ActUpdateIn'];
export type ActFileIn = components['schemas']['ActFileIn'];
export type ActFileOut = components['schemas']['ActFileOut'];
export type ActSignIn = components['schemas']['ActSignIn'];
export type ActOut = components['schemas']['ActOut'];
export type ActCardOut = components['schemas']['ActCardOut'];
export type CaseOut = components['schemas']['CaseOut'];
export type CaseHistoryEntry = components['schemas']['CaseHistoryEntry'];
export type AppealOut = components['schemas']['AppealOut'];
export type CaseCardOut = components['schemas']['CaseCardOut'];
export type ExplanationIn = components['schemas']['ExplanationIn'];
/** Namespaced because the bare `DecisionIn` resolves to a DIFFERENT
 *  module's schema (`permits`'s own suspend/resume/revoke shape) —
 *  re-exported here under the plain name so every later task imports
 *  `DecisionIn` from this file without needing to know that collision
 *  exists. */
export type DecisionIn = components['schemas']['app__modules__inspections__schemas__DecisionIn'];
/** Same collision, same reason — the bare `AppealIn` belongs to another
 *  module. */
export type AppealIn = components['schemas']['app__modules__inspections__schemas__AppealIn'];
export type AppealResolveIn = components['schemas']['AppealResolveIn'];
export type ClassifierItemOut = components['schemas']['ClassifierItemOut'];
export type PublicCheckResult =
  | components['schemas']['PublicCheckCard']
  | components['schemas']['PublicCheckMiss'];

// --- Checklists -------------------------------------------------------

/** `GET /inspections/checklists` — no permission code of its own beyond
 *  being signed in; every inspector screen that builds an act needs the
 *  full list to pick from. Rarely changes mid-shift, hence the 5-minute
 *  `staleTime`. */
export function useChecklists() {
  return useQuery({
    queryKey: ['inspector', 'checklists'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/inspections/checklists', {});
      if (error) throw apiError(error);
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

// --- Public permit check ------------------------------------------------

export type PublicPermitCheckInput = { qr: string } | { series: string; number: number };

/** `GET /public/permits/check` — anonymous, always-200 (`{found: false}`
 *  is a normal answer, never an error), so `retry: false`: retrying a miss
 *  would just burn the per-IP rate-limit bucket the route documents on
 *  itself for no better answer. `input === null` (nothing scanned/typed
 *  yet) leaves the query disabled rather than firing a request that names
 *  no permit at all (a 422 the route reserves for exactly that case). */
export function usePublicPermitCheck(input: PublicPermitCheckInput | null) {
  return useQuery({
    queryKey: ['inspector', 'publicCheck', input],
    queryFn: async () => {
      if (!input) throw new Error('usePublicPermitCheck: called while disabled');
      const query = 'qr' in input ? { qr: input.qr } : { series: input.series, number: input.number };
      const { data, error } = await api.GET('/api/v1/public/permits/check', { params: { query } });
      if (error) throw apiError(error);
      return data as PublicCheckResult;
    },
    enabled: input != null,
    retry: false,
  });
}

// --- Tasks ---------------------------------------------------------------

export interface TaskListFilters {
  status?: string;
  page: number;
  page_size: number;
}

export const taskKeys = {
  list: (filters: TaskListFilters) => ['inspector', 'tasks', 'list', filters] as const,
  detail: (id: string | undefined) => ['inspector', 'tasks', 'detail', id] as const,
};

/** `GET /inspections/tasks` — `view_any`/`tasks.manage` see the zone, a
 *  plain inspector sees only their own `assigned_to`; the backend narrows
 *  this without the caller asking (`service.py::list_tasks`), so this hook
 *  sends only the filters the route actually accepts. `options.enabled`
 *  lets `InspectionsPage`'s tab shell (every tab body mounts up front,
 *  toggled with `hidden`) keep a hidden tab's own query from firing —
 *  `ParamsTab.tsx`'s own `active` prop is the same pattern one track over. */
export function useTasksList(filters: TaskListFilters, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/inspections/tasks', { params: { query: filters } });
      if (error) throw apiError(error);
      return data;
    },
    placeholderData: (previous) => previous,
    enabled: options?.enabled ?? true,
  });
}

export function useTask(taskId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.detail(taskId),
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/inspections/tasks/{task_id}', {
        params: { path: { task_id: taskId! } },
      });
      if (error) throw apiError(error);
      return data;
    },
    enabled: !!taskId,
  });
}

/** `POST /tasks/{id}/start` — `task.assigned_to == self`, unconditionally;
 *  no permission bypasses this (`service.py`), so the screen must hide/
 *  disable the button itself for anyone else, this hook does not (and
 *  cannot) enforce it. */
export function useStartTask() {
  const queryClient = useQueryClient();
  return useMutation<TaskOut, ApiError, string>({
    mutationFn: async (taskId) => {
      const { data, error } = await api.POST('/api/v1/inspections/tasks/{task_id}/start', {
        params: { path: { task_id: taskId } },
      });
      if (error) throw apiError(error);
      return data;
    },
    onSuccess: (_data, taskId) => {
      void queryClient.invalidateQueries({ queryKey: ['inspector', 'tasks', 'list'] });
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
    },
  });
}

/** `POST /tasks/{id}/cancel` — `INSPECTIONS_TASKS_MANAGE` only. */
export function useCancelTask() {
  const queryClient = useQueryClient();
  return useMutation<TaskOut, ApiError, string>({
    mutationFn: async (taskId) => {
      const { data, error } = await api.POST('/api/v1/inspections/tasks/{task_id}/cancel', {
        params: { path: { task_id: taskId } },
      });
      if (error) throw apiError(error);
      return data;
    },
    onSuccess: (_data, taskId) => {
      void queryClient.invalidateQueries({ queryKey: ['inspector', 'tasks', 'list'] });
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
    },
  });
}

// --- Acts ------------------------------------------------------------

export interface ActListFilters {
  result?: string;
  page: number;
  page_size: number;
}

export const actKeys = {
  list: (filters: ActListFilters) => ['inspector', 'acts', 'list', filters] as const,
  detail: (id: string | undefined) => ['inspector', 'acts', 'detail', id] as const,
};

/** `options.enabled` matches `useTasksList`'s own convention (task 2) — lets
 *  `InspectionsPage`'s tab shell keep a hidden tab's own query from firing,
 *  since every tab body mounts up front, toggled with `hidden`. */
export function useActsList(filters: ActListFilters, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: actKeys.list(filters),
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/inspections/acts', { params: { query: filters } });
      if (error) throw apiError(error);
      return data;
    },
    placeholderData: (previous) => previous,
    enabled: options?.enabled ?? true,
  });
}

/** Returns `ActCardOut` (`gps` + `files[]` on top of the plain `ActOut`
 *  columns) — the list route answers with the leaner `ActOut` instead. */
export function useAct(actId: string | undefined) {
  return useQuery({
    queryKey: actKeys.detail(actId),
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/inspections/acts/{act_id}', {
        params: { path: { act_id: actId! } },
      });
      if (error) throw apiError(error);
      return data;
    },
    enabled: !!actId,
  });
}

/** `POST /inspections/acts` — `INSPECTIONS_ACTS_WRITE`. The screen, not this
 *  hook, is responsible for the ownership rule (`task_id` given => that
 *  task's own `assigned_to == self`, `ERR-ACL-001` otherwise) and for the
 *  "at least one of task_id/permit_id/application_id/gps" rule — both are
 *  enforced server-side regardless, this mutation just sends the body. */
export function useCreateAct() {
  const queryClient = useQueryClient();
  return useMutation<ActOut, ApiError, ActCreateIn>({
    mutationFn: async (body) => {
      const { data, error } = await api.POST('/api/v1/inspections/acts', { body });
      if (error) throw apiError(error);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inspector', 'acts', 'list'] });
    },
  });
}

/** `PATCH /inspections/acts/{id}` — own act, `status == 'draft'` only
 *  (`ERR-INSP-001 not_draft` otherwise); the screen must render read-only
 *  past that point, this hook does not gate it. */
export function useUpdateAct(actId: string) {
  const queryClient = useQueryClient();
  return useMutation<ActOut, ApiError, ActUpdateIn>({
    mutationFn: async (body) => {
      const { data, error } = await api.PATCH('/api/v1/inspections/acts/{act_id}', {
        params: { path: { act_id: actId } },
        body,
      });
      if (error) throw apiError(error);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inspector', 'acts', 'list'] });
      void queryClient.invalidateQueries({ queryKey: actKeys.detail(actId) });
    },
  });
}

/** `POST /inspections/acts/{id}/files` — same draft-only, own-act rule as
 *  `useUpdateAct`. `file_id` names a row already uploaded through
 *  `uploadActFile` below. */
export function useAttachActFile(actId: string) {
  const queryClient = useQueryClient();
  return useMutation<ActFileOut, ApiError, ActFileIn>({
    mutationFn: async (body) => {
      const { data, error } = await api.POST('/api/v1/inspections/acts/{act_id}/files', {
        params: { path: { act_id: actId } },
        body,
      });
      if (error) throw apiError(error);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: actKeys.detail(actId) });
    },
  });
}

/** `POST /inspections/acts/{id}/sign` — same draft-only, own-act rule;
 *  `result === 'violation'` REQUIRES `violation_type_item_id` in the same
 *  call (`ERR-VAL-001 violation_type_required` otherwise) — the screen
 *  must make the picker mandatory exactly then, this hook only forwards
 *  whatever body it is given. `pkcs7` is built from `actPackageBytes`
 *  (`./actPackage.ts`) through `lib/eimzoMock.ts::buildMockSignature`, the
 *  same two-step every ERI signature in this app goes through. */
export function useSignAct(actId: string) {
  const queryClient = useQueryClient();
  return useMutation<ActOut, ApiError, ActSignIn>({
    mutationFn: async (body) => {
      const { data, error } = await api.POST('/api/v1/inspections/acts/{act_id}/sign', {
        params: { path: { act_id: actId } },
        body,
      });
      if (error) throw apiError(error);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inspector', 'acts', 'list'] });
      void queryClient.invalidateQueries({ queryKey: actKeys.detail(actId) });
      // Signing a `result: 'violation'` act opens a case (`service.py
      // ::sign_act`) with no id link surfaced anywhere this data layer can
      // see (`GET /inspections/cases` has no `act_id` filter — the known
      // backend gap this plan's shared context documents). Invalidating the
      // cases list broadly means a screen already showing it still picks
      // up the new row on its own next fetch.
      void queryClient.invalidateQueries({ queryKey: ['inspector', 'cases', 'list'] });
    },
  });
}

/** `POST /files`, the same two-step upload every attachment in this app
 *  goes through — duplicated in miniature rather than imported from
 *  `permits/lifecycle.ts` (module-boundary convention, see this file's own
 *  header). Any authenticated user may call it (`app/files_router.py
 *  ::upload_file` takes `get_current_user` alone). */
export async function uploadActFile(file: File): Promise<{ id: string }> {
  const form = new FormData();
  form.append('file', file);
  const { data, error } = await api.POST('/api/v1/files', {
    body: form as unknown as { file: string },
  });
  if (error) throw apiError(error);
  return data;
}

// --- Cases -----------------------------------------------------------

export interface CaseListFilters {
  status?: string;
  page: number;
  page_size: number;
}

export const caseKeys = {
  list: (filters: CaseListFilters) => ['inspector', 'cases', 'list', filters] as const,
  detail: (id: string | undefined) => ['inspector', 'cases', 'detail', id] as const,
};

/** `options.enabled` — same reason as `useActsList`'s own. */
export function useCasesList(filters: CaseListFilters, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: caseKeys.list(filters),
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/inspections/cases', { params: { query: filters } });
      if (error) throw apiError(error);
      return data;
    },
    placeholderData: (previous) => previous,
    enabled: options?.enabled ?? true,
  });
}

/** Returns `CaseCardOut` (`history[]` + `appeals[]` on top of the plain
 *  `CaseOut` columns) — the list route answers with the leaner `CaseOut`
 *  instead. */
export function useCase(caseId: string | undefined) {
  return useQuery({
    queryKey: caseKeys.detail(caseId),
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/inspections/cases/{case_id}', {
        params: { path: { case_id: caseId! } },
      });
      if (error) throw apiError(error);
      return data;
    },
    enabled: !!caseId,
  });
}

function invalidateCase(queryClient: ReturnType<typeof useQueryClient>, caseId: string) {
  void queryClient.invalidateQueries({ queryKey: ['inspector', 'cases', 'list'] });
  void queryClient.invalidateQueries({ queryKey: caseKeys.detail(caseId) });
}

/** `POST /cases/{id}/request-explanation` — `CASES_MANAGE` OR
 *  `INSPECTIONS_ACTS_WRITE` (an inspector CAN call this on a case opened by
 *  their own act). */
export function useRequestExplanation(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<CaseOut, ApiError, void>({
    mutationFn: async () => {
      const { data, error } = await api.POST('/api/v1/inspections/cases/{case_id}/request-explanation', {
        params: { path: { case_id: caseId } },
      });
      if (error) throw apiError(error);
      return data;
    },
    onSuccess: () => invalidateCase(queryClient, caseId),
  });
}

/** `POST /cases/{id}/explanation` — the case's own applicant, or
 *  `CASES_MANAGE`; never a plain inspector on someone else's behalf (the
 *  screen must gate this, this hook does not). */
export function useSubmitExplanation(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<CaseOut, ApiError, { text: string; file_id?: string }>({
    mutationFn: async (body) => {
      const { data, error } = await api.POST('/api/v1/inspections/cases/{case_id}/explanation', {
        params: { path: { case_id: caseId } },
        body,
      });
      if (error) throw apiError(error);
      return data;
    },
    onSuccess: () => invalidateCase(queryClient, caseId),
  });
}

/** `POST /cases/{id}/decide` — `CASES_MANAGE` only, full stop. */
export function useDecideCase(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<CaseOut, ApiError, DecisionIn>({
    mutationFn: async (body) => {
      const { data, error } = await api.POST('/api/v1/inspections/cases/{case_id}/decide', {
        params: { path: { case_id: caseId } },
        body,
      });
      if (error) throw apiError(error);
      return data;
    },
    onSuccess: () => invalidateCase(queryClient, caseId),
  });
}

/** `POST /cases/{id}/appeal` — the case's own applicant only, and only if
 *  it has no OTHER open appeal already; correct and expected that a plain
 *  inspector never sees this control (appeals are the violator's own
 *  action). */
export function useAppealCase(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<AppealOut, ApiError, { text: string }>({
    mutationFn: async (body) => {
      const { data, error } = await api.POST('/api/v1/inspections/cases/{case_id}/appeal', {
        params: { path: { case_id: caseId } },
        body,
      });
      if (error) throw apiError(error);
      return data;
    },
    onSuccess: () => invalidateCase(queryClient, caseId),
  });
}

/** `POST /cases/{id}/appeal/resolve` — `CASES_MANAGE` only. */
export function useResolveAppeal(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<AppealOut, ApiError, { result: string }>({
    mutationFn: async (body) => {
      const { data, error } = await api.POST('/api/v1/inspections/cases/{case_id}/appeal/resolve', {
        params: { path: { case_id: caseId } },
        body,
      });
      if (error) throw apiError(error);
      return data;
    },
    onSuccess: () => invalidateCase(queryClient, caseId),
  });
}

/** `POST /cases/{id}/close` — `CASES_MANAGE` only. */
export function useCloseCase(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<CaseOut, ApiError, void>({
    mutationFn: async () => {
      const { data, error } = await api.POST('/api/v1/inspections/cases/{case_id}/close', {
        params: { path: { case_id: caseId } },
      });
      if (error) throw apiError(error);
      return data;
    },
    onSuccess: () => invalidateCase(queryClient, caseId),
  });
}

// --- Violation types classifier ---------------------------------------

/** Mirrors `permits/lifecycle.ts::usePermitStatusReasons` verbatim —
 *  `VT-01…06`, the same generic classifier-items route every reference
 *  list in this app already uses. Mandatory on `ActSignIn` exactly when
 *  the act's own `result === 'violation'`, never otherwise (`service.py`
 *  ::sign_act`). */
export function useViolationTypes() {
  return useQuery({
    queryKey: ['refs', 'classifiers', 'violation_types'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/refs/classifiers/{code}/items', {
        params: { path: { code: 'violation_types' } },
      });
      if (error) throw apiError(error);
      return data;
    },
    staleTime: 10 * 60_000,
  });
}
