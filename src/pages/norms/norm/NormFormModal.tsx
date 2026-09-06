/**
 * F5 write — create and edit. `contour_id`/`activity_type_id` are identity
 * (`NormPatch` carries neither), so — the same convention
 * `TariffFormModal.tsx` established for `activity_type_id`/`livestock_group`
 * — edit mode shows both as read-only facts, never a disabled control.
 *
 * `update_norm` only accepts `draft`/`review` (`service.py`'s own comment:
 * "approved and beyond are a fact of record") — this form does not enforce
 * that itself; the caller (`NormsTab.tsx`) never opens it for a row outside
 * those two statuses, the house rule applied at the OFFERING site rather
 * than duplicated as a second guard inside the form.
 */
import { useState } from 'react';
import { FormField, Input, Select } from '../../../components/ui/FormControls';
import { Alert } from '../../../components/ui/Feedback';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/Overlay';
import { ApiError } from '../../../api/errors';
import { useLanguage, useT } from '../../../i18n/useT';
import { pickLocalizedName, useActivityTypes } from '../refs';
import { fileUrl, uploadDocument, type NormOut } from './api';
import { ContourSearchField, type PickedContour } from './ContourSearchField';
import { parseRestYears, restYearsToText, rotationYears } from './rotation';
import { rowsToSeason, seasonToRows, seasonWindowError, type SeasonWindowRow } from './season';
import { useCreateNorm, useUpdateNorm } from './queries';
import { yieldError } from './yield';

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? `${error.code}: ${error.message}` : fallback;
}

export type NormFormMode = 'create' | 'edit';

export interface NormFormModalProps {
  mode: NormFormMode;
  row?: NormOut;
  contourNumber?: string;
  onClose: () => void;
  onSaved: (row: NormOut) => void;
}

