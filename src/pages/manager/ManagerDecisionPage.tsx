import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { StatusCard } from '../../components/ui/StatusBadge';
import { Alert } from '../../components/ui/Feedback';

export interface ManagerDecisionPageProps {
  onNavigate?: (page: string, params?: any) => void;
}

export interface SigningQueueItem {
  id: number;
  permitNo: string;
  applicant: string;
  activity: string;
  leskhozOfficer: string;
  amount: string;
  riskIndicator: string; // e.g. "Yo'q" or "RI-01 (Qo'lda to'lov)"
  status: 'pending' | 'approved';
}

export const ManagerDecisionPage: React.FC<ManagerDecisionPageProps> = () => {
  const [selectedIds] = useState<number[]>([1, 2]);
  const [isSigning, setIsSigning] = useState(false);
  const [signedSuccess, setSignedSuccess] = useState(false);

  const pendingQueue: SigningQueueItem[] = [
    { id: 1, permitNo: 'RX-2026-0090', applicant: 'Qosimov Sardor Rahimovich', activity: 'Chorva mollarini boqish (120 bosh)', leskhozOfficer: 'Karimov O. A.', amount: '2,850,000 UZS', riskIndicator: 'Yoʻq', status: 'pending' },
    { id: 2, permitNo: 'RX-2026-0093', applicant: 'Normatova Gulnora Ergashovna', activity: 'Pichan oʻrish (15 ga)', leskhozOfficer: 'Karimov O. A.', amount: '890,000 UZS', riskIndicator: 'Yoʻq', status: 'pending' },
    { id: 3, permitNo: 'RX-2026-0095', applicant: 'Fayzullayev Alijon Olimovich', activity: 'Asalarichilik (40 ari oilasi)', leskhozOfficer: 'Sodiqov T. M.', amount: '360,000 UZS', riskIndicator: 'RI-01 (Qoʻlda toʻlov)', status: 'pending' },
  ];

  const handleBulkSign = () => {
    setIsSigning(true);
    setTimeout(() => {
      setIsSigning(false);
      setSignedSuccess(true);
    }, 1500);
  };

  const columns: Column<SigningQueueItem>[] = [
    { key: 'permitNo', header: 'Ruxsatnoma №', sortable: true, width: '140px' },
    { key: 'applicant', header: 'Arizachi', sortable: true },
    { key: 'activity', header: 'Faoliyat Turi', sortable: true },
    { key: 'leskhozOfficer', header: 'Xodim Xulosasi', sortable: true, width: '150px' },
    { key: 'amount', header: 'Toʻlov Summasi', sortable: true, width: '140px' },
    {
      key: 'riskIndicator',
      header: 'Risk-Indikator',
      sortable: true,
      width: '160px',
      accessor: (row) => (
        <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${row.riskIndicator === 'Yoʻq' ? 'bg-[#F0F7F1] text-[#2E7D4F]' : 'bg-[#FFFBEB] text-[#B45309]'}`}>
          {row.riskIndicator}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#2E7D4F] bg-[#F0F7F1] px-2.5 py-1 rounded">
            Tashkilot Rahbari Kabineti (Phase 4)
          </span>
          <h1 className="text-2xl font-bold text-[#1A1F24] mt-1">E-IMZO Ommaviy Imzolash va Qarorlar Navbati</h1>
          <p className="text-xs text-[#5A646D]">
            Oʻrmon xoʻjaligi rahbari tomonidan ruxsatnomalarni guruhlab elektron raqamli imzo (E-IMZO) bilan tasdiqlash.
          </p>
        </div>
        <Button
          variant="success"
          size="lg"
          isLoading={isSigning}
          leftIcon={<ShieldCheck className="w-5 h-5" />}
          onClick={handleBulkSign}
        >
          E-IMZO Bilan Ommaviy Imzolash ({selectedIds.length})
        </Button>
      </div>

      {/* Risk Alert Banner */}
      <Alert
        variant="info"
        title="Maker-Checker Nazorati"
      >
        Tizimda 1 ta ruxsatnoma boʻyicha `RI-01 (Qoʻlda toʻlov)` risk-indikatori qayd etilgan. Tasdiqlashdan oldin bank kvitansiyasini tekshiring.
      </Alert>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard title="Imzolash Navbati" count={3} status="pending" subtitle="Kutayotgan hujjatlar" />
        <StatusCard title="Bugun Imzolandi" count={14} status="approved" subtitle="E-IMZO tasdiqlandi" />
        <StatusCard title="Risk-Indikatorlar" count={1} status="warning" subtitle="RI-01 nazorati" />
        <StatusCard title="SLA Bajarilishi" count={99} status="info" subtitle="99.2% muvaffaqiyat" />
      </div>

      {/* Success Notification */}
      {signedSuccess && (
        <div className="p-4 bg-[#F0F7F1] border border-[#D9EBDC] rounded-2xl flex items-center justify-between text-xs text-[#123522] animate-in fade-in duration-300">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="w-5 h-5 text-[#15803D]" />
            <span>Tanlangan {selectedIds.length} ta ruxsatnoma E-IMZO raqamli kaliti bilan muvaffaqiyatli tasdiqlandi va reyestrga kiritildi!</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSignedSuccess(false)}>
            Yopish
          </Button>
        </div>
      )}

      {/* Queue Table */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1A1F24]">Imzolanishi Kutilayotgan Hujjatlar Navbati</h2>
          <span className="text-xs text-[#5A646D]">Tanlanganlar: <b>{selectedIds.length} ta</b></span>
        </div>

        <DataTable columns={columns} data={pendingQueue} selectable />
      </div>
    </div>
  );
};
