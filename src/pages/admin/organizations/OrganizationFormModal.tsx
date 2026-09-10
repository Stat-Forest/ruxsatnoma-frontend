/**
 * Create and edit, one form.
 *
 * Two contract facts shape it, and neither is guessable from the OpenAPI
 * types alone (`kind` is a bare `string` there, and `LocalizedName` is a bare
 * `dict[str, str]`):
 *
 *  1. `LocalizedName` REJECTS a name without a non-blank `uz_cyrl`
 *     (`core/schemas.py`: "uz_cyrl is required and must not be blank" —
 *     design/02 principle 3 makes Cyrillic the system's fallback language).
 *     A form that only collects the Latin name 422s every time.
 *  2. `OrganizationPatch` carries neither `kind` nor `code`. Both are set once
 *     and never change, so on edit they are shown and disabled rather than
 *     silently dropped from the request.
 */
import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { FormField, Input, Select, Switch } from '../../../components/ui/FormControls';
import { Modal } from '../../../components/ui/Overlay';
import { ApiError } from '../../../api/errors';
import { useLanguage } from '../../../i18n/useT';
import { pickName } from '../../applicant/format';
import type { OrganizationOut } from '../api';
import type { LocalizedName, OrganizationAdminOut } from './api';
import {
  ALLOWED_PARENT_KINDS,
  ORGANIZATION_KINDS,
  childKindsOf,
  isOrganizationKind,
  subtreeIds,
  type OrganizationKind,
} from './hierarchy';
import { useLabels, type Labels } from './labels';
import { useCreateOrganization, useDistricts, useOrganizationDetail, useRegions, useUpdateOrganization } from './queries';

const CODE_PATTERN = /^[a-z0-9][a-z0-9-]*$/i;
const STIR_PATTERN = /^[0-9]{9}$/;

/** What the page asked for: a blank form, a blank form under a known parent, or
 *  one organization loaded for editing. */
export type FormTarget =
  | { mode: 'create'; parent?: OrganizationOut }
  | { mode: 'edit'; orgId: string };

interface FormState {
  kind: string;
  parentId: string;
  code: string;
  nameUzCyrl: string;
  nameUzLatn: string;
  nameRu: string;
  stir: string;
  regionId: string;
  districtId: string;
  /** `requisites.payme_account_id` (stage 7.9, task 9) — the Payme WALLET a
   *  leshoz is paid its remainder into, distinct from `requisites.account`
   *  (a bank account). Free-text like `stir`: the backend validates neither
   *  format, it is an opaque id Payme itself assigns. */
  paymeAccountId: string;
  /** `organizations.gis_enabled` (T12, decision #178) — the central admin's
   *  switch for whether this leshoz shows a map at all. Meaningful only for
   *  `kind === 'leshoz'` (the form only renders the control there), but the
   *  column exists on every organization row, defaulting `true` the same
   *  way the backend's own `OrganizationIn.gis_enabled` does. */
  gisEnabled: boolean;
}

type FieldErrors = Partial<Record<'parentId' | 'code' | 'nameUzCyrl' | 'stir', string>>;

/** Legal, active parents for a kind — the same predicate the form re-applies
 *  whenever the kind changes. */
function parentsFor(kind: string, organizations: OrganizationOut[]): OrganizationOut[] {
  const allowed = isOrganizationKind(kind) ? ALLOWED_PARENT_KINDS[kind] : [];
  return organizations.filter(
    (org) => org.status === 'active' && allowed.includes(org.kind as OrganizationKind),
  );
}

/**
 * A blank form. The default kind is `leshoz` — the row almost every staff
 * account hangs off — unless the reader pressed "+" on a specific row, in
 * which case the only sensible kind is what may legally sit under it.
 */
