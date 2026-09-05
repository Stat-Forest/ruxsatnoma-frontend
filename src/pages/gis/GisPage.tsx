import { useState } from 'react';
import { Tabs } from '../../components/ui/Navigation';
import { useT } from '../../i18n/useT';
import { ContoursTab } from './contours/ContoursTab';
import { ImportsTab } from './imports/ImportsTab';
import { LayersTab } from './layers/LayersTab';

type TabId = 'contours' | 'imports' | 'layers';

/**
 * The GIS specialist's workplace (F1-F4, stage 6.5 track F1). One route,
 * `/gis`, carries all four screens as tabs — `navigation.ts` has exactly one
 * entry for the whole page (widened to `['gis.contours.manage',
 * 'gis.contours.approve', 'gis.layers.manage']`, see this track's plan, so
 * every one of the three roles that acts on this page — specialist, rahbar,
 * central_admin — can open it at all). F2 (contour versions) is not a
 * separate tab: it is the lifecycle panel inside "Contours" for whichever
 * version the operator currently holds — see `contours/VersionPanel.tsx`
 * and plan ruling 2 for why "currently holds" is the operative phrase.
 */
export function GisPage() {
  const t = useT();
  const [tab, setTab] = useState<TabId>('contours');

  return (
    <div className="space-y-4 pb-16 font-sans" data-testid="gis-page">
      <div className="border-b border-[#E4E7EA] pb-4">
        <h1 className="text-lg font-bold tracking-tight text-[#1A1F24] md:text-xl">{t('gis.page.title')}</h1>
        <p className="mt-1 text-xs text-[#5A646D] md:text-sm">{t('gis.page.subtitle')}</p>
      </div>

      <Tabs
        tabs={[
          { id: 'contours', label: t('gis.page.tabContours') },
          { id: 'imports', label: t('gis.page.tabImports') },
          { id: 'layers', label: t('gis.page.tabLayers') },
        ]}
        activeTabId={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      {tab === 'contours' && <ContoursTab t={t} />}
      {tab === 'imports' && <ImportsTab t={t} />}
      {tab === 'layers' && <LayersTab t={t} />}
    </div>
  );
}
