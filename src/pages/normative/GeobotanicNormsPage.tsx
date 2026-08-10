import React, { useState } from 'react';
import {
  Calculator,
  History,
  Plus,
  Search,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/FormControls';
import { DataTable, type Column } from '../../components/ui/DataTable';

export interface GeobotanicNormsPageProps {
  onNavigate?: (page: string, params?: any) => void;
}

export interface GeobotanicNormItem {
  id: string;
  contourNo: string;
  leskhoz: string;
  geobotanicDoc: string;
  yieldPerHa: string; // e.g. "4.2 sentner/ga"
  rotationSeason: string;
  maxSB: number; // Maximum sustainable capacity
  ruleVersion: string;
  status: 'active' | 'archived';
  lastAuditDate: string;
}

export const GeobotanicNormsPage: React.FC<GeobotanicNormsPageProps> = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const mockNorms: GeobotanicNormItem[] = [
    { id: 'NRM-001', contourNo: 'Kontur №42', leskhoz: 'Burchmulla oʻrmon xoʻjaligi', geobotanicDoc: 'OʻzR Fanlar Akademiyasi Xulosasi №14/2025', yieldPerHa: '4.5 sentner/ga', rotationSeason: 'Bahor-Yoz (Aprel-Sentyabr)', maxSB: 500, ruleVersion: 'v2.4 (2026)', status: 'active', lastAuditDate: '10.01.2026' },
    { id: 'NRM-002', contourNo: 'Kontur №15', leskhoz: 'Zomin davlat qoʻriqxonasi', geobotanicDoc: 'Ekologik Geobotanika Hujjati №89', yieldPerHa: '3.8 sentner/ga', rotationSeason: 'Kuz-Qish (Oktyabr-Mart)', maxSB: 200, ruleVersion: 'v2.1 (2025)', status: 'active', lastAuditDate: '15.12.2025' },
    { id: 'NRM-003', contourNo: 'Kontur №88', leskhoz: 'Kitob baland togʻ boʻlimi', geobotanicDoc: 'NHA Qarori №402-2024', yieldPerHa: '5.1 sentner/ga', rotationSeason: 'Yoz (Iyun-Avgust)', maxSB: 350, ruleVersion: 'v1.8 (2024)', status: 'archived', lastAuditDate: '01.06.2024' },
  ];

  const bhmAuditLogs = [
    { date: '01.08.2026', oldBhm: '330,000 UZS', newBhm: '340,000 UZS', changedBy: 'Normativ Mutaxassis Karimov B.', makerCheckerStatus: 'Tasdiqlangan (RI-04 Aylanib oʻtildi)' },
    { date: '01.12.2024', oldBhm: '300,000 UZS', newBhm: '330,000 UZS', changedBy: 'Moliya Vazirligi Avto-Sync', makerCheckerStatus: 'Tasdiqlangan' },
  ];

  const columns: Column<GeobotanicNormItem>[] = [
    { key: 'contourNo', header: 'Kontur №', sortable: true, width: '120px' },
    { key: 'leskhoz', header: 'Oʻrmon Xoʻjaligi', sortable: true },
    { key: 'geobotanicDoc', header: 'Geobotanik Hujjat Basis', sortable: true },
    { key: 'yieldPerHa', header: 'Hosildorlik', sortable: true, width: '130px' },
    { key: 'rotationSeason', header: 'Mavsumiy Rotatsiya', sortable: true },
    { key: 'maxSB', header: 'Sigʻim (MaxSB)', sortable: true, width: '130px', accessor: (row) => <b className="font-mono text-[#2E7D4F]">{row.maxSB} bosh</b> },
    { key: 'ruleVersion', header: 'Versiya', sortable: true, width: '110px' },
  ];

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#2E7D4F] bg-[#F0F7F1] px-2.5 py-1 rounded">
            Normativ Subtizimi (Phase 3)
          </span>
          <h1 className="text-2xl font-bold text-[#1A1F24] mt-1">Geobotanik Normalar va BHM Audit Reestri</h1>
          <p className="text-xs text-[#5A646D]">
            Har bir oʻrmon konturiga oid geobotanik hosildorlik, rotatsiya mavsumlari va MaxSB formulalari.
          </p>
        </div>
        <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
          Yangi Norma Biriktirish
        </Button>
      </div>

      {/* Formula Calculation Logic Explanation Box */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3 border-b border-[#E4E7EA] pb-3">
          <Calculator className="w-6 h-6 text-[#2E7D4F]" />
          <h2 className="text-base font-bold text-[#1A1F24]">Yaylov Sigʻimi (MaxSB) Avto-Hisoblash Formulasi</h2>
        </div>

        <div className="p-4 bg-[#F0F7F1] border border-[#D9EBDC] rounded-xl font-mono text-xs text-[#123522] space-y-1">
          <div className="font-bold">MaxSB = (Maydon (ga) × Hosildorlik (sentner/ga) × Qayta tiklanish koeffitsienti) / Chorva ehtiyoji</div>
          <div className="text-[11px] text-[#5A646D] font-sans pt-1">
            * Formulalar va har bir kontur uchun belgilangan `rule_version` parametrlari tizim tomonidan avtomatik audit qilinadi.
          </div>
        </div>
      </div>

      {/* Norms Table */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-[#1A1F24]">Faol Geobotanik Normalar Reestri</h2>
          <div className="w-full sm:w-64">
            <Input
              placeholder="Kontur boʻyicha izlash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
        </div>

        <DataTable columns={columns} data={mockNorms} selectable />
      </div>

      {/* BHM Retroactive Change Audit Log (RI-04 Detector) */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-[#767F87] uppercase">
          <History className="w-4 h-4 text-[#B45309]" />
          <span>BHM (БҲМ) Tarixi va Retroaktiv Audit Jurnali (Maker-Checker Nazorati)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F8F9FA] border-b border-[#E4E7EA]">
              <tr>
                <th className="p-3 font-semibold text-[#5A646D]">Oʻzgarish Sanasi</th>
                <th className="p-3 font-semibold text-[#5A646D]">Eski БҲМ</th>
                <th className="p-3 font-semibold text-[#5A646D]">Yangi БҲМ</th>
                <th className="p-3 font-semibold text-[#5A646D]">Masʼul Shaxs</th>
                <th className="p-3 font-semibold text-[#5A646D]">Maker-Checker Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EA]">
              {bhmAuditLogs.map((log, idx) => (
                <tr key={idx} className="hover:bg-[#F8F9FA]">
                  <td className="p-3 font-mono font-bold">{log.date}</td>
                  <td className="p-3 font-mono text-[#767F87]">{log.oldBhm}</td>
                  <td className="p-3 font-mono font-bold text-[#2E7D4F]">{log.newBhm}</td>
                  <td className="p-3 font-semibold text-[#1A1F24]">{log.changedBy}</td>
                  <td className="p-3 text-[#15803D] font-semibold">{log.makerCheckerStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
