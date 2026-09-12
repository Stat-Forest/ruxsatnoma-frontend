/**
 * H5 — the organization hierarchy.
 *
 * This screen is the one that decides what everybody else can see: a staff
 * account's `organization_id` scopes its whole view of the system, so the two
 * things it has to get right are (a) showing containment plainly — which board
 * a leshoz reports to — and (b) never letting an administrator build a pairing
 * the backend will refuse.
 *
 * The tree is walked level by level (`./api::fetchOrganizationTree`): the
 * reference route's `parent_id` is a STRICT filter, and omitting it returns the
 * single agency rather than everything.
 */
import { useMemo, useState } from 'react';
import { Loader2, Plus, Search } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { ExportXlsxButton } from '../../../components/ui/ExportXlsxButton';
import { Input } from '../../../components/ui/FormControls';
import { ApiError } from '../../../api/errors';
import { useLanguage } from '../../../i18n/useT';
import type { OrganizationOut } from '../api';
import { ArchiveConfirmModal } from './ArchiveConfirmModal';
import { OrganizationFormModal, type FormTarget } from './OrganizationFormModal';
import { OrganizationTree } from './OrganizationTree';
import {
  buildOrganizationTree,
  countNodes,
  countOfKind,
  filterTree,
  type OrgNode,
} from './hierarchy';
import { useLabels } from './labels';
import { useOrganizationTree } from './queries';

const NOTHING_COLLAPSED: ReadonlySet<string> = new Set<string>();

/** Matches against the code and against EVERY locale of the name, not just the
 *  one on screen: an administrator typing «Бурчмулла» while the interface is in
 *  Latin should still find the row. */
function matchesQuery(node: OrgNode, query: string): boolean {
  if (node.org.code.toLowerCase().includes(query)) return true;
  return Object.values(node.org.name).some(
    (value) => typeof value === 'string' && value.toLowerCase().includes(query),
  );
}

export function OrganizationsPage() {
  const labels = useLabels();
  const { lang } = useLanguage();
  const tree = useOrganizationTree();

  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(NOTHING_COLLAPSED);
  const [search, setSearch] = useState('');
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<OrganizationOut | null>(null);
  const [archivedNotice, setArchivedNotice] = useState(false);

  const rows = useMemo(() => tree.data ?? [], [tree.data]);
  const roots = useMemo(() => buildOrganizationTree(rows), [rows]);

  const query = search.trim().toLowerCase();
  const shown = useMemo(
    () => (query ? filterTree(roots, (node) => matchesQuery(node, query)) : roots),
    [roots, query],
  );

  const total = countNodes(roots);
  const leshozes = countOfKind(roots, 'leshoz');

  function toggle(orgId: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(orgId)) next.delete(orgId);
      else next.add(orgId);
      return next;
    });
  }

  return (
    <div className="space-y-6 font-sans pb-16" data-testid="organizations-page">
      <div className="flex flex-col gap-3 border-b border-[#E4E7EA] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-[#1A1F24] md:text-xl">
            {labels['page.title']}
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-[#5A646D] md:text-sm">{labels['page.subtitle']}</p>
        </div>
        <Button
          data-testid="org-create"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => {
            setArchivedNotice(false);
            setFormTarget({ mode: 'create' });
          }}
        >
          {labels['page.create']}
        </Button>
      </div>

      {archivedNotice && (
        <div
          data-testid="org-archived-notice"
          role="status"
          className="rounded-2xl border border-[#D9EBDC] bg-[#F0F7F1] p-4 text-sm text-[#123522]"
        >
          {labels['archive.done']}
        </div>
      )}

      <div className="rounded-2xl border border-[#E4E7EA] bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div data-testid="org-summary" className="flex gap-6">
            <div>
              <div className="text-xs uppercase tracking-wider text-[#5A646D]">
                {labels['summary.total']}
              </div>
              <div className="text-2xl font-bold text-[#1A1F24]">{total}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-[#5A646D]">
                {labels['summary.leshoz']}
              </div>
              <div className="text-2xl font-bold text-[#2E7D4F]">{leshozes}</div>
            </div>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={labels['search.placeholder']}
              aria-label={labels['search.placeholder']}
              data-testid="org-search"
              leftIcon={<Search className="h-4 w-4" />}
              className="sm:max-w-xs"
            />
            {/* The tree walks `parent_id` level by level and the search above
                is client-side only (no server query object to mirror), so the
                export requests every active organization — the same default
                `GET /refs/organizations` itself answers with no filter. */}
            <ExportXlsxButton className="ml-auto" path="/api/v1/refs/organizations" query={{}} />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E4E7EA] bg-white shadow-xs">
        {tree.isLoading ? (
          <p className="flex items-center justify-center gap-2 py-12 text-sm text-[#5A646D]">
            <Loader2 className="h-5 w-5 animate-spin text-[#2E7D4F]" />
            {labels['form.loading']}
          </p>
        ) : tree.error ? (
          <p
            data-testid="org-tree-error"
            role="alert"
            className="m-4 rounded-md border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]"
          >
            {tree.error instanceof ApiError
              ? `${labels['tree.error']} (${tree.error.code})`
              : labels['tree.error']}
          </p>
        ) : shown.length === 0 ? (
          <p data-testid="org-tree-empty" className="py-12 text-center text-sm text-[#5A646D]">
            {query ? labels['search.empty'] : labels['tree.empty']}
          </p>
        ) : (
          <OrganizationTree
            nodes={shown}
            // While a search is running every surviving branch stays open —
            // a hit hidden inside a collapsed ancestor reads as "not found".
            collapsed={query ? NOTHING_COLLAPSED : collapsed}
            labels={labels}
            lang={lang}
            onToggle={toggle}
            onEdit={(org) => {
              setArchivedNotice(false);
              setFormTarget({ mode: 'edit', orgId: org.id });
            }}
            onAddChild={(org) => {
              setArchivedNotice(false);
              setFormTarget({ mode: 'create', parent: org });
            }}
            onArchive={(org) => {
              setArchivedNotice(false);
              setArchiveTarget(org);
            }}
          />
        )}
      </div>

      {formTarget && (
        <OrganizationFormModal
          // A fresh mount per target: the form seeds its state once, so
          // reopening it for another row must not reuse the previous one's.
          key={formTarget.mode === 'edit' ? formTarget.orgId : (formTarget.parent?.id ?? 'new')}
          target={formTarget}
          organizations={rows}
          onClose={() => setFormTarget(null)}
        />
      )}

      {archiveTarget && (
        <ArchiveConfirmModal
          key={archiveTarget.id}
          org={archiveTarget}
          onClose={() => setArchiveTarget(null)}
          onArchived={() => {
            setArchiveTarget(null);
            setArchivedNotice(true);
          }}
        />
      )}
    </div>
  );
}
