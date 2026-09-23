/**
 * The certificate picker: the one screen that tells a signer WHOSE
 * certificate is about to sign, and lets them say otherwise.
 *
 * Mounted once, at the root (`App.tsx`), above the router — `AuthProvider`
 * signs the login challenge before any route exists, so a picker living
 * inside a page could not serve it. It registers itself with
 * `keySelector.ts` and `client.ts` asks through that seam, which is why no
 * signing call site has to know this component exists.
 *
 * Why it lists expired certificates instead of hiding them (2026-09-23,
 * the first run against a real E-IMZO install): six certificates were
 * connected, five expired — including the operator's own, lapsed two weeks
 * earlier — and the only valid one belonged to a colleague. Hidden, the
 * screen would have shown one unfamiliar name and no reason; listed and
 * greyed, it says plainly "yours expired on 09.09.2026", which is the
 * actual thing to act on.
 */
import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/Overlay';
import { useT } from '../../i18n/useT';
import type { EimzoKeyInfo } from './client';
import { EimzoCancelledError } from './errors';
import { setEimzoKeySelector } from './keySelector';

/** `DD.MM.YYYY` from a `Date`, the same shape `applicant/format.ts`
 *  produces for a `date` column — not `toLocaleDateString`, whose output
 *  changes with the browser's locale while the rest of this app's dates do
 *  not. */
function formatDay(value: Date): string {
  if (Number.isNaN(value.getTime())) return '—';
  const d = String(value.getDate()).padStart(2, '0');
  const m = String(value.getMonth() + 1).padStart(2, '0');
  return `${d}.${m}.${value.getFullYear()}`;
}

function isExpired(key: EimzoKeyInfo, now: Date): boolean {
  return key.validTo.getTime() < now.getTime();
}

interface PendingRequest {
  keys: readonly EimzoKeyInfo[];
  /** Fixed when the dialog opens, not read per render: a certificate must
   *  not change from valid to expired between the render that drew it and
   *  the click that picks it. */
  openedAt: Date;
  resolve: (key: EimzoKeyInfo) => void;
  reject: (reason: unknown) => void;
}

export function KeyPickerHost() {
  const t = useT();
  const [pending, setPending] = useState<PendingRequest | null>(null);

  useEffect(() => {
    setEimzoKeySelector(
      (keys) =>
        new Promise<EimzoKeyInfo>((resolve, reject) => {
          setPending({ keys, openedAt: new Date(), resolve, reject });
        }),
    );
    // Unregistering on unmount is what keeps `client.ts` from resolving into
    // a tree that is gone: without it a signing call started just before a
    // hot reload would hang forever on a promise nobody can settle.
    return () => setEimzoKeySelector(null);
  }, []);

  const choose = useCallback(
    (key: EimzoKeyInfo) => {
      pending?.resolve(key);
      setPending(null);
    },
    [pending],
  );

  const cancel = useCallback(() => {
    pending?.reject(new EimzoCancelledError());
    setPending(null);
  }, [pending]);

  if (!pending) return null;
  const now = pending.openedAt;

  return (
    <Modal
      isOpen
      onClose={cancel}
      title={t('eimzo.picker.title')}
      subtitle={t('eimzo.picker.subtitle')}
      maxWidth="lg"
      footer={
        <Button type="button" variant="secondary" data-testid="eimzo-picker-cancel" onClick={cancel}>
          {t('eimzo.picker.cancel')}
        </Button>
      }
    >
      {/* Scrolls on its own: six connected certificates already overflow a
          600px-tall window, and the ONE valid entry is as likely to sit at
          the bottom of the list as anywhere else — measured 2026-09-23,
          where exactly that happened. */}
      <ul className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto" data-testid="eimzo-picker-list">
        {pending.keys.map((key) => {
          const expired = isExpired(key, now);
          return (
            <li key={key.id}>
              <button
                type="button"
                data-testid={`eimzo-picker-key-${key.serialNumber}`}
                disabled={expired}
                onClick={() => choose(key)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  expired
                    ? 'cursor-not-allowed border-[#E4E7EA] bg-[#F7F8F9] text-[#9AA3AB]'
                    : 'border-[#E4E7EA] bg-white hover:border-[#2F6B45] hover:bg-[#F2F7F4]'
                }`}
              >
                <span className="block font-medium">{key.commonName}</span>
                {key.organization && <span className="block text-sm">{key.organization}</span>}
                <span className="block text-sm">
                  {key.pinfl && <span className="mr-3">{t('eimzo.picker.pinfl')}: {key.pinfl}</span>}
                  {key.tin && <span>{t('eimzo.picker.tin')}: {key.tin}</span>}
                </span>
                <span className={`block text-sm ${expired ? '' : 'text-[#5B6670]'}`}>
                  {expired
                    ? `${t('eimzo.picker.expiredOn')} ${formatDay(key.validTo)}`
                    : `${t('eimzo.picker.validUntil')} ${formatDay(key.validTo)}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
