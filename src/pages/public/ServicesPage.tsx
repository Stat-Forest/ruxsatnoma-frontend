import React from 'react';
import { ShieldCheck, ArrowRight, FileCheck2, Trees, MapPin } from 'lucide-react';
import { Button } from '../../components/ui/button';

export interface ServicesPageProps {
  onNavigate?: (page: string, params?: any) => void;
}

export const ServicesPage: React.FC<ServicesPageProps> = ({ onNavigate }) => {
  const servicesList = [
    {
      id: 'grazing',
      title: 'Chorva mollarini boqish boʻyicha ruxsatnoma',
      category: 'Yaylovlardan foydalanish',
      desc: 'Oʻrmon fondi yaylov hududlarida belgilangan normaga muvofiq qoramol, qoʻy va echkilarni boqish uchun elektron ruxsatnoma.',
      term: '3 oy - 12 oy',
      icon: <Trees className="w-6 h-6 text-[#2E7D4F]" />,
    },
    {
      id: 'haymaking',
      title: 'Pichan oʻrish va somon yigʻish ruxsatnomasi',
      category: 'Pichanchilik',
      desc: 'Mavsumiy pichan oʻrish maydonlaridan foydalanish va chorva uchun oziq-ovqat zaxirasini gʻamlash.',
      term: 'Mavsumiy (1-6 oy)',
      icon: <FileCheck2 className="w-6 h-6 text-[#2E7D4F]" />,
    },
    {
      id: 'beekeeping',
      title: 'Asalarichilik va in qoʻyish huquqi',
      category: 'Asalarichilik',
      desc: 'Asalari oilalarini oʻrmon oʻsimliklari gullash davrida oʻrmon yerlariga vaqtinchalik joylashtirish.',
      term: 'Mavsumiy',
      icon: <ShieldCheck className="w-6 h-6 text-[#2E7D4F]" />,
    },
    {
      id: 'wild_plants',
      title: 'Yovvoyi va dorivor oʻsimliklarni yigʻish',
      category: 'Oʻsimlik xomashyosi',
      desc: 'Tabiiy mevalar, yongʻoqlar, dorivor va oziq-ovqat maqsadlaridagi oʻsimliklarni belgilangan kvota boʻyicha terish.',
      term: 'Kvota muddati boʻyicha',
      icon: <Trees className="w-6 h-6 text-[#2E7D4F]" />,
    },
    {
      id: 'recreation',
      title: 'Rekreatsiya va ekologik turizm',
      category: 'Turizm va Dam olish',
      desc: 'Vaqtinchalik yengil inshootlar qurish va ekologik turizm yoʻnalishida xizmatlar koʻrsatish.',
      term: 'Auksion shartnomasi boʻyicha',
      icon: <MapPin className="w-6 h-6 text-[#2E7D4F]" />,
    },
  ];

  return (
    <div className="space-y-8 font-sans">
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-[#2E7D4F] bg-[#F0F7F1] px-3 py-1 rounded-full border border-[#D9EBDC]">
          Davlat Xizmatlari Reyestri
        </span>
        <h1 className="text-3xl font-bold text-[#1A1F24]">Oʻrmon Fondidan Foydalanish Xizmatlari</h1>
        <p className="text-sm text-[#5A646D]">
          Yagona interaktiv portal orqali barcha turdagi ruxsatnomalarga ariza topshirishingiz mumkin.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {servicesList.map((svc) => (
          <div
            key={svc.id}
            className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-[#F0F7F1] rounded-xl">{svc.icon}</div>
                <span className="text-xs font-semibold text-[#5A646D] bg-[#F8F9FA] px-2.5 py-1 rounded-lg border border-[#E4E7EA]">
                  {svc.category}
                </span>
              </div>
              <h3 className="text-lg font-bold text-[#1A1F24]">{svc.title}</h3>
              <p className="text-xs text-[#5A646D] leading-relaxed">{svc.desc}</p>
            </div>

            <div className="pt-4 border-t border-[#E4E7EA] flex items-center justify-between text-xs">
              <span className="text-[#767F87]">Muddati: <b className="text-[#1A1F24]">{svc.term}</b></span>
              <Button
                variant="primary"
                size="sm"
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                onClick={() => onNavigate?.('applicant_wizard', { activity: svc.id })}
              >
                Ariza berish
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
