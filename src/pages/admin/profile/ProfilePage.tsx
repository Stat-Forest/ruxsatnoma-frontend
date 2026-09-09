import { useState } from 'react';
import { useAuth } from '../../../auth/useAuth';
import { useLanguage, useT } from '../../../i18n/useT';
import { pickName } from '../../applicant/format';
import { ChangePasswordForm } from './ChangePasswordForm';
import { CertificatesSection } from './certificates/CertificatesSection';
import { ContactsSection } from './contacts/ContactsSection';
import { RepresentationSection } from './representation/RepresentationSection';
import { LABELS } from './labels';
import {
  User,
  Shield,
  KeyRound,
  Lock,
  Building2,
  Globe,
} from 'lucide-react';

type TabId = 'profile' | 'representation' | 'certificates' | 'password';

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
  const passwordLabels = LABELS[lang];
  const [tab, setTab] = useState<TabId>('profile');
  const isApplicant = me?.role.code === 'applicant';
  const roleName = me ? pickName(me.role.name, lang) : '—';

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
            {getInitials(me?.user.full_name)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
              <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-white/20 text-white backdrop-blur-sm border border-white/25 shadow-xs">
                <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-300 shrink-0" />
                <span>{roleName}</span>
              </span>
              <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-medium bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span>{lang === 'ru' ? 'Активный аккаунт' : lang === 'uz_cyrl' ? 'Фаол ҳисоб' : lang === 'en' ? 'Active account' : lang === 'kaa' ? 'Aktiv esap' : 'Faol hisob'}</span>
              </span>
              {me?.is_superuser && (
                <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-amber-400/25 text-amber-200 border border-amber-400/40">
                  Superuser
                </span>
              )}
            </div>

            <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight leading-tight mb-2 sm:mb-3 break-words">
              {me?.user.full_name}
            </h1>

            <div className="flex flex-wrap items-center gap-y-1.5 sm:gap-y-2 gap-x-2.5 sm:gap-x-4 text-[11px] sm:text-xs text-emerald-100/90">
              <div className="flex items-center gap-1 sm:gap-1.5 bg-black/20 backdrop-blur-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border border-white/10">
                <span className="text-emerald-300 font-mono">@</span>
                <span className="font-mono text-white truncate max-w-[120px] sm:max-w-none">{me?.user.login ?? '—'}</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 bg-black/20 backdrop-blur-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border border-white/10">
                <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-300 shrink-0" />
                <span>{lang === 'ru' ? 'Русский' : lang === 'uz_cyrl' ? 'Ўзбекча' : lang === 'en' ? 'English' : lang === 'kaa' ? 'Qaraqalpaqsha' : 'O‘zbekcha'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modern Tabs Navigation */}
      <div className="bg-white border border-[#E4E7EA] rounded-xl sm:rounded-2xl p-1 sm:p-1.5 shadow-xs overflow-x-auto">
        <nav className="flex gap-1 sm:gap-1.5 min-w-max" aria-label="Tabs">
          {[
            { id: 'profile' as const, label: t('cabinet.profile.tabProfile'), icon: User },
            ...(isApplicant
              ? [{ id: 'representation' as const, label: t('cabinet.profile.tabRepresentation'), icon: Building2 }]
              : []),
            { id: 'certificates' as const, label: t('cabinet.profile.tabCertificates'), icon: KeyRound },
            { id: 'password' as const, label: t('cabinet.profile.tabPassword'), icon: Lock },
          ].map((item) => {
            const isActive = tab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex items-center gap-1.5 sm:gap-2 shrink-0 text-xs sm:text-sm px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-semibold transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-[#2E7D4F] text-white shadow-sm'
                    : 'text-[#5A646D] hover:text-[#1A1F24] hover:bg-[#F8F9FA]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#767F87]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {tab === 'profile' && <ContactsSection />}

      {tab === 'representation' && isApplicant && <RepresentationSection />}

      {tab === 'certificates' && <CertificatesSection />}

      {tab === 'password' && (
        <section className="bg-white border border-[#E4E7EA] rounded-xl sm:rounded-2xl p-4 sm:p-7 shadow-xs">
          <div className="mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-[#E4E7EA]">
            <h2 className="text-base sm:text-lg font-bold text-[#1A1F24] flex items-center gap-2">
              <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-[#2E7D4F] shrink-0" />
              <span>{passwordLabels.title}</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#5A646D] mt-1">
              {lang === 'ru'
                ? 'Используйте новый и надежный пароль для безопасности вашей учетной записи'
                : lang === 'uz_cyrl'
                ? 'Ҳисобингиз хавфсизлигини таъминлаш учун янги ва мустаҳкам паролдан фойдаланинг'
                : lang === 'en'
                ? 'Use a new and strong password to keep your account secure'
                : lang === 'kaa'
                ? "Esabıńız qawipsizligin támiyinlew ushın jańa hám bekkem paroldan paydalanıń"
                : "Hisobingiz xavfsizligini ta'minlash uchun yangi va mustahkam paroldan foydalaning"}
            </p>
          </div>
          <ChangePasswordForm onChanged={() => window.location.assign('/')} />
        </section>
      )}
    </div>
  );
}
