import { normalizeAddress, type Geocoder } from "../../../packages/geospatial/src/index";

export interface DiscoveredProperty {
  externalId?: string;
  address?: string;
  latitude: number;
  longitude: number;
  parcelId?: string;
  propertyType: "SINGLE_FAMILY" | "MULTI_FAMILY" | "RESIDENTIAL" | "COMMERCIAL" | "INDUSTRIAL" | "UNKNOWN";
  buildingAreaSqFt?: number;
  lotAreaSqFt?: number;
  source: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface PropertyDiscoveryInput {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  limit?: number;
}

export interface PropertyDiscoveryProvider {
  readonly source: string;
  supportsArea(input: PropertyDiscoveryInput): boolean;
  discover(input: PropertyDiscoveryInput): Promise<DiscoveredProperty[]>;
}

export class OverpassPropertyDiscoveryProvider implements PropertyDiscoveryProvider {
  readonly source = "openstreetmap_overpass";

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  supportsArea(input: PropertyDiscoveryInput): boolean {
    return Number.isFinite(input.latitude) && Number.isFinite(input.longitude) && input.radiusMiles > 0;
  }

  async discover(input: PropertyDiscoveryInput): Promise<DiscoveredProperty[]> {
    if (!this.supportsArea(input)) {
      return [];
    }

    const radiusMeters = Math.max(1000, Math.min(50_000, Math.round(input.radiusMiles * 1609.344)));
    const query = this.buildQuery(input.latitude, input.longitude, radiusMeters);
    const response = await this.fetchImpl("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: new URLSearchParams({ data: query }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Overpass discovery returned HTTP ${response.status}`);
    }

    const payload = (await response.json()) as OverpassResponse;
    const elements = Array.isArray(payload.elements) ? payload.elements : [];
    const discovered: DiscoveredProperty[] = [];
    for (const element of elements) {
      const candidate = normalizeOverpassElement(element, this.source);
      if (candidate) {
        discovered.push(candidate);
      }
    }

    return discovered;
  }

  private buildQuery(latitude: number, longitude: number, radiusMeters: number): string {
    return `
      [out:json][timeout:25];
      (
        node(around:${radiusMeters},${latitude},${longitude})["building"];
        way(around:${radiusMeters},${latitude},${longitude})["building"];
        relation(around:${radiusMeters},${latitude},${longitude})["building"];
        node(around:${radiusMeters},${latitude},${longitude})["addr:housenumber"];
        way(around:${radiusMeters},${latitude},${longitude})["addr:housenumber"];
        relation(around:${radiusMeters},${latitude},${longitude})["addr:housenumber"];
        way(around:${radiusMeters},${latitude},${longitude})["landuse"="residential"];
        relation(around:${radiusMeters},${latitude},${longitude})["landuse"="residential"];
      );
      out center tags;
    `;
  }
}

export class GridGeocodingPropertyDiscoveryProvider implements PropertyDiscoveryProvider {
  readonly source: string;

  constructor(
    private readonly geocoder: Geocoder,
    options: { source?: string; sampleMultiplier?: number } = {},
  ) {
    this.source = options.source ?? "google_geocoding_grid";
    this.sampleMultiplier = Math.max(1, options.sampleMultiplier ?? 1);
  }

  private readonly sampleMultiplier: number;

  supportsArea(input: PropertyDiscoveryInput): boolean {
    return Number.isFinite(input.latitude) && Number.isFinite(input.longitude) && input.radiusMiles > 0;
  }

