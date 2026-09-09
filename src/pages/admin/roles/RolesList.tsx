import { ShieldCheck } from 'lucide-react';
import type { RoleAdminOut } from '../api';
import { labels, pickRoleName } from './labels';

import type { UiLanguage } from '../../../i18n/context';

interface RolesListProps {
  roles: RoleAdminOut[];
  selectedId: string | null;
  onSelect: (roleId: string) => void;
  lang: UiLanguage;
}

/**
 * The register half of H2. Each row is a button rather than a table row: the
 * screen is a master/detail, the row's job is to open the matrix beside it,
 * and a five-column table would be unreadable at the 375px the shell has to
 * survive.
 */
export function RolesList({ roles, selectedId, onSelect, lang }: RolesListProps) {
  const L = labels[lang];

  if (roles.length === 0) {
    return <p className="text-sm text-[#5A646D] px-1 py-6 text-center">{L.emptyRoles}</p>;
  }

  return (
    <ul className="divide-y divide-[#E4E7EA] -mx-2" data-testid="roles-list">
      {roles.map((role) => {
        const selected = role.id === selectedId;
        const archived = role.status === 'archived';
        return (
          <li key={role.id}>
            <button
              type="button"
              onClick={() => onSelect(role.id)}
              aria-pressed={selected}
              data-testid={`role-row-${role.code}`}
              className={`w-full text-left px-3 py-3 rounded-xl transition-colors border-l-4 ${
                selected ? 'bg-[#F0F7F1] border-[#2E7D4F]' : 'border-transparent hover:bg-[#F8F9FA]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#1A1F24] truncate">
                    {pickRoleName(role, lang)}
                  </div>
                  <div className="text-[11px] text-[#5A646D] font-mono truncate">{role.code}</div>
                </div>
                {role.is_system && (
                  <span
                    data-testid="role-system-badge"
                    title={L.systemBadge}
                    className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#EEF2F5] text-[#5A646D]"
                  >
                    <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                    {L.systemBadge}
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span
                  className={`px-2 py-0.5 rounded-full font-medium ${
                    archived ? 'bg-[#FEF2F2] text-[#991B1B]' : 'bg-[#F0F7F1] text-[#15803D]'
                  }`}
                >
                  {archived ? L.statusArchived : L.statusActive}
                </span>
                <span data-testid="role-permission-count" className="px-2 py-0.5 rounded-full bg-[#F8F9FA] text-[#5A646D]">
                  {role.permission_codes.length} {L.permissionsSuffix}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#F8F9FA] text-[#5A646D]">
                  {role.holders} {L.holdersSuffix}
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
