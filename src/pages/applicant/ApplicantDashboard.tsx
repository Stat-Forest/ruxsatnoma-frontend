import React from 'react';
import {
  Plus,
  Download,
  Eye,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { StatusBadge, StatusCard } from '../../components/ui/StatusBadge';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Alert } from '../../components/ui/Feedback';

export interface ApplicantDashboardProps {
  onNavigate?: (page: string, params?: any) => void;
}

interface ApplicationItem {
  id: number;
  permitNo: string;
  activity: string;
  forestZone: string;
  cattleCount: string;
  amount: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'warning';
  date: string;
}

export const ApplicantDashboard: React.FC<ApplicantDashboardProps> = ({ onNavigate }) => {
  const sampleApplications: ApplicationItem[] = [
    {
      id: 1,
      permitNo: 'RX-2026-0089',
      activity: 'Chorva mollarini boqish',
      forestZone: 'Burchmulla oʻrmon xoʻjaligi',
      cattleCount: '45 bosh qoramol',
      amount: '1,428,000 UZS',
      status: 'approved',
      date: '10.08.2026',
    },
    {
      id: 2,
      permitNo: 'RX-2026-0090',
      activity: 'Chorva mollarini boqish',
      forestZone: 'Zomin davlat qoʻriqxonasi',
      cattleCount: '120 bosh qoʻy',
      amount: '2,850,000 UZS',
      status: 'pending',
      date: '09.08.2026',
    },
    {
      id: 3,
      permitNo: 'RX-2026-0091',
      activity: 'Asalarichilik va in qoʻyish',
      forestZone: 'Kitob baland togʻ boʻlimi',
      cattleCount: '50 ari oilasi',
      amount: '450,000 UZS',
      status: 'warning',
      date: '05.08.2026',
    },
    {
      id: 4,
      permitNo: 'RX-2026-0093',
      activity: 'Pichan oʻrish va somon yigʻish',
      forestZone: 'Burchmulla oʻrmon xoʻjaligi',
      cattleCount: '15 gektar',
      amount: '890,000 UZS',
      status: 'draft',
      date: '01.08.2026',
    },
  ];

  const columns: Column<ApplicationItem>[] = [
    { key: 'permitNo', header: 'Ariza / Ruxsatnoma №', sortable: true, width: '160px' },
    { key: 'activity', header: 'Faoliyat turi', sortable: true },
    { key: 'forestZone', header: 'Oʻrmon hududi', sortable: true },
    { key: 'cattleCount', header: 'Parametr', sortable: true, width: '130px' },
    { key: 'amount', header: 'Toʻlov summasi', sortable: true, width: '130px' },
    {
      key: 'status',
      header: 'Holati',
      sortable: true,
      width: '180px',
      accessor: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    { key: 'date', header: 'Sana', sortable: true, width: '110px' },
  ];

  return (
    <div className="space-y-8 font-sans">
      {/* Top Welcome Header */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#2E7D4F] bg-[#F0F7F1] px-2.5 py-1 rounded">
            Arizachi Kabineti
          </span>
          <h1 className="text-2xl font-bold text-[#1A1F24] mt-1">Xush kelibsiz, Alisher Nabiyevich!</h1>
          <p className="text-xs text-[#5A646D]">
            STIR: 304918234 | Yuridik shaxs: OOO "Burchmulla Chorva Xoʻjaligi"
          </p>
        </div>
        <Button
          variant="primary"
          size="lg"
          leftIcon={<Plus className="w-5 h-5" />}
          onClick={() => onNavigate?.('applicant_wizard')}
        >
          Yangi Ariza Topshirish
        </Button>
      </div>

      {/* Actionable Alerts */}
      <Alert
        variant="warning"
        title="Muddati tugayotgan ruxsatnoma"
        actionText="Muddati uzaytirish"
        onAction={() => alert('Muddati uzaytirish oynasi')}
      >
        Ruxsatnoma №RX-2026-0091 amal qilish muddati 5 kundan keyin (15.08.2026) tugaydi. Davom ettirish uchun arizani yangilang.
      </Alert>

      {/* Status Cards Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard title="Jami Arizalar" count={4} status="info" subtitle="Barcha vaqt davomida" />
        <StatusCard title="Faol Ruxsatnomalar" count={1} status="approved" subtitle="Amal qilayotgan" />
        <StatusCard title="Kutilayotganlar" count={1} status="pending" subtitle="Koʻrib chiqilayotgan" />
        <StatusCard title="Muddati Tugamoqda" count={1} status="warning" subtitle="7 kun qoldi" />
      </div>

      {/* Recent Applications Table */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#1A1F24]">Soʻnggi Arizalar va Ruxsatnomalar</h2>
            <p className="text-xs text-[#5A646D]">Real-vaqt rejimida arizalar holatini kuzatish</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate?.('applicant_applications')}
          >
            Barcha arizalarni koʻrish
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={sampleApplications}
          selectable
          actions={(row) => (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onNavigate?.('applicant_application_detail', { id: row.id })}
                className="p-1.5 rounded text-[#767F87] hover:text-[#2E7D4F] hover:bg-[#F0F7F1] transition-colors"
                title="Koʻrish"
              >
                <Eye className="w-4 h-4" />
              </button>
              {row.status === 'approved' && (
                <button
                  className="p-1.5 rounded text-[#767F87] hover:text-[#15803D] hover:bg-[#F0F7F1] transition-colors"
                  title="PDF Yuklab olish"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        />
      </div>
    </div>
  );
};
