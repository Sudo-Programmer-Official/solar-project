export interface DistanceCoordinate {
  latitude: number;
  longitude: number;
}

/**
 * Returns the straight-line distance in miles between two latitude/longitude
 * pairs. Route and field UI distances are intentionally derived at read time
 * from these coordinates instead of being persisted as absolute values.
 */
export function calculateDistanceMiles(
  originLat: number | null | undefined,
  originLng: number | null | undefined,
  propertyLat: number | null | undefined,
  propertyLng: number | null | undefined,
): number | null {
  if (!isValidLatitude(originLat) || !isValidLongitude(originLng) || !isValidLatitude(propertyLat) || !isValidLongitude(propertyLng)) {
    return null;
  }

  const earthRadiusMiles = 3958.7613;
  const originLatitude = (originLat * Math.PI) / 180;
  const propertyLatitude = (propertyLat * Math.PI) / 180;
  const latitudeDelta = ((propertyLat - originLat) * Math.PI) / 180;
  const longitudeDelta = ((propertyLng - originLng) * Math.PI) / 180;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(originLatitude) * Math.cos(propertyLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(Math.max(0, 1 - haversine)));
}

export function calculateDistanceMeters(
  originLat: number | null | undefined,
  originLng: number | null | undefined,
  propertyLat: number | null | undefined,
  propertyLng: number | null | undefined,
): number | null {
  const miles = calculateDistanceMiles(originLat, originLng, propertyLat, propertyLng);
  return miles == null ? null : Math.round(miles * 1609.344);
}

export function isValidCoordinate(value: unknown): value is DistanceCoordinate {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DistanceCoordinate>;
  return isValidLatitude(candidate.latitude) && isValidLongitude(candidate.longitude);
}

function isValidLatitude(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180;
}
