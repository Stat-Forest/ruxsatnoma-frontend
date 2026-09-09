/**
 * Turning `Announcement.audience` into words.
 *
 * Shared by the list column and the publish confirmation on purpose: the
 * dialog that asks "publish?" has to name the same audience the row shows,
 * and two spellings of the same rule is how an operator ends up sending a
 * notice to a wider circle than the one they read.
 */
import type { RegionOut, RoleAdminOut } from '../api';
import { pickName } from '../../applicant/format';
import { readAudience, type AnnouncementAdminOut } from './api';

export interface AudienceSummary {
  /** No roles and no regions — the rule targets nobody, which the backend
   *  reads as everybody. `null`, `{}` and `{role_codes: []}` all land here. */
  everyone: boolean;
  roleNames: string[];
  regionNames: string[];
}

export function describeAudience(
  audience: AnnouncementAdminOut['audience'],
  roles: RoleAdminOut[],
  regions: RegionOut[],
  lang: string = 'uz_latn',
): AudienceSummary {
  const { roleCodes, regionIds } = readAudience(audience);
  // An unresolved code is shown raw rather than dropped: an audience the
  // screen cannot name is still an audience the announcement will reach.
  const roleNames = roleCodes.map((code) => {
    const match = roles.find((role) => role.code === code);
    return (match && pickName(match.name, lang)) || code;
  });
  const regionNames = regionIds.map((id) => {
    const match = regions.find((region) => region.id === id);
    return (match && pickName(match.name, lang)) || id;
  });
  return { everyone: roleNames.length === 0 && regionNames.length === 0, roleNames, regionNames };
}
