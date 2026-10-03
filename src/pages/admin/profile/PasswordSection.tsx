import { useState } from 'react';
import { KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useLanguage, useT } from '../../../i18n/useT';
import { ChangePasswordForm } from './ChangePasswordForm';
import { LABELS } from './labels';

/**
 * The password card under the contacts on the profile page. Folded by default
 * — a password is changed rarely, and three empty fields left open would take
 * half the screen every visit — and opened in place, the way a contact row
 * opens for editing. Folding unmounts the form, so what was typed is dropped.
 */
export function PasswordSection() {
  const t = useT();
  const { lang } = useLanguage();
  const labels = LABELS[lang] ?? LABELS.uz_latn;
  const [open, setOpen] = useState(false);

  return (
    <section className="bg-white border border-[#E4E7EA] rounded-2xl p-4 sm:p-7 shadow-xs space-y-6">
      <div className="pb-4 border-b border-[#E4E7EA]">
        <h2 className="text-base sm:text-lg font-bold text-[#1A1F24] flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#2E7D4F]" />
          {t('cabinet.profile.securityTitle')}
        </h2>
        <p className="text-xs sm:text-sm text-[#5A646D] mt-1">
          {t('cabinet.profile.passwordSubtitle')}
        </p>
      </div>

      {open ? (
        <div className="p-5 rounded-2xl border border-[#2E7D4F]/40 bg-emerald-50/25 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#2E7D4F]">
            <Lock className="w-4 h-4" />
            <span>{labels.title}</span>
          </div>
          <ChangePasswordForm
            onChanged={() => window.location.assign('/')}
            onCancel={() => setOpen(false)}
          />
        </div>
      ) : (
        <div className="p-5 rounded-2xl border border-[#E4E7EA] bg-[#F8F9FA]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-amber-100/80 text-amber-700">
              <Lock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#5A646D] mb-1">
                {t('cabinet.profile.passwordLabel')}
              </p>
              <p className="text-base font-semibold text-[#1A1F24] tracking-widest" aria-hidden="true">
                ••••••••
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="password-change"
            onClick={() => setOpen(true)}
            leftIcon={<KeyRound className="w-3.5 h-3.5" />}
            className="self-end sm:self-auto"
          >
            {labels.title}
          </Button>
        </div>
      )}
    </section>
  );
}
