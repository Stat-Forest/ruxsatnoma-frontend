import { useState } from 'react';
import { Modal } from '../../../components/ui/Overlay';
import { Button } from '../../../components/ui/button';
import { Checkbox, FormField, Input, Textarea } from '../../../components/ui/FormControls';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { pickName } from '../../applicant/format';
import type { RegionOut, RoleAdminOut } from '../api';
import {
  ANNOUNCEMENT_LANGUAGES,
  readAudience,
  type AnnouncementAdminOut,
  type AudienceIn,
  type BackendLanguage,
  type LocalizedName,
} from './api';
import { LANGUAGE_LABEL_KEY, type AnnouncementLabels } from './labels';
import { useAnnouncement, useCreateAnnouncement, usePatchAnnouncement } from './queries';

interface FormState {
  title: Record<BackendLanguage, string>;
  body: Record<BackendLanguage, string>;
  roleCodes: string[];
  regionIds: string[];
  publishFrom: string;
  publishTo: string;
}

function emptyLanguages(): Record<BackendLanguage, string> {
  return { uz_latn: '', uz_cyrl: '', ru: '', kaa: '', en: '' };
}

function emptyForm(): FormState {
  return { title: emptyLanguages(), body: emptyLanguages(), roleCodes: [], regionIds: [], publishFrom: '', publishTo: '' };
}

/** `title`/`body` arrive as untyped jsonb maps, so each language is read
 *  defensively — a non-string value is treated as absent, never rendered
 *  into an input as `[object Object]`. */
function readLanguages(source: Record<string, unknown>): Record<BackendLanguage, string> {
  const out = emptyLanguages();
  for (const code of ANNOUNCEMENT_LANGUAGES) {
    const value = source[code];
    if (typeof value === 'string') out[code] = value;
  }
  return out;
}

function formFrom(row: AnnouncementAdminOut): FormState {
  const { roleCodes, regionIds } = readAudience(row.audience);
  return {
    title: readLanguages(row.title),
    body: readLanguages(row.body),
    roleCodes,
    regionIds,
    publishFrom: row.publish_from?.slice(0, 10) ?? '',
    publishTo: row.publish_to?.slice(0, 10) ?? '',
  };
}

/** Only the languages somebody actually typed into. An empty string sent as
 *  `{"kaa": ""}` would be a Karakalpak announcement with a blank title, not
 *  an absent translation. */
function localized(values: Record<BackendLanguage, string>): LocalizedName {
  const out: LocalizedName = {};
  for (const code of ANNOUNCEMENT_LANGUAGES) {
    const value = values[code].trim();
    if (value) out[code] = value;
  }
  return out;
}

/**
 * Nothing selected means everybody — so an empty rule is sent as `null`, not
 * as `{role_codes: [], region_ids: []}`, which a backend filtering on a list
 * would just as reasonably read as "matches nobody".
 */
function buildAudience(form: FormState): AudienceIn | null {
  if (form.roleCodes.length === 0 && form.regionIds.length === 0) return null;
  return {
    role_codes: form.roleCodes.length > 0 ? form.roleCodes : null,
    region_ids: form.regionIds.length > 0 ? form.regionIds : null,
  };
}

/** Toggles a value while keeping the order of the source list, so the payload
 *  does not depend on the order the boxes happened to be clicked in. */
function toggle(selected: string[], value: string, all: string[]): string[] {
  const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
  return all.filter((v) => next.includes(v));
}

export interface AnnouncementFormModalProps {
  /** `null` — a new announcement; an id — that row, re-read from its own route. */
  announcementId: string | null;
  roles: RoleAdminOut[];
  regions: RegionOut[];
  lang: string;
  L: AnnouncementLabels;
  onClose: () => void;
}

/**
 * The loader half. It exists so the editable half below can take its initial
 * state straight from a row that is already in hand — no effect copying a
 * fetched row into form state after the first render, which is both a
 * cascading render and the classic source of "my edit was overwritten by a
 * refetch".
 */
export function AnnouncementFormModal({ announcementId, roles, regions, lang, L, onClose }: AnnouncementFormModalProps) {
  const isEdit = announcementId !== null;
  const detail = useAnnouncement(announcementId);

  if (isEdit && !detail.data) {
    return (
      <Modal
        isOpen
        onClose={onClose}
        title={L.formEditTitle}
        maxWidth="2xl"
        footer={
          <Button variant="outline" size="sm" onClick={onClose}>
            {L.cancel}
          </Button>
        }
      >
        <p className={`py-8 text-center text-sm ${detail.error ? 'text-[#991B1B]' : 'text-[#5A646D]'}`} role="status">
          {detail.error ? L.formLoadFailed : L.formLoading}
        </p>
      </Modal>
    );
  }

  return (
    <AnnouncementForm
      announcementId={announcementId}
      initial={detail.data ? formFrom(detail.data) : emptyForm()}
      roles={roles}
      regions={regions}
      lang={lang}
      L={L}
      onClose={onClose}
    />
  );
}

interface AnnouncementFormProps extends AnnouncementFormModalProps {
  initial: FormState;
}

