import type {
  DiscoveryCoverageSummary,
  DiscoveryCapacityBand,
  DiscoveryCapacityBandCounts,
  DiscoveryFunnelBucket,
  DiscoveryFunnelCounts,
  DiscoveryMarketMetrics,
  DiscoverySaturationSummary,
  ScanCenter,
} from "../../../packages/contracts/src/index";

const MILES_PER_LATITUDE_DEGREE = 69;

export interface DiscoveryCoverageCell {
  key: string;
  center: ScanCenter;
  radiusMiles: number;
}

export interface MarketCandidateClassificationInput {
  propertyUse: string;
  address: string | null | undefined;
  verificationStatus: "VERIFIED" | "REVIEW" | "REJECTED" | "UNKNOWN";
  existingSolarStatus: "DETECTED" | "NOT_DETECTED" | "UNKNOWN";
  solarScore: number | null | undefined;
  whaleScore: number | null | undefined;
  strongScore: number | null | undefined;
  capacityKw?: number | null;
  minimumWhaleSolarScore?: number;
  processingError?: boolean;
  duplicate?: boolean;
}

export const DEFAULT_DISCOVERY_CAPACITY_THRESHOLDS = {
  largeKw: 15,
  whaleKw: 20,
  megaWhaleKw: 30,
  whaleSolarScore: 60,
} as const;

export function getDiscoveryCapacityThresholds() {
  return {
    largeKw: readPositiveNumber("DISCOVERY_LARGE_KW", DEFAULT_DISCOVERY_CAPACITY_THRESHOLDS.largeKw),
    whaleKw: readPositiveNumber("DISCOVERY_WHALE_KW", DEFAULT_DISCOVERY_CAPACITY_THRESHOLDS.whaleKw),
    megaWhaleKw: readPositiveNumber("DISCOVERY_MEGA_WHALE_KW", DEFAULT_DISCOVERY_CAPACITY_THRESHOLDS.megaWhaleKw),
    whaleSolarScore: readPositiveNumber("DISCOVERY_WHALE_SOLAR_SCORE", DEFAULT_DISCOVERY_CAPACITY_THRESHOLDS.whaleSolarScore),
  };
}

export function classifyDiscoveryCapacityBand(
  capacityKw: number | null | undefined,
  thresholds = getDiscoveryCapacityThresholds(),
): DiscoveryCapacityBand {
  if (capacityKw == null || !Number.isFinite(capacityKw)) return "UNKNOWN";
  if (capacityKw >= thresholds.megaWhaleKw) return "MEGA_WHALE";
  if (capacityKw >= thresholds.whaleKw) return "WHALE";
  if (capacityKw >= thresholds.largeKw) return "LARGE";
  if (capacityKw >= 10) return "STANDARD";
  return "UNKNOWN";
}

export function emptyDiscoveryCapacityBandCounts(): DiscoveryCapacityBandCounts {
  return { unknown: 0, standard: 0, large: 0, whale: 0, megaWhale: 0 };
}

export function addDiscoveryCapacityBand(
  counts: DiscoveryCapacityBandCounts,
  band: DiscoveryCapacityBand,
): void {
  const key = {
    UNKNOWN: "unknown",
    STANDARD: "standard",
    LARGE: "large",
    WHALE: "whale",
    MEGA_WHALE: "megaWhale",
  }[band] as keyof DiscoveryCapacityBandCounts;
  counts[key] += 1;
}

