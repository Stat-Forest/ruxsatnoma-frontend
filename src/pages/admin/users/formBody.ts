/**
 * The form's own state shape and the three pure functions that turn it into a
 * request body. Split out of `UserFormModal.tsx` because a file that exports
 * anything but components breaks fast refresh (`react-refresh/only-export-components`)
 * — and because a body-builder is the part worth testing without a DOM.
 */
import type { UserAdminOut, UserCreateIn, UserPatchIn } from '../api';

export interface UserFormState {
  login: string;
  full_name: string;
  role_code: string;
  pinfl: string;
  position: string;
  organization_id: string;
  region_id: string;
  district_id: string;
}

export const EMPTY_FORM: UserFormState = {
  login: '',
  full_name: '',
  role_code: '',
  pinfl: '',
  position: '',
  organization_id: '',
  region_id: '',
  district_id: '',
};

export function formFromUser(user: UserAdminOut): UserFormState {
  return {
    login: user.login ?? '',
    full_name: user.full_name,
    role_code: user.role_code,
    pinfl: user.pinfl ?? '',
    position: user.position ?? '',
    organization_id: user.organization_id ?? '',
    region_id: user.region_id ?? '',
    district_id: user.district_id ?? '',
  };
}

/** The create body carries only what was filled in — an optional field left
 *  blank is omitted, never sent as `""`, which the backend would store. */
export function buildCreateBody(form: UserFormState): UserCreateIn {
  const body: UserCreateIn = {
    login: form.login.trim(),
    full_name: form.full_name.trim(),
    role_code: form.role_code,
  };
  if (form.pinfl.trim()) body.pinfl = form.pinfl.trim();
  if (form.position.trim()) body.position = form.position.trim();
  if (form.organization_id) body.organization_id = form.organization_id;
  if (form.region_id) body.region_id = form.region_id;
  if (form.district_id) body.district_id = form.district_id;
  return body;
}

/**
 * ONLY the keys whose value actually moved. The backend patches with
 * `exclude_unset=True`, so a body carrying the whole object would rewrite
 * (and audit) fields nobody touched — and would race any change another
 * administrator made between this card being opened and saved.
 *
 * A field cleared to `''` becomes an explicit `null`: "no organisation" is a
 * real, and dangerous, value (it widens the user's zone), not an omission.
 */
export function buildPatchBody(initial: UserFormState, next: UserFormState): UserPatchIn {
  const body: UserPatchIn = {};
  (Object.keys(next) as (keyof UserFormState)[]).forEach((key) => {
    const before = initial[key].trim();
    const after = next[key].trim();
    if (before === after) return;
    if (key === 'full_name' || key === 'role_code') {
      body[key] = after;
      return;
    }
    body[key] = after === '' ? null : after;
  });
  return body;
}
