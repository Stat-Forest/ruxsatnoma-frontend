import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { useAuth } from '../../../auth/useAuth';
import { Button } from '../../../components/ui/button';
import { Alert } from '../../../components/ui/Feedback';
import { Checkbox, Input } from '../../../components/ui/FormControls';
import { Tabs } from '../../../components/ui/Navigation';
import { ApiError } from '../../../api/errors';
import { pickName, formatDate } from '../format';
import type { LayerOut } from '../api';
import {
  useArchiveLayerFeature,
  useCreateLayerFeature,
  useLayerFeatures,
  useLayers,
  usePatchLayer,
  usePublishLayerFeature,
} from '../queries';
import { DrawMap, type DrawGeometryType } from '../contours/DrawMap';
import type { Geometry } from 'geojson';

const LAYERS_MANAGE = 'gis.layers.manage';

/** One entry of `FeatureCollectionOut.features` (`gis/repo.py::features_geojson`)
 * — a plain GeoJSON Feature, NOT `FeatureOut`: the id sits at the top level,
 * and `name`/`valid_from`/`valid_to` are nested under `properties` alongside
 * `props`. `status` is deliberately absent — the collection was fetched for
 * ONE status already (`GET .../features?status=...`), so every row in it
 * shares whatever status the caller asked for. */
interface LayerFeatureGeoJSON {
  id: string;
  properties: {
    name: Record<string, string> | null;
    props: Record<string, unknown>;
    valid_from: string | null;
    valid_to: string | null;
  };
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? `${error.code}: ${error.message}` : fallback;
}

/** `layer_features.geom` is plain `GEOMETRY` for a handful of layers (a fire
 * ban's territory, a water point, a cattle corridor) — this is the one place
 * client-side that has to guess which Terra Draw mode fits, from the
 * layer's own declared `geometry_type` (`gis/models.py`). `GEOMETRY` itself
 * (deliberately mixed content, per `gis/repo.py`'s own comment) offers a
 * picker rather than guessing wrong silently. */
function geometryTypeFor(layer: LayerOut): DrawGeometryType {
  if (layer.geometry_type === 'POINT') return 'Point';
  if (layer.geometry_type === 'LINESTRING') return 'LineString';
  return 'Polygon';
}

