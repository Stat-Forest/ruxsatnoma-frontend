import { useState } from 'react';
import type { ReactNode } from 'react';
import { Check, Copy, KeyRound, ShieldAlert, Smartphone } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useLanguage } from '../../../i18n/useT';
import { labelsFor } from './labels';

export interface SecretPanelProps {
  /** `one_time_password` from `POST /admin/users` or `.../reset-password`. */
  password?: string | null;
  /** `totp_uri` from `POST /admin/users` or `.../reset-mfa`. */
  totpUri?: string | null;
  onAcknowledge: () => void;
}

/**
 * The one-time secrets, shown ONCE.
 *
 * Deliberately NOT the shared `Modal`: that component closes on Escape, on a
 * backdrop click and on its own header cross, and every one of those three is
 * a way to lose a password the server will never show again. This panel has
 * exactly one exit — the acknowledgement button — so an administrator cannot
 * dismiss it by reflex before copying anything. Losing the value means
 * another reset for the user, and (for the TOTP) another trip to their phone.
 *
 * The TOTP URI is rendered as selectable text rather than a QR image: a QR
 * library is not a dependency of this app, and a wrong-looking QR would be
 * worse than a string an administrator can paste into the authenticator.
 */
export function SecretPanel({ password, totpUri, onAcknowledge }: SecretPanelProps) {
  const { lang } = useLanguage();
  const L = labelsFor(lang);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setCopyFailed(false);
    } catch {
      // A browser without clipboard access (or an insecure origin) — the
      // value is still on screen and selectable, so this is a hint, not a
      // failure that should block the acknowledgement.
      setCopyFailed(true);
    }
  }

  function secretRow(key: string, label: string, hint: string, value: string, icon: ReactNode) {
    return (
      <div className="border border-[#E4E7EA] rounded-xl p-4 bg-[#F8F9FA]">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#5A646D]">
          {icon}
          <span>{label}</span>
        </div>
        <div className="mt-2 flex flex-col sm:flex-row sm:items-start gap-2">
          <code
            className="flex-1 min-w-0 block bg-white border border-[#E4E7EA] rounded-md px-3 py-2 text-sm text-[#1A1F24] font-mono break-all select-all"
            data-testid={`secret-value-${key}`}
          >
            {value}
          </code>
          <Button
            variant={copied === key ? 'success' : 'secondary'}
            size="sm"
            className="shrink-0"
            leftIcon={copied === key ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            onClick={() => void copy(key, value)}
          >
            {copied === key ? L.copied : L.copy}
          </Button>
        </div>
        <p className="text-xs text-[#5A646D] mt-2">{hint}</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" data-testid="secret-panel">
      {/* No onClick: a stray click outside must not throw the secret away. */}
      <div className="fixed inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl border border-[#B45309] z-10 overflow-hidden"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="secret-panel-title"
      >
        <div className="flex items-start gap-3 p-5 bg-[#FFFBEB] border-b border-[#FDE68A]">
          <ShieldAlert className="w-6 h-6 text-[#B45309] shrink-0 mt-0.5" />
          <div>
            <h3 id="secret-panel-title" className="text-base font-bold text-[#92400E]">
              {L.secretTitle}
            </h3>
            <p className="text-xs text-[#92400E] mt-1 leading-relaxed">{L.secretIntro}</p>
          </div>
        </div>

        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {password
            ? secretRow(
                'password',
                L.secretPassword,
                L.secretPasswordHint,
                password,
                <KeyRound className="w-3.5 h-3.5" />,
              )
            : null}
          {totpUri
            ? secretRow(
                'totp',
                L.secretTotp,
                L.secretTotpHint,
                totpUri,
                <Smartphone className="w-3.5 h-3.5" />,
              )
            : null}
          {copyFailed && <p className="text-xs text-[#B45309]">{L.copyFailed}</p>}
        </div>

        <div className="p-4 bg-[#F8F9FA] border-t border-[#E4E7EA] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-[#5A646D]">{L.secretAckHint}</p>
          <Button variant="primary" onClick={onAcknowledge} className="shrink-0">
            {L.secretAck}
          </Button>
        </div>
      </div>
    </div>
  );
}