export function buildDiscoveryCoverageCells(
  center: ScanCenter,
  radiusMiles: number,
  cellSizeMiles = 1,
): DiscoveryCoverageCell[] {
  const safeRadius = Math.max(0.25, radiusMiles);
  const safeCellSize = Math.max(0.25, cellSizeMiles);
  const latitudeStep = safeCellSize / MILES_PER_LATITUDE_DEGREE;
  const longitudeStep = safeCellSize / Math.max(1, MILES_PER_LATITUDE_DEGREE * Math.cos((center.latitude * Math.PI) / 180));
  const minLatitude = center.latitude - safeRadius / MILES_PER_LATITUDE_DEGREE;
  const maxLatitude = center.latitude + safeRadius / MILES_PER_LATITUDE_DEGREE;
  const minLongitude = center.longitude - safeRadius / Math.max(1, MILES_PER_LATITUDE_DEGREE * Math.cos((center.latitude * Math.PI) / 180));
  const maxLongitude = center.longitude + safeRadius / Math.max(1, MILES_PER_LATITUDE_DEGREE * Math.cos((center.latitude * Math.PI) / 180));
  const cells: DiscoveryCoverageCell[] = [];

  for (let latitude = minLatitude; latitude <= maxLatitude + latitudeStep / 2; latitude += latitudeStep) {
    for (let longitude = minLongitude; longitude <= maxLongitude + longitudeStep / 2; longitude += longitudeStep) {
      const distanceMiles = distanceMilesBetween(center, { latitude, longitude });
      if (distanceMiles <= safeRadius + safeCellSize / 1.5) {
        const cellCenter = { latitude, longitude };
        cells.push({
          key: coverageCellKey(cellCenter, safeCellSize),
          center: cellCenter,
          radiusMiles: safeCellSize / 1.4,
        });
      }
    }
  }

  const unique = new Map(cells.map((cell) => [cell.key, cell]));
  return [...unique.values()];
}

export function coverageCellKey(point: ScanCenter, cellSizeMiles = 1): string {
  const latitudeStep = Math.max(0.25, cellSizeMiles) / MILES_PER_LATITUDE_DEGREE;
  const longitudeStep = Math.max(0.25, cellSizeMiles) / Math.max(1, MILES_PER_LATITUDE_DEGREE * Math.cos((point.latitude * Math.PI) / 180));
  return `${Math.floor(point.latitude / latitudeStep)}:${Math.floor(point.longitude / longitudeStep)}`;
}

export function classifyMarketCandidate(input: MarketCandidateClassificationInput): DiscoveryFunnelBucket {
  if (input.processingError) return "PROCESSING_ERROR";
  if (input.duplicate) return "DUPLICATE";
  if (!input.address || !/\d/.test(input.address)) return "BAD_ADDRESS";
  if (["COMMERCIAL", "INDUSTRIAL", "INSTITUTIONAL", "OTHER"].includes(input.propertyUse)) return "NON_RESIDENTIAL";
  if (["VACANT", "UNKNOWN"].includes(input.propertyUse)) return "NO_BUILDING";
  if (input.existingSolarStatus === "DETECTED") return "EXISTING_SOLAR";
  if (input.verificationStatus !== "VERIFIED") return "UNVERIFIED";
  if ((input.solarScore ?? 0) < 45) return "LOW_SOLAR";
  const thresholds = getDiscoveryCapacityThresholds();
  if (
    (input.capacityKw ?? 0) >= thresholds.whaleKw &&
    (input.solarScore ?? 0) >= (input.minimumWhaleSolarScore ?? thresholds.whaleSolarScore)
  ) return "WHALE";
  if ((input.strongScore ?? 0) >= 70) return "STRONG";
  return "VIABLE";
}

export function emptyDiscoverySaturation(): DiscoverySaturationSummary {
  return {
    discovered: 0,
    qualified: 0,
    knocked: 0,
    notKnocked: 0,
    appointments: 0,
    closed: 0,
    untouchedPercent: null,
  };
}

export function emptyDiscoveryFunnelCounts(): DiscoveryFunnelCounts {
  return {
    viable: 0,
    strong: 0,
    whale: 0,
    existingSolar: 0,
    nonResidential: 0,
    noBuilding: 0,
    badAddress: 0,
    duplicate: 0,
    lowSolar: 0,
    unverified: 0,
    processingError: 0,
    total: 0,
  };
}

