import { loadAppEnv } from "../../../packages/config/src/index";
import type {
  StreetViewMetadataResponse,
} from "../../../packages/contracts/src/index";
import type { SolarRepository } from "../../../packages/database/src/repository";

export interface ImageryPropertyCoordinates {
  latitude: number;
  longitude: number;
  address: string;
}

export class StreetViewProviderError extends Error {
  constructor(
    message: string,
    public readonly code: "REQUEST_DENIED" | "OVER_QUERY_LIMIT" | "INVALID_REQUEST" | "UNKNOWN_ERROR" | "UPSTREAM_ERROR",
  ) {
    super(message);
    this.name = "StreetViewProviderError";
  }
}

export async function resolveImageryProperty(
  propertyId: string,
  repository: SolarRepository,
): Promise<ImageryPropertyCoordinates | null> {
  const property = await repository.getPropertyById(propertyId);
  if (!property || property.latitude == null || property.longitude == null) {
    return null;
  }
  return {
    latitude: property.latitude,
    longitude: property.longitude,
    address: property.street ?? property.normalizedAddress,
  };
}

export function buildImageryApiConfig() {
  const env = loadAppEnv();
  return {
    satelliteKey: env.googleMapsImageryApiKey ?? env.googleMapsStaticApiKey ?? null,
    streetViewKey: env.googleStreetViewApiKey ?? null,
  };
}

export function getImageryCapabilities() {
  const { satelliteKey, streetViewKey } = buildImageryApiConfig();
  return {
    imagery: {
      satellite: Boolean(satelliteKey),
      streetView: Boolean(streetViewKey),
    },
  };
}

export function buildSatelliteImageUrl(
  latitude: number,
  longitude: number,
  key: string,
): string {
  const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
  url.searchParams.set("center", `${latitude},${longitude}`);
  url.searchParams.set("zoom", "20");
  url.searchParams.set("size", "640x360");
  url.searchParams.set("scale", "2");
  url.searchParams.set("maptype", "satellite");
  url.searchParams.set("markers", `color:red|${latitude},${longitude}`);
  url.searchParams.set("key", key);
  return url.toString();
}

export function buildStreetViewMetadataUrl(
  latitude: number,
  longitude: number,
  key: string,
): string {
  const url = new URL("https://maps.googleapis.com/maps/api/streetview/metadata");
  url.searchParams.set("location", `${latitude},${longitude}`);
  url.searchParams.set("source", "outdoor");
  url.searchParams.set("key", key);
  return url.toString();
}

export function buildStreetViewImageUrl(
  latitude: number,
  longitude: number,
  key: string,
  heading?: number | null,
): string {
  const url = new URL("https://maps.googleapis.com/maps/api/streetview");
  url.searchParams.set("location", `${latitude},${longitude}`);
  url.searchParams.set("size", "640x360");
  url.searchParams.set("fov", "80");
  url.searchParams.set("pitch", "0");
  if (heading != null && Number.isFinite(heading)) {
    url.searchParams.set("heading", `${Math.round(heading)}`);
  }
  url.searchParams.set("source", "outdoor");
  url.searchParams.set("key", key);
  return url.toString();
}

export async function fetchStreetViewMetadata(
  latitude: number,
  longitude: number,
  apiKey: string,
): Promise<StreetViewMetadataResponse> {
  const url = buildStreetViewMetadataUrl(latitude, longitude, apiKey);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new StreetViewProviderError(`Street View metadata request failed with status ${response.status}`, "UPSTREAM_ERROR");
  }
  const payload = (await response.json()) as Record<string, unknown>;
  const status = normalizeStatus(payload.status);
  if (status === "REQUEST_DENIED") {
    throw new StreetViewProviderError("Street View request denied.", "REQUEST_DENIED");
  }
  if (status === "OVER_QUERY_LIMIT") {
    throw new StreetViewProviderError("Street View quota exceeded.", "OVER_QUERY_LIMIT");
  }
  if (status === "INVALID_REQUEST") {
    throw new StreetViewProviderError("Street View request is invalid for the provided coordinates.", "INVALID_REQUEST");
  }
  if (status === "UNKNOWN_ERROR") {
    throw new StreetViewProviderError("Street View provider returned an unknown error.", "UNKNOWN_ERROR");
  }
  const available = status === "OK" && payload.location != null;
  const location = available && isRecord(payload.location) ? payload.location : null;
  return {
    available,
    panoId: typeof payload.pano_id === "string" ? payload.pano_id : null,
    panoramaLocation: location && isFiniteNumber(location.lat) && isFiniteNumber(location.lng)
      ? { latitude: Number(location.lat), longitude: Number(location.lng) }
      : null,
    latitude: location && isFiniteNumber(location.lat) ? Number(location.lat) : null,
    longitude: location && isFiniteNumber(location.lng) ? Number(location.lng) : null,
    date: typeof payload.date === "string" ? payload.date : null,
    status,
  };
}

export async function proxyImageryImage(url: string): Promise<Response> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Upstream imagery request failed with status ${response.status}`);
  }
  return response;
}

export function calculateHeadingDegrees(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
): number {
  const fromLat = toRadians(fromLatitude);
  const toLat = toRadians(toLatitude);
  const deltaLon = toRadians(toLongitude - fromLongitude);
  const y = Math.sin(deltaLon) * Math.cos(toLat);
  const x =
    Math.cos(fromLat) * Math.sin(toLat) -
    Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLon);
  const heading = Math.atan2(y, x) * (180 / Math.PI);
  return (heading + 360) % 360;
}

export function imageryApiKeyMissingMessage(kind: "satellite" | "street-view"): string {
  return kind === "satellite"
    ? "GOOGLE_MAPS_IMAGERY_API_KEY (or GOOGLE_MAPS_STATIC_API_KEY) is required for satellite imagery."
    : "GOOGLE_STREET_VIEW_API_KEY is required for street-view imagery.";
}

function normalizeStatus(status: unknown): StreetViewMetadataResponse["status"] {
  if (
    status === "OK" ||
    status === "ZERO_RESULTS" ||
    status === "NOT_FOUND" ||
    status === "OVER_QUERY_LIMIT" ||
    status === "REQUEST_DENIED" ||
    status === "INVALID_REQUEST" ||
    status === "UNKNOWN_ERROR"
  ) {
    return status;
  }
  return "UNAVAILABLE";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
