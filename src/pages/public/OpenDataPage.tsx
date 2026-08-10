import React from 'react';
import { Database, Download } from 'lucide-react';
import { Button } from '../../components/ui/button';

export interface OpenDataPageProps {
  onNavigate?: (page: string, params?: any) => void;
}

export const OpenDataPage: React.FC<OpenDataPageProps> = () => {
  const datasets = [
    {
      title: 'Respublika boʻyicha ruxsatnomalar reyestri',
      format: 'JSON / CSV',
      updatedAt: '10.08.2026',
      size: '4.2 MB',
      desc: 'Berilgan va bekor qilingan ruxsatnomalarining anonimlashtirilgan statistikasi.',
    },
    {
      title: 'Oʻrmon xoʻjaliklari GIS chegaralari va konturlari',
      format: 'GeoJSON / SHP',
      updatedAt: '01.08.2026',
      size: '18.5 MB',
      desc: 'Oʻrmon xoʻjaliklari yer maydonlarining elektron fazoviy chegaralari.',
    },
    {
      title: 'Yaylov sigʻimi va geobotanik meʼyorlar bazasi',
      format: 'XLSX / CSV',
      updatedAt: '05.08.2026',
      size: '1.8 MB',
      desc: 'Boʻlimlar kesimida chorva mollari sigʻimi (MaxSB) koʻrsatkichlari.',
    },
  ];

  return (
    <div className="space-y-8 font-sans max-w-4xl mx-auto">
      <div className="text-center space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-[#2E7D4F] bg-[#F0F7F1] px-3 py-1 rounded-full border border-[#D9EBDC]">
          Ochiq Maʼlumotlar Portali
        </span>
        <h1 className="text-3xl font-bold text-[#1A1F24]">Ochiq Statistika va Fayllar</h1>
        <p className="text-sm text-[#5A646D]">
          Oʻrmon xoʻjaligi sohasidagi davlat maʼlumotlarining shaffof statistik toʻplamlari.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E4E7EA] p-5 rounded-2xl text-center space-y-1">
          <div className="text-2xl font-bold text-[#2E7D4F]">42,850+</div>
          <div className="text-xs text-[#5A646D]">Jami berilgan ruxsatnomalar</div>
        </div>
        <div className="bg-white border border-[#E4E7EA] p-5 rounded-2xl text-center space-y-1">
          <div className="text-2xl font-bold text-[#2E7D4F]">84 ta</div>
          <div className="text-xs text-[#5A646D]">Oʻrmon xoʻjaliklari bazasi</div>
        </div>
        <div className="bg-white border border-[#E4E7EA] p-5 rounded-2xl text-center space-y-1">
          <div className="text-2xl font-bold text-[#2E7D4F]">100%</div>
          <div className="text-xs text-[#5A646D]">Raqamli ochiqlik indeksi</div>
        </div>
      </div>

      <div className="space-y-4">
        {datasets.map((ds, idx) => (
          <div
            key={idx}
            className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-[#F0F7F1] rounded-xl text-[#2E7D4F] shrink-0">
                <Database className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold bg-[#F8F9FA] px-2 py-0.5 rounded border border-[#E4E7EA]">
                    {ds.format}
                  </span>
                  <span className="text-xs text-[#767F87]">{ds.size} • {ds.updatedAt}</span>
                </div>
                <h3 className="text-base font-bold text-[#1A1F24]">{ds.title}</h3>
                <p className="text-xs text-[#5A646D]">{ds.desc}</p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="w-4 h-4 text-[#2E7D4F]" />}
              className="shrink-0"
            >
              Yuklab olish
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
