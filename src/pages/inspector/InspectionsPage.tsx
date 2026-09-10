/**
 * J1 (stage 6.7) — the inspector's working screens (tz/04 С15/С16), the
 * phone-first tab shell every sub-screen mounts under. Copies `NormsPage.tsx`'s
 * own structure exactly: every tab body mounts up front, toggled with
 * `hidden` (never conditionally rendered — a tab switch must not reset a
 * tab's own filters/state), and each tab body takes an `active: boolean`
 * prop so a query inside a HIDDEN tab does not fire (`ParamsTab.tsx`'s own
 * documented gotcha, one track over).
 *
 * `acts`/`cases` (task 6) join `scan`/`tasks` (task 2) in the same tab
 * array and `TabId` union, same shape throughout.
 *
 * Stage 7.6 (ruling R8/#138) adds `?tab=&applicant_id=` as an OPTIONAL entry
 * point: `CaseDetailPage`'s `prior_cases_count` links here rather than to a
 * route of its own, so the repeat-violation history reuses `CasesTab`'s
 * existing list, pagination and zone-scoped query instead of a second one
 * a different screen would have to keep in step with it.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Tabs } from '../../components/ui/Navigation';
import { useT } from '../../i18n/useT';
import { ScanTab } from './ScanTab';
import { TasksTab } from './TasksTab';
import { ActsTab } from './ActsTab';
import { CasesTab } from './CasesTab';

export type TabId = 'scan' | 'tasks' | 'acts' | 'cases';

const TAB_IDS: TabId[] = ['scan', 'tasks', 'acts', 'cases'];

function isTabId(value: string | null): value is TabId {
  return TAB_IDS.includes(value as TabId);
}

export function InspectionsPage() {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const applicantId = searchParams.get('applicant_id') ?? undefined;
  // 'tasks' is the default: what the inspector opens this screen FOR, day
  // to day — scanning a QR is a deliberate, occasional action, not the
  // landing view. `?tab=` (above) overrides it for a caller that arrives
  // asking for a specific one, e.g. the repeat-violation link.
  const [tab, setTab] = useState<TabId>(isTabId(requestedTab) ? requestedTab : 'tasks');

  return (
    <div className="space-y-6 font-sans pb-16" data-testid="inspections-page">
      <div className="border-b border-[#E4E7EA] pb-4">
        <h1 className="text-lg md:text-xl font-bold text-[#1A1F24] tracking-tight">{t('inspector.title')}</h1>
      </div>

      <Tabs
        tabs={[
          { id: 'scan', label: t('inspector.tabs.scan') },
          { id: 'tasks', label: t('inspector.tabs.tasks') },
          { id: 'acts', label: t('inspector.tabs.acts') },
          { id: 'cases', label: t('inspector.tabs.cases') },
        ]}
        activeTabId={tab}
        onChange={(id) => {
          setTab(id as TabId);
          // Leaving the `cases` tab drops `applicant_id` too — the filter is
          // a fact about how the reader ARRIVED here, not a standing
          // preference that should survive a trip to another tab and back.
          setSearchParams({});
        }}
      />

      <div hidden={tab !== 'scan'}>
        <ScanTab />
      </div>
      <div hidden={tab !== 'tasks'}>
        <TasksTab active={tab === 'tasks'} />
      </div>
      <div hidden={tab !== 'acts'}>
        <ActsTab active={tab === 'acts'} />
      </div>
      <div hidden={tab !== 'cases'}>
        <CasesTab active={tab === 'cases'} applicantId={tab === 'cases' ? applicantId : undefined} />
      </div>
    </div>
  );
}
