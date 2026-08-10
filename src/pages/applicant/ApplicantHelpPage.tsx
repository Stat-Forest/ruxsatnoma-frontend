import React, { useState } from 'react';
import { HelpCircle, BookOpen, Video, PhoneCall, ChevronDown, ChevronUp, FileText, Search } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/FormControls';

export interface ApplicantHelpPageProps {
  onNavigate?: (page: string, params?: any) => void;
}

export const ApplicantHelpPage: React.FC<ApplicantHelpPageProps> = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [search, setSearch] = useState('');

  const guides = [
    {
      title: 'E-IMZO kaliti orqali arizani imzolash yoʻriqnomasi',
      type: 'Matnli yoʻriqnoma',
      time: '3 daqiqa oʻqish',
      icon: <FileText className="w-5 h-5 text-[#2E7D4F]" />,
    },
    {
      title: 'GIS xaritasidan yaylov konturini tanlash video darsi',
      type: 'Video darslik',
      time: '2:45 daqiqa',
      icon: <Video className="w-5 h-5 text-[#2E7D4F]" />,
    },
    {
      title: 'Chorva mollarini boqish toʻlovi va kalkulyator formulalari',
      type: 'Qoʻllanma',
      time: '5 daqiqa oʻqish',
      icon: <BookOpen className="w-5 h-5 text-[#2E7D4F]" />,
    },
  ];

  const faqs = [
    {
      q: 'Arizam koʻrib chiqilishi qancha vaqt oladi?',
      a: 'Arizalar reglamant boʻyicha 3 ish kuni ichida oʻrmon xoʻjaligi inspektori va rahbari tomonidan koʻrib chiqiladi hamda E-IMZO muhrlanadi.',
    },
    {
      q: 'Toʻlovni qanday amalga oshirishim kerak?',
      a: 'Ariza tasdiqlangach, shaxsiy kabinetda toʻlov kvitansiyasi shakllanadi. Click, Payme yoki bank кассаsi orqali onlayn toʻlashingiz mumkin.',
    },
    {
      q: 'Ruxsatnoma QR-kodini tekshirganda nima koʻrinadi?',
      a: 'QR-kod skanerlanganda davlat reyestridagi rasmiy ruxsatnoma holati, amal qilish muddati, yaylov konturi va biriktirilgan chorva soni koʻrinadi.',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 font-sans">
      {/* Header Title */}
      <div className="border-b border-[#E4E7EA] pb-6 space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-[#2E7D4F] bg-[#F0F7F1] px-3 py-1 rounded-full border border-[#D9EBDC]">
          Kabinet Yordam Markazi
        </span>
        <h1 className="text-2xl font-bold text-[#1A1F24]">Yordam va Yoʻriqnoma</h1>
        <p className="text-sm text-[#5A646D]">
          Tizimdan foydalanish boʻyicha yoʻriqnomalar, video darsliklar va koʻp beriladigan savollar.
        </p>
      </div>

      {/* Guide Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {guides.map((g, idx) => (
          <div
            key={idx}
            className="bg-white border border-[#E4E7EA] p-5 rounded-2xl shadow-xs hover:border-[#7FB98A] transition-all space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="p-2.5 bg-[#F0F7F1] rounded-xl w-fit">{g.icon}</div>
              <h3 className="text-sm font-bold text-[#1A1F24] leading-snug">{g.title}</h3>
              <div className="text-[11px] text-[#767F87]">{g.type} • {g.time}</div>
            </div>
            <Button variant="outline" size="sm" fullWidth>
              Koʻrish
            </Button>
          </div>
        ))}
      </div>

      {/* FAQ Accordion */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E7EA] pb-4">
          <h2 className="text-lg font-bold text-[#1A1F24]">Koʻp Beriladigan Savollar</h2>
          <div className="w-full sm:w-64">
            <Input
              placeholder="Savol izlash..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
        </div>

        <div className="space-y-3">
          {faqs
            .filter((f) => f.q.toLowerCase().includes(search.toLowerCase()))
            .map((item, idx) => {
              const isOpen = openIdx === idx;
              return (
                <div
                  key={idx}
                  className="border border-[#E4E7EA] rounded-xl overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setOpenIdx(isOpen ? null : idx)}
                    className="w-full p-4 text-left flex items-center justify-between gap-4 font-bold text-sm text-[#1A1F24] hover:bg-[#F8F9FA]"
                  >
                    <span className="flex items-center gap-2.5">
                      <HelpCircle className="w-4 h-4 text-[#2E7D4F] shrink-0" />
                      {item.q}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-[#767F87] shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#767F87] shrink-0" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 text-xs text-[#5A646D] leading-relaxed border-t border-[#E4E7EA] bg-[#F8F9FA]">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Support Call Box */}
      <div className="bg-[#123522] text-white rounded-2xl p-6 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#2E7D4F] rounded-xl shrink-0">
            <PhoneCall className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-base">Savollaringiz bormi?</h3>
            <p className="text-xs text-gray-300">24/7 Qoʻllab-quvvatlash markazi: +998 (71) 207-88-77</p>
          </div>
        </div>
        <Button variant="success" size="md">
          Murojaat Yuborish
        </Button>
      </div>
    </div>
  );
};
