/**
 * react-query bindings over `api.ts`, one hook per route (17 total, forms +
 * reports + lifecycle). List/detail keys follow this codebase's own
 * convention (`pages/norms/tariffs/queries.ts`'s single-root-key shape):
 * `['reports', 'forms', 'list', params]`, `['reports', 'forms', 'detail',
 * formId]`, `['reports', 'list', params]`, `['reports', 'detail',
 * reportId]`.
 *
 * Every lifecycle mutation invalidates both the report's own detail query
 * and the reports list on success — EXCEPT `useReviseReport`, whose 201
 * response is a DIFFERENT report (`service.revise_report` mints a new row,
 * `parent_report_id` set, a new id). Invalidating the OLD report's detail
 * key there would just refetch a report that never changed status; the
 * caller (`ReportDetailPage`, task 7) navigates to the new id instead,
 * whose own detail query has never been fetched and needs no invalidation.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  activateForm,
  approveReport,
  archiveForm,
  createForm,
  createReport,
  generateReport,
  getForm,
  getReport,
  listForms,
  listReports,
  returnReport,
  reviseReport,
  signReport,
  submitReport,
  updateReportData,
  type ReportCreate,
  type ReportDataUpdate,
  type ReportFormCreate,
  type ReportReturnIn,
  type ReportSignIn,
} from './api';

const FORMS_KEY = ['reports', 'forms'] as const;
const REPORTS_KEY = ['reports', 'list'] as const;

function reportDetailKey(reportId: string) {
  return ['reports', 'detail', reportId] as const;
}

export function useReportFormsList(params: { status?: string; page: number; page_size: number }) {
  return useQuery({
    queryKey: [...FORMS_KEY, 'list', params],
    queryFn: () => listForms(params),
    placeholderData: (previous) => previous,
  });
}

/** The "create report" modal's form picker — only ACTIVE forms, since an
 *  inactive one would be refused server-side with `ERR-REP-003` anyway
 *  (house rule: don't offer what the backend would refuse). */
export function useActiveReportForms() {
  return useQuery({
    queryKey: [...FORMS_KEY, 'list', { status: 'active', page: 1, page_size: 100 }],
    queryFn: () => listForms({ status: 'active', page: 1, page_size: 100 }),
    staleTime: 60_000,
  });
}

export function useReportForm(formId: string | undefined) {
  return useQuery({
    queryKey: [...FORMS_KEY, 'detail', formId],
    queryFn: () => getForm(formId!),
    enabled: !!formId,
  });
}

export function useCreateReportForm() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: ReportFormCreate) => createForm(body),
    onSuccess: () => client.invalidateQueries({ queryKey: FORMS_KEY }),
  });
}

export function useActivateReportForm() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (formId: string) => activateForm(formId),
    onSuccess: () => client.invalidateQueries({ queryKey: FORMS_KEY }),
  });
}

export function useArchiveReportForm() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (formId: string) => archiveForm(formId),
    onSuccess: () => client.invalidateQueries({ queryKey: FORMS_KEY }),
  });
}

export function useReportsList(params: {
  organization_id?: string;
  status?: string;
  form_id?: string;
  page: number;
  page_size: number;
}) {
  return useQuery({
    queryKey: [...REPORTS_KEY, params],
    queryFn: () => listReports(params),
    placeholderData: (previous) => previous,
  });
}

export function useReport(reportId: string | undefined) {
  return useQuery({
    queryKey: reportDetailKey(reportId ?? ''),
    queryFn: () => getReport(reportId!),
    enabled: !!reportId,
    retry: false,
  });
}

export function useCreateReport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: ReportCreate) => createReport(body),
    onSuccess: () => client.invalidateQueries({ queryKey: REPORTS_KEY }),
  });
}

function useLifecycleInvalidate(reportId: string) {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: reportDetailKey(reportId) });
    void client.invalidateQueries({ queryKey: REPORTS_KEY });
  };
}

export function useGenerateReport(reportId: string) {
  const invalidate = useLifecycleInvalidate(reportId);
  return useMutation({
    mutationFn: () => generateReport(reportId),
    onSuccess: invalidate,
  });
}

export function useUpdateReportData(reportId: string) {
  const invalidate = useLifecycleInvalidate(reportId);
  return useMutation({
    mutationFn: (body: ReportDataUpdate) => updateReportData(reportId, body),
    onSuccess: invalidate,
  });
}

export function useSubmitReport(reportId: string) {
  const invalidate = useLifecycleInvalidate(reportId);
  return useMutation({
    mutationFn: () => submitReport(reportId),
    onSuccess: invalidate,
  });
}

export function useSignReport(reportId: string) {
  const invalidate = useLifecycleInvalidate(reportId);
  return useMutation({
    mutationFn: (body: ReportSignIn) => signReport(reportId, body),
    onSuccess: invalidate,
  });
}

export function useReturnReport(reportId: string) {
  const invalidate = useLifecycleInvalidate(reportId);
  return useMutation({
    mutationFn: (body: ReportReturnIn) => returnReport(reportId, body),
    onSuccess: invalidate,
  });
}

export function useApproveReport(reportId: string) {
  const invalidate = useLifecycleInvalidate(reportId);
  return useMutation({
    mutationFn: () => approveReport(reportId),
    onSuccess: invalidate,
  });
}

/** No detail-query invalidation — see this file's own header note: the 201
 *  response is a NEW report under a different id, and the caller navigates
 *  to it rather than re-rendering this one. The list IS invalidated so a
 *  reload of `/reports` shows the new revision alongside its parent. */
export function useReviseReport(reportId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => reviseReport(reportId),
    onSuccess: () => client.invalidateQueries({ queryKey: REPORTS_KEY }),
  });
}
