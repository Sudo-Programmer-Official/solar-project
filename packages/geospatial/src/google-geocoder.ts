export interface GeocodeAddressRequest {
  address: string;
}

export interface GeocodeAddressResult {
  latitude: number;
  longitude: number;
  formattedAddress: string | null;
  placeId: string | null;
  locationType: string | null;
  partialMatch: boolean;
  rawResponse: unknown;
}

export interface Geocoder {
  geocodeAddress(request: GeocodeAddressRequest): Promise<GeocodeAddressResult>;
  reverseGeocode(request: GeocodeCoordinatesRequest): Promise<GeocodeAddressResult>;
}

export interface GeocodeCoordinatesRequest {
  latitude: number;
  longitude: number;
}

export interface GoogleGeocoderConfig {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retries?: number;
}

export class GoogleMapsGeocoder implements Geocoder {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly retries: number;

  constructor(private readonly config: GoogleGeocoderConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.timeoutMs = config.timeoutMs ?? 12000;
    this.retries = config.retries ?? 1;
  }

  async geocodeAddress(request: GeocodeAddressRequest): Promise<GeocodeAddressResult> {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", request.address);
    url.searchParams.set("key", this.config.apiKey);

    const response = await this.fetchWithRetry(url);
    const payload = (await response.json()) as Record<string, unknown>;
    const results = Array.isArray(payload.results) ? payload.results : [];
    if (payload.status !== "OK" || results.length === 0) {
      throw new Error(`Google geocoding failed with status ${String(payload.status ?? "UNKNOWN")}`);
    }

    const first = results[0] as Record<string, any>;
    const geometry = first.geometry ?? {};
    const location = geometry.location ?? {};
    const latitude = asNumber(location.lat);
    const longitude = asNumber(location.lng);
    if (latitude == null || longitude == null) {
      throw new Error("Google geocoding response did not include coordinates.");
    }

    return {
      latitude,
      longitude,
      formattedAddress: typeof first.formatted_address === "string" ? first.formatted_address : null,
      placeId: typeof first.place_id === "string" ? first.place_id : null,
      locationType: typeof geometry.location_type === "string" ? geometry.location_type : null,
      partialMatch: Boolean(first.partial_match),
      rawResponse: payload,
    };
  }

  async reverseGeocode(request: GeocodeCoordinatesRequest): Promise<GeocodeAddressResult> {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("latlng", `${request.latitude},${request.longitude}`);
    url.searchParams.set("key", this.config.apiKey);

    const response = await this.fetchWithRetry(url);
    const payload = (await response.json()) as Record<string, unknown>;
    const results = Array.isArray(payload.results) ? payload.results : [];
    if (payload.status !== "OK" || results.length === 0) {
      throw new Error(`Google geocoding failed with status ${String(payload.status ?? "UNKNOWN")}`);
    }

    const first = results[0] as Record<string, any>;
    const geometry = first.geometry ?? {};
    const location = geometry.location ?? {};
    const latitude = asNumber(location.lat) ?? request.latitude;
    const longitude = asNumber(location.lng) ?? request.longitude;

    return {
      latitude,
      longitude,
      formattedAddress: typeof first.formatted_address === "string" ? first.formatted_address : null,
      placeId: typeof first.place_id === "string" ? first.place_id : null,
      locationType: typeof geometry.location_type === "string" ? geometry.location_type : null,
      partialMatch: Boolean(first.partial_match),
      rawResponse: payload,
    };
  }

  private async fetchWithRetry(url: URL): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!response.ok) {
          throw new Error(`Google geocoding returned HTTP ${response.status}`);
        }
        return response;
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;
        if (attempt < this.retries) {
          await delay(backoffMs(attempt));
          continue;
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Google geocoding failed.");
  }
}

export interface OpenStreetMapGeocoderConfig {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retries?: number;
  userAgent?: string;
}

export class OpenStreetMapGeocoder implements Geocoder {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly userAgent: string;

  constructor(config: OpenStreetMapGeocoderConfig = {}) {
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.timeoutMs = config.timeoutMs ?? 12000;
    this.retries = config.retries ?? 1;
    this.userAgent = config.userAgent ?? "SolarTerritoryIntelligence/0.1";
  }

  async geocodeAddress(request: GeocodeAddressRequest): Promise<GeocodeAddressResult> {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("q", request.address);

    const response = await this.fetchWithRetry(url);
    const payload = (await response.json()) as Array<Record<string, unknown>>;
    const first = payload[0];
    if (!first) {
      throw new Error("OpenStreetMap geocoding returned no results.");
    }

    const latitude = asNumber(first.lat);
    const longitude = asNumber(first.lon);
    if (latitude == null || longitude == null) {
      throw new Error("OpenStreetMap geocoding response did not include coordinates.");
    }

    return {
      latitude,
      longitude,
      formattedAddress: asString(first.display_name),
      placeId: asString(first.place_id),
      locationType: asString(first.type),
      partialMatch: false,
      rawResponse: payload,
    };
  }

  async reverseGeocode(request: GeocodeCoordinatesRequest): Promise<GeocodeAddressResult> {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(request.latitude));
    url.searchParams.set("lon", String(request.longitude));

    const response = await this.fetchWithRetry(url);
    const payload = (await response.json()) as Record<string, unknown>;
    const latitude = asNumber(payload.lat) ?? request.latitude;
    const longitude = asNumber(payload.lon) ?? request.longitude;

    return {
      latitude,
      longitude,
      formattedAddress: asString(payload.display_name),
      placeId: asString(payload.place_id),
      locationType: asString(payload.type),
      partialMatch: false,
      rawResponse: payload,
    };
  }

  private async fetchWithRetry(url: URL): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, {
          signal: controller.signal,
          headers: {
            "user-agent": this.userAgent,
            accept: "application/json",
          },
        });
        clearTimeout(timeout);
        if (!response.ok) {
          throw new Error(`OpenStreetMap geocoding returned HTTP ${response.status}`);
        }
        return response;
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;
        if (attempt < this.retries) {
          await delay(backoffMs(attempt));
          continue;
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error("OpenStreetMap geocoding failed.");
  }
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function backoffMs(attempt: number): number {
  return Math.min(1500, 200 * 2 ** attempt);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