export function NormFormModal({ mode, row, contourNumber, onClose, onSaved }: NormFormModalProps) {
  const t = useT();
  const { lang } = useLanguage();
  const activityTypes = useActivityTypes();
  const create = useCreateNorm();
  const update = useUpdateNorm();
  const mutation = mode === 'create' ? create : update;

  const [contour, setContour] = useState<PickedContour | null>(
    row ? { id: row.contour_id, number: contourNumber ?? row.contour_id } : null,
  );
  const [activityTypeId, setActivityTypeId] = useState(row?.activity_type_id ?? '');
  const [yieldText, setYieldText] = useState(row?.yield_c_per_ha ?? '');
  const [seasonRows, setSeasonRows] = useState<SeasonWindowRow[]>(() => seasonToRows(row?.season));
  const [restYearsText, setRestYearsText] = useState(() => restYearsToText(rotationYears(row?.rotation)));
  const [docId, setDocId] = useState<string | null>(row?.geobotanic_doc_id ?? null);
  const [docError, setDocError] = useState<string | null>(null);
  const [docUploading, setDocUploading] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState(row?.effective_from ?? '');
  const [effectiveTo, setEffectiveTo] = useState(row?.effective_to ?? '');
  const [touched, setTouched] = useState(false);

  const contourValid = mode === 'edit' || contour !== null;
  const activityTypeValid = mode === 'edit' || activityTypeId !== '';
  const yErr = yieldError(yieldText);
  const seasonRowErrors = seasonRows.map((r) => (r.from !== '' || r.to !== '' ? seasonWindowError(r) : null));
  const seasonValid = seasonRowErrors.every((e) => e === null);
  const restYearsParsed = parseRestYears(restYearsText);
  const rotationValid = !('error' in restYearsParsed);
  const effectiveFromValid = effectiveFrom.length > 0;
  const effectiveToValid = !effectiveTo || !effectiveFrom || effectiveTo >= effectiveFrom;

  async function handleDocUpload(file: File) {
    setDocError(null);
    setDocUploading(true);
    try {
      const uploaded = await uploadDocument(file);
      setDocId(uploaded.id);
    } catch (error) {
      setDocError(errorText(error, t('norms.norms.form.docUploadFailed')));
    } finally {
      setDocUploading(false);
    }
  }

  function addSeasonRow() {
    setSeasonRows((rows) => [...rows, { from: '', to: '' }]);
  }

  function removeSeasonRow(index: number) {
    setSeasonRows((rows) => rows.filter((_, i) => i !== index));
  }

  function updateSeasonRow(index: number, patch: Partial<SeasonWindowRow>) {
    setSeasonRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function submit() {
    setTouched(true);
    if (
      !contourValid ||
      !activityTypeValid ||
      yErr !== null ||
      !seasonValid ||
      !rotationValid ||
      !effectiveFromValid ||
      !effectiveToValid
    ) {
      return;
    }

    const shared = {
      yield_c_per_ha: yieldText.trim() === '' ? null : yieldText.trim(),
      season: rowsToSeason(seasonRows) ?? null,
      rotation: !('error' in restYearsParsed) && restYearsParsed.years.length > 0 ? { rest_years: restYearsParsed.years } : null,
      geobotanic_doc_id: docId,
      effective_from: effectiveFrom,
      effective_to: effectiveTo || null,
    };
    if (mode === 'create') {
      create.mutate({ contour_id: contour!.id, activity_type_id: activityTypeId, ...shared }, { onSuccess: onSaved });
    } else {
      update.mutate({ id: row!.id, body: shared }, { onSuccess: onSaved });
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={mode === 'create' ? t('norms.norms.form.createTitle') : t('norms.norms.form.editTitle')}
      maxWidth="xl"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            {t('norms.norms.form.cancel')}
          </Button>
          <Button type="button" variant="primary" isLoading={mutation.isPending} onClick={submit}>
            {t('norms.norms.form.save')}
          </Button>
        </>
      }
    >
      <div data-testid="norm-form" className="space-y-4">
        {mode === 'create' ? (
          <FormField
            label={t('norms.norms.form.contour')}
            required
            error={touched && !contourValid ? t('norms.norms.form.contourRequired') : undefined}
          >
            <ContourSearchField
              value={contour}
              onChange={setContour}
              placeholder={t('norms.norms.form.contourSearchPlaceholder')}
              noMatches={t('norms.norms.form.contourNoMatches')}
            />
          </FormField>
        ) : (
          <FormField label={t('norms.norms.form.contour')}>
            <p className="text-sm font-medium text-[#1A1F24]" data-testid="norm-contour-readonly">
              № {contour?.number ?? row!.contour_id}
            </p>
          </FormField>
        )}

        {mode === 'create' ? (
          <FormField
            label={t('norms.norms.form.activityType')}
            required
            htmlFor="norm-activity-type"
            error={touched && !activityTypeValid ? t('norms.norms.form.activityTypeRequired') : undefined}
          >
            <Select
              id="norm-activity-type"
              data-testid="norm-activity-type"
              value={activityTypeId}
              onChange={(event) => setActivityTypeId(event.target.value)}
              options={[
                { value: '', label: t('norms.norms.form.activityTypePlaceholder') },
                ...(activityTypes.data ?? []).map((a) => ({ value: a.id, label: pickLocalizedName(a.name, lang) || a.code })),
              ]}
            />
          </FormField>
        ) : (
          <FormField label={t('norms.norms.form.activityType')}>
            <p className="text-sm font-medium text-[#1A1F24]" data-testid="norm-activity-type-readonly">
              {pickLocalizedName(activityTypes.data?.find((a) => a.id === row!.activity_type_id)?.name, lang) ||
                row!.activity_type_id}
            </p>
          </FormField>
        )}

        <FormField
          label={t('norms.norms.form.yield')}
          helperText={t('norms.norms.form.yieldHint')}
          htmlFor="norm-yield"
          error={touched && yErr !== null ? t(`norms.norms.form.yieldError.${yErr}`) : undefined}
        >
          <Input
            id="norm-yield"
            data-testid="norm-yield"
            className="font-mono"
            value={yieldText}
            onChange={(event) => setYieldText(event.target.value)}
            placeholder="12.5"
          />
        </FormField>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#5A646D]">
              {t('norms.norms.form.season')}
            </span>
            <Button type="button" variant="outline" size="sm" data-testid="norm-season-add" onClick={addSeasonRow}>
              {t('norms.norms.form.seasonAdd')}
            </Button>
          </div>
          <p className="text-xs text-[#5A646D]">{t('norms.norms.form.seasonHint')}</p>
          {seasonRows.length === 0 && <p className="text-xs text-[#5A646D]">{t('norms.norms.form.seasonEmpty')}</p>}
          {seasonRows.map((seasonRow, index) => {
            const rowError = seasonRowErrors[index];
            return (
              <div key={index} className="flex items-center gap-2" data-testid={`norm-season-row-${index}`}>
                <Input
                  data-testid={`norm-season-from-${index}`}
                  className="w-24 font-mono"
                  placeholder="05-01"
                  value={seasonRow.from}
                  onChange={(event) => updateSeasonRow(index, { from: event.target.value })}
                  error={touched && rowError === 'fromInvalid'}
                />
                <span className="text-xs text-[#5A646D]">{t('norms.norms.form.seasonTo')}</span>
                <Input
                  data-testid={`norm-season-to-${index}`}
                  className="w-24 font-mono"
                  placeholder="09-30"
                  value={seasonRow.to}
                  onChange={(event) => updateSeasonRow(index, { to: event.target.value })}
                  error={touched && rowError === 'toInvalid'}
                />
                <Button type="button" variant="ghost" size="sm" data-testid={`norm-season-remove-${index}`} onClick={() => removeSeasonRow(index)}>
                  {t('norms.norms.form.seasonRemove')}
                </Button>
              </div>
            );
          })}
          {touched && !seasonValid && (
            <p className="text-xs text-[#B91C1C]">{t('norms.norms.form.seasonInvalid')}</p>
          )}
        </div>

        <FormField
          label={t('norms.norms.form.rotation')}
          helperText={t('norms.norms.form.rotationHint')}
          htmlFor="norm-rotation"
          error={touched && !rotationValid ? t('norms.norms.form.rotationInvalid') : undefined}
        >
          <Input
            id="norm-rotation"
            data-testid="norm-rotation"
            value={restYearsText}
            placeholder="2027, 2029"
            onChange={(event) => setRestYearsText(event.target.value)}
          />
        </FormField>

        <FormField label={t('norms.norms.form.geobotanicDoc')} helperText={t('norms.norms.form.geobotanicDocHint')}>
          <div className="space-y-1.5">
            {docId && (
              <a
                href={fileUrl(docId)}
                target="_blank"
                rel="noreferrer"
                data-testid="norm-geobotanic-doc-link"
                className="block text-xs font-mono text-[#2E7D4F] underline"
              >
                {t('norms.norms.form.geobotanicDocCurrent')}: {docId}
              </a>
            )}
            <input
              type="file"
              data-testid="norm-geobotanic-doc-upload"
              disabled={docUploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleDocUpload(file);
              }}
              className="block text-xs"
            />
            {docUploading && <p className="text-xs text-[#5A646D]">{t('norms.norms.form.docUploading')}</p>}
            {docError && <p className="text-xs text-[#B91C1C]">{docError}</p>}
          </div>
        </FormField>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            label={t('norms.norms.form.effectiveFrom')}
            required
            htmlFor="norm-effective-from"
            error={touched && !effectiveFromValid ? t('norms.norms.form.effectiveFromRequired') : undefined}
          >
            <Input
              id="norm-effective-from"
              data-testid="norm-effective-from"
              type="date"
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
            />
          </FormField>
          <FormField
            label={t('norms.norms.form.effectiveTo')}
            htmlFor="norm-effective-to"
            error={touched && !effectiveToValid ? t('norms.norms.form.effectiveToBeforeFrom') : undefined}
          >
            <Input
              id="norm-effective-to"
              data-testid="norm-effective-to"
              type="date"
              value={effectiveTo}
              onChange={(event) => setEffectiveTo(event.target.value)}
            />
          </FormField>
        </div>

        {mutation.isError && (
          <Alert variant="danger">
            <span data-testid="norm-form-error">{errorText(mutation.error, t('norms.norms.form.saveFailed'))}</span>
          </Alert>
        )}
      </div>
    </Modal>
  );
}
