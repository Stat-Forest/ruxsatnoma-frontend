import React, { useState } from 'react';
import {
  Download,
  QrCode,
  FileText,
  ArrowLeft,
  Eye,
  Check,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Overlay';

export interface ApplicationDetailPageProps {
  applicationId?: number | string;
  onNavigate?: (page: string, params?: any) => void;
}

export const ApplicationDetailPage: React.FC<ApplicationDetailPageProps> = ({
  applicationId = 1,
  onNavigate,
}) => {
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Mock application record
  const appData = {
    id: applicationId,
    permitNo: 'RX-2026-0089',
    applicant: 'ABDULLAYEV ALISHER NABIYEVICH',
    tin: '304918234',
    activity: 'Chorva mollarini boqish',
    livestock: '45 bosh qoramol, 100 bosh qoʻy',
    forestZone: 'Burchmulla oʻrmon xoʻjaligi, 4-boʻlim, 12-kvartal (Kontur №42)',
    duration: '10.08.2026 — 10.08.2027 (12 oy)',
    totalAmount: '1,428,000 UZS',
    status: 'approved' as const,
    submittedAt: '10.08.2026 14:30',
  };

  const timelineSteps = [
    {
      title: 'Ariza Yuborildi va E-IMZO Imzolandi',
      date: '10.08.2026 14:30',
      actor: 'Arizachi (Abdullayev A. N.)',
      desc: 'E-IMZO OʻzDSt 1135 raqamli muhr bilan muvaffaqiyatli tasdiqlandi.',
      completed: true,
    },
    {
      title: 'GIS va Norma Avto-Tekshiruvi',
      date: '10.08.2026 14:31',
      actor: 'Tizim Avtomatik Robot',
      desc: 'Topologik chegara kesishuvi 0%. MaxSB yaylov sigʻimi yetarli (500 bosh usta birlik).',
      completed: true,
    },
    {
      title: 'Oʻrmon Xoʻjaligi Xodimi Xulosasi',
      date: '10.08.2026 15:00',
      actor: 'Inspektor Karimov O. A.',
      desc: 'Veterinariya maʼlumotnomasi va yer maydoni tekshirildi. Ijobiy xulosa berildi.',
      completed: true,
    },
    {
      title: 'Tashkilot Rahbari E-IMZO Qarori',
      date: '10.08.2026 16:15',
      actor: 'Xoʻjalik Rahbari Ergashev B. M.',
      desc: 'Ruxsatnoma berish toʻgʻrisida rasmiy qaror tasdiqlandi va E-IMZO muhrlandi.',
      completed: true,
    },
    {
      title: 'Elektron Ruxsatnoma Shakllandi (QR-kod)',
      date: '10.08.2026 16:16',
      actor: 'Davlat Reyestri Tizimi',
      desc: 'Ruxsatnoma №RX-2026-0089 reyestrda faollashtirildi.',
      completed: true,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 font-sans">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => onNavigate?.('applicant_dashboard')}
        >
          Arizalar roʻyxatiga qaytish
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<QrCode className="w-4 h-4" />}
            onClick={() => setIsQrModalOpen(true)}
          >
            QR-Kod Koʻrish
          </Button>
          <Button variant="primary" size="sm" leftIcon={<Download className="w-4 h-4" />}>
            Rasmiy PDF Yuklab Olish
          </Button>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 sm:p-8 shadow-sm space-y-8">
        {/* Header Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E7EA] pb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-mono text-[#1A1F24]">{appData.permitNo}</h1>
              <StatusBadge status={appData.status} size="md" />
            </div>
            <p className="text-xs text-[#5A646D] mt-1">Yuborilgan sana: {appData.submittedAt}</p>
          </div>
          <div className="text-right sm:text-right">
            <span className="text-xs text-[#5A646D] uppercase font-semibold block">Toʻlov summasi</span>
            <div className="text-2xl font-bold font-mono text-[#2E7D4F]">{appData.totalAmount}</div>
          </div>
        </div>

        {/* Requisites Breakdown Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div className="p-4 bg-[#F8F9FA] rounded-xl border border-[#E4E7EA] space-y-1">
            <span className="text-xs text-[#5A646D] uppercase font-semibold block">Arizachi F.I.SH. / STIR</span>
            <span className="font-bold text-[#1A1F24] text-base">{appData.applicant}</span>
            <span className="block text-xs font-mono text-[#767F87]">STIR: {appData.tin}</span>
          </div>

          <div className="p-4 bg-[#F8F9FA] rounded-xl border border-[#E4E7EA] space-y-1">
            <span className="text-xs text-[#5A646D] uppercase font-semibold block">Faoliyat va Chorva Soni</span>
            <span className="font-bold text-[#1A1F24] text-base">{appData.activity}</span>
            <span className="block text-xs text-[#5A646D]">{appData.livestock}</span>
          </div>

          <div className="p-4 bg-[#F8F9FA] rounded-xl border border-[#E4E7EA] space-y-1">
            <span className="text-xs text-[#5A646D] uppercase font-semibold block">Oʻrmon Hududi (GIS)</span>
            <span className="font-bold text-[#1A1F24]">{appData.forestZone}</span>
          </div>

          <div className="p-4 bg-[#F8F9FA] rounded-xl border border-[#E4E7EA] space-y-1">
            <span className="text-xs text-[#5A646D] uppercase font-semibold block">Amal Qilish Muddati</span>
            <span className="font-bold text-[#1A1F24] font-mono">{appData.duration}</span>
          </div>
        </div>

        {/* UNIFIED INTERACTIVE TIMELINE */}
        <div className="space-y-4 pt-4 border-t border-[#E4E7EA]">
          <h2 className="text-lg font-bold text-[#1A1F24]">Yagona Harakatlar Vaqt Shkalasi (Timeline)</h2>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#2E7D4F]">
            {timelineSteps.map((st, idx) => (
              <div key={idx} className="relative flex items-start gap-4">
                <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#2E7D4F] border-2 border-white flex items-center justify-center text-white text-[10px] font-bold">
                  <Check className="w-3 h-3 text-white" />
                </div>
                <div className="bg-[#F8F9FA] border border-[#E4E7EA] p-4 rounded-xl flex-1 space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                    <span className="font-bold text-[#1A1F24] text-sm">{st.title}</span>
                    <span className="font-mono text-[#767F87] text-[11px]">{st.date}</span>
                  </div>
                  <span className="text-xs font-semibold text-[#2E7D4F] block">Masʼul: {st.actor}</span>
                  <p className="text-xs text-[#5A646D]">{st.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Attached Documents */}
        <div className="space-y-3 pt-4 border-t border-[#E4E7EA]">
          <h3 className="text-xs font-semibold text-[#767F87] uppercase">Biriktirilgan Hujjatlar</h3>
          <div className="flex flex-wrap gap-3">
            <div className="p-3 bg-[#F8F9FA] border border-[#E4E7EA] rounded-xl flex items-center gap-3 text-xs">
              <FileText className="w-5 h-5 text-[#2E7D4F]" />
              <div>
                <span className="font-bold text-[#1A1F24] block">Vet_Spravka_2026.pdf</span>
                <span className="text-[#767F87] text-[11px]">1.2 MB • Veterinariya xulosasi</span>
              </div>
              <button className="p-1.5 rounded text-[#2E7D4F] hover:bg-[#F0F7F1] ml-2"><Eye className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Modal Viewer */}
      <Modal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        title="Rasmiy Ruxsatnoma QR-Kodi"
        subtitle="Skanerlash orqali haqiqiyligini tekshiring"
        footer={
          <Button variant="primary" size="sm" onClick={() => setIsQrModalOpen(false)}>
            Yopish
          </Button>
        }
      >
        <div className="text-center space-y-4 py-4">
          <div className="w-48 h-48 bg-white border-4 border-[#2E7D4F] rounded-2xl mx-auto flex items-center justify-center p-4 shadow-inner">
            <QrCode className="w-36 h-36 text-[#1A1F24]" />
          </div>
          <div className="font-mono text-sm font-bold text-[#2E7D4F]">№ {appData.permitNo}</div>
          <p className="text-xs text-[#5A646D] max-w-xs mx-auto">
            Ushbu QR-kod ruxsatnomaning davlat reyestridagi nusxasiga bevosita havola beradi.
          </p>
        </div>
      </Modal>
    </div>
  );
};
