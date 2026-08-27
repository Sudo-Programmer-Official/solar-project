import type { SalesRegion } from "@solar/analytics-contracts";

const cityAliases: Record<string, string> = {
  "union town": "Uniontown",
  uniontown: "Uniontown",
  union: "Uniontown",
  conneilsville: "Connellsville",
  conellsville: "Connellsville",
  connellsville: "Connellsville",
  "juniata gap": "Juniata Gap",
  carrolltown: "Carrolltown",
  cresson: "Cresson",
  altoona: "Altoona",
  johnstown: "Johnstown",
  hopwood: "Hopwood",
  patton: "Patton",
  indiana: "Indiana",
  spangler: "Spangler",
  salix: "Salix",
  belmont: "Belmont",
  latrobe: "Latrobe",
  "fair chance": "Fairchance",
  fairchance: "Fairchance",
  masontown: "Masontown",
  greensburg: "Greensburg",
  "new alexandria": "New Alexandria",
  derry: "Derry",
  "belle vernon": "Belle Vernon",
  carmichaels: "Carmichaels",
  carmichael: "Carmichaels",
  waynesburg: "Waynesburg",
  morgantown: "Morgantown",
  "mount pleasant": "Mount Pleasant",
};

const cityCentroids: Record<string, { latitude: number; longitude: number }> = {
  Altoona: { latitude: 40.5187, longitude: -78.3947 },
  Johnstown: { latitude: 40.3267, longitude: -78.922 },
  Uniontown: { latitude: 39.9001, longitude: -79.7164 },
  Connellsville: { latitude: 40.0176, longitude: -79.5895 },
  Hopwood: { latitude: 39.8784, longitude: -79.7017 },
  Indiana: { latitude: 40.6215, longitude: -79.1525 },
  Latrobe: { latitude: 40.3212, longitude: -79.3795 },
  Greensburg: { latitude: 40.3015, longitude: -79.5389 },
  Morgantown: { latitude: 39.6295, longitude: -79.9559 },
  "Belle Vernon": { latitude: 40.1251, longitude: -79.8664 },
  Carmichaels: { latitude: 39.8965, longitude: -79.9767 },
  Waynesburg: { latitude: 39.8965, longitude: -80.1873 },
  Masontown: { latitude: 39.8451, longitude: -79.8992 },
  Carrolltown: { latitude: 40.6034, longitude: -78.6922 },
  Cresson: { latitude: 40.459, longitude: -78.5856 },
  Patton: { latitude: 40.6337, longitude: -78.6509 },
  Spangler: { latitude: 40.639, longitude: -78.7725 },
  Salix: { latitude: 40.3167, longitude: -78.7667 },
  Belmont: { latitude: 40.2856, longitude: -78.8895 },
  Fairchance: { latitude: 39.8248, longitude: -79.7542 },
  Derry: { latitude: 40.3334, longitude: -79.2995 },
  "New Alexandria": { latitude: 40.3962, longitude: -79.4339 },
  "Mount Pleasant": { latitude: 40.1487, longitude: -79.5417 },
  "Juniata Gap": { latitude: 40.5067, longitude: -78.3631 },
};

export function normalizeTerritoryLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .normalize("NFKC")
    .replace(/[\u00a0\u200b]/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,]+$/g, "")
    .toLowerCase();
  if (!normalized || normalized === "-" || normalized === "n/a") return null;
  if (cityAliases[normalized]) return cityAliases[normalized];
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function normalizeStreetLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .normalize("NFKC")
    .replace(/[\u00a0\u200b]/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,]+$/, "");
  if (!normalized || normalized === "-" || /^n\/a$/i.test(normalized)) return null;
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function isValidCoordinate(latitude: number | null, longitude: number | null): boolean {
  return latitude != null && longitude != null && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export function stableCoordinateOffset(key: string): { latitude: number; longitude: number } {
  let hash = 2166136261;
  for (const character of key) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const normalized = (hash >>> 0) / 4294967295;
  return {
    latitude: ((normalized * 2) - 1) * 0.012,
    longitude: ((((hash >>> 8) >>> 0) / 16777215) * 2 - 1) * 0.016,
  };
}

export function normalizeRegion(value: unknown): SalesRegion {
  if (typeof value !== "string") return "UNKNOWN";
  const normalized = value.trim().toUpperCase();
  return normalized === "EAST" || normalized === "WEST" ? normalized : "UNKNOWN";
}

export function territoryKey(region: SalesRegion, city: string | null, hood: string | null = null): string {
  return [region, city ?? "UNKNOWN", hood ?? ""].join("::").toLowerCase();
}

export function getCityCentroid(city: string | null): { latitude: number; longitude: number } | null {
  return city ? cityCentroids[city] ?? null : null;
}

export function formatTerritoryLabel(city: string, hood: string | null, region?: SalesRegion): string {
  const area = hood && hood !== city ? `${city} · ${hood}` : city;
  return region && region !== "UNKNOWN" ? `${area} · ${region}` : area;
}
