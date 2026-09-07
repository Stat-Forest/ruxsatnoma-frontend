import { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Alert } from '../../../components/ui/Feedback';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useLanguage } from '../../../i18n/useT';
import { labels } from './labels';
import { PermissionMatrix } from './PermissionMatrix';
import { RolesList } from './RolesList';
import { usePermissions, useRoles } from './queries';

/**
 * H2 — roles and the permission matrix. A master/detail: `GET /admin/roles`
 * on the left, and the permission REGISTRY (`GET /admin/permissions`) on the
 * right with the selected role's own codes ticked. Saving replaces the role's
 * whole set through `PUT /admin/roles/{id}/permissions`, which is a
 * replace-set, not a patch — so the request carries every checked code, not
 * only the ones that changed.
 *
 * Nothing here creates, renames or archives a role: `POST /admin/roles`,
 * `PATCH /admin/roles/{id}` and the archive route exist, but this screen is
 * the permission editor, and a system role has no rename path at all.
 */
export function RolesPage() {
  const { lang } = useLanguage();
  const errorText = useApiErrorText();
  const L = labels[lang];
  const roles = useRoles();
  const permissions = usePermissions();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadError = (roles.error ?? permissions.error) as unknown;
  const selectedRole = roles.data?.find((role) => role.id === selectedId) ?? null;
  const isLoading = roles.isLoading || permissions.isLoading;

  return (
    <div className="space-y-6 font-sans pb-16" data-testid="roles-page">
      <div className="border-b border-[#E4E7EA] pb-4">
        <h1 className="text-lg md:text-xl font-bold text-[#1A1F24] tracking-tight">{L.title}</h1>
        <p className="text-xs md:text-sm text-[#5A646D] mt-1">{L.subtitle}</p>
      </div>

      {loadError != null && (
        <div data-testid="roles-error">
          <Alert variant="danger" title={L.loadError}>
            {loadError instanceof ApiError ? errorText(loadError) : String(loadError)}
          </Alert>
        </div>
      )}

      {isLoading ? (
        <div className="py-16 text-center text-sm text-[#5A646D]">
          <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" aria-hidden="true" /> {L.loading}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-6 items-start">
          <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 sm:p-6 shadow-xs">
            <h2 className="text-sm font-bold text-[#1A1F24]">{L.listTitle}</h2>
            <p className="text-xs text-[#5A646D] mt-0.5 mb-3">{L.listHint}</p>
            <RolesList roles={roles.data ?? []} selectedId={selectedId} onSelect={setSelectedId} lang={lang} />
          </div>

          {selectedRole && permissions.data ? (
            <PermissionMatrix
              // Remounts on a role switch, so the draft below is always seeded
              // from the role now on screen.
              key={selectedRole.id}
              role={selectedRole}
              permissions={permissions.data}
              lang={lang}
            />
          ) : (
            <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#F0F7F1] flex items-center justify-center text-[#2E7D4F] mb-3">
                <ShieldCheck className="w-6 h-6" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-[#1A1F24]">{L.emptySelection}</p>
              <p className="text-xs text-[#5A646D] mt-1">{L.emptySelectionHint}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
