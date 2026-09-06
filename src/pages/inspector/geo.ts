/**
 * A thin Promise wrapper over `navigator.geolocation.getCurrentPosition` —
 * the only geolocation this app does. Per the plan's own global constraint,
 * this is purely informational: the backend records `distance_to_contour_m`
 * on the signed act (`ActOut`), computed server-side, and never uses a
 * client-reported fix as a submission gate — no geofencing lives here or
 * anywhere in this module.
 */

export interface GeoFix {
  lon: number;
  lat: number;
  /** `position.coords.accuracy`, rounded to the nearest metre — `null` only
   *  when the browser itself omits it (not a documented case today, kept
   *  defensive rather than assumed). */
  accuracyM: number | null;
}

export type GeoError = 'denied' | 'unavailable' | 'timeout';

function mapPositionError(error: GeolocationPositionError): GeoError {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'denied';
    case error.TIMEOUT:
      return 'timeout';
    case error.POSITION_UNAVAILABLE:
    default:
      return 'unavailable';
  }
}

/** Rejects with a `GeoError` (never the raw `GeolocationPositionError`) so
 *  every caller can branch on the same three-value union regardless of
 *  which browser API produced it — including the `navigator.geolocation`
 *  undefined case (an insecure context, or a browser without the API),
 *  which has no `GeolocationPositionError` of its own to map. */
export function getCurrentPosition(): Promise<GeoFix> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject('unavailable' satisfies GeoError);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lon: position.coords.longitude,
          lat: position.coords.latitude,
          accuracyM: position.coords.accuracy == null ? null : Math.round(position.coords.accuracy),
        });
      },
      (error) => reject(mapPositionError(error)),
      { timeout: 10_000, enableHighAccuracy: true },
    );
  });
}
