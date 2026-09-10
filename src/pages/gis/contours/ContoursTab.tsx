import { useMemo, useState } from 'react';
import { Loader2, MapPinOff, Plus, Scissors } from 'lucide-react';
import { useAuth } from '../../../auth/useAuth';
import { Button } from '../../../components/ui/button';
import { Alert } from '../../../components/ui/Feedback';
import { Input, Select } from '../../../components/ui/FormControls';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useLanguage } from '../../../i18n/useT';
import { translateTerm } from '../../../i18n/terms';
import { pickName, formatDecimal } from '../format';
import { getContoursLayerId, type VersionIn } from '../api';
import {
  useArchiveVersion,
  useContourCard,
  useContourFeatures,
  useContours,
  useCreateContour,
  useCreateVersion,
  useOrganizations,
} from '../queries';
import { activeRecalledVersion } from '../localVersions';
import { DrawMap } from './DrawMap';
import { VersionPanel } from './VersionPanel';
import { SplitPanel } from './SplitPanel';
import type { Geometry, LineString, MultiPolygon, Polygon } from 'geojson';

const CONTOURS_MANAGE = 'gis.contours.manage';
const CONTOURS_APPROVE = 'gis.contours.approve';

type WorkMode = 'browse' | 'draw-new' | 'edit-draft' | 'split';

/** The small form for the fields `VersionIn` needs beyond geometry itself —
 * shown once a shape has been drawn (a new contour's first version, or a
 * redraw of a held draft). Local to this file: it is a handful of fields
 * with no reuse elsewhere.
 *
 * `requireDeclaredArea` (T12, decision #178) is set whenever the owning
 * leshoz has no GIS layer: `geom` is never sent for such a version, and the
 * DB's own `geom_or_declared_area` CHECK then makes `declared_area_ha` the
 * ONLY area of record — the Save button stays disabled until it is filled,
 * catching that 422 here instead of round-tripping to the server for it. */
