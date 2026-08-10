import React, { useState } from 'react';
import { CabinetLayout } from '../layouts/CabinetLayout';
import { PublicLayout } from '../layouts/PublicLayout';
import { StatusBadge } from '../ui/StatusBadge';
import { Button } from '../ui/button';
import { FileText, Download, CheckCircle, Clock } from 'lucide-react';

export const LayoutsShowcase: React.FC = () => {
  const [activeLayout, setActiveLayout] = useState<'cabinet' | 'public'>('cabinet');

  return (
    <div className="space-y-6">
      {/* Switcher Header */}
      <div className="bg-white border border-[#E4E7EA] p-4 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#1A1F24]">Karkaslar (Layout Shells - `cabinet.html` & `public.html`)</h2>
          <p className="text-xs text-[#5A646D]">Tizim interfeyslarining asosiy maket karkaslari</p>
        </div>
        <div className="flex bg-[#F8F9FA] p-1 border border-[#767F87] rounded-lg">
          <button
            onClick={() => setActiveLayout('cabinet')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeLayout === 'cabinet' ? 'bg-[#2E7D4F] text-white shadow-xs' : 'text-[#5A646D] hover:text-[#1A1F24]'
            }`}
          >
            Kabinet Karkasi (Cabinet Shell)
          </button>
          <button
            onClick={() => setActiveLayout('public')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeLayout === 'public' ? 'bg-[#2E7D4F] text-white shadow-xs' : 'text-[#5A646D] hover:text-[#1A1F24]'
            }`}
          >
            Ommaviy Portal (Public Shell)
          </button>
        </div>
      </div>

      {/* Render Active Layout Preview */}
      <div className="border border-[#E4E7EA] rounded-xl overflow-hidden shadow-md">
        {activeLayout === 'cabinet' ? (
          <CabinetLayout activeNavId="permits">
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-[#1A1F24]">Ruxsatnomalar boshqaruvi</h1>
                  <p className="text-sm text-[#5A646D]">Tuman boʻyicha barcha berilgan va koʻrib chiqilayotgan arizalar</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" leftIcon={<Download className="w-4 h-4" />}>
                    Hisobot (PDF)
                  </Button>
                  <Button variant="primary" size="sm" leftIcon={<FileText className="w-4 h-4" />}>
                    Yangi ruxsatnoma
                  </Button>
                </div>
              </div>

              {/* Sample Dashboard Content */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 border border-[#E4E7EA] rounded-xl flex items-center gap-4">
                  <div className="p-3 bg-[#F0F7F1] text-[#2E7D4F] rounded-lg">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs text-[#5A646D] font-semibold uppercase">Faol ruxsatnomalar</span>
                    <div className="text-2xl font-bold text-[#1A1F24]">31 ta</div>
                  </div>
                </div>

                <div className="bg-white p-5 border border-[#E4E7EA] rounded-xl flex items-center gap-4">
                  <div className="p-3 bg-[#E0F2FE] text-[#0369A1] rounded-lg">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs text-[#5A646D] font-semibold uppercase">Kutilayotgan arizalar</span>
                    <div className="text-2xl font-bold text-[#1A1F24]">7 ta</div>
                  </div>
                </div>

                <div className="bg-white p-5 border border-[#E4E7EA] rounded-xl flex items-center gap-4">
                  <div className="p-3 bg-[#FFFBEB] text-[#B45309] rounded-lg">
                    <StatusBadge status="warning" showIcon={false} size="sm" />
                  </div>
                  <div>
                    <span className="text-xs text-[#5A646D] font-semibold uppercase">Muddati tugayotgan</span>
                    <div className="text-2xl font-bold text-[#1A1F24]">4 ta</div>
                  </div>
                </div>
              </div>
            </div>
          </CabinetLayout>
        ) : (
          <PublicLayout onCheckPermit={(no) => alert(`Ruxsatnoma №${no} tekshirildi!`)}>
            <div className="space-y-8">
              <div className="text-center max-w-2xl mx-auto space-y-2">
                <h2 className="text-2xl font-bold text-[#1A1F24]">Davlat xizmatlari va imkoniyatlar</h2>
                <p className="text-sm text-[#5A646D]">Oʻrmon xoʻjaligidan ruxsatnoma olish boʻyicha qulay imkoniyatlar</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="border border-[#E4E7EA] p-6 rounded-xl bg-white space-y-2">
                  <h3 className="font-bold text-base text-[#1A1F24]">1. Onlayn Ariza</h3>
                  <p className="text-xs text-[#5A646D] leading-relaxed">
                    Arizalarni uyda oʻtirgan holda E-IMZO elektron kaliti orqali qulay topshirish.
                  </p>
                </div>
                <div className="border border-[#E4E7EA] p-6 rounded-xl bg-white space-y-2">
                  <h3 className="font-bold text-base text-[#1A1F24]">2. Avtomatik Tekshiruv</h3>
                  <p className="text-xs text-[#5A646D] leading-relaxed">
                    QR-kod orqali berilgan ruxsatnoma haqiqiyligini istalgan joyda tekshirish.
                  </p>
                </div>
                <div className="border border-[#E4E7EA] p-6 rounded-xl bg-white space-y-2">
                  <h3 className="font-bold text-base text-[#1A1F24]">3. SMS Ogohlantirish</h3>
                  <p className="text-xs text-[#5A646D] leading-relaxed">
                    Ruxsatnoma muddati tugashidan 7 kun oldin avtomatik SMS xabarnoma yuboriladi.
                  </p>
                </div>
              </div>
            </div>
          </PublicLayout>
        )}
      </div>
    </div>
  );
};
