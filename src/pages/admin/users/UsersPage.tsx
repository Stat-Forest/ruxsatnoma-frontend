import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Alert } from '../../../components/ui/Feedback';
import { Button } from '../../../components/ui/button';
import { FormField, Input, Select, Textarea } from '../../../components/ui/FormControls';
import { Modal } from '../../../components/ui/Overlay';
import { Tabs } from '../../../components/ui/Navigation';
import { useLanguage } from '../../../i18n/useT';
import { formatDateTime } from '../../applicant/format';
import { pickName } from '../../applicant/format';
import type { PermissionOut, UserAdminOut, UserCreatedOut } from '../api';
import { SecretPanel } from './SecretPanel';
import { UserFormModal } from './UserFormModal';
import { labelsFor } from './labels';
import {
  useBlockUser,
  useDeleteUser,
  useOrganizations,
  usePermissions,
  useRegions,
  useResetMfa,
  useResetPassword,
  useRevokeAllSessions,
  useRevokeSession,
  useRoles,
  useSetUserPermissions,
  useUnblockUser,
  useUser,
  useUserPermissions,
  useUserSessions,
  useUserStats,
  useUsersList,
} from './queries';

const PAGE_SIZE = 20;

interface Filters {
  q: string;
  role_code: string;
  status: string;
  organization_id: string;
  region_id: string;
}

const EMPTY_FILTERS: Filters = { q: '', role_code: '', status: '', organization_id: '', region_id: '' };

/** The filters the form holds become query parameters only when Apply is
 *  pressed: typing a PINFL should not fire a request per keystroke against a
 *  route that scans three columns with ILIKE. */
function toParams(filters: Filters, page: number) {
  return {
    page,
    page_size: PAGE_SIZE,
    q: filters.q || undefined,
    role_code: filters.role_code || undefined,
    status: filters.status || undefined,
    organization_id: filters.organization_id || undefined,
    region_id: filters.region_id || undefined,
  };
}

/**
 * Screen H1 — the administration of staff accounts, and the only place in the
 * system where a user is created at all.
 *
 * Citizens are absent by construction: they are born through OneID or E-IMZO,
 * and `POST /admin/users` refuses `role_code: "applicant"` outright, so the
 * role picker never offers it.
 */