function AnnouncementForm({ announcementId, initial, roles, regions, lang, L, onClose }: AnnouncementFormProps) {
  const isEdit = announcementId !== null;
  const toErrorText = useApiErrorText();
  const create = useCreateAnnouncement();
  const patch = usePatchAnnouncement(announcementId);

  const [form, setForm] = useState<FormState>(initial);
  const [validationError, setValidationError] = useState<string | null>(null);

  const pending = create.isPending || patch.isPending;
  const failure = create.error ?? patch.error;
  const errorText =
    validationError ??
    (failure instanceof ApiError ? toErrorText(failure) : failure ? failure.message : null);

  function setTitle(code: BackendLanguage, value: string) {
    setForm((f) => ({ ...f, title: { ...f.title, [code]: value } }));
  }

  function setBody(code: BackendLanguage, value: string) {
    setForm((f) => ({ ...f, body: { ...f.body, [code]: value } }));
  }

  function submit() {
    const title = localized(form.title);
    const body = localized(form.body);
    // `uz_latn` is the system's primary language and the one every fallback
    // chain ends at — an announcement without it renders blank for readers
    // whose own language was never filled in.
    if (!title.uz_latn || !body.uz_latn) {
      setValidationError(L.formRequired);
      return;
    }
    setValidationError(null);
    const payload = {
      title,
      body,
      audience: buildAudience(form),
      publish_from: form.publishFrom || null,
      publish_to: form.publishTo || null,
    };
    // No `file_ids`: `exclude_unset=True` leaves the attachments alone only
    // as long as the key never appears.
    if (isEdit) patch.mutate(payload, { onSuccess: onClose });
    else create.mutate(payload, { onSuccess: onClose });
  }

  const roleCodes = roles.map((role) => role.code);
  const regionIds = regions.map((region) => region.id);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEdit ? L.formEditTitle : L.formCreateTitle}
      subtitle={L.formLanguagesHint}
      maxWidth="2xl"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            {L.cancel}
          </Button>
          <Button variant="primary" size="sm" onClick={submit} isLoading={pending}>
            {L.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {errorText && (
          <div
            data-testid="form-error"
            role="alert"
            className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-xs text-[#991B1B]"
          >
            {errorText}
          </div>
        )}

        {ANNOUNCEMENT_LANGUAGES.map((code) => {
          const languageName = L[LANGUAGE_LABEL_KEY[code]];
          const primary = code === 'uz_latn';
          return (
            <div
              key={code}
              className={`rounded-2xl border p-4 space-y-3 ${
                primary ? 'border-[#2E7D4F]/40 bg-[#F0F7F1]' : 'border-[#E4E7EA] bg-white'
              }`}
            >
              <FormField label={`${L.formTitleField} — ${languageName}`} htmlFor={`ann-title-${code}`} required={primary}>
                <Input
                  id={`ann-title-${code}`}
                  data-testid={`field-title-${code}`}
                  value={form.title[code]}
                  onChange={(e) => setTitle(code, e.target.value)}
                  maxLength={300}
                />
              </FormField>
              <FormField label={`${L.formBodyField} — ${languageName}`} htmlFor={`ann-body-${code}`} required={primary}>
                <Textarea
                  id={`ann-body-${code}`}
                  data-testid={`field-body-${code}`}
                  value={form.body[code]}
                  onChange={(e) => setBody(code, e.target.value)}
                />
              </FormField>
            </div>
          );
        })}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label={L.formPublishFrom} htmlFor="ann-publish-from">
            <Input
              id="ann-publish-from"
              type="date"
              data-testid="field-publish-from"
              value={form.publishFrom}
              onChange={(e) => setForm((f) => ({ ...f, publishFrom: e.target.value }))}
            />
          </FormField>
          <FormField label={L.formPublishTo} htmlFor="ann-publish-to">
            <Input
              id="ann-publish-to"
              type="date"
              data-testid="field-publish-to"
              value={form.publishTo}
              onChange={(e) => setForm((f) => ({ ...f, publishTo: e.target.value }))}
            />
          </FormField>
        </div>

        <div className="rounded-2xl border border-[#E4E7EA] p-4 space-y-4" data-testid="audience-picker">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#5A646D]">{L.colAudience}</h4>
            <p className="text-xs text-[#5A646D] mt-1">{L.audienceHint}</p>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-[#1A1F24] mb-1">{L.audienceRoles}</legend>
            {roles.map((role) => (
              <Checkbox
                key={role.id}
                label={pickName(role.name, lang) || role.code}
                checked={form.roleCodes.includes(role.code)}
                onChange={() => setForm((f) => ({ ...f, roleCodes: toggle(f.roleCodes, role.code, roleCodes) }))}
              />
            ))}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-[#1A1F24] mb-1">{L.audienceRegions}</legend>
            {regions.map((region) => (
              <Checkbox
                key={region.id}
                label={pickName(region.name, lang) || region.code}
                checked={form.regionIds.includes(region.id)}
                onChange={() => setForm((f) => ({ ...f, regionIds: toggle(f.regionIds, region.id, regionIds) }))}
              />
            ))}
          </fieldset>
        </div>
      </div>
    </Modal>
  );
}
