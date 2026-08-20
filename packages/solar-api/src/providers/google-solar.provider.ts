export interface BuildingInsightsRequest {
  latitude: number;
  longitude: number;
  requiredQuality?: "HIGH" | "MEDIUM" | "LOW" | "UNSPECIFIED";
  additionalInsights?: Array<"DETECTED_ARRAYS">;
}

export interface SolarDataProvider {
  getBuildingInsights(request: BuildingInsightsRequest): Promise<unknown>;
  normalizeBuildingInsights(response: unknown): NormalizedBuildingInsights;
  getNormalizedBuildingInsights(request: BuildingInsightsRequest): Promise<NormalizedBuildingInsights>;
}

export interface NormalizedCoordinates {
  latitude: number;
  longitude: number;
}

export interface NormalizedRoofSegmentStat {
  segmentIndex: number;
  areaMeters2: number | null;
  pitchDegrees: number | null;
  azimuthDegrees: number | null;
  sunshineHours: number | null;
  panelsCount: number | null;
  yearlyEnergyDcKwh: number | null;
  raw: Record<string, unknown>;
}

export interface NormalizedSolarPanelConfig {
  panelsCount: number | null;
  yearlyEnergyDcKwh: number | null;
  orientation: string | null;
  pitchDegrees: number | null;
  azimuthDegrees: number | null;
  panelHeightMeters: number | null;
  panelWidthMeters: number | null;
  raw: Record<string, unknown>;
}

export interface NormalizedSolarPanel {
  center: NormalizedCoordinates | null;
  orientation: string | null;
  segmentIndex: number | null;
  raw: Record<string, unknown>;
}

export interface NormalizedDetectedArrays {
  detectionStatus: "DETECTED" | "NOT_DETECTED" | "UNKNOWN";
  latestCaptureDate: string | null;
  raw: Record<string, unknown>;
}

export interface SelectedProductionConfig {
  panelsCount: number | null;
  yearlyEnergyDcKwh: number | null;
  selectionReason: string;
  raw: Record<string, unknown>;
}

export interface NormalizedBuildingInsights {
  provider: "google_solar";
  providerVersion: string | null;
  imageryDate: string | null;
  imageryProcessedDate: string | null;
  imageryQuality: string | null;
  providerBuildingId: string | null;
  buildingCenter: NormalizedCoordinates | null;
  roofAreaMeters2: number | null;
  groundAreaMeters2: number | null;
  maxArrayAreaMeters2: number | null;
  maxArrayPanelsCount: number | null;
  panelCapacityWatts: number | null;
  maxSunshineHoursPerYear: number | null;
  estimatedMaxSystemKw: number | null;
  estimatedAnnualProductionKwh: number | null;
  detectedArrays: NormalizedDetectedArrays;
  existingSolarStatus: "DETECTED" | "NOT_DETECTED" | "UNKNOWN";
  existingSolarConfidence: number | null;
  selectedProductionConfig: SelectedProductionConfig | null;
  wholeRoofStats: Array<Record<string, unknown>>;
  buildingStats: Array<Record<string, unknown>>;
  roofSegmentStats: NormalizedRoofSegmentStat[];
  roofSegmentCount: number;
  solarPanelConfigs: NormalizedSolarPanelConfig[];
  solarPanels: NormalizedSolarPanel[];
  missingFields: string[];
  warnings: string[];
  rawResponse: unknown;
}

export interface GoogleSolarProviderConfig {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retries?: number;
}

export class SolarProviderError extends Error {
  constructor(
    public readonly code:
      | "BUILDING_NOT_FOUND"
      | "UNSUPPORTED_LOCATION"
      | "RATE_LIMITED"
      | "QUOTA_EXCEEDED"
      | "AUTHENTICATION_FAILED"
      | "TIMEOUT"
      | "MALFORMED_RESPONSE"
      | "NETWORK_ERROR"
      | "HTTP_ERROR",
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "SolarProviderError";
  }
}

const REALISTIC_PANEL_CAPACITY_WATTS = {
  min: 250,
  max: 700,
} as const;

export class GoogleSolarDataProvider implements SolarDataProvider {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly retries: number;

  constructor(private readonly config: GoogleSolarProviderConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.timeoutMs = config.timeoutMs ?? 12000;
    this.retries = config.retries ?? 2;
  }

