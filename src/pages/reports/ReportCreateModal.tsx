/**
 * `POST /reports` — creates a new report instance from an ACTIVE form. Only
 * `active` forms are offered (an inactive one is refused server-side with
 * `ERR-REP-003` anyway — house rule: don't offer what the backend would
 * refuse). On success, navigates straight to the new report's own detail
 * page (task 7's `ReportDetailPage`).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../auth/useAuth';
import { useLanguage, useT } from '../../i18n/useT';
import { ApiError } from '../../api/errors';
import { Alert } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/button';
import { FormField, Input, Select } from '../../components/ui/FormControls';
import { Modal } from '../../components/ui/Overlay';
import { pickLocalizedName } from './format';
import { useActiveReportForms, useCreateReport, useLeshozOrganizations } from './queries';
import type { ReportCreate } from './api';

function createErrorMessage(t: (key: string) => string, err: ApiError): string {
  if (err.code === 'ERR-REP-001') return t('reports.create.error.duplicatePeriod');
  if (err.code === 'ERR-REP-003') return t('reports.create.error.formNotActive');
  if (err.code === 'ERR-ACL-002') return t('reports.create.error.zone');
  return t('reports.create.error.generic');
}

export function ReportCreateModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { lang } = useLanguage();
  const { me } = useAuth();
  const navigate = useNavigate();

  const activeForms = useActiveReportForms();
  const organizations = useLeshozOrganizations(true);
  const create = useCreateReport();

  const [formId, setFormId] = useState('');
  // Pre-selected for a zoned actor (`_assert_zone` refuses any OTHER
  // organization for them anyway); left blank for a zone-free
  // `central_admin`/`accountant`, who picks explicitly.
  const [organizationId, setOrganizationId] = useState(me?.zone.organization_id ?? '');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const canSubmit = !!formId && !!organizationId && !!periodStart && !!periodEnd && !create.isPending;

  function handleSubmit() {
    if (!canSubmit) return;
    const body: ReportCreate = {
      form_id: formId,
      organization_id: organizationId,
      period_start: periodStart,
      period_end: periodEnd,
    };
    create.mutate(body, {
      onSuccess: (report) => navigate(`/reports/${report.id}`),
    });
  }

  const apiErr = create.error instanceof ApiError ? create.error : null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('reports.create.title')}
      maxWidth="md"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 w-full">
          <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={onClose} disabled={create.isPending}>
            {t('reports.create.cancel')}
          </Button>
          <Button type="button" variant="primary" className="w-full sm:w-auto" isLoading={create.isPending} disabled={!canSubmit} onClick={handleSubmit}>
            {t('reports.create.submit')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormField label={t('reports.create.formLabel')} required>
          <Select
            value={formId}
            onChange={(e) => setFormId(e.target.value)}
            options={[
              { value: '', label: t('reports.create.formPlaceholder') },
              ...(activeForms.data?.items ?? []).map((form) => ({
                value: form.id,
                label: `${pickLocalizedName(form.name, lang) || form.code} (v${form.version})`,
              })),
            ]}
          />
        </FormField>
        <FormField label={t('reports.create.organizationLabel')} required>
          <Select
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            options={[
              { value: '', label: t('reports.create.organizationPlaceholder') },
              ...(organizations.data?.items ?? []).map((org) => ({
                value: org.id,
                label: pickLocalizedName(org.name, lang) || org.code,
              })),
            ]}
          />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label={t('reports.create.periodStartLabel')} required>
            <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </FormField>
          <FormField label={t('reports.create.periodEndLabel')} required>
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </FormField>
        </div>

        {apiErr && (
          <div data-testid="report-create-error">
            <Alert variant="danger">{createErrorMessage(t, apiErr)}</Alert>
          </div>
        )}
      </div>
    </Modal>
  );
}
