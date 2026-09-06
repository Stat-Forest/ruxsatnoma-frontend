/** Thin wrappers over every `reports` route — mirrors
 *  `app/modules/reports/router.py` one function per endpoint. Types come
 *  from `src/api/schema.d.ts` (already regenerated for this module — never
 *  regenerate it). */
import { api } from '../../api/client';
import { apiError } from '../../api/errors';
import type { components } from '../../api/schema';

export type ReportFormOut = components['schemas']['ReportFormOut'];
export type ReportFormCreate = components['schemas']['ReportFormCreate'];
export type ReportFormColumn = components['schemas']['ReportFormColumn'];
export type ReportOut = components['schemas']['ReportOut'];
export type ReportCreate = components['schemas']['ReportCreate'];
export type ReportDataUpdate = components['schemas']['ReportDataUpdate'];
export type ReportSignIn = components['schemas']['ReportSignIn'];
export type ReportReturnIn = components['schemas']['ReportReturnIn'];

export interface PageQuery { page: number; page_size: number }

export async function listForms(params: PageQuery & { status?: string }) {
  const { data, error } = await api.GET('/api/v1/reports/forms', { params: { query: params } });
  if (error) throw apiError(error);
  return data;
}

export async function createForm(body: ReportFormCreate) {
  const { data, error } = await api.POST('/api/v1/reports/forms', { body });
  if (error) throw apiError(error);
  return data;
}

export async function getForm(formId: string) {
  const { data, error } = await api.GET('/api/v1/reports/forms/{form_id}', { params: { path: { form_id: formId } } });
  if (error) throw apiError(error);
  return data;
}

export async function activateForm(formId: string) {
  const { data, error } = await api.POST('/api/v1/reports/forms/{form_id}/activate', { params: { path: { form_id: formId } } });
  if (error) throw apiError(error);
  return data;
}

export async function archiveForm(formId: string) {
  const { data, error } = await api.POST('/api/v1/reports/forms/{form_id}/archive', { params: { path: { form_id: formId } } });
  if (error) throw apiError(error);
  return data;
}

export async function listReports(params: PageQuery & { organization_id?: string; status?: string; form_id?: string }) {
  const { data, error } = await api.GET('/api/v1/reports', { params: { query: params } });
  if (error) throw apiError(error);
  return data;
}

export async function createReport(body: ReportCreate) {
  const { data, error } = await api.POST('/api/v1/reports', { body });
  if (error) throw apiError(error);
  return data;
}

export async function getReport(reportId: string) {
  const { data, error } = await api.GET('/api/v1/reports/{report_id}', { params: { path: { report_id: reportId } } });
  if (error) throw apiError(error);
  return data;
}

export async function generateReport(reportId: string) {
  const { data, error } = await api.POST('/api/v1/reports/{report_id}/generate', { params: { path: { report_id: reportId } } });
  if (error) throw apiError(error);
  return data;
}

export async function updateReportData(reportId: string, body: ReportDataUpdate) {
  const { data, error } = await api.PATCH('/api/v1/reports/{report_id}/data', { params: { path: { report_id: reportId } }, body });
  if (error) throw apiError(error);
  return data;
}

export async function submitReport(reportId: string) {
  const { data, error } = await api.POST('/api/v1/reports/{report_id}/submit', { params: { path: { report_id: reportId } } });
  if (error) throw apiError(error);
  return data;
}

export async function signReport(reportId: string, body: ReportSignIn) {
  const { data, error } = await api.POST('/api/v1/reports/{report_id}/sign', { params: { path: { report_id: reportId } }, body });
  if (error) throw apiError(error);
  return data;
}

export async function returnReport(reportId: string, body: ReportReturnIn) {
  const { data, error } = await api.POST('/api/v1/reports/{report_id}/return', { params: { path: { report_id: reportId } }, body });
  if (error) throw apiError(error);
  return data;
}

export async function approveReport(reportId: string) {
  const { data, error } = await api.POST('/api/v1/reports/{report_id}/approve', { params: { path: { report_id: reportId } } });
  if (error) throw apiError(error);
  return data;
}

export async function reviseReport(reportId: string) {
  const { data, error } = await api.POST('/api/v1/reports/{report_id}/revise', { params: { path: { report_id: reportId } } });
  if (error) throw apiError(error);
  return data;
}

// --- exports: binary responses, outside the typed JSON client -------------
// Same reasoning as `pages/permits/PermitPdfPanel.tsx`: openapi-fetch parses
// every response as JSON, so a binary route needs a plain `fetch`.
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

async function fetchExport(reportId: string, kind: 'xlsx' | 'pdf'): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/v1/reports/${reportId}/export.${kind}`, { credentials: 'include' });
  if (!res.ok) {
    let message = `Faylni yuklab boʻlmadi (${res.status})`;
    try {
      const body = (await res.clone().json()) as { error?: { message?: string } };
      if (body?.error?.message) message = body.error.message;
    } catch {
      // The body was not JSON — the fallback message above stays.
    }
    throw new Error(message);
  }
  return res.blob();
}

export function fetchReportExcel(reportId: string): Promise<Blob> {
  return fetchExport(reportId, 'xlsx');
}
export function fetchReportPdf(reportId: string): Promise<Blob> {
  return fetchExport(reportId, 'pdf');
}