function blankState(parent: OrganizationOut | undefined, organizations: OrganizationOut[]): FormState {
  const kind = parent ? (childKindsOf(parent.kind)[0] ?? 'leshoz') : 'leshoz';
  const candidates = parentsFor(kind, organizations);
  const legal = parent !== undefined && candidates.some((org) => org.id === parent.id);
  // With a single legal parent (the usual case early on, when only the agency
  // exists) there is nothing to choose, so it starts chosen.
  const onlyCandidate = candidates.length === 1 ? candidates[0].id : '';
  return {
    kind,
    parentId: legal ? parent!.id : onlyCandidate,
    code: '',
    nameUzCyrl: '',
    nameUzLatn: '',
    nameRu: '',
    stir: '',
    // A new leshoz almost always sits in its parent's region; pre-filling it
    // saves the pick and stays editable.
    regionId: parent?.region_id ?? '',
    districtId: '',
    paymeAccountId: '',
    gisEnabled: true,
  };
}

function loadedState(org: OrganizationAdminOut): FormState {
  const name = org.name as Record<string, unknown>;
  const text = (key: string) => (typeof name[key] === 'string' ? (name[key] as string) : '');
  const requisites = org.requisites as Record<string, unknown>;
  const paymeAccountId = typeof requisites.payme_account_id === 'string' ? requisites.payme_account_id : '';
  return {
    kind: org.kind,
    parentId: org.parent_id ?? '',
    code: org.code,
    nameUzCyrl: text('uz_cyrl'),
    nameUzLatn: text('uz_latn'),
    nameRu: text('ru'),
    stir: org.stir ?? '',
    regionId: org.region_id ?? '',
    districtId: org.district_id ?? '',
    paymeAccountId,
    // `typeof` guard, not `?? true`: a real `false` from the server must
    // survive, and only an actually-missing field (a fixture predating the
    // column, or a stale cache) should fall back to the schema's own default.
    gisEnabled: typeof org.gis_enabled === 'boolean' ? org.gis_enabled : true,
  };
}

function validate(state: FormState, labels: Labels): FieldErrors {
  const errors: FieldErrors = {};
  const needsParent = isOrganizationKind(state.kind) && ALLOWED_PARENT_KINDS[state.kind].length > 0;
  if (needsParent && !state.parentId) errors.parentId = labels['error.parentRequired'];
  if (!state.code.trim()) errors.code = labels['error.required'];
  else if (!CODE_PATTERN.test(state.code.trim())) errors.code = labels['error.code'];
  if (!state.nameUzCyrl.trim()) errors.nameUzCyrl = labels['error.required'];
  if (state.stir.trim() && !STIR_PATTERN.test(state.stir.trim())) errors.stir = labels['error.stir'];
  return errors;
}

function buildName(state: FormState): LocalizedName {
  const name: LocalizedName = {};
  if (state.nameUzCyrl.trim()) name.uz_cyrl = state.nameUzCyrl.trim();
  if (state.nameUzLatn.trim()) name.uz_latn = state.nameUzLatn.trim();
  if (state.nameRu.trim()) name.ru = state.nameRu.trim();
  return name;
}

/** Turns the backend's own `ERR-VAL-001` details into something an
 *  administrator can act on, instead of "Unexpected error". */
function describeSaveError(error: unknown, labels: Labels): string {
  if (!(error instanceof ApiError)) return labels['error.save'];
  const details = error.details as { reason?: string; code?: string } | undefined;
  if (details?.code) return labels['error.codeTaken'];
  if (details?.reason === 'root already exists') return labels['error.agencyExists'];
  return `${labels['error.save']}: ${error.message}`;
}

