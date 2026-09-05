import { useT } from '../../i18n/useT';

/** G5 placeholder — replaced by the real screen in a later commit. */
export function RefundsTab() {
  const t = useT();
  return <div data-testid="refunds-tab-placeholder">{t('accountant.common.loading')}</div>;
}
