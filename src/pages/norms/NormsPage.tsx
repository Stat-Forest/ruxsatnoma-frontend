/**
 * F5-F7 — norms, tariffs and rule parameters, one route (`/norms`) behind
 * one menu entry (ruling R1, `navigation.ts`), split into three tabs because
 * the two permissions that gate them (`norms.manage`, `norms.tariffs.manage`)
 * are held by different people who both need this screen.
 *
 * Each tab body is a bare, no-props component in its own file (`ParamsTab`,
 * `NormsTab`, `TariffsTab`) — a small stub here, replaced by tasks 3-6
 * without this file changing shape, the same way `placeholders.tsx` replaces
 * a placeholder by re-export.
 *
 * All three stay mounted once the page loads; switching tabs only toggles
 * the `hidden` attribute. `IntegrationsPage` unmounts its inactive tab on
 * purpose, because neither of its two queues carries state worth keeping —
 * here the opposite holds: task 3 needs a tab switch to NOT reset
 * Parameters' own filters, and conditionally rendering only the active tab
 * would remount it (and reset that state) on every switch.
 */
import { useState } from 'react';
import { Tabs } from '../../components/ui/Navigation';
import { useT } from '../../i18n/useT';
import { NormsTab } from './NormsTab';
import { ParamsTab } from './ParamsTab';
import { TariffsTab } from './TariffsTab';

type NormsTabId = 'params' | 'norms' | 'tariffs';

export function NormsPage() {
  const t = useT();
  // 'params' is first and default deliberately — it is the screen the track
  // exists for (task-2 brief).
  const [tab, setTab] = useState<NormsTabId>('params');

  return (
    <div className="space-y-6 font-sans pb-16" data-testid="norms-page">
      <div className="border-b border-[#E4E7EA] pb-4">
        <h1 className="text-lg font-bold tracking-tight text-[#1A1F24] md:text-xl">
          {t('norms.title')}
        </h1>
      </div>

      <Tabs
        tabs={[
          { id: 'params', label: t('norms.tab.params') },
          { id: 'norms', label: t('norms.tab.norms') },
          { id: 'tariffs', label: t('norms.tab.tariffs') },
        ]}
        activeTabId={tab}
        onChange={(id) => setTab(id as NormsTabId)}
      />

      <div hidden={tab !== 'params'}>
        <ParamsTab />
      </div>
      <div hidden={tab !== 'norms'}>
        <NormsTab />
      </div>
      <div hidden={tab !== 'tariffs'}>
        <TariffsTab />
      </div>
    </div>
  );
}
