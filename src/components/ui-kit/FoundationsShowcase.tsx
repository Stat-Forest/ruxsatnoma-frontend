import React from 'react';
import {
  COLOR_TOKENS,
  SPACING_TOKENS,
  TYPOGRAPHY_TOKENS,
  FONT_WEIGHT_TOKENS,
  LAYOUT_SIZES,
  RADIUS_TOKENS,
  SUPPORTED_LANGUAGES,
  WCAG_CONTRAST_MATRIX,
  type ContrastRow,
} from '../../foundations/tokens';

import { ShieldCheck, Info } from 'lucide-react';

export const FoundationsShowcase: React.FC = () => {
  return (
    <div className="space-y-10">
      {/* 1. COLOR FOUNDATIONS */}
      <section className="bg-white border border-[#E4E7EA] rounded-xl p-6 shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-[#1A1F24]">1. Ranglar va Palitra (Color Tokens)</h2>
          <p className="text-sm text-[#5A646D] mt-1">
            Davlat oʻrmon xoʻjaligi ruxsatnomalar tizimi uchun belgilangan asosiy va semantik ranglar shkalasi (`colors.html`).
          </p>
        </div>

        {/* Primary Scale */}
        <div>
          <h3 className="text-xs font-semibold text-[#767F87] uppercase mb-3">Brend yashil ranglar shkalasi (Primary)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.entries(COLOR_TOKENS.primary).map(([step, hex]: [string, string]) => (
              <div key={step} className="border border-[#E4E7EA] rounded-lg overflow-hidden bg-white">
                <div
                  className="h-16 w-full flex items-end p-2 border-b border-[#E4E7EA]"
                  style={{ backgroundColor: hex }}
                >
                  <span className={`text-xs font-mono font-semibold ${Number(step) > 300 ? 'text-white' : 'text-[#123522]'}`}>
                    primary-{step}
                  </span>
                </div>
                <div className="p-2">
                  <span className="block text-xs font-mono text-[#5A646D]">{hex}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Neutral Scale */}
        <div className="pt-4 border-t border-[#E4E7EA]">
          <h3 className="text-xs font-semibold text-[#767F87] uppercase mb-3">Neytral ranglar shkalasi (Neutral Scale)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {Object.entries(COLOR_TOKENS.neutral).map(([step, hex]: [string, string]) => (
              <div key={step} className="border border-[#E4E7EA] rounded-lg overflow-hidden bg-white">
                <div
                  className="h-16 w-full flex items-end p-2 border-b border-[#E4E7EA]"
                  style={{ backgroundColor: hex }}
                >
                  <span className={`text-xs font-mono font-semibold ${Number(step) > 400 ? 'text-white' : 'text-[#1A1F24]'}`}>
                    neutral-{step}
                  </span>
                </div>
                <div className="p-2">
                  <span className="block text-xs font-mono text-[#5A646D]">{hex}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Semantic Scale */}
        <div className="pt-4 border-t border-[#E4E7EA]">
          <h3 className="text-xs font-semibold text-[#767F87] uppercase mb-3">Semantik ranglar (Semantic States)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(COLOR_TOKENS.semantic).map(([key, hex]: [string, string]) => (
              <div key={key} className="border border-[#E4E7EA] rounded-lg overflow-hidden bg-white">
                <div
                  className="h-16 w-full flex items-end p-2 border-b border-[#E4E7EA] text-white"
                  style={{ backgroundColor: hex }}
                >
                  <span className="text-xs font-mono font-semibold capitalize">{key}</span>
                </div>
                <div className="p-2">
                  <span className="block text-xs font-mono text-[#5A646D]">{hex}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* WCAG Contrast Ratio Table */}
        <div className="pt-4 border-t border-[#E4E7EA]">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-[#15803D]" />
            <h3 className="text-xs font-semibold text-[#767F87] uppercase">WCAG 2.2 AA Kontrast Natijalari Matrix</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8F9FA] border-b border-[#E4E7EA]">
                  <th className="p-2.5 font-semibold text-[#5A646D]">Rang juftligi</th>
                  <th className="p-2.5 font-semibold text-[#5A646D]">Kontrast nisbati</th>
                  <th className="p-2.5 font-semibold text-[#5A646D]">WCAG Darajasi</th>
                  <th className="p-2.5 font-semibold text-[#5A646D]">Qoʻllanish joyi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E7EA]">
                {WCAG_CONTRAST_MATRIX.map((row: ContrastRow, idx: number) => (
                  <tr key={idx} className="hover:bg-[#F8F9FA]">
                    <td className="p-2.5 font-mono text-[#1A1F24]">{row.pair}</td>
                    <td className="p-2.5 font-mono text-[#2E7D4F] font-semibold">{row.ratio}</td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#F0F7F1] text-[#2E7D4F] border border-[#D9EBDC]">
                        {row.status}
                      </span>
                    </td>
                    <td className="p-2.5 text-[#5A646D]">{row.usage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 2. SPACING & SIZING FOUNDATIONS */}
      <section className="bg-white border border-[#E4E7EA] rounded-xl p-6 shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-[#1A1F24]">2. Masofalar va Oʻlchamlar (Spacing & Sizing - `spacing.html`)</h2>
          <p className="text-sm text-[#5A646D] mt-1">
            Padding, margin, va layout oʻlchamlari uchun 8x/4x oʻlchov shkalasi.
          </p>
        </div>

        {/* Spacing Bars */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#767F87] uppercase mb-3">Spacing Scale Visual Bars</h3>
          {SPACING_TOKENS.map((sp: { token: string; value: string; usage: string }) => (
            <div key={sp.token} className="flex items-center gap-4 py-1.5 border-b border-[#E4E7EA] last:border-b-0">
              <span className="w-28 font-mono text-xs font-semibold text-[#1A1F24]">{sp.token} ({sp.value})</span>
              <div className="flex-1 flex items-center gap-3">
                <div
                  className="h-4 bg-[#2E7D4F] rounded-xs shrink-0"
                  style={{ width: sp.value }}
                />
                <span className="text-xs text-[#5A646D]">{sp.usage}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Layout Sizes Table */}
        <div className="pt-4 border-t border-[#E4E7EA]">
          <h3 className="text-xs font-semibold text-[#767F87] uppercase mb-3">Boshqaruv va Maket Oʻlchamlari (Layout Sizes)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {LAYOUT_SIZES.map((ls: { token: string; value: string; usage: string }) => (
              <div key={ls.token} className="border border-[#E4E7EA] p-3 rounded-lg bg-[#F8F9FA]">
                <div className="font-mono text-xs font-bold text-[#2E7D4F]">{ls.token}: {ls.value}</div>
                <div className="text-xs text-[#5A646D] mt-1">{ls.usage}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Border Radius Grid */}
        <div className="pt-4 border-t border-[#E4E7EA]">
          <h3 className="text-xs font-semibold text-[#767F87] uppercase mb-3">Border Radius Tokens</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {RADIUS_TOKENS.map((r: { token: string; value: string; usage: string }) => (
              <div key={r.token} className="border border-[#E4E7EA] p-4 rounded-lg bg-[#F8F9FA]">
                <div
                  className="h-16 w-full bg-[#D9EBDC] border border-[#7FB98A] mb-2 flex items-center justify-center font-mono text-xs font-bold text-[#123522]"
                  style={{ borderRadius: r.value }}
                >
                  {r.value}
                </div>
                <span className="block font-mono text-xs font-semibold text-[#1A1F24]">{r.token}</span>
                <span className="block text-xs text-[#5A646D] mt-1">{r.usage}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. TYPOGRAPHY FOUNDATIONS */}
      <section className="bg-white border border-[#E4E7EA] rounded-xl p-6 shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-[#1A1F24]">3. Tipografiya (Typography Scale - `typography.html`)</h2>
          <p className="text-sm text-[#5A646D] mt-1">
            Shriftlar oʻlchami, qator balandligi va 5 ta interfeys tili boʻyicha sinov namunalar.
          </p>
        </div>

        {/* Font Weight Note */}
        <div className="p-4 bg-[#F0F7F1] border-l-4 border-[#2E7D4F] rounded-r-md text-xs text-[#123522] space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <Info className="w-4 h-4 text-[#2E7D4F]" />
            Shrift Qalinliklari Eslatmasi (Font Weights):
          </div>
          <p>
            Dizayn sistemada 400 (Regular), 500 (Medium), va 600 (Semibold) ishlatiladi. **700 (Bold) ataylab chiqarib tashlangan** chunki Kirill yozuvlarida kichik oʻlchamlarda matn xiralashib qoladi.
          </p>
        </div>

        {/* Font Weights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {FONT_WEIGHT_TOKENS.map((fw: { weight: number; name: string; usage: string }) => (
            <div key={fw.weight} className="border border-[#E4E7EA] p-3 rounded-lg bg-[#F8F9FA]">
              <div className="text-sm font-semibold text-[#1A1F24]" style={{ fontWeight: fw.weight }}>
                Weight {fw.weight} ({fw.name})
              </div>
              <span className="text-xs text-[#5A646D]">{fw.usage}</span>
            </div>
          ))}
        </div>

        {/* Typography Scale */}
        <div className="pt-4 border-t border-[#E4E7EA] space-y-4 divide-y divide-[#E4E7EA]">
          {TYPOGRAPHY_TOKENS.map((t: { level: string; size: string; line: string; weight: string; usage: string }) => (
            <div key={t.level} className="pt-4 first:pt-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="w-48 shrink-0">
                <span className="font-mono text-xs font-semibold text-[#2E7D4F]">text-{t.level} ({t.size})</span>
                <span className="block text-xs text-[#5A646D]">Line-height: {t.line}</span>
                <span className="block text-xs text-[#5A646D]">Weight: {t.weight}</span>
              </div>
              <div className="flex-1">
                <p style={{ fontSize: t.size, lineHeight: t.line }} className="font-sans font-medium text-[#1A1F24]">
                  Oʻzbekiston Respublikasi Oʻrmon xoʻjaligi davlat qoʻmitasi — Ruxsatnoma
                </p>
                <span className="block text-xs text-[#767F87] mt-1">{t.usage}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Multi-language Support Test */}
        <div className="pt-4 border-t border-[#E4E7EA]">
          <h3 className="text-xs font-semibold text-[#767F87] uppercase mb-3">Tillar boʻyicha shrift koʻrinishi sinovi (5 ta interfeys tili)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {SUPPORTED_LANGUAGES.map((lang: { code: string; name: string; sample: string }) => (
              <div key={lang.code} className="border border-[#767F87] rounded-lg p-3 bg-white">
                <span className="text-xs font-bold text-[#2E7D4F] uppercase">{lang.name} ({lang.code})</span>
                <p className="text-sm font-medium text-[#1A1F24] mt-1 leading-snug">{lang.sample}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
