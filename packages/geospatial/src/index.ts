export interface Coordinate {
  latitude: number;
  longitude: number;
}

export function isCoordinate(value: unknown): value is Coordinate {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.latitude === "number" && typeof candidate.longitude === "number";
}

export function normalizeAddress(address: string): string {
  return address.trim().replace(/\s+/g, " ").toUpperCase();
}

export * from "./google-geocoder";
