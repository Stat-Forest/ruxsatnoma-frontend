import React, { useState } from 'react';
import {
  ShieldAlert,
  Search,
  Download,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/FormControls';
import { DataTable, type Column } from '../../components/ui/DataTable';

export interface ProsecutorPortalPageProps {
  onNavigate?: (page: string, params?: any) => void;
}

export interface RiskIndicatorItem {
  id: string;
  code: 'RI-01' | 'RI-04' | 'RI-12' | 'RI-15';
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  targetObject: string;
  leskhoz: string;
  ipAddress: string;
  detectedAt: string;
  auditTrail: string;
}

export const ProsecutorPortalPage: React.FC<ProsecutorPortalPageProps> = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const riskIndicators: RiskIndicatorItem[] = [
    {
      id: 'RISK-801',
      code: 'RI-01',
      level: 'HIGH',
      title: 'Qoʻlda toʻlov belgilash (Bank koʻchirmasisiz tasdiqlash)',
      targetObject: 'Ruxsatnoma №RX-2026-0095',
      leskhoz: 'Burchmulla oʻrmon xoʻjaligi',
      ipAddress: '192.168.10.45',
      detectedAt: '08.08.2026 16:00',
      auditTrail: 'Buxgalter Sodiqov T. M. tomonidan qoʻlda tasdiq urilgan',
    },
    {
      id: 'RISK-802',
      code: 'RI-04',
      level: 'MEDIUM',
      title: 'Retroaktiv БҲМ oʻzgarishi (Maker-Checker chetlab oʻtildi)',
      targetObject: 'Tarif №NRM-001 (Kontur №42)',
      leskhoz: 'Markaziy Apparat',
      ipAddress: '10.0.4.12',
      detectedAt: '01.08.2026 09:12',
      auditTrail: 'Normativ mutaxassis Karimov B. tomonidan oʻzgartirilgan',
    },
    {
      id: 'RISK-803',
      code: 'RI-12',
      level: 'HIGH',
      title: 'Yaylov sigʻimi (MaxSB) chegarasidan oshiqcha ruxsat berish',
      targetObject: 'Ruxsatnoma №RX-2026-0088',
      leskhoz: 'Zomin davlat qoʻriqxonasi',
      ipAddress: '192.168.12.89',
      detectedAt: '28.07.2026 11:45',
      auditTrail: 'Xodim Xasanov R. A. tomonidan tasdiqlashga yuborilgan',
    },
  ];

  const columns: Column<RiskIndicatorItem>[] = [
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      width: '100px',
      accessor: (row) => <b className="font-mono text-[#B91C1C]">{row.code}</b>,
    },
    {
      key: 'level',
      header: 'Daraja',
      sortable: true,
      width: '110px',
      accessor: (row) => (
        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${row.level === 'HIGH' ? 'bg-[#FEF2F2] text-[#991B1B] border border-[#FCA5A5]' : 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]'}`}>
          {row.level}
        </span>
      ),
    },
    { key: 'title', header: 'Risk-Indikator Turi', sortable: true },
    { key: 'targetObject', header: 'Obʼyekt', sortable: true, width: '180px' },
    { key: 'leskhoz', header: 'Oʻrmon Xoʻjaligi', sortable: true },
    { key: 'detectedAt', header: 'Vaqt', sortable: true, width: '130px' },
    { key: 'ipAddress', header: 'IP Manzil', sortable: true, width: '120px' },
  ];

  return (
    <div className="space-y-8 font-sans">
      {/* Strict Read-Only Header */}
      <div className="bg-[#123522] text-white rounded-2xl p-6 sm:p-8 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#2E7D4F] rounded-2xl">
              <ShieldAlert className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-[#B91C1C] text-white text-[10px] font-bold px-2 py-0.5 rounded">
                  YOPIQ PERIMETR — STRICT READ-ONLY
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white mt-0.5">
                Prokuratura Raqamli Nazorat Portali
              </h1>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-white/30 text-white hover:bg-white/10"
            leftIcon={<Download className="w-4 h-4" />}
          >
            Watermarked Audit PDF Export
          </Button>
        </div>

        <p className="text-xs text-gray-300 leading-relaxed max-w-2xl">
          Oʻzbekiston Respublikasi Prokuraturasi Nazorat Portali. Tizimda tahrirlash va oʻchirish tugmalari HTML darajasida chiqarib tashlangan (Read-Only). Barcha qidiruv va koʻrish harakatlari suv belgilari (Watermark) bilan qayd etiladi.
        </p>
      </div>

      {/* Strict Read-Only Search Form */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-4">
        <span className="text-xs font-bold uppercase tracking-wider text-[#767F87] block">
          JSHSHIR, STIR, Ruxsatnoma № yoki IP boʻyicha Qidiruv
        </span>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Masalan: 304918234 yoki RX-2026-0089"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              touchSize
            />
          </div>
          <Button variant="primary" size="lg">
            Qidiruv (Audit Query)
          </Button>
        </div>
      </div>

      {/* Real-time Risk-Indicators Table */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1A1F24]">Tizim Risk-Indikatorlari Stream (RI-01 ... RI-15)</h2>
          <span className="text-xs font-mono font-bold text-[#B91C1C]">3 ta faol risk signal</span>
        </div>

        <DataTable columns={columns} data={riskIndicators} selectable />
      </div>
    </div>
  );
};
