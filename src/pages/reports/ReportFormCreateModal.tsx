/**
 * `POST /reports/forms` — creates a new report FORM (a template), always in
 * `draft` status server-side. `ReportFormCreate.columns` is
 * `Field(min_length=1)` on the wire (`schemas.py`) — refused client-side
 * with a visible message before the request is even sent, the same house
 * rule every other "the backend would refuse this" gate in this track
 * follows.
 */
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { apiError, ApiError } from '../../api/errors';
import { useT } from '../../i18n/useT';
import { Button } from '../../components/ui/button';
import { FormField, Input, Select, Textarea } from '../../components/ui/FormControls';
import { Alert } from '../../components/ui/Feedback';
import { Modal } from '../../components/ui/Overlay';
import { useCreateReportForm } from './queries';
import type { ReportFormColumn, ReportFormCreate } from './api';

type ColumnDraft = {
  code: string;
  labelUz: string;
  labelRu: string;
  source: ReportFormColumn['source'];
  type: ReportFormColumn['type'];
};

function emptyColumn(): ColumnDraft {
  return { code: '', labelUz: '', labelRu: '', source: 'manual', type: 'text' };
}

function localizedName(uz: string, ru: string): Record<string, string> {
  const name: Record<string, string> = {};
  if (uz.trim()) name.uz_latn = uz.trim();
  if (ru.trim()) name.ru = ru.trim();
  return name;
}

