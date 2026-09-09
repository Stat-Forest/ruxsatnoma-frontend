import { useState } from 'react';
import { Tabs } from '../../components/ui/Navigation';
import { useT } from '../../i18n/useT';
import { ZoneBanner } from './ZoneBanner';
import { InvoicesTab } from './InvoicesTab';
import { StatementsTab } from './StatementsTab';
import { DiscrepanciesTab } from './DiscrepanciesTab';
import { RefundsTab } from './RefundsTab';

type TabId = 'invoices' | 'statements' | 'discrepancies' | 'refunds';

/**
 * The accountant's whole workplace (track F3, screens G1–G5) — one route
 * (`/invoices`, permission `payments.view` OR `payments.confirm`, see
 * `shell/navigation.ts`), four tabs kept in component state rather than
 * separate routes (`06.5-accountant.md` ruling R3: the task brief forbids
 * touching `routes.tsx`, and only one nav entry exists for this whole area).
 *
 * `executor_head` (the manual-PAID / refund CHECKER, holding only
 * `payments.confirm`) reaches this same page — ruling R4 widened the nav
 * entry's permission to admit them. What they see inside each tab is then
 * gated on the specific code they hold, same pattern `DecisionPanel.tsx`
 * uses for `applications.review` vs `.decide`.
 */
export function AccountantWorkspace() {
  const t = useT();
  const [tab, setTab] = useState<TabId>('invoices');

  return (
    <div className="space-y-5 pb-16 font-sans" data-testid="accountant-workspace">
      <header className="border-b border-[#E4E7EA] pb-3 sm:pb-4">
        <h1 className="text-lg font-bold text-[#1A1F24] md:text-xl">{t('accountant.workspace.title')}</h1>
        <p className="mt-1 text-xs text-[#5A646D] md:text-sm">{t('accountant.workspace.subtitle')}</p>
      </header>

      <ZoneBanner />

      <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
        <Tabs
          tabs={[
            { id: 'invoices', label: t('accountant.tabs.invoices') },
            { id: 'statements', label: t('accountant.tabs.statements') },
            { id: 'discrepancies', label: t('accountant.tabs.discrepancies') },
            { id: 'refunds', label: t('accountant.tabs.refunds') },
          ]}
          activeTabId={tab}
          onChange={(id) => setTab(id as TabId)}
        />
      </div>

      <div>
        {tab === 'invoices' && <InvoicesTab />}
        {tab === 'statements' && <StatementsTab />}
        {tab === 'discrepancies' && <DiscrepanciesTab />}
        {tab === 'refunds' && <RefundsTab />}
      </div>
    </div>
  );
}
