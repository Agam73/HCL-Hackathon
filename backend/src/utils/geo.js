const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (Number(deg) * Math.PI) / 180;

/**
 * Great-circle (haversine) distance in km between two { latitude, longitude }
 * points, rounded to one decimal. Returns null if either point has no coordinates.
 */
export function distanceKm(a, b) {
  const known = (p) => p && p.latitude != null && p.longitude != null;
  if (!known(a) || !known(b)) return null;

  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;

  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h)) * 10) / 10;
}
