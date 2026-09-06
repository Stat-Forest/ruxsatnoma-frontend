/**
 * A "Capture GPS" button plus the captured fix — purely informational
 * (Global Constraint 7): `distance_to_contour_m` is server-computed and
 * rendered here as a plain fact, never a colour-coded "inside/outside"
 * verdict, and capturing a fix never blocks or unblocks anything on this
 * page by itself.
 */
import { useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { useT } from '../../../i18n/useT';
import { Button } from '../../../components/ui/button';
import { formatCoord } from '../format';
import { getCurrentPosition, type GeoError, type GeoFix } from '../geo';

const ERROR_KEY: Record<GeoError, string> = {
  denied: 'inspector.actForm.gps.errorDenied',
  unavailable: 'inspector.actForm.gps.errorUnavailable',
  timeout: 'inspector.actForm.gps.errorTimeout',
};

export interface ActGpsCardProps {
  fix: GeoFix | null;
  onCapture: (fix: GeoFix) => void;
  /** `ActOut.distance_to_contour_m` — only present once the act exists
   *  server-side; absent on a not-yet-created draft. */
  distanceToContourM?: string | null;
  readOnly?: boolean;
}

export function ActGpsCard({ fix, onCapture, distanceToContourM, readOnly = false }: ActGpsCardProps) {
  const t = useT();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<GeoError | null>(null);

  async function capture() {
    setPending(true);
    setError(null);
    try {
      onCapture(await getCurrentPosition());
    } catch (err) {
      setError(err as GeoError);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 space-y-3 shadow-xs">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#5A646D]">{t('inspector.actForm.gps.title')}</p>

      {!readOnly && (
        <Button
          type="button"
          size="touch"
          variant="outline"
          disabled={pending}
          leftIcon={pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
          onClick={() => void capture()}
        >
          {t('inspector.actForm.gps.captureButton')}
        </Button>
      )}

      {fix ? (
        <p className="text-sm text-[#1A1F24] font-mono">
          {formatCoord(fix.lat)}, {formatCoord(fix.lon)}
          {fix.accuracyM != null && <span className="text-[#5A646D]"> (±{fix.accuracyM} m)</span>}
        </p>
      ) : (
        <p className="text-sm text-[#5A646D]">{t('inspector.actForm.gps.noFix')}</p>
      )}

      {error && (
        <p className="text-xs text-[#B91C1C]" role="alert">
          {t(ERROR_KEY[error])}
        </p>
      )}

      {distanceToContourM != null && (
        <p className="text-xs text-[#5A646D]">
          {t('inspector.actForm.gps.distanceLabel')} {distanceToContourM} m
        </p>
      )}
    </div>
  );
}
