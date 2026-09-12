import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, MapPinOff, Search } from 'lucide-react';
import { Input, Select } from '../../../components/ui/FormControls';
import { Button } from '../../../components/ui/button';
import { getContourCard, listContours, listOrganizations } from '../api';
import { formatUnit, pickName } from '../format';
import { ContourMapPreview, type PickedContour } from './ContourMapPreview';
import { useLanguage, useT } from '../../../i18n/useT';

/**
 * Takes the map's place — same footprint, so the layout does not jump —
 * whenever nothing here COULD have a map: the leshoz filter is pinned to an
 * organization with `gis_enabled === false` (decision #178), or the picked
 * contour itself carries no geometry. A blank basemap with nothing drawn on
 * it would read as a broken map, not an absent one — T12's own charge is
 * that the absence must look deliberate.
 */
function NoMapNotice({ t }: { t: (key: string) => string }) {
  return (
    <div
      data-testid="no-map-notice"
      className="w-full h-80 lg:h-[560px] rounded-xl border border-dashed border-[#D9EBDC] bg-[#F7FAF7] flex flex-col items-center justify-center gap-2 px-6 text-center"
    >
      <MapPinOff className="w-8 h-8 text-[#8FA396]" aria-hidden="true" />
      <p className="text-sm font-semibold text-[#3D4B41]">{t('wizard.step2.noMapTitle')}</p>
      <p className="text-xs text-[#5A646D] max-w-xs">{t('wizard.step2.noMapHint')}</p>
    </div>
  );
}

// Re-exported under its original home so `ApplicationWizardPage.tsx`'s
// `import { ContourPicker, type PickedContour } from './ContourPicker'` needs
// no change — the type itself now lives in `ContourMapPreview.tsx`, which
// this file already depends on, rather than the other way around.
export type { PickedContour };

/**
 * Lets the applicant PICK a published contour — drawing and editing geometry
 * stay out of scope. Two ways in, one selection between them: the map draws
 * every published contour in view (`GET /gis/contours/features`, decision
 * #68) and a click picks one, while the searchable list beside it is the
 * lookup for someone who already knows a contour number — narrowed further
 * by a leshoz filter (T2, demo remark 2026-09-10) for someone who knows the
 * other thing an applicant is far more likely to know than a contour number.
 *
 * The map used to be neither of those. Until that endpoint existed nothing
 * returned geometry in bulk — `GET /gis/contours` carries attributes only
 * (`ContourListItem`'s own docstring) — so it could draw only the parcel the
 * list had already chosen, and the list was the sole way to find anything.
 * That is why it was the narrow column; it is the wide one now.
 *
 * Selection IS the click (T2): there used to be a two-step "preview, then
 * press Select" flow, which the demo review called out as an extra click for
 * no reason — clicking a parcel, on the map or in the list, commits it
 * immediately, in both places, and clicking the very one already selected
 * again clears it to browse. `value`/`onChange` keep their original shape
 * either way: this component reports a pick through `onChange` the same way
 * it always did, it just no longer waits for a second click to do it.
 */
