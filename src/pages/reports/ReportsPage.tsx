/**
 * J2 — the central apparatus's reporting screens (С20), one route
 * (`/reports`) behind one menu entry, split into two tabs exactly the shape
 * `pages/norms/NormsPage.tsx` established: "Reports" (the workflow this
 * track exists for, default) and "Forms" (the small admin catalog behind
 * it). Both tabs stay mounted once the page loads — switching only toggles
 * `hidden` — so each tab body gates its own queries on its own `active`
 * prop (that file's own header comment explains why).
 */
import { useState } from 'react';
import { Tabs } from '../../components/ui/Navigation';
import { useT } from '../../i18n/useT';
import { ReportFormsTab } from './ReportFormsTab';
import { ReportsListTab } from './ReportsListTab';

type ReportsTabId = 'reports' | 'forms';

export function ReportsPage() {
  const t = useT();
  const [tab, setTab] = useState<ReportsTabId>('reports');

  return (
    <div className="space-y-6 font-sans pb-16" data-testid="reports-page">
      <div className="border-b border-[#E4E7EA] pb-4">
        <h1 className="text-lg font-bold tracking-tight text-[#1A1F24] md:text-xl">{t('reports.title')}</h1>
      </div>

      <Tabs
        tabs={[
          { id: 'reports', label: t('reports.tab.reports') },
          { id: 'forms', label: t('reports.tab.forms') },
        ]}
        activeTabId={tab}
        onChange={(id) => setTab(id as ReportsTabId)}
      />

      <div hidden={tab !== 'reports'}>
        <ReportsListTab active={tab === 'reports'} />
      </div>
      <div hidden={tab !== 'forms'}>
        <ReportFormsTab active={tab === 'forms'} />
      </div>
    </div>
  );
}
