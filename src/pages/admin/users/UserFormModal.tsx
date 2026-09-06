import { useState } from 'react';
import { Alert } from '../../../components/ui/Feedback';
import { Button } from '../../../components/ui/button';
import { FormField, Input, Select } from '../../../components/ui/FormControls';
import { Modal } from '../../../components/ui/Overlay';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useLanguage } from '../../../i18n/useT';
import { pickName } from '../../applicant/format';
import type { UserAdminOut, UserCreatedOut } from '../api';
import { labelsFor } from './labels';
import {
  EMPTY_FORM,
  buildCreateBody,
  buildPatchBody,
  formFromUser,
  type UserFormState,
} from './formBody';
import { useCreateUser, useDistricts, useOrganizations, usePatchUser, useRegions, useRoles } from './queries';

/** Everything the form edits, as strings — `''` stands for "not set", which
 *  on a PATCH becomes an explicit `null` rather than a dropped key. */
export interface UserFormModalProps {
  mode: 'create' | 'edit';
  /** The row being edited — required in `edit` mode, ignored otherwise. */
  user?: UserAdminOut | null;
  onClose: () => void;
  /** Create only: hands the one-time secrets straight to `SecretPanel`. */
  onCreated?: (created: UserCreatedOut) => void;
}

export function UserFormModal({ mode, user, onClose, onCreated }: UserFormModalProps) {
  const { lang } = useLanguage();
  const errorText = useApiErrorText();
  const L = labelsFor(lang);

  const initial = mode === 'edit' && user ? formFromUser(user) : EMPTY_FORM;
  const [form, setForm] = useState<UserFormState>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof UserFormState, string>>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const roles = useRoles();
  const organizations = useOrganizations();
  const regions = useRegions();
  const districts = useDistricts(form.region_id);

  const create = useCreateUser();
  const patch = usePatchUser();
  const pending = create.isPending || patch.isPending;
  const failure = create.error ?? patch.error;

  function set<K extends keyof UserFormState>(key: K, value: UserFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setNotice(null);
  }

  function validate(): boolean {
    const next: Partial<Record<keyof UserFormState, string>> = {};
    if (!form.login.trim()) next.login = L.errRequired;
    if (!form.full_name.trim()) next.full_name = L.errRequired;
    if (!form.role_code) next.role_code = L.errRequired;
    if (form.pinfl.trim() && !/^\d{14}$/.test(form.pinfl.trim())) next.pinfl = L.errPinfl;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    if (mode === 'create') {
      create.mutate(buildCreateBody(form), {
        onSuccess: (created) => {
          onCreated?.(created);
          onClose();
        },
      });
      return;
    }

    if (!user) return;
    const body = buildPatchBody(initial, form);
    if (Object.keys(body).length === 0) {
      setNotice(L.nothingChanged);
      return;
    }
    patch.mutate({ userId: user.id, body }, { onSuccess: onClose });
  }

  // `applicant` is filtered out rather than left in and refused by the
  // server: a citizen is born through OneID/E-IMZO, and offering the option
  // only to answer with a 422 teaches nothing.
  const roleOptions = [
    { value: '', label: L.formSelect },
    ...(roles.data ?? [])
      .filter((role) => role.code !== 'applicant')
      .map((role) => ({ value: role.code, label: pickName(role.name, lang) || role.code })),
  ];

  const organizationOptions = [
    { value: '', label: L.formSelect },
    ...(organizations.data ?? []).map((org) => ({
      value: org.id,
      label: `${org.parent_id ? '— ' : ''}${pickName(org.name, lang) || org.code}`,
    })),
  ];

  const regionOptions = [
    { value: '', label: L.formSelect },
    ...(regions.data ?? []).map((region) => ({
      value: region.id,
      label: pickName(region.name, lang) || region.code,
    })),
  ];

  const districtOptions = [
    { value: '', label: form.region_id ? L.formSelect : L.zoneDistrictDisabled },
    ...(districts.data ?? []).map((district) => ({
      value: district.id,
      label: pickName(district.name, lang) || district.code,
    })),
  ];

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={mode === 'create' ? L.createTitle : L.editTitle}
      subtitle={mode === 'create' ? L.createSubtitle : L.editSubtitle}
      maxWidth="2xl"
    >
      <form onSubmit={submit} data-testid="user-form" className="space-y-5" noValidate>
        {failure && (
          <Alert variant="danger">
            {failure instanceof ApiError ? errorText(failure) : L.saveFailed}
          </Alert>
        )}
        {notice && <Alert variant="info">{notice}</Alert>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label={L.formLogin} required error={errors.login} htmlFor="user-form-login">
            <Input
              id="user-form-login"
              value={form.login}
              onChange={(e) => set('login', e.target.value)}
              error={!!errors.login}
              autoComplete="off"
            />
          </FormField>
          <FormField label={L.formFullName} required error={errors.full_name} htmlFor="user-form-full-name">
            <Input
              id="user-form-full-name"
              value={form.full_name}
              onChange={(e) => set('full_name', e.target.value)}
              error={!!errors.full_name}
            />
          </FormField>
          <FormField
            label={L.formRole}
            required
            error={errors.role_code}
            helperText={L.formRoleHint}
            htmlFor="user-form-role"
          >
            <Select
              id="user-form-role"
              value={form.role_code}
              onChange={(e) => set('role_code', e.target.value)}
              options={roleOptions}
              error={!!errors.role_code}
            />
          </FormField>
          <FormField
            label={L.formPinfl}
            error={errors.pinfl}
            helperText={L.formPinflHint}
            htmlFor="user-form-pinfl"
          >
            <Input
              id="user-form-pinfl"
              value={form.pinfl}
              inputMode="numeric"
              onChange={(e) => set('pinfl', e.target.value)}
              error={!!errors.pinfl}
            />
          </FormField>
          <FormField label={L.formPosition} htmlFor="user-form-position" className="sm:col-span-2">
            <Input
              id="user-form-position"
              value={form.position}
              onChange={(e) => set('position', e.target.value)}
            />
          </FormField>
        </div>

        <div
          className="border border-[#FDE68A] bg-[#FFFBEB] rounded-2xl p-4 space-y-4"
          data-testid="zone-fields"
        >
          <div>
            <h4 className="text-sm font-bold text-[#92400E]">{L.zoneTitle}</h4>
            <p className="text-xs text-[#92400E] mt-1 leading-relaxed">{L.zoneWarning}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label={L.zoneOrganization} htmlFor="user-form-organization">
              <Select
                id="user-form-organization"
                value={form.organization_id}
                onChange={(e) => set('organization_id', e.target.value)}
                options={organizationOptions}
              />
            </FormField>
            <FormField label={L.zoneRegion} htmlFor="user-form-region">
              <Select
                id="user-form-region"
                value={form.region_id}
                onChange={(e) => {
                  // A district belongs to exactly one region: keeping the old
                  // one after the region moves would send a mismatched pair.
                  setForm((f) => ({ ...f, region_id: e.target.value, district_id: '' }));
                  setNotice(null);
                }}
                options={regionOptions}
              />
            </FormField>
            <FormField label={L.zoneDistrict} helperText={L.zoneDistrictHint} htmlFor="user-form-district">
              <Select
                id="user-form-district"
                value={form.district_id}
                disabled={!form.region_id}
                onChange={(e) => set('district_id', e.target.value)}
                options={districtOptions}
              />
            </FormField>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            {L.cancel}
          </Button>
          <Button type="submit" variant="primary" isLoading={pending}>
            {pending ? L.saving : L.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