  async discover(input: PropertyDiscoveryInput): Promise<DiscoveredProperty[]> {
    if (!this.supportsArea(input)) {
      return [];
    }

    const sampleLimit = Math.max(16, Math.min(250, Math.round((input.limit ?? 40) * this.sampleMultiplier)));
    const samples = buildSamplingPoints(input.latitude, input.longitude, input.radiusMiles, sampleLimit);
    const discovered: DiscoveredProperty[] = [];
    for (const sample of samples) {
      try {
        const geocoded = await this.geocoder.reverseGeocode(sample);
        const address = geocoded.formattedAddress?.trim();
        if (!address) {
          continue;
        }
        discovered.push({
          externalId: geocoded.placeId ?? `${sample.latitude.toFixed(5)}:${sample.longitude.toFixed(5)}`,
          address,
          latitude: geocoded.latitude,
          longitude: geocoded.longitude,
          parcelId: geocoded.placeId ?? undefined,
          propertyType: inferPropertyTypeFromLocationType(geocoded.locationType),
          source: this.source,
          confidence: inferGeocodingConfidence(geocoded.locationType),
          metadata: {
            locationType: geocoded.locationType,
            placeId: geocoded.placeId ?? null,
            ...extractGoogleGeocodingDetails(geocoded.rawResponse),
            sampleLatitude: sample.latitude,
            sampleLongitude: sample.longitude,
          },
        });
      } catch {
        continue;
      }
    }
    return dedupeDiscoveredProperties(discovered);
  }
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

interface OverpassElement {
  type?: "node" | "way" | "relation";
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string | undefined>;
}

function normalizeOverpassElement(element: OverpassElement, source: string): DiscoveredProperty | null {
  const latitude = element.type === "node" ? element.lat : element.center?.lat;
  const longitude = element.type === "node" ? element.lon : element.center?.lon;
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }
  const tags = element.tags ?? {};
  const address = buildAddress(tags);
  const propertyType = inferPropertyType(tags);
  const parcelId = typeof tags["ref:parcel"] === "string" ? tags["ref:parcel"] : typeof tags["parcel_id"] === "string" ? tags["parcel_id"] : undefined;
  const buildingAreaSqFt = parseArea(tags["building:area"] ?? tags["area"]);
  const lotAreaSqFt = parseArea(tags["land_area"] ?? tags["lot_area"]);
  const externalId = element.id != null && element.type ? `${source}:${element.type}/${element.id}` : undefined;

