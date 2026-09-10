import { AlertCircle } from 'lucide-react';
import { useT } from '../../i18n/useT';
// Through `./index`, not `./switch`, on purpose: the call sites' real-mode
// tests flip the switch with `vi.spyOn(eimzo, 'isEimzoMock')` on the index
// namespace, and a direct import here would not see that spy — this hook
// would still think "mock", find no PINFL, and disable the button the test
// is about to click. The cycle is harmless: the binding is only read at
// render time, never while `index.ts` is still evaluating.
import { isEimzoMock } from './index';
import type { MockSigner } from './useMockSigner';

/**
 * Mock mode only: one line saying which PINFL the mock signature will
 * carry, or — with none recorded on the account — the reason the button is
 * disabled. Renders nothing in real mode.
 */
export function MockSignerNotice({ signer }: { signer: MockSigner }) {
  const t = useT();
  if (!isEimzoMock()) return null;
  if (signer.pinfl === null) {
    return (
      <p className="text-xs text-[#B91C1C] flex items-center gap-1.5" role="alert">
        <AlertCircle className="w-4 h-4 shrink-0" /> {t('eimzo.mock.pinflMissing')}
      </p>
    );
  }
  return (
    <p className="text-xs text-[#5A646D]" data-testid="mock-signer-notice">
      {t('eimzo.mock.signingAs')} <strong className="text-[#1A1F24] font-mono">{signer.pinfl}</strong>
    </p>
  );
}
