import type { StreetViewMetadataResponse } from "@solar/contracts";

export interface PropertyImageryRequest {
  propertyId?: string | null;
  latitude: number;
  longitude: number;
  address?: string | null;
}

export interface PropertyImageryResult {
  url: string;
  attribution: string;
  alt: string;
}

export interface PropertyImageryProvider {
  name: string;
  getSatelliteImage(request: PropertyImageryRequest): Promise<PropertyImageryResult | null>;
  getStreetViewMetadata(request: PropertyImageryRequest): Promise<StreetViewMetadataResponse | null>;
  getStreetViewImage(request: PropertyImageryRequest): Promise<PropertyImageryResult | null>;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
const useSameOriginApi = typeof window !== "undefined" && window.location.hostname.endsWith(".vercel.app");

export const backendPropertyImageryProvider: PropertyImageryProvider = {
  name: "backend",
  async getSatelliteImage(request) {
    if (!request.propertyId) return null;
    return {
      url: buildPropertySatelliteImageUrl(request.propertyId),
      attribution: "Google Maps",
      alt: buildImageryAlt("Satellite", request.address, request.latitude, request.longitude),
    };
  },
  async getStreetViewMetadata(request) {
    if (!request.propertyId) return null;
    const response = await fetch(buildPropertyStreetViewMetadataUrl(request.propertyId), { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as StreetViewMetadataResponse;
  },
  async getStreetViewImage(request) {
    if (!request.propertyId) return null;
    return {
      url: buildPropertyStreetViewImageUrl(request.propertyId),
      attribution: "Google Street View",
      alt: buildImageryAlt("Street View", request.address, request.latitude, request.longitude),
    };
  },
};

export const noopPropertyImageryProvider: PropertyImageryProvider = {
  name: "unconfigured",
  async getSatelliteImage() {
    return null;
  },
  async getStreetViewMetadata() {
    return null;
  },
  async getStreetViewImage() {
    return null;
  },
};

export function buildPropertySatelliteImageUrl(propertyId: string) {
  return buildApiUrl(`/api/v1/properties/${encodeURIComponent(propertyId)}/imagery/satellite`);
}

export function buildPropertyStreetViewMetadataUrl(propertyId: string) {
  return buildApiUrl(`/api/v1/properties/${encodeURIComponent(propertyId)}/imagery/street-view-metadata`);
}

export function buildPropertyStreetViewImageUrl(propertyId: string) {
  return buildApiUrl(`/api/v1/properties/${encodeURIComponent(propertyId)}/imagery/street-view`);
}

export function buildGoogleMapsSearchUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

export function buildGoogleMapsDirectionsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

function buildApiUrl(path: string) {
  return useSameOriginApi || !apiBaseUrl ? path : `${apiBaseUrl}${path}`;
}

function buildImageryAlt(
  view: "Satellite" | "Street View",
  address?: string | null,
  latitude?: number | null,
  longitude?: number | null,
) {
  const label = address ?? (latitude != null && longitude != null ? `${latitude}, ${longitude}` : "property");
  return `${view} view for ${label}`;
}