function FieldError({ testId, message }: { testId: string; message?: string }) {
  if (!message) return null;
  return (
    <p data-testid={testId} role="alert" className="text-xs text-[#B91C1C] flex items-center gap-1">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

interface FormBodyProps {
  initial: FormState;
  mode: 'create' | 'edit';
  orgId?: string;
  organizations: OrganizationOut[];
  labels: Labels;
  onClose: () => void;
  /** The row's own `requisites`, as last read from `GET .../{id}` — `{}` on
   *  create. Carried separately from `FormState` because this form only
   *  edits one key of it (`payme_account_id`); a bank `account` or any other
   *  key already there must survive a save this form did not touch. */
  existingRequisites: Record<string, unknown>;
}

function OrganizationForm({
  initial,
  mode,
  orgId,
  organizations,
  labels,
  onClose,
  existingRequisites,
}: FormBodyProps) {
  const { lang } = useLanguage();
  const [state, setState] = useState<FormState>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});

  const regions = useRegions();
  const districts = useDistricts(state.regionId || undefined);
  const create = useCreateOrganization();
  const update = useUpdateOrganization();
  const saving = create.isPending || update.isPending;
  const saveError = create.error ?? update.error;

  const excluded = mode === 'edit' && orgId ? subtreeIds(organizations, orgId) : new Set<string>();
  const parentCandidates = parentsFor(state.kind, organizations).filter((org) => !excluded.has(org.id));
  const isRoot = isOrganizationKind(state.kind) && ALLOWED_PARENT_KINDS[state.kind].length === 0;

  function patch(next: Partial<FormState>) {
    setState((current) => ({ ...current, ...next }));
  }

  function changeKind(kind: string) {
    const allowed = isOrganizationKind(kind) ? ALLOWED_PARENT_KINDS[kind] : [];
    const parent = organizations.find((org) => org.id === state.parentId);
    const keepParent = parent && allowed.includes(parent.kind as OrganizationKind);
    patch({ kind, parentId: keepParent ? state.parentId : '' });
  }

  /** A district outside the chosen region is the one wrong answer this pair of
   *  selects can produce, so the region change clears it rather than leaving a
   *  stale id that only fails server-side. */
  function changeRegion(regionId: string) {
    patch({ regionId, districtId: '' });
  }

  function submit() {
    const found = validate(state, labels);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const shared = {
      parent_id: isRoot ? null : state.parentId,
      name: buildName(state),
      stir: state.stir.trim() || null,
      region_id: state.regionId || null,
      district_id: state.districtId || null,
    };

    if (mode === 'edit' && orgId) {
      // `requisites` is a free-form dict this screen only partly owns (a
      // bank `account` may already live in it, written outside this form);
      // PATCH replaces the whole dict when the key is present, so it is only
      // sent — merged over whatever `GET .../{id}` last returned — when the
      // Payme id actually changed. `gis_enabled` gets the same "only what
      // changed" treatment for the same reason `patchOrganization`'s own
      // docstring gives `kind`/`code`: a field resent unconditionally on
      // every save is a field this form silently owns end to end, and this
      // one does not — a leshoz's switch must survive an edit that only
      // touched its name. Left untouched otherwise, the same reading
      // `stir`/`region_id` already get from the backend's own
      // `exclude_unset`, applied here on the client side since this form
      // always resends those regardless of edits.
      const paymeChanged = state.paymeAccountId.trim() !== initial.paymeAccountId.trim();
      const gisEnabledChanged = state.gisEnabled !== initial.gisEnabled;
      const body = {
        ...shared,
        ...(paymeChanged
          ? { requisites: { ...existingRequisites, payme_account_id: state.paymeAccountId.trim() || null } }
          : {}),
        ...(gisEnabledChanged ? { gis_enabled: state.gisEnabled } : {}),
      };
      update.mutate({ orgId, body }, { onSuccess: onClose });
      return;
    }
    create.mutate(
      // `requisites` is not optional in the generated type (the backend gives
      // it a `{}` default, which openapi-typescript renders as required); bank
      // details are not part of this screen, so a new row starts empty unless
      // a Payme id was entered. `gis_enabled` is required the same way — no
      // "only when it differs" here, unlike the edit path below: a create has
      // no prior value to diff against, so it is always sent explicitly, the
      // same as every other field on this object.
      {
        ...shared,
        kind: state.kind,
        code: state.code.trim(),
        requisites: state.paymeAccountId.trim() ? { payme_account_id: state.paymeAccountId.trim() } : {},
        gis_enabled: state.gisEnabled,
      },
      { onSuccess: onClose },
    );
  }

  const districtOptions = state.regionId
    ? (districts.data ?? []).map((d) => ({ value: d.id, label: pickName(d.name, lang) || d.code }))
    : [];

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label={labels['form.kind']} required htmlFor="org-kind">
          <Select
            id="org-kind"
            data-testid="field-kind"
            value={state.kind}
            disabled={mode === 'edit'}
            onChange={(e) => changeKind(e.target.value)}
            options={ORGANIZATION_KINDS.map((kind) => ({ value: kind, label: labels[`kind.${kind}`] }))}
          />
        </FormField>

        <FormField
          label={labels['form.parent']}
          required={!isRoot}
          htmlFor="org-parent"
          helperText={isRoot ? labels['form.parentRoot'] : undefined}
        >
          <Select
            id="org-parent"
            data-testid="field-parent"
            value={isRoot ? '' : state.parentId}
            disabled={isRoot}
            error={Boolean(errors.parentId)}
            onChange={(e) => patch({ parentId: e.target.value })}
            options={[
              { value: '', label: isRoot ? '—' : labels['form.parentPlaceholder'] },
              ...parentCandidates.map((org) => ({
                value: org.id,
                label: `${pickName(org.name, lang) || org.code} · ${labels[`kind.${org.kind}` as keyof Labels] ?? org.kind}`,
              })),
            ]}
          />
          <FieldError testId="error-parent" message={errors.parentId} />
        </FormField>

        <FormField
          label={labels['form.code']}
          required
          htmlFor="org-code"
          helperText={mode === 'create' ? labels['form.codeHint'] : undefined}
        >
          <Input
            id="org-code"
            data-testid="field-code"
            value={state.code}
            disabled={mode === 'edit'}
            error={Boolean(errors.code)}
            onChange={(e) => patch({ code: e.target.value })}
            placeholder="burchmulla"
          />
          <FieldError testId="error-code" message={errors.code} />
        </FormField>

        <FormField label={labels['form.stir']} htmlFor="org-stir" helperText={labels['form.stirHint']}>
          <Input
            id="org-stir"
            data-testid="field-stir"
            value={state.stir}
            inputMode="numeric"
            maxLength={9}
            error={Boolean(errors.stir)}
            onChange={(e) => patch({ stir: e.target.value.replace(/\D/g, '') })}
            placeholder="301234567"
          />
          <FieldError testId="error-stir" message={errors.stir} />
        </FormField>
      </div>

      <fieldset className="space-y-3 border-t border-[#E4E7EA] pt-4">
        <legend className="sr-only">{labels['form.nameSection']}</legend>
        <FormField
          label={labels['form.name.uz_cyrl']}
          required
          htmlFor="org-name-uz_cyrl"
          helperText={labels['form.nameHint']}
        >
          <Input
            id="org-name-uz_cyrl"
            data-testid="field-name-uz_cyrl"
            value={state.nameUzCyrl}
            error={Boolean(errors.nameUzCyrl)}
            onChange={(e) => patch({ nameUzCyrl: e.target.value })}
          />
          <FieldError testId="error-name-uz_cyrl" message={errors.nameUzCyrl} />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label={labels['form.name.uz_latn']} htmlFor="org-name-uz_latn">
            <Input
              id="org-name-uz_latn"
              data-testid="field-name-uz_latn"
              value={state.nameUzLatn}
              onChange={(e) => patch({ nameUzLatn: e.target.value })}
            />
          </FormField>
          <FormField label={labels['form.name.ru']} htmlFor="org-name-ru">
            <Input
              id="org-name-ru"
              data-testid="field-name-ru"
              value={state.nameRu}
              onChange={(e) => patch({ nameRu: e.target.value })}
            />
          </FormField>
        </div>
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[#E4E7EA] pt-4">
        <FormField label={labels['form.region']} htmlFor="org-region">
          <Select
            id="org-region"
            data-testid="field-region"
            value={state.regionId}
            onChange={(e) => changeRegion(e.target.value)}
            options={[
              { value: '', label: labels['form.notSelected'] },
              ...(regions.data ?? []).map((r) => ({ value: r.id, label: pickName(r.name, lang) || r.code })),
            ]}
          />
        </FormField>
        <FormField
          label={labels['form.district']}
          htmlFor="org-district"
          helperText={state.regionId ? undefined : labels['form.districtLocked']}
        >
          <Select
            id="org-district"
            data-testid="field-district"
            value={state.districtId}
            disabled={!state.regionId || districts.isLoading}
            onChange={(e) => patch({ districtId: e.target.value })}
            options={[{ value: '', label: labels['form.notSelected'] }, ...districtOptions]}
          />
        </FormField>
      </div>

      <div className="border-t border-[#E4E7EA] pt-4">
        <FormField
          label={labels['form.paymeAccountId']}
          htmlFor="org-payme-account-id"
          helperText={labels['form.paymeAccountIdHint']}
        >
          <Input
            id="org-payme-account-id"
            data-testid="field-payme-account-id"
            value={state.paymeAccountId}
            onChange={(e) => patch({ paymeAccountId: e.target.value })}
          />
        </FormField>
      </div>

      {/* T12 (decision #178) — the leshoz shows a map at all only while this
          is on; off, its contours are filed and browsed by requisites alone
          everywhere else in the app. Shown only for `kind === 'leshoz'`: the
          column exists on every organization row, but nothing reads it for
          any other kind, and offering it there would only invite a
          meaningless toggle. */}
      {state.kind === 'leshoz' && (
        <div className="border-t border-[#E4E7EA] pt-4 space-y-1.5">
          <Switch
            checked={state.gisEnabled}
            onChange={(checked) => patch({ gisEnabled: checked })}
            label={labels['form.gisEnabled']}
            data-testid="field-gis-enabled"
          />
          <p className="text-xs text-[#5A646D]">{labels['form.gisEnabledHint']}</p>
        </div>
      )}

      {saveError && (
        <p data-testid="org-form-error" role="alert" className="text-sm text-[#991B1B] bg-[#FEF2F2] border border-[#FCA5A5] rounded-md p-3">
          {describeSaveError(saveError, labels)}
        </p>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-[#E4E7EA] pt-4">
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
          {labels['form.cancel']}
        </Button>
        <Button type="button" data-testid="org-form-submit" onClick={submit} isLoading={saving}>
          {labels['form.submit']}
        </Button>
      </div>
    </form>
  );
}

export interface OrganizationFormModalProps {
  target: FormTarget;
  /** The flat tree, for the parent picker and the cycle guard. */
  organizations: OrganizationOut[];
  onClose: () => void;
}

export function OrganizationFormModal({ target, organizations, onClose }: OrganizationFormModalProps) {
  const labels = useLabels();
  const detail = useOrganizationDetail(target.mode === 'edit' ? target.orgId : undefined);
  const isEdit = target.mode === 'edit';

  // `OrganizationForm` seeds its state once, at mount, so the edit form is
  // rendered only after the row it edits has arrived. Reading the row back
  // from `GET /admin/organizations/{id}` — the only route that returns
  // `requisites` — is what makes the PATCH a patch of the current truth
  // rather than of whatever the tree happened to be showing.
  let body;
  if (!isEdit) {
    body = (
      <OrganizationForm
        initial={blankState(target.parent, organizations)}
        mode="create"
        organizations={organizations}
        labels={labels}
        onClose={onClose}
        existingRequisites={{}}
      />
    );
  } else if (detail.data) {
    body = (
      <OrganizationForm
        initial={loadedState(detail.data)}
        mode="edit"
        orgId={target.orgId}
        organizations={organizations}
        labels={labels}
        onClose={onClose}
        existingRequisites={detail.data.requisites as Record<string, unknown>}
      />
    );
  } else if (detail.error) {
    body = (
      <p data-testid="org-form-load-error" role="alert" className="text-sm text-[#991B1B]">
        {describeSaveError(detail.error, labels)}
      </p>
    );
  } else {
    body = (
      <p className="flex items-center gap-2 text-sm text-[#5A646D]">
        <Loader2 className="w-4 h-4 animate-spin" /> {labels['form.loading']}
      </p>
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEdit ? labels['form.editTitle'] : labels['form.createTitle']}
      subtitle={isEdit ? labels['form.editSubtitle'] : labels['form.createSubtitle']}
      maxWidth="2xl"
    >
      <div data-testid="org-form-modal">{body}</div>
    </Modal>
  );
}
