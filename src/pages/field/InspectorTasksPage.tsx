import React, { useState } from 'react';
import {
  QrCode,
  MapPin,
  WifiOff,
  Wifi,
  Camera,
  Navigation,
  ArrowRight,
} from 'lucide-react';
import { Button } from '../../components/ui/button';

export interface InspectorTasksPageProps {
  onNavigate?: (page: string, params?: any) => void;
}

export const InspectorTasksPage: React.FC<InspectorTasksPageProps> = ({ onNavigate }) => {
  const [isOnline, setIsOnline] = useState(true);

  const tasks = [
    {
      id: 'TASK-101',
      permitNo: 'RX-2026-0089',
      applicant: 'Abdullayev A. N.',
      activity: 'Chorva boqish (45 bosh qoramol)',
      contour: 'Kontur №42 (Burchmulla, 4-boʻlim)',
      distanceKm: '1.2 km',
      status: 'pending',
      slaDue: 'Bugun 18:00 gacha',
    },
    {
      id: 'TASK-102',
      permitNo: 'RX-2026-0091',
      applicant: 'Karimov J. O.',
      activity: 'Asalarichilik (50 ari oilasi)',
      contour: 'Kontur №15 (Zomin)',
      distanceKm: '4.8 km',
      status: 'pending',
      slaDue: 'Ertaga 12:00 gacha',
    },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6 font-sans">
      {/* Network Status Header */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl text-white ${isOnline ? 'bg-[#15803D]' : 'bg-[#D97706]'}`}>
            {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
          </div>
          <div>
            <h1 className="text-base font-bold text-[#1A1F24]">Inspektor PWA Ilovasi</h1>
            <span className="text-xs text-[#5A646D]">
              Tarmoq holati: <b className={isOnline ? 'text-[#15803D]' : 'text-[#D97706]'}>{isOnline ? 'ONLAYN (Server Sync)' : 'OFFLAYN (Kesh rejimi)'}</b>
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsOnline(!isOnline)}
          className="text-xs font-semibold text-[#2E7D4F] underline hover:text-[#23653F]"
        >
          {isOnline ? 'Offlayn rejimga oʻtish' : 'Onlayn rejimga oʻtish'}
        </button>
      </div>

      {/* Quick Action Camera Scanner CTA */}
      <div className="bg-[#123522] text-white p-6 rounded-2xl shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-[#7FB98A] uppercase">Dala Tekshiruvi</span>
            <h2 className="text-xl font-bold">QR-Kod va Joyida Tekshirish</h2>
            <p className="text-xs text-gray-300">Ruxsatnomani skanerlash va GPS masofani aniqlash</p>
          </div>
          <div className="p-3 bg-[#2E7D4F] rounded-2xl">
            <Camera className="w-8 h-8 text-white" />
          </div>
        </div>

        <Button
          variant="success"
          fullWidth
          size="lg"
          leftIcon={<QrCode className="w-5 h-5" />}
          onClick={() => onNavigate?.('field_scan')}
        >
          Kamera Bilan Skanerlash (Scan QR)
        </Button>
      </div>

      {/* Tasks List for Today */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[#1A1F24]">Bugungi Topshiriqlar</h3>
          <span className="text-xs font-mono font-bold text-[#2E7D4F]">2 ta topshiriq</span>
        </div>

        <div className="space-y-3">
          {tasks.map((t) => (
            <div
              key={t.id}
              className="bg-white border border-[#E4E7EA] rounded-2xl p-5 shadow-xs space-y-3 hover:border-[#7FB98A] transition-colors"
            >
              <div className="flex items-center justify-between border-b border-[#E4E7EA] pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-[#1A1F24]">{t.permitNo}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F0F7F1] text-[#2E7D4F] border border-[#D9EBDC]">
                    SLA: {t.slaDue}
                  </span>
                </div>
                <span className="text-xs font-mono text-[#5A646D] flex items-center gap-1">
                  <Navigation className="w-3.5 h-3.5 text-[#0284C7]" /> {t.distanceKm}
                </span>
              </div>

              <div className="space-y-1 text-xs">
                <div className="font-bold text-[#1A1F24] text-sm">{t.applicant}</div>
                <div className="text-[#5A646D]">{t.activity}</div>
                <div className="text-[#767F87] flex items-center gap-1 pt-1">
                  <MapPin className="w-3.5 h-3.5 text-[#2E7D4F]" /> {t.contour}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  onClick={() => onNavigate?.('field_inspection', { permitNo: t.permitNo })}
                >
                  Dalolatnoma Tuzish
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
