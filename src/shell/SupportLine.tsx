import { Phone } from 'lucide-react';
import { useT } from '../i18n/useT';
import { SUPPORT_EXTENSION, SUPPORT_PHONE, SUPPORT_PHONE_HREF } from './support';

/**
 * The two-line tech-support block (`./support.ts`): label above, number as a
 * `tel:` link with the extension beside it. The header shows it from `lg` up;
 * below that `SupportFooter` puts the same block at the bottom of the
 * persistent sidebar (tablets) and the drawer (phones), so it is visible at
 * every width without the header ever having to fit it beside the rest.
 */
export function SupportLine({ className = '' }: { className?: string }) {
  const t = useT();
  return (
    <div className={`flex flex-col min-w-0 ${className}`}>
      <span className="text-[11px] text-[#5A646D] leading-tight">{t('shell.techSupport')}</span>
      <span className="text-xs font-semibold text-[#1A1F24] leading-tight">
        <a href={SUPPORT_PHONE_HREF} className="text-[#2E7D4F] hover:underline">
          {SUPPORT_PHONE}
        </a>
        <span className="font-normal text-[#5A646D]">
          {' '}
          ({t('shell.extension')}: {SUPPORT_EXTENSION})
        </span>
      </span>
    </div>
  );
}

/** `SupportLine` with a phone icon and a top border — the sidebar/drawer footer. */
export function SupportFooter({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 border-t border-[#E4E7EA] shrink-0 ${className}`}>
      <Phone className="w-4 h-4 text-[#2E7D4F] shrink-0" />
      <SupportLine />
    </div>
  );
}