export function addFunnelBucket(counts: DiscoveryFunnelCounts, bucket: DiscoveryFunnelBucket): void {
  const key = {
    VIABLE: "viable",
    STRONG: "strong",
    WHALE: "whale",
    EXISTING_SOLAR: "existingSolar",
    NON_RESIDENTIAL: "nonResidential",
    NO_BUILDING: "noBuilding",
    BAD_ADDRESS: "badAddress",
    DUPLICATE: "duplicate",
    LOW_SOLAR: "lowSolar",
    UNVERIFIED: "unverified",
    PROCESSING_ERROR: "processingError",
  }[bucket] as keyof Omit<DiscoveryFunnelCounts, "total">;
  counts[key] += 1;
  counts.total += 1;
}

export function buildCoverageSummary(input: {
  cellCount: number;
  source: string | null;
  sourceSucceeded: boolean;
  discoveredCellCount: number;
  verifiedCellCount: number;
  solarAnalyzedCellCount: number;
  completeCellCount: number;
  warning?: string | null;
}): DiscoveryCoverageSummary {
  const attemptedCellCount = input.sourceSucceeded ? input.cellCount : Math.min(input.cellCount, input.discoveredCellCount > 0 ? input.discoveredCellCount : 0);
  const status = input.cellCount === 0 || attemptedCellCount === 0
    ? "UNAVAILABLE"
    : attemptedCellCount >= input.cellCount
      ? "MEASURED"
      : "PARTIAL";
  return {
    status,
    cellCount: input.cellCount,
    attemptedCellCount,
    discoveredCellCount: input.discoveredCellCount,
    verifiedCellCount: input.verifiedCellCount,
    solarAnalyzedCellCount: input.solarAnalyzedCellCount,
    completeCellCount: input.completeCellCount,
    coveragePercent: attemptedCellCount > 0 && input.cellCount > 0
      ? Math.round((attemptedCellCount / input.cellCount) * 100)
      : null,
    source: input.source,
    warning: input.warning ?? (status === "UNAVAILABLE" ? "No geographic discovery source returned data." : null),
  };
}

export function emptyDiscoveryMarketMetrics(now = new Date().toISOString()): DiscoveryMarketMetrics {
  return {
    coverage: buildCoverageSummary({
      cellCount: 0,
      source: null,
      sourceSucceeded: false,
      discoveredCellCount: 0,
      verifiedCellCount: 0,
      solarAnalyzedCellCount: 0,
      completeCellCount: 0,
    }),
    funnel: emptyDiscoveryFunnelCounts(),
    densePocketCount: 0,
    discoveredPropertyCount: 0,
    residentialPropertyCount: 0,
    verifiedPropertyCount: 0,
    existingSolarCount: 0,
    solarViableCount: 0,
    strongLeadCount: 0,
    whaleCount: 0,
    capacityBands: emptyDiscoveryCapacityBandCounts(),
    saturation: emptyDiscoverySaturation(),
    clusteredPropertyCount: 0,
    isolatedPropertyCount: 0,
    neighborhoodSignals: {
      propertiesWithNeighbors: 0,
      nearbyPropertyCount: 0,
      nearbyVerifiedCount: 0,
      nearbyStrongCount: 0,
      nearbyWhaleCount: 0,
    },
    desiredWhaleCount: null,
    measuredAt: now,
    warnings: [],
  };
}

function readPositiveNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function distanceMilesBetween(left: ScanCenter, right: ScanCenter): number {
  const earthRadiusMiles = 3958.8;
  const latitudeDelta = ((right.latitude - left.latitude) * Math.PI) / 180;
  const longitudeDelta = ((right.longitude - left.longitude) * Math.PI) / 180;
  const leftLatitude = (left.latitude * Math.PI) / 180;
  const rightLatitude = (right.latitude * Math.PI) / 180;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(Math.max(0, 1 - haversine)));
}