  async getBuildingInsights(request: BuildingInsightsRequest): Promise<unknown> {
    const url = new URL("https://solar.googleapis.com/v1/buildingInsights:findClosest");
    url.searchParams.set("location.latitude", String(request.latitude));
    url.searchParams.set("location.longitude", String(request.longitude));
    url.searchParams.set("requiredQuality", request.requiredQuality ?? "MEDIUM");
    url.searchParams.set("key", this.config.apiKey);
    if (request.additionalInsights?.includes("DETECTED_ARRAYS")) {
      url.searchParams.set("additionalInsights", "DETECTED_ARRAYS");
    }

    const response = await this.fetchWithRetry(url);
    return response.json();
  }

  async getNormalizedBuildingInsights(request: BuildingInsightsRequest): Promise<NormalizedBuildingInsights> {
    const raw = await this.getBuildingInsights(request);
    return this.normalizeBuildingInsights(raw);
  }

  normalizeBuildingInsights(response: unknown): NormalizedBuildingInsights {
    const payload = asRecord(response);
    if (!payload) {
      throw new SolarProviderError("MALFORMED_RESPONSE", "Google Solar API response was not an object.");
    }

    const solarPotential = asRecord(payload.solarPotential) ?? {};
    const roofSegmentStats = normalizeRoofSegmentStats(payload.roofSegmentStats);
    const solarPanelConfigs = normalizeSolarPanelConfigs(solarPotential.solarPanelConfigs);
    const solarPanels = normalizeSolarPanels(payload.solarPanels ?? solarPotential.solarPanels);
    const detectedArrays = normalizeDetectedArrays(payload.detectedArrays);
    const selectedProductionConfig = selectProductionConfig(solarPanelConfigs);
    const buildingCenter = normalizeCoordinates(getNestedRecord(payload, "center") ?? getNestedRecord(payload, "buildingCenter") ?? getNestedRecord(solarPotential, "center"));
    const maxArrayPanelsCount = asNumber(solarPotential.maxArrayPanelsCount);
    const panelCapacityWatts = asNumber(solarPotential.panelCapacityWatts);
    const estimatedMaxSystemKw =
      maxArrayPanelsCount != null && panelCapacityWatts != null
        ? (maxArrayPanelsCount * panelCapacityWatts) / 1000
        : null;

    const estimatedAnnualProductionKwh =
      selectedProductionConfig?.yearlyEnergyDcKwh ??
      maxByNumber(roofSegmentStats.map((segment) => segment.yearlyEnergyDcKwh)) ??
      null;

    const warnings = buildProviderWarnings({
      panelCapacityWatts,
      maxArrayPanelsCount,
      estimatedMaxSystemKw,
      roofSegmentCount: roofSegmentStats.length,
      imageryDate: asString(payload.imageryDate),
      detectedArrays,
    });

    const missingFields = buildMissingFields({
      imageryDate: asString(payload.imageryDate),
      detectedArrays,
      roofSegmentStats,
      selectedProductionConfig,
      buildingCenter,
    });

    return {
      provider: "google_solar",
      providerVersion: asString(payload.version) ?? asString(payload.providerVersion),
      imageryDate: asString(payload.imageryDate),
      imageryProcessedDate: asString(payload.imageryProcessedDate),
      imageryQuality: asString(payload.imageryQuality),
      providerBuildingId: asString(payload.buildingId) ?? asString(payload.name),
      buildingCenter,
      roofAreaMeters2: asNumber(payload.roofAreaMeters2) ?? asNumber(payload.roofArea),
      groundAreaMeters2: asNumber(payload.groundAreaMeters2),
      maxArrayAreaMeters2: asNumber(solarPotential.maxArrayAreaMeters2),
      maxArrayPanelsCount,
      panelCapacityWatts,
      maxSunshineHoursPerYear: asNumber(solarPotential.maxSunshineHoursPerYear),
      estimatedMaxSystemKw,
      estimatedAnnualProductionKwh,
      detectedArrays,
      existingSolarStatus: detectedArrays.detectionStatus,
      existingSolarConfidence: detectedArraysConfidence(detectedArrays),
      selectedProductionConfig,
      wholeRoofStats: normalizeRecordArray(payload.wholeRoofStats),
      buildingStats: normalizeRecordArray(payload.buildingStats),
      roofSegmentStats,
      roofSegmentCount: roofSegmentStats.length,
      solarPanelConfigs,
      solarPanels,
      missingFields,
      warnings,
      rawResponse: response,
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
        if (response.ok) {
          return response;
        }
        const mapped = mapHttpError(response.status);
        if (mapped) {
          if (mapped.retryable && attempt < this.retries) {
            lastError = mapped.error;
            await delay(backoffMs(attempt));
            continue;
          }
          throw mapped.error;
        }
        throw new SolarProviderError("HTTP_ERROR", `Google Solar API returned ${response.status}.`, response.status);
      } catch (error) {
        clearTimeout(timeout);
        if (error instanceof SolarProviderError) {
          throw error;
        }
        if (error instanceof DOMException && error.name === "AbortError") {
          lastError = new SolarProviderError("TIMEOUT", "Google Solar API request timed out.");
        } else {
          lastError = new SolarProviderError("NETWORK_ERROR", error instanceof Error ? error.message : "Network error");
        }
        if (attempt < this.retries) {
          await delay(backoffMs(attempt));
          continue;
        }
      }
    }
    throw lastError instanceof Error ? lastError : new SolarProviderError("NETWORK_ERROR", "Google Solar API request failed.");
  }
}