export function UsersPage() {
  const { lang } = useLanguage();
  const L = labelsFor(lang);

  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [secrets, setSecrets] = useState<{ password?: string | null; totpUri?: string | null } | null>(null);

  const list = useUsersList(toParams(applied, page));
  const stats = useUserStats();
  const roles = useRoles();
  const organizations = useOrganizations();
  const regions = useRegions();

  const roleName = useMemo(() => {
    const byCode = new Map((roles.data ?? []).map((role) => [role.code, pickName(role.name, lang)]));
    return (code: string) => byCode.get(code) || code;
  }, [roles.data, lang]);

  const orgName = useMemo(() => {
    const byId = new Map((organizations.data ?? []).map((org) => [org.id, pickName(org.name, lang)]));
    return (id: string | null | undefined) => (id ? byId.get(id) || L.noValue : L.wholeRepublic);
  }, [organizations.data, lang, L.noValue, L.wholeRepublic]);

  const statusLabel = (status: string) =>
    status === 'active' ? L.statusActive : status === 'blocked' ? L.statusBlocked : L.statusDeleted;

  const apply = () => {
    setApplied(draft);
    setPage(1);
  };

  const onCreated = (created: UserCreatedOut) => {
    setFormMode(null);
    setSecrets({ password: created.one_time_password, totpUri: created.totp_uri });
  };

  return (
    <div data-testid="users-page" className="space-y-5 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[#1A1F24]">{L.pageTitle}</h1>
          <p className="text-xs text-[#5A646D] mt-1">{L.pageSubtitle}</p>
        </div>
        <Button onClick={() => setFormMode('create')} leftIcon={<Plus className="w-4 h-4" />}>
          {L.create}
        </Button>
      </header>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat testId="stat-total" label={L.statTotal} value={stats.data?.total} />
        <Stat testId="stat-active" label={L.statActive} value={stats.data?.by_status?.active} />
        <Stat testId="stat-blocked" label={L.statBlocked} value={stats.data?.by_status?.blocked} />
        <Stat testId="stat-sessions" label={L.statSessions} value={stats.data?.active_sessions} />
      </div>

      <section className="bg-white border border-[#E4E7EA] rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          <FormField label={L.filterQuery} helperText={L.filterQueryHint} htmlFor="users-filter-q">
            <Input
              id="users-filter-q"
              value={draft.q}
              placeholder={L.filterQueryPlaceholder}
              onChange={(e) => setDraft({ ...draft, q: e.target.value })}
            />
          </FormField>
          <FormField label={L.filterRole} htmlFor="users-filter-role">
            <Select
              id="users-filter-role"
              value={draft.role_code}
              onChange={(e) => setDraft({ ...draft, role_code: e.target.value })}
              options={[
                { value: '', label: L.filterAll },
                ...(roles.data ?? [])
                  .filter((role) => role.code !== 'applicant')
                  .map((role) => ({ value: role.code, label: pickName(role.name, lang) })),
              ]}
            />
          </FormField>
          <FormField label={L.filterStatus} htmlFor="users-filter-status">
            <Select
              id="users-filter-status"
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value })}
              options={[
                { value: '', label: L.filterAll },
                { value: 'active', label: L.statusActive },
                { value: 'blocked', label: L.statusBlocked },
                { value: 'deleted', label: L.statusDeleted },
              ]}
            />
          </FormField>
          <FormField label={L.filterOrganization} htmlFor="users-filter-org">
            <Select
              id="users-filter-org"
              value={draft.organization_id}
              onChange={(e) => setDraft({ ...draft, organization_id: e.target.value })}
              options={[
                { value: '', label: L.filterAll },
                ...(organizations.data ?? []).map((org) => ({
                  value: org.id,
                  label: pickName(org.name, lang),
                })),
              ]}
            />
          </FormField>
          <FormField label={L.filterRegion} htmlFor="users-filter-region">
            <Select
              id="users-filter-region"
              value={draft.region_id}
              onChange={(e) => setDraft({ ...draft, region_id: e.target.value })}
              options={[
                { value: '', label: L.filterAll },
                ...(regions.data ?? []).map((region) => ({
                  value: region.id,
                  label: pickName(region.name, lang),
                })),
              ]}
            />
          </FormField>
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={apply} leftIcon={<Search className="w-4 h-4" />}>
            {L.apply}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setDraft(EMPTY_FILTERS);
              setApplied(EMPTY_FILTERS);
              setPage(1);
            }}
          >
            {L.reset}
          </Button>
        </div>
      </section>

      <section className="bg-white border border-[#E4E7EA] rounded-2xl shadow-xs overflow-hidden">
        {list.isError ? (
          <div className="p-6">
            <Alert variant="danger">{L.loadFailed}</Alert>
          </div>
        ) : list.isPending ? (
          <p className="p-6 text-sm text-[#5A646D]">{L.loading}</p>
        ) : list.data.items.length === 0 ? (
          <p className="p-6 text-sm text-[#5A646D]">{L.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F8F9FA] text-left text-xs font-bold uppercase tracking-wide text-[#5A646D]">
                <tr>
                  <th className="px-4 py-3">{L.colFullName}</th>
                  <th className="px-4 py-3">{L.colLogin}</th>
                  <th className="px-4 py-3">{L.colRole}</th>
                  <th className="px-4 py-3">{L.colOrganization}</th>
                  <th className="px-4 py-3">{L.colStatus}</th>
                  <th className="px-4 py-3 text-right">{L.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((row) => (
                  <tr key={row.id} className="border-t border-[#E4E7EA]">
                    <td className="px-4 py-3 text-[#1A1F24]">{row.full_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#5A646D]">{row.login ?? L.noValue}</td>
                    <td className="px-4 py-3 text-[#5A646D]">{roleName(row.role_code)}</td>
                    <td className="px-4 py-3 text-[#5A646D]">{orgName(row.organization_id)}</td>
                    <td className="px-4 py-3">{statusLabel(row.status)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setOpenUserId(row.id)}>
                        {L.openCard}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {openUserId ? (
        <UserCard
          userId={openUserId}
          onClose={() => setOpenUserId(null)}
          onEdit={() => setFormMode('edit')}
          onSecrets={(next) => setSecrets(next)}
        />
      ) : null}

      {formMode ? (
        <UserFormModal
          mode={formMode}
          user={formMode === 'edit' ? (list.data?.items.find((u) => u.id === openUserId) ?? null) : null}
          onClose={() => setFormMode(null)}
          onCreated={onCreated}
        />
      ) : null}

      {secrets ? (
        <SecretPanel
          password={secrets.password}
          totpUri={secrets.totpUri}
          onAcknowledge={() => setSecrets(null)}
        />
      ) : null}
    </div>
  );
}

function Stat({ testId, label, value }: { testId: string; label: string; value: number | undefined }) {
  return (
    <article data-testid={testId} className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#5A646D]">{label}</p>
      <p className="mt-1 text-xl font-bold font-mono tabular-nums text-[#1A1F24]">{value ?? '—'}</p>
    </article>
  );
}

/**
 * The user's card: their details, the actions on them, their live sessions
 * (H4) and their personal grants (H3).
 *
 * The card re-reads the row from `GET /admin/users/{id}` rather than trusting
 * the list's copy, which may be pages old by the time somebody opens it.
 */
function UserCard({
  userId,
  onClose,
  onEdit,
  onSecrets,
}: {
  userId: string;
  onClose: () => void;
  onEdit: () => void;
  onSecrets: (secrets: { password?: string | null; totpUri?: string | null }) => void;
}) {
  const { lang } = useLanguage();
  const L = labelsFor(lang);
  const [tab, setTab] = useState('info');
  const [blocking, setBlocking] = useState(false);

  const user = useUser(userId);

  return (
    <Modal isOpen onClose={onClose} title={L.cardTitle}>
      <div data-testid="user-card" className="space-y-5">
        {user.isError ? (
          <Alert variant="danger">{L.cardFailed}</Alert>
        ) : user.isPending ? (
          <p className="text-sm text-[#5A646D]">{L.cardLoading}</p>
        ) : (
          <>
            <Tabs
              tabs={[
                { id: 'info', label: L.tabInfo },
                { id: 'sessions', label: L.tabSessions },
                { id: 'grants', label: L.tabGrants },
              ]}
              activeTabId={tab}
              onChange={setTab}
            />

            {tab === 'info' ? (
              <UserInfo user={user.data} onEdit={onEdit} onBlock={() => setBlocking(true)} onSecrets={onSecrets} />
            ) : null}
            {tab === 'sessions' ? <SessionsTab userId={userId} /> : null}
            {tab === 'grants' ? <GrantsTab userId={userId} /> : null}

            {blocking ? <BlockDialog userId={userId} onDone={() => setBlocking(false)} /> : null}
          </>
        )}
      </div>
    </Modal>
  );
}

function UserInfo({
  user,
  onEdit,
  onBlock,
  onSecrets,
}: {
  user: UserAdminOut;
  onEdit: () => void;
  onBlock: () => void;
  onSecrets: (secrets: { password?: string | null; totpUri?: string | null }) => void;
}) {
  const { lang } = useLanguage();
  const L = labelsFor(lang);
  const unblock = useUnblockUser();
  const remove = useDeleteUser();
  const resetPassword = useResetPassword();
  const resetMfa = useResetMfa();

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <Field label={L.fieldLogin} value={user.login} mono />
        <Field label={L.fieldFullName} value={user.full_name} />
        <Field label={L.fieldPinfl} value={user.pinfl} mono />
        <Field label={L.fieldPosition} value={user.position} />
        <Field label={L.fieldPhone} value={user.phone} />
        <Field label={L.fieldEmail} value={user.email} />
        <Field label={L.fieldStatus} value={user.status} />
      </dl>

      {user.must_change_password ? <Alert variant="warning">{L.mustChangePassword}</Alert> : null}

      <div className="pt-3 border-t border-[#E4E7EA]">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#5A646D] mb-2">{L.actionsTitle}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={onEdit}>
            {L.actionEdit}
          </Button>
          {user.status === 'blocked' ? (
            <Button size="sm" variant="secondary" onClick={() => unblock.mutate(user.id)}>
              {L.actionUnblock}
            </Button>
          ) : (
            <Button size="sm" variant="danger" onClick={onBlock}>
              {L.actionBlock}
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              resetPassword.mutate(user.id, {
                onSuccess: (result) => onSecrets({ password: result.one_time_password }),
              })
            }
          >
            {L.actionResetPassword}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              resetMfa.mutate(user.id, { onSuccess: (result) => onSecrets({ totpUri: result.totp_uri }) })
            }
          >
            {L.actionResetMfa}
          </Button>
          <Button size="sm" variant="danger" onClick={() => remove.mutate(user.id)}>
            {L.actionDelete}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  const { lang } = useLanguage();
  const L = labelsFor(lang);
  return (
    <div>
      <dt className="text-xs text-[#5A646D]">{label}</dt>
      <dd className={`text-[#1A1F24] ${mono ? 'font-mono text-xs' : ''}`}>{value || L.noValue}</dd>
    </div>
  );
}

/** Blocking is the one action carrying a body: the reason lands in the audit
 *  trail, so an empty one is refused here rather than sent as a placeholder. */
function BlockDialog({ userId, onDone }: { userId: string; onDone: () => void }) {
  const { lang } = useLanguage();
  const L = labelsFor(lang);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const block = useBlockUser();

  const submit = () => {
    setTouched(true);
    if (!reason.trim()) return;
    block.mutate({ userId, reason }, { onSuccess: onDone });
  };

  return (
    <div data-testid="block-dialog" className="rounded-xl border border-[#E4E7EA] bg-[#F8F9FA] p-4 space-y-3">
      <p className="text-sm font-bold text-[#1A1F24]">{L.blockTitle}</p>
      <FormField label={L.blockReason} helperText={L.blockReasonHint} required htmlFor="block-reason">
        <Textarea id="block-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </FormField>
      {touched && !reason.trim() ? <p className="text-xs text-[#B91C1C]">{L.blockReasonRequired}</p> : null}
      {block.isError ? <Alert variant="danger">{L.blockFailed}</Alert> : null}
      <div className="flex gap-2">
        <Button size="sm" variant="danger" onClick={submit} disabled={block.isPending}>
          {L.blockConfirm}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          {L.cancel}
        </Button>
      </div>
    </div>
  );
}

function SessionsTab({ userId }: { userId: string }) {
  const { lang } = useLanguage();
  const L = labelsFor(lang);
  const sessions = useUserSessions(userId);
  const revoke = useRevokeSession();
  const revokeAll = useRevokeAllSessions();

  if (sessions.isError) return <Alert variant="danger">{L.sessionsFailed}</Alert>;
  if (sessions.isPending) return <p className="text-sm text-[#5A646D]">{L.loading}</p>;
  if (sessions.data.length === 0) return <p className="text-sm text-[#5A646D]">{L.sessionsEmpty}</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#5A646D]">{L.sessionsHint}</p>
      <ul className="space-y-2">
        {sessions.data.map((session) => (
          <li
            key={session.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E4E7EA] bg-[#F8F9FA] px-4 py-3"
          >
            <div className="min-w-0 text-xs text-[#5A646D]">
              <p className="text-[#1A1F24]">{session.ip ?? L.noValue}</p>
              <p className="truncate max-w-xs">{session.user_agent ?? L.noValue}</p>
              <p>
                {L.sessionLastSeen}: {formatDateTime(session.last_seen_at)}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => revoke.mutate({ sessionId: session.id, userId })}
            >
              {L.sessionRevoke}
            </Button>
          </li>
        ))}
      </ul>
      <Button size="sm" variant="danger" onClick={() => revokeAll.mutate(userId)}>
        {L.sessionRevokeAll}
      </Button>
    </div>
  );
}

/**
 * Personal grants — codes given to THIS user on top of whatever their role
 * already carries. Not the effective set: `GET /auth/me` is what answers
 * "what may this caller do", and reading this list as the user's full rights
 * is the misreading the notice above it exists to prevent.
 */
function GrantsTab({ userId }: { userId: string }) {
  const { lang } = useLanguage();
  const L = labelsFor(lang);
  const granted = useUserPermissions(userId);
  const registry = usePermissions();
  const save = useSetUserPermissions();
  const [draft, setDraft] = useState<string[] | null>(null);

  const codes = draft ?? granted.data?.codes ?? [];
  const toggle = (code: string) =>
    setDraft(codes.includes(code) ? codes.filter((c) => c !== code) : [...codes, code]);

  const groups = useMemo(() => {
    const byModule = new Map<string, PermissionOut[]>();
    for (const permission of registry.data ?? []) {
      const module = permission.code.split('.')[0];
      byModule.set(module, [...(byModule.get(module) ?? []), permission]);
    }
    return [...byModule.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [registry.data]);

  if (granted.isError || registry.isError) return <Alert variant="danger">{L.grantsFailed}</Alert>;
  if (granted.isPending || registry.isPending) return <p className="text-sm text-[#5A646D]">{L.loading}</p>;

  return (
    <div className="space-y-4">
      <Alert variant="info">{L.grantsNotice}</Alert>
      <p className="text-xs text-[#5A646D]">{L.grantsRoleHint}</p>

      {groups.map(([module, permissions]) => (
        <fieldset key={module} className="rounded-xl border border-[#E4E7EA] p-3">
          <legend className="px-1 text-xs font-bold uppercase tracking-wide text-[#5A646D]">{module}</legend>
          <ul className="space-y-1.5">
            {(permissions ?? []).map((permission) => (
              <li key={permission.code}>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={codes.includes(permission.code)}
                    onChange={() => toggle(permission.code)}
                  />
                  <span>
                    <span className="font-mono text-xs text-[#1A1F24]">{permission.code}</span>
                    <span className="block text-xs text-[#5A646D]">{permission.description}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ))}

      {save.isError ? <Alert variant="danger">{L.grantsSaveFailed}</Alert> : null}
      <Button size="sm" disabled={save.isPending} onClick={() => save.mutate({ userId, codes })}>
        {L.grantsSave}
      </Button>
    </div>
  );
}
