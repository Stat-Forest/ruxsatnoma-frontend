import React from 'react';
import { FileText, Download } from 'lucide-react';
import { Button } from '../../components/ui/button';

export interface DocumentsPageProps {
  onNavigate?: (page: string, params?: any) => void;
}

export const DocumentsPage: React.FC<DocumentsPageProps> = () => {
  const docs = [
    {
      title: 'Oʻzbekiston Respublikasining Oʻrmon Kodeksi',
      number: 'ZRU-475',
      date: '16.04.2018',
      desc: 'Oʻrmonlarni muhofaza qilish, himoya qilish, koʻpaytirish va ulardan oqilona foydalanish sohasidagi munosabatlarni tartibga soladi.',
    },
    {
      title: 'Oʻrmon fondi yerlarida chorva mollarini boqish tartibi toʻgʻrisida Nizom',
      number: 'VMQ-342',
      date: '12.05.2021',
      desc: 'Yaylov sigʻimi normalari va chorva mollarini boqish uchun ruxsatnomalar berish tartibini belgilaydi.',
    },
    {
      title: '2026-yil uchun Bazaviy Hisoblash Miqdori (BHM) va toʻlov stavkalari',
      number: 'PF-108',
      date: '01.01.2026',
      desc: 'Ruxsatnomalar rasmiylashtirish uchun toʻlanadigan toʻlov koeffitsientlari yigʻindisi.',
    },
    {
      title: 'Geobotanik tadqiqotlar va yaylov sigʻimi meʼyorlari qoʻllanmasi',
      number: 'ST-04',
      date: '10.02.2025',
      desc: '1 gektar yaylov maydoniga toʻgʻri keluvchi shartli chorva mollari birligi (MaxSB).',
    },
  ];

  return (
    <div className="space-y-8 font-sans max-w-4xl mx-auto">
      <div className="text-center space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-[#2E7D4F] bg-[#F0F7F1] px-3 py-1 rounded-full border border-[#D9EBDC]">
          Hujjatlar va Qonunchilik
        </span>
        <h1 className="text-3xl font-bold text-[#1A1F24]">Normativ-Huquqiy Hujjatlar</h1>
        <p className="text-sm text-[#5A646D]">
          Oʻrmon xoʻjaligi sohasi boʻyicha amaldagi qonunlar, qarorlar va meʼyoriy normativlar.
        </p>
      </div>

      <div className="space-y-4">
        {docs.map((doc, idx) => (
          <div
            key={idx}
            className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs hover:border-[#7FB98A] transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-[#F0F7F1] rounded-xl text-[#2E7D4F] shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-[#2E7D4F] bg-[#F0F7F1] px-2 py-0.5 rounded">
                    № {doc.number}
                  </span>
                  <span className="text-xs text-[#767F87]">{doc.date}</span>
                </div>
                <h3 className="text-base font-bold text-[#1A1F24]">{doc.title}</h3>
                <p className="text-xs text-[#5A646D]">{doc.desc}</p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="w-4 h-4 text-[#2E7D4F]" />}
              className="shrink-0"
            >
              PDF Yuklab olish
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
