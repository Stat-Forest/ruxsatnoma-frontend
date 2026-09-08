import { useMemo, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Checkbox } from '../../../components/ui/FormControls';
import { Alert } from '../../../components/ui/Feedback';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { pickName } from '../../applicant/format';
import type { PermissionOut, RoleAdminOut } from '../api';
import { GROUP_ORDER, groupTitle, labels } from './labels';
import { useSetRolePermissions } from './queries';

/** The public applicant role is the one role `PUT /admin/roles/{id}/permissions`
 *  refuses outright (`users_service.set_role_permissions`, ruling R5b: staff
 *  codes must never be grantable to the public role). Its matrix is therefore
 *  shown read-only — offering an editor whose every save is rejected would be
 *  a lie the operator only discovers after losing their work. */
const READ_ONLY_ROLE_CODE = 'applicant';

interface PermissionGroup {
  prefix: string;
  permissions: PermissionOut[];
}

/** Groups the registry by the prefix before the first dot — `applications.*`,
 *  `admin.*`, and whatever a later module registers. A code with no dot forms
 *  its own group under its own name rather than being dropped. */
function groupPermissions(permissions: PermissionOut[]): PermissionGroup[] {
  const byPrefix = new Map<string, PermissionOut[]>();
  for (const permission of permissions) {
    const prefix = permission.code.split('.')[0] || permission.code;
    const bucket = byPrefix.get(prefix);
    if (bucket) bucket.push(permission);
    else byPrefix.set(prefix, [permission]);
  }
  const rank = (prefix: string) => {
    const index = GROUP_ORDER.indexOf(prefix);
    return index === -1 ? GROUP_ORDER.length : index;
  };
  return [...byPrefix.entries()]
    .map(([prefix, group]) => ({ prefix, permissions: [...group].sort((a, b) => a.code.localeCompare(b.code)) }))
    .sort((a, b) => rank(a.prefix) - rank(b.prefix) || a.prefix.localeCompare(b.prefix));
}

import type { UiLanguage } from '../../../i18n/context';

interface PermissionMatrixProps {
  role: RoleAdminOut;
  permissions: PermissionOut[];
  lang: UiLanguage;
}

/**
 * The detail half of H2. Mounted with `key={role.id}` by `RolesPage`, so
 * selecting another role remounts it and the draft below is seeded from the
 * role now on screen — no effect chasing prop changes, which is where a
 * half-edited matrix silently leaks from one role onto the next.
 */
export function PermissionMatrix({ role, permissions, lang }: PermissionMatrixProps) {
  const L = labels[lang];
  const errorText = useApiErrorText();
  const readOnly = role.code === READ_ONLY_ROLE_CODE;
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set(role.permission_codes));
  const mutation = useSetRolePermissions(role.id);

  const groups = useMemo(() => groupPermissions(permissions), [permissions]);
  const saved = useMemo(() => [...role.permission_codes].sort().join(' '), [role.permission_codes]);
  const draft = useMemo(() => [...checked].sort().join(' '), [checked]);
  const dirty = saved !== draft;

  function update(next: ReadonlySet<string>) {
    // A fresh edit retires the previous verdict: leaving a green "saved" (or a
    // red refusal) beside a matrix that has changed since would describe a
    // state that no longer exists.
    mutation.reset();
    setChecked(next);
  }

  function toggle(code: string) {
    const next = new Set(checked);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    update(next);
  }

  function toggleGroup(group: PermissionGroup, on: boolean) {
    const next = new Set(checked);
    for (const permission of group.permissions) {
      if (on) next.add(permission.code);
      else next.delete(permission.code);
    }
    update(next);
  }

  function save() {
    mutation.mutate([...checked].sort());
  }

  const error = mutation.error instanceof ApiError ? mutation.error : null;

  return (
    <section
      data-testid="permission-matrix"
      className="bg-white border border-[#E4E7EA] rounded-2xl p-4 sm:p-6 shadow-xs space-y-5"
    >
      <header className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h2 className="text-base font-bold text-[#1A1F24]">{pickName(role.name, lang) || role.code}</h2>
          <span className="text-xs font-mono text-[#5A646D]">{role.code}</span>
        </div>
        <p className="text-xs text-[#5A646D]">
          {L.matrixTitle} — {checked.size} / {permissions.length} {L.selectedOf}
        </p>
        {role.is_system && !readOnly && <p className="text-xs text-[#5A646D]">{L.systemNote}</p>}
      </header>

      {readOnly && (
        <div data-testid="role-read-only">
          <Alert variant="warning">{L.applicantNote}</Alert>
        </div>
      )}

      {mutation.isError && (
        <div data-testid="save-error">
          <Alert variant="danger" title={L.saveError}>
            {error ? errorText(error) : String(mutation.error)}
          </Alert>
        </div>
      )}

      {mutation.isSuccess && (
        <div data-testid="save-success">
          <Alert variant="success">{L.saved}</Alert>
        </div>
      )}

      {permissions.length === 0 ? (
        <p className="text-sm text-[#5A646D] py-6 text-center">{L.emptyPermissions}</p>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => {
            const total = group.permissions.length;
            const held = group.permissions.filter((permission) => checked.has(permission.code)).length;
            return (
              <div
                key={group.prefix}
                data-testid={`permission-group-${group.prefix}`}
                className="border border-[#E4E7EA] rounded-xl overflow-hidden"
              >
                <div className="flex items-center justify-between gap-3 bg-[#F8F9FA] px-3 py-2.5 border-b border-[#E4E7EA]">
                  <Checkbox
                    label={groupTitle(group.prefix, lang)}
                    checked={held === total}
                    disabled={readOnly}
                    // No `checked` and no `unchecked` describes a half-granted
                    // module; only the DOM property can say so.
                    ref={(element) => {
                      if (element) element.indeterminate = held > 0 && held < total;
                    }}
                    onChange={(event) => toggleGroup(group, event.target.checked)}
                  />
                  <span className="shrink-0 text-[11px] font-medium text-[#5A646D] tabular-nums">
                    {held}/{total}
                  </span>
                </div>
                <div className="p-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {group.permissions.map((permission) => (
                    <Checkbox
                      key={permission.code}
                      label={permission.code}
                      hint={permission.description}
                      checked={checked.has(permission.code)}
                      disabled={readOnly}
                      onChange={() => toggle(permission.code)}
                      className="min-w-0 [&_label]:font-mono [&_label]:text-[13px] [&_label]:break-all"
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!readOnly && (
        <footer className="flex flex-wrap items-center justify-end gap-2 pt-1">
          {mutation.isPending && (
            <span className="mr-auto inline-flex items-center gap-1.5 text-xs text-[#5A646D]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              {L.saving}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => update(new Set(role.permission_codes))} disabled={!dirty || mutation.isPending}>
            {L.reset}
          </Button>
          <Button
            variant="primary"
            size="sm"
            data-testid="save-permissions"
            isLoading={mutation.isPending}
            disabled={!dirty || mutation.isPending}
            leftIcon={<Check className="w-3.5 h-3.5" />}
            onClick={save}
          >
            {mutation.isPending ? L.saving : L.save}
          </Button>
        </footer>
      )}
    </section>
  );
}