function normalizeDetectedArrays(value: unknown): NormalizedDetectedArrays {
  const record = asRecord(value);
  if (!record) {
    return {
      detectionStatus: "UNKNOWN",
      latestCaptureDate: null,
      raw: {},
    };
  }

  return {
    detectionStatus: mapDetectionStatus(asString(record.detectionStatus)),
    latestCaptureDate: asString(record.latestCaptureDate),
    raw: record,
  };
}

function detectedArraysConfidence(value: NormalizedDetectedArrays): number | null {
  switch (value.detectionStatus) {
    case "DETECTED":
      return 0.98;
    case "NOT_DETECTED":
      return 0.9;
    default:
      return null;
  }
}

function mapDetectionStatus(value: string | null): "DETECTED" | "NOT_DETECTED" | "UNKNOWN" {
  switch (value) {
    case "DETECTION_STATUS_ARRAYS_DETECTED":
      return "DETECTED";
    case "DETECTION_STATUS_NO_ARRAYS_DETECTED":
      return "NOT_DETECTED";
    case "DETECTION_STATUS_DATA_UNAVAILABLE":
    case "DETECTION_STATUS_UNSPECIFIED":
    default:
      return "UNKNOWN";
  }
}

function normalizeRoofSegmentStats(value: unknown): NormalizedRoofSegmentStat[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((segment, index) => {
    const record = asRecord(segment) ?? {};
    return {
      segmentIndex: index,
      areaMeters2: asNumber(record.areaMeters2),
      pitchDegrees: asNumber(record.pitchDegrees),
      azimuthDegrees: asNumber(record.azimuthDegrees),
      sunshineHours: asNumber(record.sunshineHours),
      panelsCount: asNumber(record.panelsCount),
      yearlyEnergyDcKwh: asNumber(record.yearlyEnergyDcKwh) ?? asNumber(record.yearlyEnergyKwh),
      raw: record,
    };
  });
}

function normalizeSolarPanelConfigs(value: unknown): NormalizedSolarPanelConfig[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((config) => {
    const record = asRecord(config) ?? {};
    return {
      panelsCount: asNumber(record.panelsCount),
      yearlyEnergyDcKwh: asNumber(record.yearlyEnergyDcKwh),
      orientation: asString(record.orientation),
      pitchDegrees: asNumber(record.pitchDegrees),
      azimuthDegrees: asNumber(record.azimuthDegrees),
      panelHeightMeters: asNumber(record.panelHeightMeters),
      panelWidthMeters: asNumber(record.panelWidthMeters),
      raw: record,
    };
  });
}

function normalizeSolarPanels(value: unknown): NormalizedSolarPanel[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((panel) => {
    const record = asRecord(panel) ?? {};
    return {
      center: normalizeCoordinates(record.center),
      orientation: asString(record.orientation),
      segmentIndex: asNumber(record.segmentIndex),
      raw: record,
    };
  });
}

function normalizeCoordinates(value: unknown): NormalizedCoordinates | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const latitude = asNumber(record.latitude ?? record.lat);
  const longitude = asNumber(record.longitude ?? record.lng);
  if (latitude == null || longitude == null) {
    return null;
  }
  return { latitude, longitude };
}

function getNestedRecord(source: Record<string, unknown>, key: string): Record<string, unknown> | null {
  return asRecord(source[key]);
}

function normalizeRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => asRecord(entry) ?? {});
}