export function ContourPicker({ value, onChange }: { value: PickedContour | null; onChange: (c: PickedContour) => void }) {
  const t = useT();
  const { lang } = useLanguage();
  const [search, setSearch] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(value?.id ?? null);
  const [page, setPage] = useState(1);
  // Mirrors `ContourMapPreview`'s own fullscreen state (it owns the actual
  // MapLibre control and fires this back through `onFullscreenChange`) so
  // THIS layout — the leshoz filter, the search box, the list — can grow to
  // fill the screen alongside the map instead of being left behind on the
  // page underneath it.
  const [isFullscreen, setIsFullscreen] = useState(false);
  // The fullscreen TARGET: this whole grid (list column + map column), not
  // just the map's own div. Handed to `ContourMapPreview` as
  // `fullscreenTarget` — its button still renders on the map's own corner,
  // but pressing it expands this ancestor, so every control below stays
  // usable in full screen (T2, demo remark 3: "full screen is not a
  // degraded map").
  const shellRef = useRef<HTMLDivElement>(null);

  const organizationsQuery = useQuery({ queryKey: ['organizations'], queryFn: listOrganizations });
  const orgNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const org of organizationsQuery.data ?? []) map.set(org.id, pickName(org.name, lang) || org.code);
    return map;
  }, [organizationsQuery.data, lang]);
  // Leshoz-kind organizations only — `listOrganizations()` flattens the whole
  // tree (the agency root plus its leshozes, per its own docstring), and the
  // root itself is not something a contour is ever filed under.
  const leshozOptions = useMemo(() => {
    const leshozes = (organizationsQuery.data ?? []).filter((org) => org.kind === 'leshoz');
    return [
      { value: '', label: t('wizard.step2.allLeshozes') },
      ...leshozes.map((org) => ({ value: org.id, label: pickName(org.name, lang) || org.code })),
    ];
  }, [organizationsQuery.data, lang, t]);

  // `OrganizationOut.gis_enabled` (decision #178) — `!== false` defaults an
  // organization this browser has not loaded yet (or a row from before the
  // field existed) to "has a map", the same direction `ContourMapPreview`'s
  // own absence-vs-broken distinction already leans: showing a map that
  // turns out empty is recoverable, hiding one that exists is not.
  const orgHasGis = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const org of organizationsQuery.data ?? []) map.set(org.id, org.gis_enabled !== false);
    return map;
  }, [organizationsQuery.data]);

  // The leshoz filter itself is pinned to an org with no GIS layer — every
  // contour it could ever list is geometry-less, so the map column never
  // has anything to draw and is replaced outright (also skips the
  // now-pointless `listContourFeatures` fetch `ContourMapPreview` would
  // otherwise make for an always-empty viewport).
  const filteredLeshozHasNoGis = organizationId !== '' && orgHasGis.get(organizationId) === false;

  // Server-side, not client-side: `GET /gis/contours` already accepts
  // `organization_id` (`listContours`'s own params, generated from the
  // backend's `list_contours_api_v1_gis_contours_get` operation) — the exact
  // filter this picker needed already existed, unused. Filtering client-side
  // over one fetched page would also have been WRONG once a leshoz has more
  // contours than a page holds: the count and "load more" would silently
  // stop matching what the filter promised.
  const contoursQuery = useQuery({
    queryKey: ['contours', page, organizationId],
    queryFn: () => listContours({ page, page_size: 100, organization_id: organizationId || undefined }),
  });

  const filtered = useMemo(() => {
    const items = contoursQuery.data?.items ?? [];
    if (!search.trim()) return items;
    const needle = search.trim().toLowerCase();
    return items.filter((c) => c.number.toLowerCase().includes(needle));
  }, [contoursQuery.data, search]);

  const previewQuery = useQuery({
    queryKey: ['contour-card', selectedId],
    queryFn: () => getContourCard(selectedId!),
    enabled: !!selectedId,
  });

  const total = contoursQuery.data?.total ?? 0;
  const hasMore = page * 100 < total;

  function handleOrganizationChange(id: string) {
    setOrganizationId(id);
    // A leshoz change is a new result set, not a continuation of the old
    // one's pages — staying on page 3 of a filter that now has one page
    // would show nothing and look broken rather than filtered.
    setPage(1);
  }

  // The one place a pick becomes an actual selection — from a list row's
  // click or the map's, alike, both funnelled here (`onPick` below). `null`
  // means "toggle off, go back to browsing" (clicking the already-selected
  // parcel again): it clears the LOCAL preview only. It is never reported
  // upward through `onChange`, which has no way to say "nothing is picked
  // any more" — that callback's shape is `ApplicationWizardPage.tsx`'s own
  // contract, unchanged by T2, so an actual pick is the only thing this ever
  // sends it.
  function handlePick(contour: PickedContour | null) {
    if (!contour) {
      setSelectedId(null);
      return;
    }
    setSelectedId(contour.id);
    onChange(contour);
  }

  // A CONSTANT className on the fullscreen TARGET, on purpose: MapLibre
  // expands this grid by toggling `maplibregl-pseudo-fullscreen` on it
  // imperatively and only then fires the event that sets `isFullscreen`.
  // Were this className to depend on that state, React's re-render would
  // rewrite the `class` attribute wholesale and drop MapLibre's class —
  // a "shrink" button over a map still sitting in its card (the dev
  // stand, 2026-09-13). The full-screen look is keyed on MapLibre's own
  // class via `[&.maplibregl-pseudo-fullscreen]:` instead; the CHILDREN
  // below may still read `isFullscreen`, MapLibre never touches them.
  return (
    <div
      ref={shellRef}
      className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start [&.maplibregl-pseudo-fullscreen]:items-stretch [&.maplibregl-pseudo-fullscreen]:bg-white [&.maplibregl-pseudo-fullscreen]:p-4"
    >
      <div
        className={`bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs space-y-3 ${
          isFullscreen ? 'h-full overflow-y-auto' : ''
        }`}
      >
        <label className="block space-y-1 text-xs">
          <span className="text-[#5A646D] font-semibold">{t('wizard.step2.leshozLabel')}</span>
          <Select
            value={organizationId}
            onChange={(e) => handleOrganizationChange(e.target.value)}
            options={leshozOptions}
          />
        </label>
        <Input
          leftIcon={<Search className="w-4 h-4" />}
          placeholder={t('wizard.step2.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div
          className={`overflow-y-auto divide-y divide-[#E4E7EA] border border-[#E4E7EA] rounded-xl ${
            isFullscreen ? 'max-h-[60vh]' : 'max-h-80'
          }`}
        >
          {contoursQuery.isLoading && <p className="p-4 text-xs text-[#5A646D]">{t('wizard.step2.loading')}</p>}
          {!contoursQuery.isLoading && filtered.length === 0 && (
            <p className="p-4 text-xs text-[#5A646D]">{t('wizard.step2.notFound')}</p>
          )}
          {filtered.map((c) => {
            const isSelected = selectedId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => handlePick(isSelected ? null : { id: c.id, number: c.number, areaHa: c.area_ha })}
                aria-pressed={isSelected}
                data-testid={`contour-row-${c.id}`}
                // A click SELECTS (T2) — there is no separate confirm button
                // any more, so the highlight has to carry the whole weight of
                // "this is the one you picked": a filled background, a solid
                // left border in the same green as the map's selected fill,
                // and the badge below rather than a lone checkmark easy to
                // miss next to the area figure.
                className={`w-full text-left p-3 flex items-center justify-between gap-3 transition-colors cursor-pointer border-l-4 ${
                  isSelected ? 'bg-[#F0F7F1] border-l-[#2E7D4F]' : 'border-l-transparent hover:bg-[#F8F9FA]'
                }`}
              >
                <div>
                  <span
                    className={`font-mono text-sm block ${isSelected ? 'font-extrabold text-[#123522]' : 'font-bold text-[#1A1F24]'}`}
                  >
                    {c.number}
                  </span>
                  <span className="text-[11px] text-[#5A646D]">{orgNameById.get(c.organization_id) ?? c.organization_id}</span>
                </div>
                <div className="text-right text-xs">
                  <span className="font-mono font-semibold text-[#1A1F24] block">
                    {c.area_ha ?? '—'} {formatUnit('ha', t, lang)}
                  </span>
                  {isSelected && (
                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold uppercase text-[#2E7D4F]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {t('wizard.step2.selectedBadge')}
                    </span>
                  )}
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
          </div>
        )}
      </div>

      <div className={isFullscreen ? 'h-full' : ''}>
        {filteredLeshozHasNoGis ? (
          <NoMapNotice t={t} />
        ) : (
          <ContourMapPreview
            geometry={previewQuery.data?.geometry ?? null}
            selectedId={selectedId}
            // Selection is one value shared by the list and the map, so picking
            // a parcel on either shows it on both. `null` arrives when the map
            // clears it — clicking the highlighted parcel a second time — and
            // puts every contour in view back on screen.
            onPick={handlePick}
            organizationId={organizationId || null}
            fullscreenTarget={shellRef}
            onFullscreenChange={setIsFullscreen}
          />
        )}
      </div>
    </div>
  );
}