function NewFeatureForm({
  layer,
  onCreated,
  onCancel,
  t,
}: {
  layer: LayerOut;
  onCreated: () => void;
  onCancel: () => void;
  t: (key: string) => string;
}) {
  const createFeature = useCreateLayerFeature(layer.code);
  const [shapeType, setShapeType] = useState<DrawGeometryType>(geometryTypeFor(layer));
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [name, setName] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');

  async function handleSubmit() {
    if (!geometry) return;
    await createFeature.mutateAsync({
      geom: geometry as unknown as Record<string, unknown>,
      name: name.trim() ? { uz_latn: name.trim() } : null,
      valid_from: validFrom || null,
      valid_to: validTo || null,
    });
    onCreated();
  }

  return (
    <div className="space-y-3">
      {layer.geometry_type === 'GEOMETRY' && (
        <label className="block space-y-1 text-xs">
          <span className="text-[#5A646D]">{t('gis.layers.form.shapeType')}</span>
          <select
            value={shapeType}
            onChange={(e) => {
              setShapeType(e.target.value as DrawGeometryType);
              setGeometry(null);
            }}
            className="w-full h-10 rounded-md border border-[#767F87] px-3 text-sm"
          >
            <option value="Polygon">Polygon</option>
            <option value="LineString">LineString</option>
            <option value="Point">Point</option>
          </select>
        </label>
      )}

      <DrawMap geometryType={shapeType} active onDrawFinish={setGeometry} height="320px" />
      {!geometry && <Alert variant="info">{t('gis.layers.form.drawHint')}</Alert>}

      {geometry && (
        <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs space-y-3">
          <label className="block space-y-1 text-xs">
            <span className="text-[#5A646D]">{t('gis.layers.form.name')}</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-xs">
              <span className="text-[#5A646D]">{t('gis.layers.form.validFrom')}</span>
              <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </label>
            <label className="block space-y-1 text-xs">
              <span className="text-[#5A646D]">{t('gis.layers.form.validTo')}</span>
              <Input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
            </label>
          </div>
          {createFeature.isError && (
            <Alert variant="danger">{errorText(createFeature.error, t('gis.layers.form.failed'))}</Alert>
          )}
          <div className="flex gap-2">
            <Button variant="primary" size="sm" isLoading={createFeature.isPending} className="cursor-pointer" onClick={handleSubmit}>
              {t('gis.layers.form.create')}
            </Button>
            <Button variant="outline" size="sm" className="cursor-pointer" onClick={onCancel}>
              {t('gis.contours.form.cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FeatureRow({
  feature,
  status,
  code,
  canManage,
  t,
}: {
  feature: LayerFeatureGeoJSON;
  status: 'draft' | 'published' | 'archived';
  code: string;
  canManage: boolean;
  t: (key: string) => string;
}) {
  const publish = usePublishLayerFeature(code);
  const archive = useArchiveLayerFeature(code);
  const { name, valid_from: validFrom, valid_to: validTo } = feature.properties;

  return (
    <div className="flex items-center justify-between gap-3 p-3 text-xs" data-testid={`feature-${feature.id}`}>
      <div className="min-w-0">
        <div className="font-semibold text-[#1A1F24] truncate">{pickName(name) || t('gis.layers.unnamed')}</div>
        {(validFrom || validTo) && (
          <div className="text-[11px] text-[#5A646D]">
            {formatDate(validFrom)} — {formatDate(validTo) || t('gis.layers.noEnd')}
          </div>
        )}
      </div>
      {canManage && status === 'draft' && (
        <Button
          variant="primary"
          size="sm"
          isLoading={publish.isPending}
          className="cursor-pointer shrink-0"
          onClick={() => publish.mutate(feature.id)}
        >
          {t('gis.layers.actions.publish')}
        </Button>
      )}
      {canManage && status === 'published' && (
        <Button
          variant="danger"
          size="sm"
          isLoading={archive.isPending}
          className="cursor-pointer shrink-0"
          onClick={() => archive.mutate(feature.id)}
        >
          {t('gis.layers.actions.archive')}
        </Button>
      )}
      {(publish.isError || archive.isError) && (
        <span className="text-[#991B1B]">{errorText(publish.error ?? archive.error, t('gis.layers.actions.failed'))}</span>
      )}
    </div>
  );
}

function LayerFeatures({ layer, t }: { layer: LayerOut; t: (key: string) => string }) {
  const { me } = useAuth();
  const canManage = !!me?.permissions.includes(LAYERS_MANAGE) || !!me?.is_superuser;
  const patchLayer = usePatchLayer();
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('published');
  const [creating, setCreating] = useState(false);
  const featuresQuery = useLayerFeatures(layer.code, status);

  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-mono text-xs text-[#5A646D]">{layer.code}</span>
            <h3 className="text-sm font-bold text-[#1A1F24]">{pickName(layer.name) || layer.code}</h3>
          </div>
          {canManage && (
            <Button size="sm" variant="primary" leftIcon={<Plus className="w-4 h-4" />} className="cursor-pointer" onClick={() => setCreating(true)}>
              {t('gis.layers.newFeature')}
            </Button>
          )}
        </div>
        {canManage && (
          <div className="flex items-center gap-4 pt-2 border-t border-[#E4E7EA]">
            <Checkbox
              label={t('gis.layers.isPublic')}
              checked={layer.is_public}
              onChange={(e) => patchLayer.mutate({ code: layer.code, body: { is_public: e.target.checked } })}
            />
            <Checkbox
              label={t('gis.layers.active')}
              checked={layer.status === 'active'}
              onChange={(e) => patchLayer.mutate({ code: layer.code, body: { status: e.target.checked ? 'active' : 'archived' } })}
            />
          </div>
        )}
      </div>

      {creating ? (
        <NewFeatureForm layer={layer} onCreated={() => setCreating(false)} onCancel={() => setCreating(false)} t={t} />
      ) : (
        <div className="bg-white border border-[#E4E7EA] rounded-2xl shadow-xs">
          <div className="p-3 border-b border-[#E4E7EA]">
            <Tabs
              tabs={[
                { id: 'published', label: t('gis.layers.tabs.published') },
                { id: 'draft', label: t('gis.layers.tabs.draft') },
                { id: 'archived', label: t('gis.layers.tabs.archived') },
              ]}
              activeTabId={status}
              onChange={(id) => setStatus(id as typeof status)}
            />
          </div>
          {featuresQuery.isLoading && (
            <p className="p-4 text-xs text-[#5A646D]">
              <Loader2 className="w-4 h-4 inline animate-spin mr-1" /> {t('gis.layers.loading')}
            </p>
          )}
          {featuresQuery.isError && <Alert variant="danger">{errorText(featuresQuery.error, t('gis.layers.loadFailed'))}</Alert>}
          {featuresQuery.data && featuresQuery.data.features.length === 0 && (
            <p className="p-4 text-xs text-[#5A646D]">{t('gis.layers.empty')}</p>
          )}
          <div className="divide-y divide-[#E4E7EA]">
            {(featuresQuery.data?.features ?? []).map((f) => {
              const feature = f as unknown as LayerFeatureGeoJSON;
              return (
                <FeatureRow
                  key={feature.id}
                  feature={feature}
                  status={status}
                  code={layer.code}
                  canManage={canManage}
                  t={t}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * F4 — layers and layer features: the fixed 15-layer catalogue
 * (`gis/models.py::LAYER_CODES`, not admin CRUD — ruling 19) and, for
 * restriction/protection/fire-ban style layers, their features: a
 * draft->published->archived lifecycle with NO review step (`gis/service.py`
 * comment: "tz/07 gives that lifecycle to CONTOURS only").
 */
export function LayersTab({ t }: { t: (key: string) => string }) {
  const layersQuery = useLayers();
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const selected = (layersQuery.data ?? []).find((l) => l.code === selectedCode) ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 items-start">
      <div className="bg-white border border-[#E4E7EA] rounded-2xl divide-y divide-[#E4E7EA] shadow-xs">
        {layersQuery.isLoading && (
          <p className="p-4 text-xs text-[#5A646D]">
            <Loader2 className="w-4 h-4 inline animate-spin mr-1" /> {t('gis.layers.loading')}
          </p>
        )}
        {layersQuery.isError && <Alert variant="danger">{errorText(layersQuery.error, t('gis.layers.loadFailed'))}</Alert>}
        {(layersQuery.data ?? []).map((layer) => (
          <button
            key={layer.code}
            onClick={() => setSelectedCode(layer.code)}
            data-testid={`layer-row-${layer.code}`}
            className={`w-full text-left p-3 text-xs cursor-pointer transition-colors ${
              selectedCode === layer.code ? 'bg-[#F0F7F1]' : 'hover:bg-[#F8F9FA]'
            }`}
          >
            <div className="font-semibold text-[#1A1F24]">{pickName(layer.name) || layer.code}</div>
            <div className="text-[11px] text-[#5A646D] font-mono">{layer.code}</div>
          </button>
        ))}
      </div>

      <div>
        {selected ? (
          <LayerFeatures layer={selected} t={t} />
        ) : (
          <p className="text-xs text-[#5A646D]">{t('gis.layers.noneSelected')}</p>
        )}
      </div>
    </div>
  );
}
