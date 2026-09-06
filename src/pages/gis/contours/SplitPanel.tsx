import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { LineString, MultiPolygon, Polygon } from 'geojson';
import { Button } from '../../../components/ui/button';
import { Alert } from '../../../components/ui/Feedback';
import { Input, Select } from '../../../components/ui/FormControls';
import { ApiError } from '../../../api/errors';
import { createContour, createVersion, getContoursLayerId } from '../api';
import { rememberNewVersion } from '../localVersions';
import { splitPolygonWithLine, type SplitFailureReason } from './splitContour';

const REASON_KEYS: Record<SplitFailureReason, string> = {
  line_too_short: 'gis.contours.split.errors.lineTooShort',
  line_does_not_cross: 'gis.contours.split.errors.doesNotCross',
  unexpected_piece_count: 'gis.contours.split.errors.piecesCount',
  geometry_error: 'gis.contours.split.errors.geometryError',
};

interface SplitPieceResult {
  contourId: string;
  number: string;
}

async function createChild(input: {
  organizationId: string;
  parentId: string;
  number: string;
  geometry: Polygon;
}): Promise<SplitPieceResult> {
  const layerId = await getContoursLayerId();
  if (!layerId) throw new ApiError('ERR-SYS-000', 'contours layer not found');
  const contour = await createContour({
    layer_id: layerId,
    organization_id: input.organizationId,
    number: input.number,
    kind: 'subcontour',
    parent_id: input.parentId,
  });
  const version = await createVersion(contour.id, {
    geom: input.geometry as unknown as Record<string, unknown>,
    source: 'survey',
  });
  rememberNewVersion(contour.id, version, input.geometry);
  return { contourId: contour.id, number: contour.number };
}

/**
 * "Split" has no backend endpoint (plan ruling 3) — it is composed here from
 * `createContour`/`createVersion`, called twice. The parent contour and its
 * own version are left untouched; an operator archives the parent's
 * published version separately once the two children clear the lifecycle.
 */
export function SplitPanel({
  contourId,
  parentGeometry,
  line,
  parentNumber,
  organizationOptions,
  defaultOrganizationId,
  onRetryLine,
  onDone,
  onCancel,
  t,
}: {
  contourId: string;
  parentGeometry: Polygon | MultiPolygon;
  line: LineString | null;
  parentNumber: string;
  organizationOptions: { id: string; label: string }[];
  defaultOrganizationId?: string;
  onRetryLine: () => void;
  onDone: () => void;
  onCancel: () => void;
  t: (key: string) => string;
}) {
  const splitResult = useMemo(
    () => (line ? splitPolygonWithLine(parentGeometry, line) : null),
    [parentGeometry, line],
  );

  const [organizationId, setOrganizationId] = useState(defaultOrganizationId ?? organizationOptions[0]?.id ?? '');
  const [numberA, setNumberA] = useState(`${parentNumber || 'K'}/1`);
  const [numberB, setNumberB] = useState(`${parentNumber || 'K'}/2`);

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!splitResult?.ok) throw new Error('no split to confirm');
      const [pieceA, pieceB] = splitResult.pieces;
      const a = await createChild({ organizationId, parentId: contourId, number: numberA, geometry: pieceA });
      const b = await createChild({ organizationId, parentId: contourId, number: numberB, geometry: pieceB });
      return [a, b];
    },
    onSuccess: onDone,
  });

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs space-y-3" data-testid="split-panel">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A646D]">{t('gis.contours.split.title')}</h3>

      {!line && <Alert variant="info">{t('gis.contours.split.drawLineHint')}</Alert>}

      {line && splitResult && !splitResult.ok && (
        <>
          <Alert variant="danger">{t(REASON_KEYS[splitResult.reason])}</Alert>
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={onRetryLine}>
            {t('gis.contours.split.retry')}
          </Button>
        </>
      )}

      {line && splitResult?.ok && (
        <div className="space-y-3">
          <label className="block space-y-1 text-xs">
            <span className="text-[#5A646D]">{t('gis.contours.form.organization')}</span>
            <Select
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              options={organizationOptions.map((o) => ({ value: o.id, label: o.label }))}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-xs">
              <span className="text-[#5A646D]">{t('gis.contours.split.pieceA')}</span>
              <Input value={numberA} onChange={(e) => setNumberA(e.target.value)} />
            </label>
            <label className="block space-y-1 text-xs">
              <span className="text-[#5A646D]">{t('gis.contours.split.pieceB')}</span>
              <Input value={numberB} onChange={(e) => setNumberB(e.target.value)} />
            </label>
          </div>
          {confirmMutation.isError && (
            <Alert variant="danger">
              {confirmMutation.error instanceof ApiError
                ? `${confirmMutation.error.code}: ${confirmMutation.error.message}`
                : t('gis.contours.split.failed')}
            </Alert>
          )}
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              className="cursor-pointer"
              disabled={!organizationId || !numberA.trim() || !numberB.trim()}
              isLoading={confirmMutation.isPending}
              onClick={() => confirmMutation.mutate()}
            >
              {t('gis.contours.split.confirm')}
            </Button>
            <Button variant="outline" size="sm" className="cursor-pointer" onClick={onRetryLine}>
              {t('gis.contours.split.redrawLine')}
            </Button>
          </div>
        </div>
      )}

      <Button variant="ghost" size="sm" className="cursor-pointer" onClick={onCancel}>
        {t('gis.contours.form.cancel')}
      </Button>
    </div>
  );
}
