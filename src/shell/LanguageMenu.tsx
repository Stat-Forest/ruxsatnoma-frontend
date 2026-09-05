import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { LANGUAGES } from '../i18n/context';
import type { BackendLanguage } from '../i18n/context';

interface LanguageMenuProps {
  value: BackendLanguage;
  /** Accessible name for the trigger — `shell.language`, in the active language. */
  label: string;
  onSelect: (code: BackendLanguage) => void;
}

/**
 * The header's language picker: a compact trigger that opens a menu of all five
 * languages the backend accepts (`decisions.md` #71).
 *
 * A two-button pill was what stage 6.0 shipped and it cannot hold five options —
 * five 44px targets do not fit beside the burger, bell and logout at 375px, the
 * width decision #61 verified the shell against. A native `<select>` fits but
 * renders as an OS control that matches nothing else on the screen, so the menu
 * is built from the same surface the modals use (`components/ui/Overlay.tsx`):
 * white, `rounded-xl`, `#E4E7EA` border, `shadow-xl`.
 */
export function LanguageMenu({ value, label, onSelect }: LanguageMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const active = LANGUAGES.find((language) => language.code === value) ?? LANGUAGES[1];

  // Escape and an outside click both close it. `mousedown` rather than `click`
  // so a press that starts outside closes the menu before the element under it
  // handles the release — the behaviour every other dismissible surface here has.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        data-testid="language-trigger"
        aria-label={`${label}: ${active.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className={`flex h-11 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors ${
          open
            ? 'border-[#2E7D4F] bg-[#F0F7F1] text-[#23653F]'
            : 'border-[#E4E7EA] text-[#5A646D] hover:bg-[#F8F9FA]'
        }`}
      >
        <Globe className="h-4 w-4" />
        {active.label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          data-testid="language-menu"
          aria-label={label}
          className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-[#E4E7EA] bg-white py-1 shadow-xl animate-in fade-in zoom-in-95 duration-150"
        >
          {LANGUAGES.map(({ code, label: short, title }) => {
            const selected = code === value;
            return (
              <button
                key={code}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  setOpen(false);
                  if (!selected) onSelect(code);
                }}
                className={`flex h-11 w-full items-center justify-between gap-3 px-3 text-left text-sm transition-colors ${
                  selected ? 'bg-[#F0F7F1] font-semibold text-[#23653F]' : 'text-[#1A1F24] hover:bg-[#F8F9FA]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className={`w-7 shrink-0 text-xs font-semibold ${
                      selected ? 'text-[#2E7D4F]' : 'text-[#9AA3AB]'
                    }`}
                  >
                    {short}
                  </span>
                  {title}
                </span>
                {selected && <Check className="h-4 w-4 shrink-0 text-[#2E7D4F]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
