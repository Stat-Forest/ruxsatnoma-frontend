import React, { useState } from 'react';
import {
  Layers,
  Edit3,
  Square,
  Ruler,
  Upload,
  Plus,
  Compass,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/FormControls';
import { DataTable, type Column } from '../../components/ui/DataTable';

export interface GisEditorPageProps {
  onNavigate?: (page: string, params?: any) => void;
}

interface ContourItem {
  id: string;
  name: string;
  leskhoz: string;
  areaHa: number;
  maxSB: number; // Maximum livestock capacity
  currentSB: number; // Currently used
  layer: string;
  status: 'published' | 'review' | 'draft' | 'archived';
  lastUpdated: string;
}

export const GisEditorPage: React.FC<GisEditorPageProps> = ({ onNavigate }) => {
  const [activeTool, setActiveTool] = useState<'select' | 'polygon' | 'measure' | 'vertex'>('select');

  // 13 GIS Layers List
  const gisLayers = [
    { id: 'grazing', name: 'Yaylov konturlari', count: 142, visible: true, color: '#2E7D4F' },
    { id: 'haymaking', name: 'Pichan oʻrish maydonlari', count: 58, visible: true, color: '#B45309' },
    { id: 'protected', name: 'Qoʻriqxona hududlari', count: 12, visible: true, color: '#B91C1C' },
    { id: 'leskhoz_bounds', name: 'Oʻrmon xoʻjaligi chegaralari', count: 84, visible: true, color: '#0369A1' },
    { id: 'water_bodies', name: 'Suv obʼyektlari va daryolar', count: 34, visible: false, color: '#0284C7' },
    { id: 'roads', name: 'Oʻrmon yoʻllari va yoʻlaklar', count: 110, visible: false, color: '#767F87' },
    { id: 'erosion', name: 'Eroziya xavfi zonasi', count: 19, visible: false, color: '#D97706' },
  ];

  const contoursList: ContourItem[] = [
    { id: 'K-042', name: 'Kontur №42 (Chorva boqish)', leskhoz: 'Burchmulla oʻrmon xoʻjaligi', areaHa: 450, maxSB: 500, currentSB: 120, layer: 'Yaylov konturlari', status: 'published', lastUpdated: '10.08.2026' },
    { id: 'K-015', name: 'Kontur №15 (Pichangoh)', leskhoz: 'Zomin davlat qoʻriqxonasi', areaHa: 180, maxSB: 200, currentSB: 180, layer: 'Pichan oʻrish maydonlari', status: 'published', lastUpdated: '08.08.2026' },
    { id: 'K-088', name: 'Kontur №88 (Yangi chegara)', leskhoz: 'Kitob baland togʻ boʻlimi', areaHa: 320, maxSB: 350, currentSB: 0, layer: 'Yaylov konturlari', status: 'review', lastUpdated: '05.08.2026' },
    { id: 'K-099', name: 'Kontur №99 (Qoralama)', leskhoz: 'Pop oʻrmon boʻlimi', areaHa: 95, maxSB: 100, currentSB: 0, layer: 'Yaylov konturlari', status: 'draft', lastUpdated: '01.08.2026' },
  ];

  const columns: Column<ContourItem>[] = [
    { key: 'id', header: 'Kontur ID', sortable: true, width: '100px' },
    { key: 'name', header: 'Nomi va Qatlami', sortable: true },
    { key: 'leskhoz', header: 'Oʻrmon xoʻjaligi', sortable: true },
    { key: 'areaHa', header: 'Maydon (ga)', sortable: true, width: '110px' },
    {
      key: 'maxSB',
      header: 'Sigʻim (MaxSB / Ishlatilgan)',
      sortable: true,
      width: '180px',
      accessor: (row) => (
        <span className="font-mono text-xs">
          <b>{row.currentSB}</b> / {row.maxSB} bosh
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      width: '130px',
      accessor: (row) => (
        <span
          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
            row.status === 'published'
              ? 'bg-[#F0F7F1] text-[#2E7D4F] border border-[#D9EBDC]'
              : row.status === 'review'
              ? 'bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD]'
              : 'bg-[#F8F9FA] text-[#767F87] border border-[#E4E7EA]'
          }`}
        >
          {row.status.toUpperCase()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8 font-sans">
      {/* Top Header */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#2E7D4F] bg-[#F0F7F1] px-2.5 py-1 rounded">
            GIS Subtizimi (Phase 3)
          </span>
          <h1 className="text-2xl font-bold text-[#1A1F24] mt-1">GIS Xarita Muharriri va Konturlar Muhiti</h1>
          <p className="text-xs text-[#5A646D]">
            Oʻrmon zonasi poligonlarini chizish, 13 ta GIS qatlamini boshqarish va topologik konfliktlarni tahlil qilish.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Upload className="w-4 h-4" />}
            onClick={() => onNavigate?.('gis_import')}
          >
            Fayl Import (GeoJSON/SHP)
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setActiveTool('polygon')}
          >
            Yangi Kontur Chizish
          </Button>
        </div>
      </div>

      {/* Main Interactive Map Section */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[550px]">
        {/* Left Toolbar & Layers Selector */}
        <div className="lg:col-span-3 border-r border-[#E4E7EA] p-4 space-y-6 bg-[#F8F9FA]">
          {/* Drawing Tools */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#767F87] block">Xarita Asboblari</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setActiveTool('select')}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors ${
                  activeTool === 'select'
                    ? 'bg-[#2E7D4F] text-white border-[#2E7D4F]'
                    : 'bg-white text-[#1A1F24] border-[#E4E7EA] hover:bg-gray-50'
                }`}
              >
                <Compass className="w-4 h-4" /> Tanlash
              </button>
              <button
                onClick={() => setActiveTool('polygon')}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors ${
                  activeTool === 'polygon'
                    ? 'bg-[#2E7D4F] text-white border-[#2E7D4F]'
                    : 'bg-white text-[#1A1F24] border-[#E4E7EA] hover:bg-gray-50'
                }`}
              >
                <Square className="w-4 h-4" /> Poligon
              </button>
              <button
                onClick={() => setActiveTool('measure')}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors ${
                  activeTool === 'measure'
                    ? 'bg-[#2E7D4F] text-white border-[#2E7D4F]'
                    : 'bg-white text-[#1A1F24] border-[#E4E7EA] hover:bg-gray-50'
                }`}
              >
                <Ruler className="w-4 h-4" /> Masofa
              </button>
              <button
                onClick={() => setActiveTool('vertex')}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors ${
                  activeTool === 'vertex'
                    ? 'bg-[#2E7D4F] text-white border-[#2E7D4F]'
                    : 'bg-white text-[#1A1F24] border-[#E4E7EA] hover:bg-gray-50'
                }`}
              >
                <Edit3 className="w-4 h-4" /> Tahrir
              </button>
            </div>
          </div>

          {/* GIS Layers Switcher List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#767F87]">GIS Qatlamlar (13 ta)</span>
              <Layers className="w-4 h-4 text-[#2E7D4F]" />
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {gisLayers.map((l) => (
                <label
                  key={l.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#E4E7EA] text-xs cursor-pointer hover:border-[#7FB98A]"
                >
                  <div className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked={l.visible} className="accent-[#2E7D4F]" />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                    <span className="font-semibold text-[#1A1F24]">{l.name}</span>
                  </div>
                  <span className="font-mono text-[11px] text-[#767F87]">{l.count}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Coordinate Projection System */}
          <div className="pt-2 border-t border-[#E4E7EA] space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#767F87] block">Koordinatalar Tizimi</span>
            <Select
              options={[
                { value: 'epsg4326', label: 'EPSG:4326 - WGS 84 (Gradus)' },
                { value: 'epsg3857', label: 'EPSG:3857 - Web Mercator (Metr)' },
              ]}
              touchSize
            />
          </div>
        </div>

        {/* Right Canvas Map Simulation */}
        <div className="lg:col-span-9 relative bg-[#E5E9EC] flex flex-col justify-between p-6 overflow-hidden">
          {/* Top Canvas Controls Bar */}
          <div className="relative z-10 flex items-center justify-between gap-4 bg-white/90 backdrop-blur-md p-3 rounded-xl border border-white/40 shadow-xs text-xs">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded bg-[#2E7D4F] text-white font-bold text-[11px]">MODE: {activeTool.toUpperCase()}</span>
              <span className="text-[#5A646D] hidden sm:inline">Markaz: 41.6028° N, 70.0245° E (Burchmulla)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#15803D] font-bold bg-[#F0F7F1] px-2 py-1 rounded border border-[#D9EBDC]">
                Topologiya: 0% Kesishuv (Valid)
              </span>
            </div>
          </div>

          {/* Simulated Map Canvas Graphics */}
          <div className="my-auto py-12 flex flex-col items-center justify-center relative">
            {/* Vector Polygon Visual Simulations */}
            <div className="relative w-full max-w-lg h-72 border-2 border-dashed border-[#2E7D4F] bg-[#2E7D4F]/15 rounded-3xl p-6 flex flex-col justify-between shadow-inner animate-pulse">
              <div className="flex justify-between items-start">
                <span className="bg-[#2E7D4F] text-white font-mono font-bold text-xs px-2 py-1 rounded shadow-xs">
                  KONTUR №42 (450 ga)
                </span>
                <span className="bg-white text-[#123522] font-mono text-xs px-2 py-1 rounded border border-[#E4E7EA] font-semibold">
                  Yaylov Zonasi
                </span>
              </div>

              <div className="text-center space-y-1 bg-white/80 backdrop-blur-md p-3 rounded-xl border border-white/60 max-w-xs mx-auto">
                <div className="text-xs font-bold text-[#1A1F24]">Geobotanik Normalar (MaxSB)</div>
                <div className="text-sm font-mono font-bold text-[#2E7D4F]">500 Bosh Usta Birlik</div>
                <div className="text-[11px] text-[#5A646D]">Erkin sigʻim qoldigʻi: 380 bosh</div>
              </div>

              <div className="flex justify-between text-[11px] font-mono text-[#5A646D] bg-white/60 p-2 rounded-lg">
                <span>N: 41.6028°</span>
                <span>E: 70.0245°</span>
                <span>Perimetr: 8.4 km</span>
              </div>
            </div>
          </div>

          {/* Bottom Coordinates & Scale Bar */}
          <div className="relative z-10 flex items-center justify-between text-xs text-[#5A646D] bg-white/90 backdrop-blur-md p-2.5 rounded-xl border border-white/40 shadow-xs font-mono">
            <div>Masshtab: 1 : 10,000 | Z-Index: 12</div>
            <div>Oʻrmon Xoʻjaligi Davlat Cadastre Sync: FAOL</div>
          </div>
        </div>
      </div>

      {/* Contours Lifecycle Registry Table */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#1A1F24]">Oʻrmon Konturlari Hayotiy Sikli Reestri</h2>
            <p className="text-xs text-[#5A646D]">Draft → Review → Approved → Published → Archived statustagi konturlar</p>
          </div>
        </div>

        <DataTable columns={columns} data={contoursList} selectable />
      </div>
    </div>
  );
};
