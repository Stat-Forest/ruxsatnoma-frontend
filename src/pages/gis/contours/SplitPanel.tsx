import { useMemo, useState } from 'react';
import type { LineString, MultiPolygon, Polygon } from 'geojson';
import { Button } from '../../../components/ui/button';
import { Alert } from '../../../components/ui/Feedback';
import { Input } from '../../../components/ui/FormControls';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useSplitContour } from '../queries';
import { splitPolygonWithLine, type SplitFailureReason } from './splitContour';

const REASON_KEYS: Record<SplitFailureReason, string> = {
  line_too_short: 'gis.contours.split.errors.lineTooShort',
  line_does_not_cross: 'gis.contours.split.errors.doesNotCross',
  unexpected_piece_count: 'gis.contours.split.errors.piecesCount',
  geometry_error: 'gis.contours.split.errors.geometryError',
};

/**
 * "Split" (F1) is `POST /gis/contours/{parent_id}/split` (core PR #53,
 * decision #91) — ONE atomic call. Before this, the screen composed the
 * operation client-side out of `createContour` + `createVersion`, called
 * twice; a failure between those two calls left one new contour and no
 * second, with nothing telling the operator which half actually happened.
 * The cut itself still runs client-side (`splitPolygonWithLine`, `@turf/
 * difference` — PostGIS ships no "split polygon by line" primitive, and the
 * backend validates the submitted pieces rather than re-deriving them); only
 * the two-call composition around it is gone.
 *
 * The parent contour and its own published version are left untouched by the
 * split — a permit issued before the split keeps pointing at something that
 * still exists (decision #91). That has one consequence the operator must
 * know about: the two new drafts sit entirely inside the parent's own
 * still-published geometry, so neither can be PUBLISHED until that parent
 * version is archived (`checks.overlap` refuses it with `ERR-GIS-003`
 * otherwise). This screen says so once the split succeeds, rather than
 * leaving the operator to discover it as an opaque check failure later on
 * `VersionPanel`.
 */
export function SplitPanel({
  contourId,
  parentGeometry,
  line,
  parentNumber,
  onRetryLine,
  onDone,
  onCancel,
  t,
}: {
  contourId: string;
  parentGeometry: Polygon | MultiPolygon;
  line: LineString | null;
  parentNumber: string;
  onRetryLine: () => void;
  onDone: () => void;
  onCancel: () => void;
  t: (key: string) => string;
}) {
  const errorText = useApiErrorText();
  const splitResult = useMemo(
    () => (line ? splitPolygonWithLine(parentGeometry, line) : null),
    [parentGeometry, line],
  );

  const [numberA, setNumberA] = useState(`${parentNumber || 'K'}/1`);
  const [numberB, setNumberB] = useState(`${parentNumber || 'K'}/2`);

  const splitMutation = useSplitContour(contourId);

  function handleConfirm() {
    if (!splitResult?.ok) return;
    const [pieceA, pieceB] = splitResult.pieces;
    splitMutation.mutate({
      piece_a: { number: numberA, geom: pieceA as unknown as Record<string, unknown> },
      piece_b: { number: numberB, geom: pieceB as unknown as Record<string, unknown> },
      source: 'survey',
    });
  }

  if (splitMutation.isSuccess && splitMutation.data) {
    const { piece_a, piece_b } = splitMutation.data;
    return (
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs space-y-3" data-testid="split-panel">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A646D]">{t('gis.contours.split.title')}</h3>
        <Alert variant="success">{t('gis.contours.split.doneMessage')}</Alert>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs" data-testid="split-result">
          <dt className="text-[#5A646D]">{t('gis.contours.split.resultParent')}</dt>
          <dd className="font-mono font-semibold">{parentNumber}</dd>
          <dt className="text-[#5A646D]">{t('gis.contours.split.resultPieceA')}</dt>
          <dd className="font-mono font-semibold">{piece_a.contour.number}</dd>
          <dt className="text-[#5A646D]">{t('gis.contours.split.resultPieceB')}</dt>
          <dd className="font-mono font-semibold">{piece_b.contour.number}</dd>
        </dl>
        <Alert variant="info">{t('gis.contours.split.publishHint')}</Alert>
        <Button variant="primary" size="sm" className="cursor-pointer" onClick={onDone}>
          {t('gis.contours.split.done')}
        </Button>
      </div>
    );
  }

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
          {splitMutation.isError && (
            <Alert variant="danger">
              {splitMutation.error instanceof ApiError
                ? errorText(splitMutation.error)
                : t('gis.contours.split.failed')}
            </Alert>
          )}
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              className="cursor-pointer"
              disabled={!numberA.trim() || !numberB.trim()}
              isLoading={splitMutation.isPending}
              onClick={handleConfirm}
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