function VersionFieldsForm({
  initial,
  onSubmit,
  onCancel,
  isPending,
  requireDeclaredArea = false,
  t,
}: {
  // Loose on purpose: pre-fills from either a `VersionIn` about to be sent or
  // a `VersionOut` already on record (`source` is a free `string` on the OUT
  // side, the narrower enum on the IN side) — this form only ever READS these
  // fields into its own typed local state, never passes the object through.
  initial?: { source?: string; declared_area_ha?: string | number | null; survey_date?: string | null; effective_from?: string | null };
  onSubmit: (fields: Omit<VersionIn, 'geom'>) => void;
  onCancel: () => void;
  isPending: boolean;
  requireDeclaredArea?: boolean;
  t: (key: string) => string;
}) {
  const { lang } = useLanguage();
  const [source, setSource] = useState(initial?.source ?? 'survey');
  const [declaredAreaHa, setDeclaredAreaHa] = useState(initial?.declared_area_ha?.toString() ?? '');
  const [surveyDate, setSurveyDate] = useState(initial?.survey_date ?? '');
  const [effectiveFrom, setEffectiveFrom] = useState(initial?.effective_from ?? '');
  const canSubmit = !requireDeclaredArea || declaredAreaHa.trim() !== '';

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs space-y-3" data-testid="version-fields-form">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A646D]">
        {t('gis.contours.form.versionDetails')}
      </h3>
      {requireDeclaredArea && <Alert variant="info">{t('gis.contours.form.noGeometryHint')}</Alert>}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <label className="space-y-1">
          <span className="text-[#5A646D]">{t('gis.versions.source')}</span>
          <Select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            options={[
              { value: 'cadastre', label: translateTerm('cadastre', lang) },
              { value: 'survey', label: translateTerm('survey', lang) },
              { value: 'aerial', label: translateTerm('aerial', lang) },
              { value: 'gps', label: translateTerm('gps', lang) },
              { value: 'import', label: translateTerm('import', lang) },
            ]}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[#5A646D]">
            {t('gis.versions.declaredAreaHa')}
            {requireDeclaredArea ? ' *' : ''}
          </span>
          <Input
            type="number"
            step="0.0001"
            value={declaredAreaHa}
            onChange={(e) => setDeclaredAreaHa(e.target.value)}
            data-testid="version-declared-area-input"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[#5A646D]">{t('gis.versions.surveyDate')}</span>
          <Input type="date" value={surveyDate} onChange={(e) => setSurveyDate(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-[#5A646D]">{t('gis.versions.effectiveFrom')}</span>
          <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        </label>
      </div>
      {requireDeclaredArea && !canSubmit && (
        <p className="text-[11px] text-[#B45309]">{t('gis.contours.form.declaredAreaRequired')}</p>
      )}
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          isLoading={isPending}
          disabled={!canSubmit}
          className="cursor-pointer"
          onClick={() =>
            onSubmit({
              source: source as VersionIn['source'],
              declared_area_ha: declaredAreaHa ? declaredAreaHa : null,
              survey_date: surveyDate || null,
              effective_from: effectiveFrom || null,
            })
          }
        >
          {t('gis.contours.form.saveVersion')}
        </Button>
        <Button variant="outline" size="sm" className="cursor-pointer" onClick={onCancel}>
          {t('gis.contours.form.cancel')}
        </Button>
      </div>
    </div>
  );
}

/** Same footprint as `DrawMap`'s own default height, so swapping it out for
 * this notice does not jump the layout — takes the map's place for a
 * geometry-less contour (T12, decision #178: its leshoz has no GIS layer,
 * or this particular version was filed by requisites alone). A blank map
 * canvas with nothing on it would read as broken, not absent. */
function NoGisNotice({ t }: { t: (key: string) => string }) {
  return (
    <div
      data-testid="no-gis-notice"
      className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#D9EBDC] bg-[#F7FAF7] px-6 text-center"
      style={{ height: '420px' }}
    >
      <MapPinOff className="w-8 h-8 text-[#8FA396]" aria-hidden="true" />
      <p className="text-sm font-semibold text-[#3D4B41]">{t('gis.contours.noMapOrg')}</p>
      <p className="max-w-sm text-xs text-[#5A646D]">{t('gis.contours.noMapOrgHint')}</p>
    </div>
  );
}

function NewContourForm({
  organizations,
  onSubmit,
  onCancel,
  isPending,
  error,
  t,
}: {
  organizations: { id: string; label: string }[];
  onSubmit: (fields: { organization_id: string; number: string }) => void;
  onCancel: () => void;
  isPending: boolean;
  error: unknown;
  t: (key: string) => string;
}) {
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? '');
  const [number, setNumber] = useState('');
  const errorText = useApiErrorText();

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs space-y-3" data-testid="new-contour-form">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A646D]">
        {t('gis.contours.form.newContour')}
      </h3>
      <label className="block space-y-1 text-xs">
        <span className="text-[#5A646D]">{t('gis.contours.form.organization')}</span>
        <Select
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
          options={organizations.map((o) => ({ value: o.id, label: o.label }))}
        />
      </label>
      <label className="block space-y-1 text-xs">
        <span className="text-[#5A646D]">{t('gis.contours.form.number')}</span>
        <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="K-001" />
      </label>
      {error != null && <Alert variant="danger">{errorText(error, t('gis.contours.form.createFailed'))}</Alert>}
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={!organizationId || !number.trim()}
          isLoading={isPending}
          className="cursor-pointer"
          onClick={() => onSubmit({ organization_id: organizationId, number: number.trim() })}
        >
          {t('gis.contours.form.create')}
        </Button>
        <Button variant="outline" size="sm" className="cursor-pointer" onClick={onCancel}>
          {t('gis.contours.form.cancel')}
        </Button>
      </div>
    </div>
  );
}

/**
 * F1 — the contour map: browse published contours, draw a brand-new one's
 * first version, redraw a held draft as a new version (geometry is never
 * patched in place), and split. See `06.5-gis-screens.md` for the design
 * rulings this screen embodies, in particular ruling 2 (no backend route
 * lists a contour's non-published versions — the "held version" concept
 * below IS the workaround) and ruling 3 (split has no backend endpoint).
 */
export function ContoursTab({ t }: { t: (key: string) => string }) {
  const { me } = useAuth();
  const { lang } = useLanguage();
  const errorText = useApiErrorText();
  const canManage = !!me?.permissions.includes(CONTOURS_MANAGE) || !!me?.is_superuser;
  const canApprove = !!me?.permissions.includes(CONTOURS_APPROVE) || !!me?.is_superuser;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  // One leshoz, or `''` for all — narrows the list AND the map's browsable
  // layer together (both endpoints take the same `organization_id`), so the
  // two never show different sets of the same contours side by side.
  const [orgFilter, setOrgFilter] = useState('');
  const [selectedContourId, setSelectedContourId] = useState<string | null>(null);
  const [mode, setMode] = useState<WorkMode>('browse');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [drawnGeometry, setDrawnGeometry] = useState<Geometry | null>(null);
  const [bbox, setBbox] = useState<string | null>(null);
  const [pendingContourId, setPendingContourId] = useState<string | null>(null);
  // The number the operator typed into `NewContourForm`, echoed back by the
  // create response — kept only for `pendingContourId`'s own lifetime, so the
  // "your contour was created, now draw it" message below can name it. The
  // published-only list can never show this row (see `noVersionYet` below),
  // so this is the one place its number appears at all until it has a
  // version.
  const [pendingContourNumber, setPendingContourNumber] = useState<string | null>(null);
  // The organization the operator picked for a brand-new contour (T12) —
  // `cardQuery` is disabled for `pendingContourId` (see below), so this is
  // the only place `gisEnabled` below can learn its org before a card ever
  // exists for it.
  const [pendingOrgId, setPendingOrgId] = useState<string | null>(null);
  const [splitLine, setSplitLine] = useState<LineString | null>(null);
  // Bumped after a version mutation to force the panel to re-read the
  // localStorage cache (React state, not the cache itself, drives render).
  const [recallTick, setRecallTick] = useState(0);

  const contoursQuery = useContours({ page, page_size: 50, organization_id: orgFilter || undefined });
  const organizationsQuery = useOrganizations();
  // Skipped for the contour we ourselves just created and have not yet drawn
  // a version for: `contour_card` requires a published version (backend
  // `gis/service.py::contour_card`), and a brand-new contour has none by
  // construction — asking would only be a guaranteed, noisy 404.
  const cardQuery = useContourCard(selectedContourId, {
    enabled: selectedContourId !== pendingContourId,
  });
  const featuresQuery = useContourFeatures(bbox, orgFilter || undefined);
  const createContour = useCreateContour();
  const createVersion = useCreateVersion(pendingContourId ?? selectedContourId ?? '');
  const archivePublished = useArchiveVersion(selectedContourId ?? '');

  const orgOptions = useMemo(
    () => (organizationsQuery.data ?? []).map((o) => ({ id: o.id, label: pickName(o.name, lang) || o.code })),
    [organizationsQuery.data, lang],
  );
  const orgNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of orgOptions) map.set(o.id, o.label);
    return map;
  }, [orgOptions]);
  // `OrganizationOut.gis_enabled` (decision #178). `!== false` defaults an
  // org this browser has not loaded yet to "has a map" — the same direction
  // `ContourPicker`'s own copy of this lookup takes, for the same reason: a
  // map that turns out to have nothing to draw is recoverable, hiding one
  // that exists is not.
  const orgHasGis = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const o of organizationsQuery.data ?? []) map.set(o.id, o.gis_enabled !== false);
    return map;
  }, [organizationsQuery.data]);

  const filtered = useMemo(() => {
    const items = contoursQuery.data?.items ?? [];
    if (!search.trim()) return items;
    const needle = search.trim().toLowerCase();
    return items.filter((c) => c.number.toLowerCase().includes(needle));
  }, [contoursQuery.data, search]);

  // The org behind whichever contour is currently in play, from whichever
  // source actually has it yet: the published card first (it always carries
  // `organization_id`), the list row second (covers the gap before the card
  // has loaded), and — for a contour this operator just created themselves,
  // which `cardQuery` never fetches (see its own `enabled` below) —
  // `pendingOrgId`, the one place that organization is remembered at all
  // until a version gives the contour a card.
  const selectedOrgId =
    cardQuery.data?.organization_id ??
    filtered.find((c) => c.id === selectedContourId)?.organization_id ??
    (selectedContourId === pendingContourId ? pendingOrgId : null);
  const gisEnabled = selectedOrgId ? (orgHasGis.get(selectedOrgId) ?? true) : true;

  const held = selectedContourId ? activeRecalledVersion(selectedContourId) : undefined;
  // Re-read on every tick bump — see `recallTick` above.
  void recallTick;

  const knownGeometry: Geometry | null = held?.geometry ?? (cardQuery.data?.geometry as Geometry | undefined) ?? null;

  function selectContour(id: string) {
    setSelectedContourId(id);
    setMode('browse');
    setShowCreateForm(false);
    setDrawnGeometry(null);
    setSplitLine(null);
  }

  /** A click on a parcel drawn on the map — the same selection the list row
   * makes, with one difference: clicking the parcel that is already selected
   * clears the selection (the toggle `ContourPicker`'s map is built on),
   * because on a map there is no other control for "none". `DrawMap` only
   * fires this in browse mode, so no draw in progress is ever interrupted. */
  function pickContourOnMap(id: string) {
    if (id === selectedContourId) {
      setSelectedContourId(null);
      return;
    }
    selectContour(id);
  }

  async function handleCreateContour(fields: { organization_id: string; number: string }) {
    const layerId = await getContoursLayerId();
    if (!layerId) return;
    const contour = await createContour.mutateAsync({
      layer_id: layerId,
      organization_id: fields.organization_id,
      number: fields.number,
      kind: 'contour',
    });
    setShowCreateForm(false);
    setPendingContourId(contour.id);
    setPendingContourNumber(contour.number);
    setPendingOrgId(contour.organization_id);
    setSelectedContourId(contour.id);
    setMode('draw-new');
  }

  async function handleSaveVersion(fields: Omit<VersionIn, 'geom'>) {
    // A drawn shape is required UNLESS this org has no GIS layer at all
    // (T12, decision #178) — there, `geom` is never sent and
    // `declared_area_ha` (enforced required by `VersionFieldsForm` itself
    // via `requireDeclaredArea`) becomes the area of record instead.
    if (!drawnGeometry && gisEnabled) return;
    const contourId = pendingContourId ?? selectedContourId;
    if (!contourId) return;
    // `useCreateVersion(contourId)` above already records the result (with
    // this same geometry, or none) in `localVersions` on success.
    await createVersion.mutateAsync({
      ...fields,
      ...(drawnGeometry ? { geom: drawnGeometry as unknown as Record<string, unknown> } : {}),
    });
    setDrawnGeometry(null);
    setPendingContourId(null);
    setPendingContourNumber(null);
    setPendingOrgId(null);
    setMode('browse');
    setRecallTick((n) => n + 1);
  }

  const isDrawing = mode === 'draw-new' || mode === 'edit-draft';
  const total = contoursQuery.data?.total ?? 0;
  const hasMore = page * 50 < total;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 items-start">
        <div className="space-y-3">
          <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#1A1F24]">{t('gis.contours.listTitle')}</h2>
              {canManage && (
                <Button
                  size="sm"
                  variant="primary"
                  leftIcon={<Plus className="w-4 h-4" />}
                  className="cursor-pointer"
                  onClick={() => {
                    setShowCreateForm(true);
                    setSelectedContourId(null);
                    setMode('browse');
                  }}
                >
                  {t('gis.contours.newContour')}
                </Button>
              )}
            </div>
            <Select
              aria-label={t('gis.contours.filterOrganization')}
              data-testid="contour-org-filter"
              value={orgFilter}
              onChange={(e) => {
                setOrgFilter(e.target.value);
                // Page numbers belong to the previous filter's list; page 2
                // of a narrower one may not even exist.
                setPage(1);
              }}
              options={[{ value: '', label: t('gis.contours.allOrganizations') }, ...orgOptions.map((o) => ({ value: o.id, label: o.label }))]}
            />
            <Input
              placeholder={t('gis.contours.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-96 overflow-y-auto divide-y divide-[#E4E7EA] border border-[#E4E7EA] rounded-xl">
              {contoursQuery.isLoading && (
                <p className="p-4 text-xs text-[#5A646D]">
                  <Loader2 className="w-4 h-4 inline animate-spin mr-1" /> {t('gis.contours.loading')}
                </p>
              )}
              {contoursQuery.isError && (
                <Alert variant="danger">{errorText(contoursQuery.error, t('gis.contours.loadFailed'))}</Alert>
              )}
              {!contoursQuery.isLoading && filtered.length === 0 && (
                <p className="p-4 text-xs text-[#5A646D]">{t('gis.contours.empty')}</p>
              )}
              {filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectContour(c.id)}
                  data-testid={`contour-row-${c.id}`}
                  className={`w-full text-left p-3 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                    selectedContourId === c.id ? 'bg-[#F0F7F1]' : 'hover:bg-[#F8F9FA]'
                  }`}
                >
                  <div>
                    <span className="font-mono text-sm font-bold text-[#1A1F24] block">{c.number}</span>
                    <span className="text-[11px] text-[#5A646D]">{orgNameById.get(c.organization_id) ?? '—'}</span>
                  </div>
                  <div className="text-right text-xs font-mono">
                    <div>{formatDecimal(c.area_ha, 'ga')}</div>
                    <div className="text-[#5A646D]">{formatDecimal(c.s_available_ha, 'ga')} {t('gis.contours.available')}</div>
                  </div>
                </button>
              ))}
            </div>
            {hasMore && (
              <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setPage((p) => p + 1)}>
                {t('gis.contours.loadMore')}
              </Button>
            )}
          </div>

          {showCreateForm && (
            <NewContourForm
              organizations={orgOptions}
              onSubmit={handleCreateContour}
              onCancel={() => setShowCreateForm(false)}
              isPending={createContour.isPending}
              error={createContour.error}
              t={t}
            />
          )}

          {selectedContourId && !showCreateForm && (
            <>
              {cardQuery.isError && !held && (
                <Alert variant="warning">{t('gis.contours.noPublishedVersion')}</Alert>
              )}

              {cardQuery.data && (
                <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-lg font-bold text-[#1A1F24]">{cardQuery.data.number}</span>
                    <span className="rounded-full border border-[#D9EBDC] bg-[#F0F7F1] px-2 py-0.5 text-[10px] font-bold uppercase text-[#123522]">
                      {t('gis.versions.status.published')}
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-y-1">
                    <dt className="text-[#5A646D]">{t('gis.contours.totalArea')}</dt>
                    <dd className="text-right font-mono font-semibold">{formatDecimal(cardQuery.data.area_ha, 'ga')}</dd>
                    <dt className="text-[#5A646D]">{t('gis.contours.occupied')}</dt>
                    <dd className="text-right font-mono">{formatDecimal(cardQuery.data.occupied_ha, 'ga')}</dd>
                    <dt className="text-[#5A646D]">{t('gis.contours.available')}</dt>
                    <dd className="text-right font-mono font-semibold">{formatDecimal(cardQuery.data.s_available_ha, 'ga')}</dd>
                  </dl>
                  {/* F5 (`docs/plans/07.3-findings.md`): occupied > total is a
                      real, demo-witnessed state (`ContourListItem`'s own
                      docstring in `schema.d.ts`), not a display bug — the
                      backend already carries an explicit flag for it, which
                      this screen used to leave unrendered next to a "0 ga"
                      free area that otherwise looks like an arithmetic
                      error. */}
                  {cardQuery.data.over_allocated && (
                    <Alert variant="danger">{t('gis.contours.overAllocated')}</Alert>
                  )}
                  {/* Only shown when this browser holds no OTHER (unpublished)
                      version for the same contour — `VersionPanel` below
                      already offers Archive once a draft/review/approved
                      version has moved through to `published` in this same
                      session, and two archive buttons for the same action
                      would be confusing, not thorough. */}
                  {!held && canApprove && (
                    <Button
                      variant="danger"
                      size="sm"
                      isLoading={archivePublished.isPending}
                      className="cursor-pointer"
                      onClick={() => archivePublished.mutate(cardQuery.data!.version_id)}
                    >
                      {t('gis.versions.actions.archive')}
                    </Button>
                  )}
                  {archivePublished.isError && (
                    <Alert variant="danger">{errorText(archivePublished.error, t('gis.versions.actions.failed'))}</Alert>
                  )}
                </div>
              )}

              {held ? (
                <VersionPanel
                  contourId={selectedContourId}
                  version={held.version}
                  onVersionChange={() => setRecallTick((n) => n + 1)}
                  t={t}
                />
              ) : selectedContourId === pendingContourId ? (
                // The contour we just created ourselves — `cardQuery` is
                // disabled for it (see above), so this is not the 404
                // fallback below; it is the confirmation that create
                // actually worked, naming the one thing the operator cannot
                // see anywhere else on this screen: which contour they are
                // now drawing for. The map is already armed (`mode` was set
                // to `draw-new` on create) — no second "start drawing"
                // button here, or there would be two ways to do the same
                // thing on screen at once.
                <Alert variant="info">
                  {t('gis.contours.justCreatedPrefix')}{' '}
                  <span className="font-mono font-semibold">{pendingContourNumber}</span>.{' '}
                  {t('gis.contours.justCreatedHint')}
                </Alert>
              ) : (
                !cardQuery.data &&
                !cardQuery.isLoading &&
                canManage && (
                  <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs space-y-2">
                    <p className="text-xs text-[#5A646D]">{t('gis.contours.noVersionYet')}</p>
                    <Button
                      variant="primary"
                      size="sm"
                      className="cursor-pointer"
                      onClick={() => {
                        setPendingContourId(selectedContourId);
                        setMode('draw-new');
                      }}
                    >
                      {t('gis.contours.drawFirstVersion')}
                    </Button>
                  </div>
                )
              )}

              {held?.version.status === 'draft' && canManage && mode === 'browse' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => setMode('edit-draft')}
                >
                  {gisEnabled ? t('gis.contours.redraw') : t('gis.contours.reviseRequisites')}
                </Button>
              )}

              {knownGeometry && canManage && mode === 'browse' && (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Scissors className="w-4 h-4" />}
                  className="cursor-pointer"
                  onClick={() => setMode('split')}
                >
                  {t('gis.contours.split')}
                </Button>
              )}
            </>
          )}
        </div>

        <div className="space-y-3">
          {gisEnabled ? (
            <DrawMap
              geometryType={mode === 'split' ? 'LineString' : 'Polygon'}
              active={mode !== 'browse'}
              referenceGeometry={mode === 'edit-draft' || mode === 'split' ? knownGeometry : null}
              selectedGeometry={mode === 'browse' ? knownGeometry : null}
              browsableFeatures={featuresQuery.data as never}
              browsableLoading={featuresQuery.isFetching}
              onViewportChange={setBbox}
              onPickContour={pickContourOnMap}
              onDrawFinish={(geometry) => {
                if (mode === 'split') {
                  setSplitLine(geometry as LineString);
                  return;
                }
                setDrawnGeometry(geometry);
              }}
            />
          ) : (
            <NoGisNotice t={t} />
          )}

          {isDrawing && gisEnabled && !drawnGeometry && <Alert variant="info">{t('gis.contours.drawHint')}</Alert>}

          {isDrawing && (drawnGeometry || !gisEnabled) && (
            <VersionFieldsForm
              initial={mode === 'edit-draft' ? held?.version : undefined}
              onSubmit={handleSaveVersion}
              onCancel={() => {
                setDrawnGeometry(null);
                setMode('browse');
                setPendingContourId(null);
                setPendingContourNumber(null);
                setPendingOrgId(null);
              }}
              isPending={createVersion.isPending}
              requireDeclaredArea={!gisEnabled}
              t={t}
            />
          )}
          {createVersion.isError && (
            <Alert variant="danger">{errorText(createVersion.error, t('gis.contours.form.createFailed'))}</Alert>
          )}

          {mode === 'split' && selectedContourId && knownGeometry && (
            <SplitPanel
              contourId={selectedContourId}
              parentGeometry={knownGeometry as Polygon | MultiPolygon}
              line={splitLine}
              parentNumber={cardQuery.data?.number ?? ''}
              onRetryLine={() => setSplitLine(null)}
              onDone={() => {
                setMode('browse');
                setSplitLine(null);
                setRecallTick((n) => n + 1);
              }}
              onCancel={() => {
                setMode('browse');
                setSplitLine(null);
              }}
              t={t}
            />
          )}
        </div>
      </div>
    </div>
  );
}