function selectProductionConfig(configs: NormalizedSolarPanelConfig[]): SelectedProductionConfig | null {
  const valid = configs.filter((config) => isValidCount(config.panelsCount) && isValidEnergy(config.yearlyEnergyDcKwh));
  if (valid.length === 0) {
    return null;
  }
  const ordered = [...valid].sort((a, b) => {
    const countDelta = (b.panelsCount ?? 0) - (a.panelsCount ?? 0);
    if (countDelta !== 0) {
      return countDelta;
    }
    return (b.yearlyEnergyDcKwh ?? 0) - (a.yearlyEnergyDcKwh ?? 0);
  });
  const selected = ordered[0];
  const reason = valid.length === 1 ? "only valid production config" : "largest valid panel count and production estimate";
  return {
    panelsCount: selected.panelsCount ?? null,
    yearlyEnergyDcKwh: selected.yearlyEnergyDcKwh ?? null,
    selectionReason: reason,
    raw: selected.raw,
  };
}

function buildProviderWarnings(input: {
  panelCapacityWatts: number | null;
  maxArrayPanelsCount: number | null;
  estimatedMaxSystemKw: number | null;
  roofSegmentCount: number;
  imageryDate: string | null;
  detectedArrays: NormalizedDetectedArrays;
}): string[] {
  const warnings: string[] = [];
  if (input.panelCapacityWatts != null && !isRealisticPanelCapacity(input.panelCapacityWatts)) {
    warnings.push("PANEL_CAPACITY_OUT_OF_RANGE");
  }
  if (input.maxArrayPanelsCount != null && input.maxArrayPanelsCount <= 0) {
    warnings.push("SYSTEM_SIZE_UNAVAILABLE");
  }
  if ((input.estimatedMaxSystemKw ?? 0) > 30) {
    warnings.push("LARGE_SYSTEM_REVIEW");
  }
  if (input.roofSegmentCount === 0) {
    warnings.push("ROOF_SEGMENTS_UNAVAILABLE");
  }
  if (!input.imageryDate) {
    warnings.push("MISSING_IMAGERY_DATE");
  }
  if (input.detectedArrays.detectionStatus === "UNKNOWN") {
    warnings.push("DETECTED_ARRAYS_UNAVAILABLE");
  }
  return warnings;
}

function buildMissingFields(input: {
  imageryDate: string | null;
  detectedArrays: NormalizedDetectedArrays;
  roofSegmentStats: NormalizedRoofSegmentStat[];
  selectedProductionConfig: SelectedProductionConfig | null;
  buildingCenter: NormalizedCoordinates | null;
}): string[] {
  const missing: string[] = [];
  if (!input.imageryDate) missing.push("imageryDate");
  if (input.detectedArrays.detectionStatus === "UNKNOWN" && Object.keys(input.detectedArrays.raw).length === 0) {
    missing.push("detectedArrays");
  }
  if (input.roofSegmentStats.length === 0) missing.push("roofSegmentStats");
  if (!input.selectedProductionConfig) missing.push("solarPanelConfigs");
  if (!input.buildingCenter) missing.push("buildingCenter");
  return missing;
}

function mapHttpError(status: number): { error: SolarProviderError; retryable: boolean } | null {
  if (status === 400 || status === 404) {
    return {
      error: new SolarProviderError(
        status === 404 ? "BUILDING_NOT_FOUND" : "UNSUPPORTED_LOCATION",
        status === 404
          ? "No building found for the supplied coordinates."
          : "The supplied location is not supported by Google Solar API.",
        status,
      ),
      retryable: false,
    };
  }
  if (status === 401 || status === 403) {
    return {
      error: new SolarProviderError("AUTHENTICATION_FAILED", `Google Solar API returned ${status}.`, status),
      retryable: false,
    };
  }
  if (status === 402) {
    return {
      error: new SolarProviderError("QUOTA_EXCEEDED", "Google Solar API quota exceeded.", status),
      retryable: false,
    };
  }
  if (status === 429) {
    return {
      error: new SolarProviderError("RATE_LIMITED", "Google Solar API rate limit reached.", status),
      retryable: true,
    };
  }
  if (status >= 500) {
    return {
      error: new SolarProviderError("HTTP_ERROR", `Google Solar API returned ${status}.`, status),
      retryable: true,
    };
  }
  return null;
}

function maxByNumber(values: Array<number | null>): number | null {
  return values.reduce<number | null>((best, value) => {
    if (value == null) return best;
    if (best == null || value > best) return value;
    return best;
  }, null);
}

function isRealisticPanelCapacity(value: number): boolean {
  return value >= REALISTIC_PANEL_CAPACITY_WATTS.min && value <= REALISTIC_PANEL_CAPACITY_WATTS.max;
}

function isValidCount(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isValidEnergy(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function backoffMs(attempt: number): number {
  return Math.min(2000, 250 * 2 ** attempt);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
