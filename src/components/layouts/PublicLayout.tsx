import React, { useState } from 'react';
import { Trees, Search, QrCode, ArrowRight, Phone, Mail, MapPin } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/FormControls';

export interface PublicLayoutProps {
  children?: React.ReactNode;
  onCheckPermit?: (permitNo: string) => void;
  onNavigate?: (page: string, params?: any) => void;
  activeNav?: string;
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({
  children,
  onCheckPermit,
  onNavigate,
  activeNav = 'home',
}) => {
  const [permitInput, setPermitInput] = useState('');
  const [lang, setLang] = useState<'uz' | 'ru'>('uz');

  const navLinks = [
    { id: 'home',        label: 'Bosh sahifa',         page: 'home' },
    { id: 'services',   label: 'Xizmatlar',             page: 'services' },
    { id: 'tariffs',    label: 'Tariflar',              page: 'tariffs' },
    { id: 'documents',  label: 'Hujjatlar',             page: 'documents' },
    { id: 'opendata',   label: 'Ochiq ma\u02bbumotlar', page: 'opendata' },
    { id: 'faq',        label: 'Savollar',              page: 'faq' },
  ];

  const handleNavClick = (page: string) => {
    if (page === 'contact') {
      const footerEl = document.getElementById('public-footer');
      if (footerEl) {
        footerEl.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      onNavigate?.(page);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans text-[#1A1F24]">
      {/* ── Top Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E4E7EA] shadow-xs">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <button
            onClick={() => onNavigate?.('home')}
            className="flex items-center gap-3 text-left focus:outline-none shrink-0"
          >
            <div className="w-10 h-10 rounded-xl bg-[#2E7D4F] text-white flex items-center justify-center font-bold shadow-xs">
              <Trees className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-base font-bold text-[#1A1F24] leading-tight tracking-tight">ruxsatnoma-urmon.uz</span>
              <span className="block text-[11px] text-[#5A646D]">Oʻrmon xoʻjaligi davlat portali</span>
            </div>
          </button>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navLinks.map((link) => {
              const isActive = activeNav === link.id || (link.id === 'tariffs' && activeNav === 'tariffs');
              return (
                <button
                  key={link.id}
                  onClick={() => handleNavClick(link.page)}
                  className={`px-3.5 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'text-[#2E7D4F] bg-[#F0F7F1] border border-[#D9EBDC]'
                      : 'text-[#5A646D] hover:bg-[#F8F9FA] hover:text-[#1A1F24]'
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </nav>

          {/* Language Switcher & Auth Buttons */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex border border-[#E4E7EA] rounded-lg overflow-hidden bg-[#F8F9FA] text-xs p-0.5">
              <button
                onClick={() => setLang('uz')}
                className={`px-2.5 py-1 font-bold rounded-md transition-all ${
                  lang === 'uz' ? 'bg-[#2E7D4F] text-white shadow-xs' : 'text-[#5A646D] hover:text-[#1A1F24]'
                }`}
              >
                UZ
              </button>
              <button
                onClick={() => setLang('ru')}
                className={`px-2.5 py-1 font-bold rounded-md transition-all ${
                  lang === 'ru' ? 'bg-[#2E7D4F] text-white shadow-xs' : 'text-[#5A646D] hover:text-[#1A1F24]'
                }`}
              >
                RU
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate?.('auth_login')}
            >
              Kirish (OneID)
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onNavigate?.('auth_login')}
            >
              Ariza topshirish
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero Banner Section (Only on Home Page) ──────────────── */}
      {activeNav === 'home' && (
        <section className="bg-gradient-to-b from-[#F0F7F1] to-white py-12 sm:py-16 border-b border-[#E4E7EA]">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <span className="inline-block px-3 py-1 bg-[#D9EBDC] text-[#123522] font-semibold text-xs rounded-full">
                Rasmiy Davlat Portali
              </span>
              <h1 className="text-3xl sm:text-4xl font-bold text-[#1A1F24] leading-tight">
                Oʻrmon xoʻjaligi hududlarida chorva mollarini boqish boʻyicha ruxsatnomalar
              </h1>
              <p className="text-base text-[#5A646D] leading-relaxed max-w-xl">
                Tizim orqali elektron ruxsatnomalarni rasmiylashtirish, QR-kodli hujjat haqiqiyligini tekshirish va arizalar holatini onlayn kuzatish imkoniyati.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  onClick={() => onNavigate?.('applicant_wizard')}
                >
                  Yangi ariza topshirish
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => onNavigate?.('tariffs')}
                >
                  Tariflar va kalkulyator
                </Button>
              </div>
            </div>

            {/* Quick QR Permit Checker Box */}
            <div className="lg:col-span-5">
              <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-md space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#F0F7F1] text-[#2E7D4F] rounded-xl">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1A1F24]">Ruxsatnomani tekshirish</h3>
                    <p className="text-xs text-[#5A646D]">QR-kod yoki ruxsatnoma raqami boʻyicha</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      placeholder="Masalan: RX-2026-0089"
                      value={permitInput}
                      onChange={(e) => setPermitInput(e.target.value)}
                      leftIcon={<Search className="w-4 h-4" />}
                      touchSize
                    />
                  </div>
                  <Button
                    variant="success"
                    fullWidth
                    onClick={() => onCheckPermit?.(permitInput)}
                  >
                    Haqiqiyligini tekshirish
                  </Button>
                </div>

                <p className="text-[11px] text-[#767F87] text-center">
                  * Tekshiruv davlat reyestri maʼlumotlar bazasiga muvofiq onlayn tarzda amalga oshiriladi.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Main Content Slot ───────────────────────────────────── */}
      {children && <main className="flex-1 max-w-7xl mx-auto px-6 py-10 w-full">{children}</main>}

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer id="public-footer" className="bg-[#123522] text-white pt-16 pb-8 mt-auto">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Col 1 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-[#2E7D4F] flex items-center justify-center">
                <Trees className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg">ruxsatnoma-urmon.uz</span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Oʻzbekiston Respublikasi Oʻrmon xoʻjaligi davlat qoʻmitasining rasmiy ruxsatnomalar axborot tizimi.
            </p>
          </div>

          {/* Col 2 */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#7FB98A] mb-4">Xizmatlar</h4>
            <ul className="space-y-2 text-xs text-gray-300">
              <li>
                <button onClick={() => onNavigate?.('applicant_wizard')} className="hover:text-white transition-colors text-left">
                  Ariza berish tartibi
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate?.('verify')} className="hover:text-white transition-colors text-left">
                  Ruxsatnoma tekshirish
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate?.('tariffs')} className="hover:text-white transition-colors text-left">
                  Toʻlov stavkalari va kalkulyator
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate?.('gis_editor')} className="hover:text-white transition-colors text-left">
                  Oʻrmon zonalari GIS kartasi
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3 */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#7FB98A] mb-4">Hujjatlar</h4>
            <ul className="space-y-2 text-xs text-gray-300">
              <li>
                <button onClick={() => onNavigate?.('normative_norms')} className="hover:text-white transition-colors text-left">
                  Geobotanik normalar va qoidalar
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate?.('prosecutor_portal')} className="hover:text-white transition-colors text-left">
                  Raqamli Nazorat (Prokuratura Portali)
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4 */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#7FB98A] mb-4">Aloqa</h4>
            <ul className="space-y-2 text-xs text-gray-300">
              <li className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-[#7FB98A]" /> +998 (71) 200-00-00</li>
              <li className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-[#7FB98A]" /> info@urmon.gov.uz</li>
              <li className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-[#7FB98A]" /> Toshkent sh., Chilonzor t.</li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 border-t border-white/10 pt-6 flex flex-col sm:flex-row justify-between items-center text-xs text-gray-400 gap-4">
          <div>© 2026 Oʻrmon xoʻjaligi davlat qoʻmitasi. Barcha huquqlar himoyalangan.</div>
          <div>WCAG 2.2 AA Muvofiq dizayn-sistemasi</div>
        </div>
      </footer>
    </div>
  );
};
