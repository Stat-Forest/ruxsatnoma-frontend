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
 */
import { useState } from 'react';
import { Tabs } from '../../components/ui/Navigation';
import { useT } from '../../i18n/useT';
import { ScanTab } from './ScanTab';
import { TasksTab } from './TasksTab';
import { ActsTab } from './ActsTab';
import { CasesTab } from './CasesTab';

export type TabId = 'scan' | 'tasks' | 'acts' | 'cases';

export function InspectionsPage() {
  const t = useT();
  // 'tasks' is the default: what the inspector opens this screen FOR, day
  // to day — scanning a QR is a deliberate, occasional action, not the
  // landing view.
  const [tab, setTab] = useState<TabId>('tasks');

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
        onChange={(id) => setTab(id as TabId)}
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
        <CasesTab active={tab === 'cases'} />
      </div>
    </div>
  );
}
