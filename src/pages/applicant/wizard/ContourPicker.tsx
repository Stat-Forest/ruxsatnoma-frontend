import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Search } from 'lucide-react';
import { Input } from '../../../components/ui/FormControls';
import { Button } from '../../../components/ui/button';
import { getContourCard, listContours, listOrganizations } from '../api';
import { pickName } from '../format';
import { ContourMapPreview } from './ContourMapPreview';

export interface PickedContour {
  id: string;
  number: string;
  areaHa: string | null;
}

/**
 * Lets the applicant PICK a published contour — drawing/editing stays out of
 * scope (task brief). The published layer is rendered with MapLibre GL JS
 * (decision #60.1), but `GET /gis/contours` carries attributes only, no
 * geometry (`ContourListItem`'s own docstring: "the card, not the list,
 * carries what a picker needs to actually render a plot") — there is no bulk
 * endpoint that would let this component draw all ~151 Burchmulla polygons
 * at once. So the searchable LIST below is the primary, reliable way to find
 * a plot, and the map is a real, live preview of whichever one is currently
 * selected (fetched via `GET /gis/contours/{id}` on selection) — not a
 * click-anywhere-on-the-map browser. A worse fallback (a static SVG instead
 * of MapLibre) was not needed: the list alone already carries the picking,
 * so the map could be built as a genuine preview without missing the
 * two-hour budget the task brief allows for it.
 */
export function ContourPicker({ value, onChange }: { value: PickedContour | null; onChange: (c: PickedContour) => void }) {
  const [search, setSearch] = useState('');
  const [highlightedId, setHighlightedId] = useState<string | null>(value?.id ?? null);
  const [page, setPage] = useState(1);

  const organizationsQuery = useQuery({ queryKey: ['organizations'], queryFn: listOrganizations });
  const orgNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const org of organizationsQuery.data ?? []) map.set(org.id, pickName(org.name) || org.code);
    return map;
  }, [organizationsQuery.data]);

  const contoursQuery = useQuery({
    queryKey: ['contours', page],
    queryFn: () => listContours({ page, page_size: 100 }),
  });

  const filtered = useMemo(() => {
    const items = contoursQuery.data?.items ?? [];
    if (!search.trim()) return items;
    const needle = search.trim().toLowerCase();
    return items.filter((c) => c.number.toLowerCase().includes(needle));
  }, [contoursQuery.data, search]);

  const previewQuery = useQuery({
    queryKey: ['contour-card', highlightedId],
    queryFn: () => getContourCard(highlightedId!),
    enabled: !!highlightedId,
  });

  const total = contoursQuery.data?.total ?? 0;
  const hasMore = page * 100 < total;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs space-y-3">
        <Input
          leftIcon={<Search className="w-4 h-4" />}
          placeholder="Kontur raqami boʻyicha qidirish..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="max-h-80 overflow-y-auto divide-y divide-[#E4E7EA] border border-[#E4E7EA] rounded-xl">
          {contoursQuery.isLoading && <p className="p-4 text-xs text-[#5A646D]">Yuklanmoqda...</p>}
          {!contoursQuery.isLoading && filtered.length === 0 && (
            <p className="p-4 text-xs text-[#5A646D]">Konturlar topilmadi.</p>
          )}
          {filtered.map((c) => {
            const isSelected = value?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setHighlightedId(c.id)}
                className={`w-full text-left p-3 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                  highlightedId === c.id ? 'bg-[#F0F7F1]' : 'hover:bg-[#F8F9FA]'
                }`}
              >
                <div>
                  <span className="font-mono text-sm font-bold text-[#1A1F24] block">{c.number}</span>
                  <span className="text-[11px] text-[#5A646D]">{orgNameById.get(c.organization_id) ?? c.organization_id}</span>
                </div>
                <div className="text-right text-xs">
                  <span className="font-mono font-semibold text-[#1A1F24] block">{c.area_ha ?? '—'} ga</span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-[#2E7D4F] inline-block mt-1" />}
                </div>
              </button>
            );
          })}
        </div>
        {hasMore && (
          <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} className="cursor-pointer">
            Yana yuklash
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <ContourMapPreview geometry={previewQuery.data?.geometry ?? null} />
        {previewQuery.data && (
          <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs space-y-2 text-xs">
            <div className="font-mono text-lg font-bold text-[#1A1F24]">{previewQuery.data.number}</div>
            <dl className="grid grid-cols-2 gap-y-1">
              <dt className="text-[#5A646D]">Umumiy maydon</dt>
              <dd className="text-right font-mono font-semibold">{previewQuery.data.area_ha ?? '—'} ga</dd>
              <dt className="text-[#5A646D]">Band qism</dt>
              <dd className="text-right font-mono">{previewQuery.data.occupied_ha} ga</dd>
              <dt className="text-[#5A646D]">Boʻsh qism</dt>
              <dd className="text-right font-mono font-semibold text-[#123522]">{previewQuery.data.s_available_ha ?? '—'} ga</dd>
            </dl>
            {previewQuery.data.occupancy_source !== 'measured' && (
              <p className="text-[11px] text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] rounded p-2">
                Bandlik hozircha oʻlchanmagan (occupancy_source: {previewQuery.data.occupancy_source}) — boʻsh maydon
                taxminiy koʻrsatilgan.
              </p>
            )}
            <Button
              variant="primary"
              size="sm"
              fullWidth
              onClick={() =>
                onChange({ id: previewQuery.data!.id, number: previewQuery.data!.number, areaHa: previewQuery.data!.area_ha })
              }
              className="cursor-pointer font-bold"
            >
              Ushbu konturni tanlash
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
