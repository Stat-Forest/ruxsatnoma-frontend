import React, { useState } from 'react';
import {
  QrCode,
  Download,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/FormControls';
import { Tabs } from '../../components/ui/Navigation';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Overlay';

export interface MyPermitsPageProps {
  onNavigate?: (page: string, params?: any) => void;
}

export interface PermitCardItem {
  id: number;
  permitNo: string;
  activity: string;
  forestZone: string;
  livestock: string;
  issueDate: string;
  expiryDate: string;
  status: 'approved' | 'warning' | 'rejected';
  daysLeft: number;
}

export const MyPermitsPage: React.FC<MyPermitsPageProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQrPermit, setSelectedQrPermit] = useState<PermitCardItem | null>(null);

  const permits: PermitCardItem[] = [
    {
      id: 1,
      permitNo: 'RX-2026-0089',
      activity: 'Chorva mollarini boqish',
      forestZone: 'Burchmulla oʻrmon xoʻjaligi, 4-boʻlim',
      livestock: '45 bosh qoramol',
      issueDate: '10.08.2026',
      expiryDate: '10.08.2027',
      status: 'approved',
      daysLeft: 365,
    },
    {
      id: 3,
      permitNo: 'RX-2026-0091',
      activity: 'Asalarichilik va in qoʻyish',
      forestZone: 'Kitob baland togʻ boʻlimi',
      livestock: '50 ari oilasi',
      issueDate: '05.08.2025',
      expiryDate: '15.08.2026',
      status: 'warning',
      daysLeft: 5,
    },
  ];

  const filteredPermits = permits.filter((p) => {
    if (activeTab === 'approved' && p.status !== 'approved') return false;
    if (activeTab === 'warning' && p.status !== 'warning') return false;
    if (searchQuery && !p.permitNo.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-8 font-sans">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#2E7D4F] bg-[#F0F7F1] px-2.5 py-1 rounded">
            Rasmiy Hujjatlar
          </span>
          <h1 className="text-2xl font-bold text-[#1A1F24] mt-1">Mening Ruxsatnomalarim</h1>
          <p className="text-xs text-[#5A646D]">Berilgan elektron ruxsatnomalarni yuklab olish va uzaytirish</p>
        </div>
        <Button
          variant="primary"
          onClick={() => onNavigate?.('applicant_wizard')}
        >
          Yangi Ariza
        </Button>
      </div>

      {/* Controls & Filter bar */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <Tabs
            tabs={[
              { id: 'all', label: 'Barchasi', count: permits.length },
              { id: 'approved', label: 'Faol ruxsatnomalar', count: 1 },
              { id: 'warning', label: 'Muddati tugayotganlar', count: 1 },
            ]}
            activeTabId={activeTab}
            onChange={setActiveTab}
          />
          <div className="w-full sm:w-64">
            <Input
              placeholder="Raqam boʻyicha izlash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
        </div>
      </div>

      {/* Permits Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredPermits.map((p) => (
          <div
            key={p.id}
            className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs hover:shadow-md transition-shadow space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold font-mono text-[#1A1F24]">{p.permitNo}</span>
                <StatusBadge status={p.status} size="sm" />
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-base text-[#1A1F24]">{p.activity}</h3>
                <p className="text-xs text-[#5A646D]">{p.forestZone}</p>
                <p className="text-xs text-[#767F87]">Parametr: <b className="text-[#1A1F24]">{p.livestock}</b></p>
              </div>

              <div className="p-3 bg-[#F8F9FA] rounded-xl border border-[#E4E7EA] flex items-center justify-between text-xs font-mono">
                <span className="text-[#5A646D]">Amal qilish muddati:</span>
                <b className="text-[#1A1F24]">{p.issueDate} — {p.expiryDate}</b>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-[#E4E7EA] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<QrCode className="w-4 h-4" />}
                  onClick={() => setSelectedQrPermit(p)}
                >
                  QR-Kod
                </Button>
                <Button variant="secondary" size="sm" leftIcon={<Download className="w-4 h-4" />}>
                  PDF
                </Button>
              </div>

              {p.status === 'warning' ? (
                <Button
                  variant="success"
                  size="sm"
                  leftIcon={<RefreshCw className="w-4 h-4" />}
                  onClick={() => onNavigate?.('applicant_wizard')}
                >
                  Muddati uzaytirish
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigate?.('applicant_application_detail', { id: p.id })}
                >
                  Tafsilotlar
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* QR Code Viewer Modal */}
      {selectedQrPermit && (
        <Modal
          isOpen={!!selectedQrPermit}
          onClose={() => setSelectedQrPermit(null)}
          title={`Ruxsatnoma ${selectedQrPermit.permitNo}`}
          subtitle="QR-kod orqali tekshirish"
          footer={
            <Button variant="primary" size="sm" onClick={() => setSelectedQrPermit(null)}>
              Yopish
            </Button>
          }
        >
          <div className="text-center space-y-4 py-4">
            <div className="w-48 h-48 bg-white border-4 border-[#2E7D4F] rounded-2xl mx-auto flex items-center justify-center p-4">
              <QrCode className="w-36 h-36 text-[#1A1F24]" />
            </div>
            <div className="font-mono text-sm font-bold text-[#2E7D4F]">{selectedQrPermit.permitNo}</div>
            <p className="text-xs text-[#5A646D]">
              Oʻrmon inspektorlari uchun tekshirish kodi
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
};