function useActivityTypesForModal() {
  return useQuery({
    queryKey: ['reports', 'refs', 'activity-types'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/refs/activity-types', {});
      if (error) throw apiError(error);
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

export function ReportFormCreateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const activityTypes = useActivityTypesForModal();
  const create = useCreateReportForm();

  const [code, setCode] = useState('');
  const [version, setVersion] = useState('1');
  const [nameUz, setNameUz] = useState('');
  const [nameRu, setNameRu] = useState('');
  const [activityTypeId, setActivityTypeId] = useState('');
  const [periodType, setPeriodType] = useState<ReportFormCreate['period_type']>('month');
  const [validFrom, setValidFrom] = useState('');
  const [columns, setColumns] = useState<ColumnDraft[]>([emptyColumn()]);
  const [rulesText, setRulesText] = useState('[]');
  const [scheduleText, setScheduleText] = useState('{}');
  const [localError, setLocalError] = useState<string | null>(null);

  function updateColumn(index: number, patch: Partial<ColumnDraft>) {
    setColumns((prev) => prev.map((col, i) => (i === index ? { ...col, ...patch } : col)));
  }
  function addColumn() {
    setColumns((prev) => [...prev, emptyColumn()]);
  }
  function removeColumn(index: number) {
    setColumns((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit() {
    setLocalError(null);

    if (columns.length === 0) {
      setLocalError(t('reports.forms.create.error.columnsRequired'));
      return;
    }

    let rules: Record<string, unknown>[];
    let schedule: Record<string, unknown>;
    try {
      rules = rulesText.trim() ? (JSON.parse(rulesText) as Record<string, unknown>[]) : [];
    } catch {
      setLocalError(t('reports.forms.create.error.invalidJson'));
      return;
    }
    try {
      schedule = scheduleText.trim() ? (JSON.parse(scheduleText) as Record<string, unknown>) : {};
    } catch {
      setLocalError(t('reports.forms.create.error.invalidJson'));
      return;
    }

    const body: ReportFormCreate = {
      code: code.trim(),
      version: Number(version) || 1,
      name: localizedName(nameUz, nameRu),
      activity_type_id: activityTypeId || undefined,
      period_type: periodType,
      columns: columns.map((col) => ({
        code: col.code.trim(),
        label: localizedName(col.labelUz, col.labelRu),
        source: col.source,
        type: col.type,
      })),
      rules,
      schedule,
      valid_from: validFrom || undefined,
    };

    create.mutate(body, { onSuccess: onSaved });
  }

  const apiErr = create.error instanceof ApiError ? create.error : null;
  const reason = (apiErr?.details as { reason?: string } | undefined)?.reason;
  const apiErrorMessage =
    apiErr?.code === 'ERR-REP-001' && reason === 'form_version_exists'
      ? t('reports.forms.create.error.versionExists')
      : apiErr
        ? t('reports.forms.create.error.generic')
        : null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('reports.forms.create.title')}
      maxWidth="2xl"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={create.isPending}>
            {t('reports.forms.create.cancel')}
          </Button>
          <Button type="button" variant="primary" isLoading={create.isPending} onClick={handleSubmit}>
            {t('reports.forms.create.submit')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label={t('reports.forms.create.codeLabel')} required>
            <Input value={code} onChange={(e) => setCode(e.target.value)} />
          </FormField>
          <FormField label={t('reports.forms.create.versionLabel')} required>
            <Input type="number" min={1} value={version} onChange={(e) => setVersion(e.target.value)} />
          </FormField>
          <FormField label={t('reports.forms.create.nameUzLabel')}>
            <Input value={nameUz} onChange={(e) => setNameUz(e.target.value)} />
          </FormField>
          <FormField label={t('reports.forms.create.nameRuLabel')}>
            <Input value={nameRu} onChange={(e) => setNameRu(e.target.value)} />
          </FormField>
          <FormField label={t('reports.forms.create.activityTypeLabel')}>
            <Select
              value={activityTypeId}
              onChange={(e) => setActivityTypeId(e.target.value)}
              options={[
                { value: '', label: t('reports.forms.create.activityTypeAll') },
                ...(activityTypes.data ?? []).map((item) => ({
                  value: item.id,
                  label: (item.name?.uz_latn as string | undefined) ?? item.code,
                })),
              ]}
            />
          </FormField>
          <FormField label={t('reports.forms.create.periodTypeLabel')} required>
            <Select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as ReportFormCreate['period_type'])}
              options={[
                { value: 'month', label: t('reports.forms.periodType.month') },
                { value: 'quarter', label: t('reports.forms.periodType.quarter') },
                { value: 'year', label: t('reports.forms.periodType.year') },
              ]}
            />
          </FormField>
          <FormField label={t('reports.forms.create.validFromLabel')}>
            <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          </FormField>
        </div>

        <FormField label={t('reports.forms.create.columnsLabel')} required>
          <div className="space-y-2">
            {columns.map((col, index) => (
              <div key={index} className="grid grid-cols-1 gap-2 rounded-lg border border-[#E4E7EA] p-3 sm:grid-cols-6" data-testid={`report-form-column-${index}`}>
                <Input
                  placeholder={t('reports.forms.create.columnCode')}
                  value={col.code}
                  onChange={(e) => updateColumn(index, { code: e.target.value })}
                />
                <Input
                  placeholder={t('reports.forms.create.columnLabelUz')}
                  value={col.labelUz}
                  onChange={(e) => updateColumn(index, { labelUz: e.target.value })}
                />
                <Input
                  placeholder={t('reports.forms.create.columnLabelRu')}
                  value={col.labelRu}
                  onChange={(e) => updateColumn(index, { labelRu: e.target.value })}
                />
                <Select
                  value={col.source}
                  onChange={(e) => updateColumn(index, { source: e.target.value as ColumnDraft['source'] })}
                  options={[
                    { value: 'auto', label: t('reports.forms.create.columnSourceAuto') },
                    { value: 'manual', label: t('reports.forms.create.columnSourceManual') },
                  ]}
                />
                <Select
                  value={col.type}
                  onChange={(e) => updateColumn(index, { type: e.target.value as ColumnDraft['type'] })}
                  options={[
                    { value: 'text', label: t('reports.forms.create.columnTypeText') },
                    { value: 'number', label: t('reports.forms.create.columnTypeNumber') },
                    { value: 'date', label: t('reports.forms.create.columnTypeDate') },
                    { value: 'money', label: t('reports.forms.create.columnTypeMoney') },
                  ]}
                />
                <div className="flex items-center justify-end sm:col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    data-testid={`report-form-column-remove-${index}`}
                    leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => removeColumn(index)}
                  >
                    {t('reports.forms.create.columnRemove')}
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={addColumn} data-testid="report-form-column-add">
              {t('reports.forms.create.columnAdd')}
            </Button>
          </div>
        </FormField>

        <FormField label={t('reports.forms.create.rulesLabel')} helperText={t('reports.forms.create.rulesHint')}>
          <Textarea value={rulesText} onChange={(e) => setRulesText(e.target.value)} />
        </FormField>

        <FormField label={t('reports.forms.create.scheduleLabel')} helperText={t('reports.forms.create.scheduleHint')}>
          <Textarea value={scheduleText} onChange={(e) => setScheduleText(e.target.value)} />
        </FormField>

        {localError && (
          <div data-testid="report-form-create-error">
            <Alert variant="danger">{localError}</Alert>
          </div>
        )}
        {apiErrorMessage && (
          <div data-testid="report-form-create-api-error">
            <Alert variant="danger">{apiErrorMessage}</Alert>
          </div>
        )}
      </div>
    </Modal>
  );
}
