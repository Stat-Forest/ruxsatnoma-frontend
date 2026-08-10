import React, { useState } from 'react';
import {
  Clock,
  Eye,
  Search,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/FormControls';
import { DataTable, type Column } from '../../components/ui/DataTable';

export interface LeskhozInboxPageProps {
  onNavigate?: (page: string, params?: any) => void;
}

export interface LeskhozTaskItem {
  id: number;
  permitNo: string;
  applicant: string;
  activity: string;
  contour: string;
  slaHoursLeft: number;
  autoGisCheck: 'passed' | 'warning' | 'failed';
  autoNormCheck: 'passed' | 'warning' | 'failed';
  status: 'pending' | 'review' | 'approved' | 'rejected';
  submittedDate: string;
}

export const LeskhozInboxPage: React.FC<LeskhozInboxPageProps> = ({ onNavigate }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const tasks: LeskhozTaskItem[] = [
    { id: 1, permitNo: 'RX-2026-0090', applicant: 'Qosimov Sardor Rahimovich', activity: 'Chorva mollarini boqish (120 bosh)', contour: 'Kontur №42 (Burchmulla)', slaHoursLeft: 18, autoGisCheck: 'passed', autoNormCheck: 'passed', status: 'pending', submittedDate: '09.08.2026 10:15' },
    { id: 2, permitNo: 'RX-2026-0092', applicant: 'Mirzayev Temur Bahromovich', activity: 'Chorva mollarini boqish (30 bosh)', contour: 'Kontur №15 (Zomin)', slaHoursLeft: 4, autoGisCheck: 'passed', autoNormCheck: 'warning', status: 'pending', submittedDate: '09.08.2026 16:40' },
    { id: 3, permitNo: 'RX-2026-0093', applicant: 'Normatova Gulnora Ergashovna', activity: 'Pichan oʻrish (15 ga)', contour: 'Kontur №88 (Kitob)', slaHoursLeft: 48, autoGisCheck: 'passed', autoNormCheck: 'passed', status: 'review', submittedDate: '10.08.2026 09:00' },
  ];

  const columns: Column<LeskhozTaskItem>[] = [
    { key: 'permitNo', header: 'Ariza №', sortable: true, width: '130px' },
    { key: 'applicant', header: 'Arizachi F.I.SH.', sortable: true },
    { key: 'activity', header: 'Faoliyat / Parametr', sortable: true },
    { key: 'contour', header: 'Oʻrmon Konturi', sortable: true },
    {
      key: 'slaHoursLeft',
      header: 'SLA Qoldiq Muddat',
      sortable: true,
      width: '160px',
      accessor: (row) => (
        <span className={`flex items-center gap-1 font-mono text-xs font-bold ${row.slaHoursLeft < 12 ? 'text-[#B91C1C]' : 'text-[#2E7D4F]'}`}>
          <Clock className="w-3.5 h-3.5" /> {row.slaHoursLeft} soat qoldi
        </span>
      ),
    },
    {
      key: 'autoGisCheck',
      header: 'Avto-Tekshiruvlar',
      sortable: true,
      width: '180px',
      accessor: (row) => (
        <div className="flex items-center gap-1 text-[11px] font-mono">
          <span className="px-1.5 py-0.5 rounded bg-[#F0F7F1] text-[#2E7D4F] font-bold border border-[#D9EBDC]">GIS: 100%</span>
          <span className={`px-1.5 py-0.5 rounded font-bold ${row.autoNormCheck === 'passed' ? 'bg-[#F0F7F1] text-[#2E7D4F]' : 'bg-[#FFFBEB] text-[#92400E]'}`}>
            Norma: {row.autoNormCheck.toUpperCase()}
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#2E7D4F] bg-[#F0F7F1] px-2.5 py-1 rounded">
            Oʻrmon Xoʻjaligi Xodimi Kabineti (Phase 4)
          </span>
          <h1 className="text-2xl font-bold text-[#1A1F24] mt-1">Koʻrib Chiqiladigan Arizalar Ish Stoli</h1>
          <p className="text-xs text-[#5A646D]">
            Avto-tekshiruv natijalarini koʻrish, rad etish kodlarini qoʻllash hamda joyiga chiqish topshiriqlarini biriktirish.
          </p>
        </div>
      </div>

      {/* Inbox Table */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-[#1A1F24]">Biriktirilgan Arizalar Navbati</h2>
          <div className="w-full sm:w-64">
            <Input
              placeholder="Ariza № boʻyicha izlash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={tasks}
          selectable
          actions={(row) => (
            <div className="flex items-center gap-1">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Eye className="w-4 h-4" />}
                onClick={() => onNavigate?.('leskhoz_review', { id: row.id })}
              >
                Koʻrib chiqish
              </Button>
            </div>
          )}
        />
      </div>
    </div>
  );
};
