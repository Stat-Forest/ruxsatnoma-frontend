/**
 * The hierarchy itself. Not a `DataTable`: a table's columns cannot show
 * containment, and containment is the whole content of this screen — a user's
 * `organization_id` is what scopes everything they are allowed to see, so
 * "which board is this leshoz under" is the question the screen exists to
 * answer.
 *
 * The rows are flattened into one list with `aria-level`, rather than nested
 * `<ul>`s, so that an indent of six levels does not eat the whole width of a
 * 375px screen.
 */
import { Archive, Building2, ChevronDown, ChevronRight, Landmark, Pencil, Plus, TreePine } from 'lucide-react';
import type { OrganizationOut } from '../api';
import { childKindsOf, visibleRows, type OrgNode } from './hierarchy';
import type { Labels } from './labels';
import { pickName } from '../../applicant/format';
import type { UiLanguage } from '../../../i18n/context';

const KIND_ICON: Record<string, typeof Landmark> = {
  agency: Landmark,
  territorial: Building2,
  leshoz: TreePine,
};

/** The leshoz is the row that matters — it is the organization almost every
 *  staff account is attached to — so it carries the green accent and the rest
 *  stay neutral. */
function kindPillClass(kind: string): string {
  if (kind === 'leshoz') return 'bg-[#F0F7F1] text-[#23653F] border-[#D9EBDC]';
  if (kind === 'agency') return 'bg-[#EEF2F6] text-[#1A1F24] border-[#D6DDE4]';
  return 'bg-white text-[#5A646D] border-[#E4E7EA]';
}

interface RowProps {
  node: OrgNode;
  collapsed: boolean;
  labels: Labels;
  lang: UiLanguage;
  onToggle: (orgId: string) => void;
  onEdit: (org: OrganizationOut) => void;
  onArchive: (org: OrganizationOut) => void;
  onAddChild: (org: OrganizationOut) => void;
}

function OrganizationRow({ node, collapsed, labels, lang, onToggle, onEdit, onArchive, onAddChild }: RowProps) {
  const { org, depth } = node;
  const hasChildren = node.children.length > 0;
  const Icon = KIND_ICON[org.kind] ?? Building2;
  const archived = org.status === 'archived';
  const canHaveChildren = childKindsOf(org.kind).length > 0;

  return (
    <li
      role="treeitem"
      aria-level={depth + 1}
      aria-expanded={hasChildren ? !collapsed : undefined}
      data-testid={`org-row-${org.id}`}
      data-depth={depth}
      className={`flex items-start gap-2 py-2.5 pr-2 border-b border-[#E4E7EA] last:border-b-0 hover:bg-[#F8F9FA] ${
        archived ? 'opacity-60' : ''
      }`}
      style={{ paddingLeft: 8 + depth * 16 }}
    >
      {hasChildren ? (
        <button
          type="button"
          data-testid={`org-toggle-${org.id}`}
          onClick={() => onToggle(org.id)}
          aria-label={collapsed ? labels['tree.expand'] : labels['tree.collapse']}
          className="mt-0.5 shrink-0 p-1 rounded text-[#5A646D] hover:bg-[#E4E7EA] hover:text-[#1A1F24]"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      ) : (
        <span className="w-6 shrink-0" aria-hidden="true" />
      )}

      <Icon
        className={`w-4 h-4 mt-1.5 shrink-0 ${org.kind === 'leshoz' ? 'text-[#2E7D4F]' : 'text-[#9AA3AB]'}`}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-[#1A1F24] break-words">
            {pickName(org.name, lang) || org.code}
          </span>
          <span
            data-testid="org-kind"
            className={`shrink-0 px-2 py-0.5 rounded-full border text-[11px] font-medium ${kindPillClass(org.kind)}`}
          >
            {labels[`kind.${org.kind}` as keyof Labels] ?? org.kind}
          </span>
          <span
            data-testid="org-status"
            className={`shrink-0 px-2 py-0.5 rounded-full border text-[11px] ${
              archived
                ? 'bg-[#F8F9FA] text-[#5A646D] border-[#E4E7EA]'
                : 'bg-[#F0F7F1] text-[#15803D] border-[#D9EBDC]'
            }`}
          >
            {archived ? labels['status.archived'] : labels['status.active']}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-[#5A646D]">
          <span className="font-mono">{org.code}</span>
          <span aria-hidden="true">·</span>
          <span>{org.stir ? `${labels['form.stir']} ${org.stir}` : labels['tree.noStir']}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {canHaveChildren && (
          <button
            type="button"
            data-testid={`org-add-child-${org.id}`}
            onClick={() => onAddChild(org)}
            aria-label={labels['tree.addChild']}
            title={labels['tree.addChild']}
            className="p-1.5 rounded text-[#5A646D] hover:bg-[#F0F7F1] hover:text-[#2E7D4F]"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          data-testid={`org-edit-${org.id}`}
          onClick={() => onEdit(org)}
          aria-label={labels['tree.edit']}
          title={labels['tree.edit']}
          className="p-1.5 rounded text-[#5A646D] hover:bg-[#F0F7F1] hover:text-[#2E7D4F]"
        >
          <Pencil className="w-4 h-4" />
        </button>
        {!archived && (
          <button
            type="button"
            data-testid={`org-archive-${org.id}`}
            onClick={() => onArchive(org)}
            aria-label={labels['tree.archive']}
            title={labels['tree.archive']}
            className="p-1.5 rounded text-[#5A646D] hover:bg-[#FEF2F2] hover:text-[#B91C1C]"
          >
            <Archive className="w-4 h-4" />
          </button>
        )}
      </div>
    </li>
  );
}

export interface OrganizationTreeProps {
  nodes: OrgNode[];
  collapsed: ReadonlySet<string>;
  labels: Labels;
  lang: UiLanguage;
  onToggle: (orgId: string) => void;
  onEdit: (org: OrganizationOut) => void;
  onArchive: (org: OrganizationOut) => void;
  onAddChild: (org: OrganizationOut) => void;
}

export function OrganizationTree({ nodes, collapsed, ...handlers }: OrganizationTreeProps) {
  const rows = visibleRows(nodes, collapsed);
  return (
    <ul role="tree" aria-label={handlers.labels['page.title']} data-testid="org-tree" className="w-full">
      {rows.map((node) => (
        <OrganizationRow
          key={node.org.id}
          node={node}
          collapsed={collapsed.has(node.org.id)}
          {...handlers}
        />
      ))}
    </ul>
  );
}
