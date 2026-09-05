import { useT } from '../../i18n/useT';

/** G4 placeholder — replaced by the real screen in a later commit. */
export function DiscrepanciesTab() {
  const t = useT();
  return <div data-testid="discrepancies-tab-placeholder">{t('accountant.common.loading')}</div>;
}
