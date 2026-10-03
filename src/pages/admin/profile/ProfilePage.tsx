import { useAuth } from '../../../auth/useAuth';
import { useLanguage, useT } from '../../../i18n/useT';
import { translateTerm } from '../../../i18n/terms';
import { pickName } from '../../applicant/format';
import { ContactsSection } from './contacts/ContactsSection';
import { PasswordSection } from './PasswordSection';
import { Shield, Globe, Building2 } from 'lucide-react';

function getInitials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function ProfilePage() {
  const { me } = useAuth();
  const { lang } = useLanguage();
  const t = useT();
  const displayName = me ? translateTerm(me.user.full_name, lang) : '';
  const roleName = me
    ? (pickName(me.role.name, lang) || (me.role.code ? translateTerm(me.role.code, lang) : '—'))
    : '—';
  const isLegalApplicant = me?.applicant?.kind === 'legal';

  return (
    <div data-testid="profile-page" className="max-w-4xl mx-auto space-y-4 sm:space-y-6 pb-8 sm:pb-12">
      {/* Hero Banner Card */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#123522] via-[#1E5638] to-[#2E7D4F] text-white p-4 sm:p-8 shadow-md">
        {/* Subtle decorative glow elements */}
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/5 pointer-events-none blur-2xl" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-emerald-400/10 pointer-events-none blur-3xl" />

        <div className="relative z-10 flex flex-row items-center sm:items-center gap-4 sm:gap-6">
          {/* Avatar with Initials */}
          <div className="w-14 h-14 sm:w-24 sm:h-24 rounded-xl sm:rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 shadow-inner flex items-center justify-center text-lg sm:text-3xl font-extrabold text-white tracking-wider shrink-0 ring-2 sm:ring-4 ring-white/10">
            {getInitials(displayName || me?.user.full_name)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
              <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-white/20 text-white backdrop-blur-sm border border-white/25 shadow-xs">
                <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-300 shrink-0" />
                <span>{roleName}</span>
              </span>
              <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-medium bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span>{t('cabinet.profile.activeAccount')}</span>
              </span>
              {me?.is_superuser && (
                <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-amber-400/25 text-amber-200 border border-amber-400/40">
                  {t('cabinet.profile.superuser')}
                </span>
              )}
            </div>

            <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight leading-tight mb-2 sm:mb-3 break-words">
              {isLegalApplicant ? (me.applicant?.name ?? displayName) : (displayName || me?.user.full_name)}
            </h1>

            <div className="flex flex-wrap items-center gap-y-1.5 sm:gap-y-2 gap-x-2.5 sm:gap-x-4 text-[11px] sm:text-xs text-emerald-100/90">
              <div className="flex items-center gap-1 sm:gap-1.5 bg-black/20 backdrop-blur-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border border-white/10">
                <span className="text-emerald-300 font-mono">@</span>
                <span className="font-mono text-white truncate max-w-[120px] sm:max-w-none">{me?.user.login ?? '—'}</span>
              </div>
              {isLegalApplicant && me?.applicant?.stir && (
                <div className="flex items-center gap-1 sm:gap-1.5 bg-black/20 backdrop-blur-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border border-white/10" title={t('cabinet.profile.stir')}>
                  <Building2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-300 shrink-0" />
                  <span className="font-mono text-white">{me.applicant.stir}</span>
                </div>
              )}
              <div className="flex items-center gap-1 sm:gap-1.5 bg-black/20 backdrop-blur-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border border-white/10" title={t('shell.language')}>
                <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-300 shrink-0" />
                <span>{t('cabinet.profile.currentLang')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ContactsSection />
      <PasswordSection />
    </div>
  );
}
