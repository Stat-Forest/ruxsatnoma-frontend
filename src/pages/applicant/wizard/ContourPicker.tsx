import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Search } from 'lucide-react';
import { Input } from '../../../components/ui/FormControls';
import { Button } from '../../../components/ui/button';
import { getContourCard, listContours, listOrganizations } from '../api';
import { formatUnit, pickName } from '../format';
import { ContourMapPreview } from './ContourMapPreview';
import { useLanguage, useT } from '../../../i18n/useT';

export interface PickedContour {
  id: string;
  number: string;
  areaHa: string | null;
}

/**
 * Lets the applicant PICK a published contour — drawing and editing geometry
 * stay out of scope. Two ways in, one selection between them: the map draws
 * every published contour in view (`GET /gis/contours/features`, decision
 * #68) and a click picks one, while the searchable list beside it is the
 * lookup for someone who already knows a contour number.
 *
 * The map used to be neither of those. Until that endpoint existed nothing
 * returned geometry in bulk — `GET /gis/contours` carries attributes only
 * (`ContourListItem`'s own docstring) — so it could draw only the parcel the
 * list had already chosen, and the list was the sole way to find anything.
 * That is why it was the narrow column; it is the wide one now.
 */
export function ContourPicker({ value, onChange }: { value: PickedContour | null; onChange: (c: PickedContour) => void }) {
  const t = useT();
  const { lang } = useLanguage();
  const [search, setSearch] = useState('');
  const [highlightedId, setHighlightedId] = useState<string | null>(value?.id ?? null);
  const [page, setPage] = useState(1);

  const organizationsQuery = useQuery({ queryKey: ['organizations'], queryFn: listOrganizations });
  const orgNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const org of organizationsQuery.data ?? []) map.set(org.id, pickName(org.name, lang) || org.code);
    return map;
  }, [organizationsQuery.data, lang]);

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

  // The map is the WIDE column now, not the narrow one. It stopped being a
  // thumbnail of an already-made choice the day it started drawing every
  // parcel in view: finding a plot happens on the map, and the list beside
  // it is the lookup for someone who already knows a contour number. The
  // selected contour's card sits under the LIST for the same reason — it
  // belongs with the choosing, and stretched across a wide map column it
  // would be a line of text with half a screen of white space after it.
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs space-y-3">
        <Input
          leftIcon={<Search className="w-4 h-4" />}
          placeholder={t('wizard.step2.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="max-h-80 overflow-y-auto divide-y divide-[#E4E7EA] border border-[#E4E7EA] rounded-xl">
          {contoursQuery.isLoading && <p className="p-4 text-xs text-[#5A646D]">{t('wizard.step2.loading')}</p>}
          {!contoursQuery.isLoading && filtered.length === 0 && (
            <p className="p-4 text-xs text-[#5A646D]">{t('wizard.step2.notFound')}</p>
          )}
          {filtered.map((c) => {
            const isSelected = value?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setHighlightedId((current) => (current === c.id ? null : c.id))}
                className={`w-full text-left p-3 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                  highlightedId === c.id ? 'bg-[#F0F7F1]' : 'hover:bg-[#F8F9FA]'
                }`}
              >
                <div>
                  <span className="font-mono text-sm font-bold text-[#1A1F24] block">{c.number}</span>
                  <span className="text-[11px] text-[#5A646D]">{orgNameById.get(c.organization_id) ?? c.organization_id}</span>
                </div>
                <div className="text-right text-xs">
                  <span className="font-mono font-semibold text-[#1A1F24] block">{c.area_ha ?? '—'} {formatUnit('ha', t, lang)}</span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-[#2E7D4F] inline-block mt-1" />}
                </div>
              </button>
            );
          })}
        </div>
        {hasMore && (
          <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} className="cursor-pointer">
            {t('wizard.step2.loadMore')}
          </Button>
        )}
        {previewQuery.data && (
          <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs space-y-2 text-xs">
            <div className="font-mono text-lg font-bold text-[#1A1F24]">{previewQuery.data.number}</div>
            <dl className="grid grid-cols-2 gap-y-1">
              <dt className="text-[#5A646D]">{t('wizard.step2.totalArea')}</dt>
              <dd className="text-right font-mono font-semibold">{previewQuery.data.area_ha ?? '—'} {formatUnit('ha', t, lang)}</dd>
              <dt className="text-[#5A646D]">{t('wizard.step2.occupiedArea')}</dt>
              <dd className="text-right font-mono">{previewQuery.data.occupied_ha} {formatUnit('ha', t, lang)}</dd>
              <dt className="text-[#5A646D]">{t('wizard.step2.freeArea')}</dt>
              <dd className="text-right font-mono font-semibold text-[#123522]">{previewQuery.data.s_available_ha ?? '—'} {formatUnit('ha', t, lang)}</dd>
            </dl>
            {previewQuery.data.over_allocated && (
              <p className="text-[11px] text-[#B91C1C] bg-[#FEF2F2] border border-[#FCA5A5] rounded p-2 font-semibold">
                {t('wizard.step2.overAllocated')}
              </p>
            )}
            {previewQuery.data.occupancy_source !== 'measured' && (
              <p className="text-[11px] text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] rounded p-2">
                {t('wizard.step2.notMeasured')}
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
              {t('wizard.step2.selectThisContour')}
            </Button>
          </div>
        )}
      </div>

      <div>
        <ContourMapPreview
          geometry={previewQuery.data?.geometry ?? null}
          selectedId={highlightedId}
          // Selection is one value shared by the list and the map, so picking
          // a parcel on either shows it on both. `null` arrives when the map
          // clears it — clicking the highlighted parcel a second time — and
          // puts every contour in view back on screen.
          onPick={setHighlightedId}
        />
      </div>
    </div>
  );
}
