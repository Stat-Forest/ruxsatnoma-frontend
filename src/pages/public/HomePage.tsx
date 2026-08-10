import React, { useState } from 'react';
import {
  Search,
  QrCode,
  ArrowRight,
  ShieldCheck,
  FileCheck2,
  CheckCircle2,
  Users,
  TrendingUp,
  Trees,
  ChevronRight,
  PhoneCall,
  ExternalLink,
  MapPin,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/FormControls';

export interface HomePageProps {
  onNavigate?: (page: string, params?: any) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [quickSearchInput, setQuickSearchInput] = useState('');

  const stats = [
    { label: 'Jami berilgan ruxsatnomalar', value: '42,850+', icon: <FileCheck2 className="w-6 h-6 text-[#2E7D4F]" />, change: '+12% ushbu oyda' },
    { label: 'Faol oʻrmon xujaliklari', value: '84 ta', icon: <Trees className="w-6 h-6 text-[#2E7D4F]" />, change: 'Respublika boʻyicha 100%' },
    { label: 'Biriktirilgan chorva mollari', value: '185,400', icon: <Users className="w-6 h-6 text-[#2E7D4F]" />, change: 'Ushbu mavsumda' },
    { label: 'Avtomatik tasdiqlangan', value: '94.8%', icon: <TrendingUp className="w-6 h-6 text-[#2E7D4F]" />, change: 'OneID & E-IMZO integratsiya' },
  ];

  const activities = [
    {
      id: 'grazing',
      title: 'Chorva mollarini boqish',
      desc: 'Yaylov konturlarida belgilangan normalarga muvofiq qoramol, qoʻy va echkilarni boqish uchun rasmiy ruxsatnoma.',
      badge: 'Eng koʻp talab qilingan',
      icon: <Trees className="w-6 h-6 text-[#2E7D4F]" />,
      limit: '85,000 bosh',
    },
    {
      id: 'haymaking',
      title: 'Pichan oʻrish va Somon yigʻish',
      desc: 'Oʻrmon fondi yerlarida pichan oʻrish maydonlaridan mavsumiy foydalanish.',
      badge: 'Mavsumiy',
      icon: <FileCheck2 className="w-6 h-6 text-[#2E7D4F]" />,
      limit: '14,200 gektar',
    },
    {
      id: 'beekeeping',
      title: 'Asalarichilik va In qoʻyish',
      desc: 'Asalari oilalarini oʻrmon hududlariga joylashtirish va asal yigʻish faoliyati.',
      badge: 'Imtiyozli tarif',
      icon: <ShieldCheck className="w-6 h-6 text-[#2E7D4F]" />,
      limit: '42,000 ari oilasi',
    },
    {
      id: 'wild_plants',
      title: 'Yovvoyi oʻsimliklarni yigʻish',
      desc: 'Mevalar, yongʻoqlar, rezavorlar va oziq-ovqat maqsadlaridagi oʻsimlik xomashyosi.',
      badge: 'Kvota boʻyicha',
      icon: <Trees className="w-6 h-6 text-[#2E7D4F]" />,
      limit: '350 tonna',
    },
    {
      id: 'medicinal_herbs',
      title: 'Shifobaxsh dorivor oʻsimliklar',
      desc: 'Sanoat va farmatsevtika maqsadlarida dorivor oʻsimliklarni terish.',
      badge: 'Maxsus ruxsatnoma',
      icon: <Trees className="w-6 h-6 text-[#2E7D4F]" />,
      limit: '120 tonna',
    },
    {
      id: 'recreation',
      title: 'Rekreatsiya va Turizm',
      desc: 'Ekologik turizm, vaqtinchalik yengil inshootlar va dam olish maskanlari tashkil etish.',
      badge: 'Uzoq muddatli',
      icon: <MapPin className="w-6 h-6 text-[#2E7D4F]" />,
      limit: 'Auksion boʻyicha',
    },
  ];

  const newsList = [
    {
      date: '10 Avgust 2026',
      title: '2026-2027 yillar yaylov mavsumi uchun elektron arizalar qabuli boshlandi',
      desc: 'Barcha tuman oʻrmon xoʻjaliklarida yangi GIS chegaralari va elektron kvotalar belgilandi.',
    },
    {
      date: '05 Avgust 2026',
      title: 'Prokuratura va Raqamli Nazorat tizimi bilan oʻzaro integratsiya yakunlandi',
      desc: 'Ruxsatnomalarning haqiqiyligi va risk-indikatorlar avtomatik monitoring qilinadi.',
    },
    {
      date: '01 Avgust 2026',
      title: 'Oʻrmon xoʻjaligi hududlarida chorva boqish toʻlov stavkalari yangilandi',
      desc: 'Vazirlar Mahkamasi qaroriga muvofiq BHM koeffitsientlari tasdiqlandi.',
    },
  ];

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickSearchInput.trim()) {
      onNavigate?.('verify', { query: quickSearchInput.trim() });
    }
  };

  return (
    <div className="space-y-12 font-sans">
      {/* ── 1. HERO BANNER ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#2E7D4F] via-[#23653F] to-[#123522] text-white rounded-3xl p-8 md:p-12 shadow-xl">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold tracking-wide">
              <ShieldCheck className="w-4 h-4 text-[#7FB98A]" />
              Oʻzbekiston Respublikasi Oʻrmon Xoʻjaligi Davlat Tizimi
            </div>

            <h1 className="text-3xl sm:text-5xl font-bold leading-tight tracking-tight">
              Oʻrmon fondi yerlaridan foydalanish uchun <span className="text-[#7FB98A]">Elektron Ruxsatnoma</span>
            </h1>

            <p className="text-sm sm:text-base text-gray-200 leading-relaxed max-w-xl">
              Chorva mollarini boqish, pichan oʻrish, asalarichilik va dorivor oʻsimliklar yigʻish uchun ariza topshirish, QR-kodli hujjat olish va haqiqiyligini tekshirish yagona davlat portali.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                variant="success"
                size="lg"
                rightIcon={<ArrowRight className="w-4 h-4" />}
                onClick={() => onNavigate?.('auth_login')}
              >
                Ariza topshirish (OneID)
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                onClick={() => onNavigate?.('verify')}
              >
                Ruxsatnomani tekshirish
              </Button>
            </div>
          </div>

          {/* Quick Verification Search Box */}
          <div className="lg:col-span-5">
            <form
              onSubmit={handleQuickSearch}
              className="bg-white text-[#1A1F24] p-6 rounded-2xl shadow-2xl border border-white/20 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F0F7F1] text-[#2E7D4F] flex items-center justify-center font-bold">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#1A1F24]">Tezkor QR va Hujjat Tekshiruvi</h3>
                  <p className="text-xs text-[#5A646D]">Ruxsatnoma seriyasi va raqami boʻyicha</p>
                </div>
              </div>

              <div className="space-y-3">
                <Input
                  placeholder="Masalan: RX-2026-0089"
                  value={quickSearchInput}
                  onChange={(e) => setQuickSearchInput(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                  touchSize
                />
                <Button type="submit" variant="primary" fullWidth size="lg">
                  Izlash va Tekshirish
                </Button>
              </div>

              <div className="flex items-center justify-between text-xs text-[#767F87] pt-1">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" /> Reyestrda mavjud
                </span>
                <span>WCAG 2.2 AA Himoyalangan</span>
              </div>
            </form>
          </div>
        </div>

        {/* Decorative Background Elements */}
        <div className="absolute -bottom-10 -right-10 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
      </section>

      {/* ── 2. KEY STATS METRICS ───────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((st, idx) => (
          <div
            key={idx}
            className="bg-white border border-[#E4E7EA] p-5 rounded-2xl shadow-xs hover:shadow-md transition-shadow flex items-start justify-between"
          >
            <div className="space-y-1">
              <span className="text-xs font-semibold text-[#5A646D] uppercase tracking-wider block">
                {st.label}
              </span>
              <div className="text-2xl font-bold text-[#1A1F24]">{st.value}</div>
              <span className="text-xs text-[#15803D] font-medium flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> {st.change}
              </span>
            </div>
            <div className="p-3 bg-[#F0F7F1] rounded-xl shrink-0">{st.icon}</div>
          </div>
        ))}
      </section>

      {/* ── 3. ACTIVITIES GRID ─────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#2E7D4F]">Xizmat Turlari</span>
            <h2 className="text-2xl font-bold text-[#1A1F24] mt-1">Oʻrmon Fondidan Foydalanish Yoʻnalishlari</h2>
            <p className="text-sm text-[#5A646D]">Oʻzbekiston Respublikasi Oʻrmon Kodeksiga muvofiq beriladigan rasmiy ruxsatnomalar</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            rightIcon={<ChevronRight className="w-4 h-4" />}
            onClick={() => onNavigate?.('activities')}
          >
            Barcha turlarni koʻrish
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activities.map((act) => (
            <div
              key={act.id}
              className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs hover:border-[#7FB98A] hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 bg-[#F0F7F1] rounded-xl">{act.icon}</div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#F0F7F1] text-[#2E7D4F] border border-[#D9EBDC]">
                    {act.badge}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[#1A1F24] group-hover:text-[#2E7D4F] transition-colors">
                  {act.title}
                </h3>
                <p className="text-xs text-[#5A646D] leading-relaxed">
                  {act.desc}
                </p>
              </div>

              <div className="pt-4 border-t border-[#E4E7EA] flex items-center justify-between text-xs">
                <span className="text-[#767F87]">Yillik kvota: <b className="text-[#1A1F24]">{act.limit}</b></span>
                <button
                  onClick={() => onNavigate?.('auth_login', { activity: act.id })}
                  className="font-bold text-[#2E7D4F] group-hover:underline inline-flex items-center gap-1"
                >
                  Ariza yozish <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. HOW IT WORKS TIMELINE ───────────────────────────────── */}
      <section className="bg-white border border-[#E4E7EA] rounded-2xl p-8 shadow-xs space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#2E7D4F]">Qulay va Ishonchli</span>
          <h2 className="text-2xl font-bold text-[#1A1F24]">Ruxsatnoma Olish Bosqichlari</h2>
          <p className="text-sm text-[#5A646D]">Arizadan boshlab tayyor elektron hujjatgacha boʻlgan 4 ta oddiy qadam</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
          {[
            { step: '01', title: 'OneID Autentifikatsiya', desc: 'OneID yoki E-IMZO orqali shaxsiy kabinetga kiring.' },
            { step: '02', title: 'Hudud va Parametr', desc: 'GIS xaritasidan oʻrmon konturini va chorva sonini tanlang.' },
            { step: '03', title: 'Avto-Hisob & Toʻlov', desc: 'Narx avtomatik hisoblanadi va Click/Payme orqali toʻlanadi.' },
            { step: '04', title: 'QR Ruxsatnoma', desc: 'E-IMZO muhrlangan rasmiy PDF ruxsatnomani yuklab oling.' },
          ].map((st, idx) => (
            <div key={idx} className="relative space-y-3 p-4 bg-[#F8F9FA] border border-[#E4E7EA] rounded-xl">
              <span className="text-2xl font-black font-mono text-[#2E7D4F]">{st.step}</span>
              <h3 className="text-base font-bold text-[#1A1F24]">{st.title}</h3>
              <p className="text-xs text-[#5A646D] leading-relaxed">{st.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 5. NEWS & ANNOUNCEMENTS ───────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-[#E4E7EA] pb-4">
            <h3 className="text-lg font-bold text-[#1A1F24]">Yangiliklar va Eʼlonlar</h3>
            <a href="#" className="text-xs font-bold text-[#2E7D4F] hover:underline flex items-center gap-1">
              Barchasi <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="space-y-4 divide-y divide-[#E4E7EA]">
            {newsList.map((item, idx) => (
              <div key={idx} className="pt-4 first:pt-0 space-y-1">
                <span className="text-[11px] font-mono text-[#767F87]">{item.date}</span>
                <h4 className="text-base font-bold text-[#1A1F24] hover:text-[#2E7D4F] cursor-pointer transition-colors">
                  {item.title}
                </h4>
                <p className="text-xs text-[#5A646D] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Support & Contact Widget */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#123522] text-white rounded-2xl p-6 shadow-md space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#2E7D4F] rounded-xl">
                <PhoneCall className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-base">Ishonch Telefoni</h4>
                <p className="text-xs text-gray-300">24/7 Texnik qoʻllab-quvvatlash</p>
              </div>
            </div>

            <div className="text-2xl font-bold font-mono text-[#7FB98A]">+998 (71) 207-88-77</div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Tizimdan foydalanish boʻyicha savollaringiz boʻlsa, operatorlarimizga murojaat qiling.
            </p>

            <Button
              variant="outline"
              fullWidth
              className="border-white/30 text-white hover:bg-white/10"
              onClick={() => onNavigate?.('feedback')}
            >
              Murojaat yuborish
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
