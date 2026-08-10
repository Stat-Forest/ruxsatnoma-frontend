import React, { useState } from 'react';
import {
  Shield,
  Plus,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Tabs } from '../../components/ui/Navigation';

export interface AdminSettingsPageProps {
  onNavigate?: (page: string, params?: any) => void;
}

export const AdminSettingsPage: React.FC<AdminSettingsPageProps> = () => {
  const [activeTab, setActiveTab] = useState('roles');

  const roles = [
    { name: 'Arizachi (Applicant)', usersCount: 42800, scope: 'Shaxsiy kabinet va arizalar', access: 'RBAC / ABAC' },
    { name: 'Oʻrmon Xoʻjaligi Xodimi', usersCount: 320, scope: 'Tuman va boʻlim arizalarini koʻrib chiqish', access: 'Leskhoz Restricted' },
    { name: 'Tashkilot Rahbari (Manager)', usersCount: 84, scope: 'Qaror chiqarish va E-IMZO ommaviy imzolash', access: 'Organization Executive' },
    { name: 'GIS Mutaxassisi', usersCount: 45, scope: 'XaritaMuharriri va 13 qatlam muhiti', access: 'GIS Layer Write' },
    { name: 'Normativ Mutaxassis', usersCount: 18, scope: 'Geobotanik normalar va MaxSB formulalari', access: 'Normative Write' },
    { name: 'Dala Inspektori (PWA)', usersCount: 450, scope: 'Offline PWA ilovasi, QR skaner, GPS va Foto', access: 'Field Mobile' },
    { name: 'Buxgalter', usersCount: 84, scope: 'Bank koʻchirmalari va 50/50 taqsimot', access: 'Financial Ledger' },
    { name: 'Tizim Administratori', usersCount: 5, scope: 'Toʻliq maʼmuriy va foydalanuvchilar boshqaruvi', access: 'Super Admin' },
    { name: 'Markaziy Apparat', usersCount: 25, scope: 'Respublika analitikasi va monitoring', access: 'Nationwide Read' },
    { name: 'Prokuror (Yopiq Perimetr)', usersCount: 120, scope: 'Raqamli Nazorat yopiq portali va Risk-Indikatorlar', access: 'STRICT READ-ONLY' },
  ];

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#2E7D4F] bg-[#F0F7F1] px-2.5 py-1 rounded">
            Tizim Admini (Phase 7)
          </span>
          <h1 className="text-2xl font-bold text-[#1A1F24] mt-1">Foydalanuvchilar, Роллар va RBAC/ABAC Maʼmurlash</h1>
          <p className="text-xs text-[#5A646D]">
            10 ta foydalanuvchi roli boʻyicha huquqlar matritsasi, 84 oʻrmon xoʻjaligi ierarxiyasi va cs.egov.uz 14 klassifikatori.
          </p>
        </div>
        <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
          Yangi Foydalanuvchi Qoʻshish
        </Button>
      </div>

      {/* Admin Tabs */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs">
        <Tabs
          tabs={[
            { id: 'roles', label: '10 ta Tizim Rollari (RBAC/ABAC)', count: 10 },
            { id: 'orgs', label: '84 ta Oʻrmon Xoʻjaligi Ierarxiyasi', count: 84 },
            { id: 'classifiers', label: 'cs.egov.uz 14 ta Klassifikator', count: 14 },
          ]}
          activeTabId={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roles.map((r, idx) => (
          <div key={idx} className="bg-white border border-[#E4E7EA] p-5 rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-[#1A1F24] flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#2E7D4F]" /> {r.name}
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#F0F7F1] text-[#2E7D4F] border border-[#D9EBDC]">
                {r.access}
              </span>
            </div>
            <p className="text-xs text-[#5A646D]">{r.scope}</p>
            <div className="pt-2 border-t border-[#E4E7EA] flex justify-between text-xs text-[#767F87] font-mono">
              <span>Faol foydalanuvchilar: <b>{r.usersCount}</b></span>
              <button className="text-[#2E7D4F] font-bold hover:underline">Huquqlarni Sozlash</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