  return {
    externalId,
    address,
    latitude,
    longitude,
    parcelId,
    propertyType,
    buildingAreaSqFt,
    lotAreaSqFt,
    source,
    confidence: inferConfidence(tags),
    metadata: {
      osmType: element.type ?? null,
      osmId: element.id ?? null,
      tags,
      normalizedAddress: address ? normalizeAddress(address) : null,
    },
  };
}

function buildAddress(tags: Record<string, string | undefined>): string | undefined {
  const parts = [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"], tags["addr:state"], tags["addr:postcode"]]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function inferPropertyType(tags: Record<string, string | undefined>): DiscoveredProperty["propertyType"] {
  const building = (tags.building ?? "").toLowerCase();
  const landuse = (tags.landuse ?? "").toLowerCase();
  const amenity = (tags.amenity ?? "").toLowerCase();
  const industrial = (tags.industrial ?? "").toLowerCase();
  const shop = (tags.shop ?? "").toLowerCase();
  const office = (tags.office ?? "").toLowerCase();
  if (building.includes("industrial") || landuse === "industrial" || industrial.length > 0) return "INDUSTRIAL";
  if (building.includes("commercial") || landuse === "commercial" || amenity.length > 0 || shop.length > 0 || office.length > 0) return "COMMERCIAL";
  if (building.length === 0 && typeof tags["addr:housenumber"] === "string") {
    return "SINGLE_FAMILY";
  }
  if (building.includes("apartments")) return "MULTI_FAMILY";
  if (building.includes("house") || building.includes("residential") || building.includes("detached") || building.includes("semidetached_house") || building.includes("terrace") || building.includes("bungalow") || building.includes("villa") || building.includes("home") || building.includes("cabin")) {
    return "SINGLE_FAMILY";
  }
  return "RESIDENTIAL";
}

function inferConfidence(tags: Record<string, string | undefined>): number {
  const building = tags.building?.toLowerCase() ?? "";
  if (typeof tags["addr:housenumber"] === "string") {
    return 88;
  }
  if (building.includes("house") || building.includes("detached") || building.includes("residential")) {
    return 82;
  }
  if (building.includes("apartments")) {
    return 76;
  }
  return 68;
}

function inferPropertyTypeFromLocationType(locationType: string | null): DiscoveredProperty["propertyType"] {
  if (locationType && /(street|premise|route|subpremise|establishment|point_of_interest)/i.test(locationType)) {
    return "SINGLE_FAMILY";
  }
  return "RESIDENTIAL";
}

function inferGeocodingConfidence(locationType: string | null): number {
  if (locationType && /(street|premise)/i.test(locationType)) {
    return 84;
  }
  if (locationType && /(route|subpremise|establishment)/i.test(locationType)) {
    return 74;
  }
  return 66;
}

function buildSamplingPoints(
  latitude: number,
  longitude: number,
  radiusMiles: number,
  limit: number,
): Array<{ latitude: number; longitude: number }> {
  const metersPerMile = 1609.344;
  const radiusMeters = Math.max(500, radiusMiles * metersPerMile);
  const rings = Math.max(2, Math.min(5, Math.ceil(limit / 8)));
  const points: Array<{ latitude: number; longitude: number }> = [{ latitude, longitude }];
  for (let ring = 1; ring <= rings && points.length < limit; ring += 1) {
    const ringRadius = (radiusMeters * ring) / (rings + 0.5);
    const samples = Math.max(6, ring * 8);
    for (let index = 0; index < samples && points.length < limit; index += 1) {
      const angle = (Math.PI * 2 * index) / samples;
      const offsetNorth = Math.cos(angle) * ringRadius;
      const offsetEast = Math.sin(angle) * ringRadius;
      const nextLatitude = latitude + (offsetNorth / 111_320);
      const nextLongitude = longitude + (offsetEast / (111_320 * Math.cos((latitude * Math.PI) / 180)));
      points.push({ latitude: nextLatitude, longitude: nextLongitude });
    }
  }
  return points.slice(0, Math.max(1, limit));
}

function dedupeDiscoveredProperties(properties: DiscoveredProperty[]): DiscoveredProperty[] {
  const seen = new Set<string>();
  const unique: DiscoveredProperty[] = [];
  for (const property of properties) {
    const key = discoveryKey(property);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(property);
  }
  return unique;
}

function discoveryKey(property: DiscoveredProperty): string {
  return [property.parcelId ?? null, property.address ? normalizeAddress(property.address) : null, property.latitude.toFixed(5), property.longitude.toFixed(5)]
    .filter((value): value is string => value != null)
    .join("|");
}

function parseArea(value: string | undefined): number | undefined {
  if (value == null) {
    return undefined;
  }
  const numeric = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? numeric : undefined;
}

function extractGoogleGeocodingDetails(rawResponse: unknown): {
  city: string | null;
  county: string | null;
  state: string | null;
  postalCode: string | null;
} {
  const results = rawResponse && typeof rawResponse === "object" && Array.isArray((rawResponse as Record<string, unknown>).results)
    ? (rawResponse as Record<string, unknown>).results as Array<Record<string, unknown>>
    : [];
  const first = results[0];
  const components = first && Array.isArray(first.address_components)
    ? first.address_components.filter((value): value is Record<string, unknown> => typeof value === "object" && value != null)
    : [];
  const getComponent = (type: string) => {
    const match = components.find((entry) => {
      const types = Array.isArray(entry.types) ? entry.types.filter((value): value is string => typeof value === "string") : [];
      return types.includes(type);
    });
    return typeof match?.long_name === "string" ? match.long_name : null;
  };

  return {
    city: getComponent("locality") ?? getComponent("postal_town") ?? getComponent("sublocality") ?? null,
    county: getComponent("administrative_area_level_2"),
    state: getComponent("administrative_area_level_1"),
    postalCode: getComponent("postal_code"),
  };
}
