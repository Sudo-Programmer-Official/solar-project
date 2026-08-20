import type {
  DealBrief,
  DiscoverResponse,
  DiscoveryScanRequest,
  DiscoveryScanJobResponse,
  DiscoveryScanLead,
  DiscoveryScanResult,
  DiscoveryScanResultsPage,
  DiscoveryScanStatus,
  DiscoveryScanStatusResponse,
  LeadOutcome,
  LeadOutcomeCard,
  LocationResolveRequest,
  LocationResolveResponse,
  LocationReverseRequest,
  NeighborhoodMarket,
  PropertyDataQualityResponse,
  RevenueCommandCenter,
  RouteCreateRequest,
  RouteNextResponse,
  RoutePlan,
  TodayDashboard,
  OpportunitySignal,
  ImageryCapabilitiesResponse,
  MarketAreaDetail,
  MarketEventsResponse,
  MarketHotspotsResponse,
  ConversationInsight,
  HomeownerConfirmationState,
  PropertyVisualSignal,
} from "@solar/contracts";

const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

export interface PropertyDetailPayload {
  property: {
    id: string;
    normalizedAddress: string;
    street?: string | null;
    city?: string | null;
    state?: string | null;
    county?: string | null;
    municipality?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  locationVerification?: {
    geocodedLatitude?: number | null;
    geocodedLongitude?: number | null;
    solarBuildingCenterLatitude?: number | null;
    solarBuildingCenterLongitude?: number | null;
    distanceMeters: number | null;
    thresholdMeters: number;
    status: "VERIFIED" | "REVIEW" | "MISMATCH" | "UNKNOWN";
  };
  solarAssessment: {
    solarFitScore: number;
    solarFitConfidence: number;
    maxRoofSolarCapacityKw?: number | null;
    confirmedAnnualUsageKwh?: number | null;
    estimatedEnergyNeedKw?: number | null;
    estimatedMaxSystemKw?: number | null;
    estimatedAnnualProductionKwh?: number | null;
    maxArrayPanelsCount?: number | null;
    maxSunshineHoursPerYear?: number | null;
    imageryQuality?: string | null;
    existingSolarStatus: "DETECTED" | "NOT_DETECTED" | "UNKNOWN";
    imageryDate?: string | null;
    imageryProcessedDate?: string | null;
  };
  opportunityAssessment: {
    overallOpportunityScore: number;
    confidence: number;
  };
  whaleScore: {
    whaleScore: number;
    confidence: number;
    reasons: string[];
    verificationNeeded: string[];
  };
  signals: Array<{
    signalType: string;
    source: string;
    confidence: number;
    valueJson: unknown;
  }>;
  visualSignals: PropertyVisualSignal[];
  conversationInsights: ConversationInsight[];
  homeownerConfirmations: HomeownerConfirmationState;
  opportunitySignals: OpportunitySignal[];
  usageProfile: {
    annualUsageKwh?: number | null;
    monthlyBillAverage?: number | null;
    source: string;
    confidence: number;
  };
  permits: Array<{
    permitType: string;
    status: string;
    issuedDate?: string | null;
    applicationDate?: string | null;
  }>;
  leadOutcome: LeadOutcome;
  audit: {
    missingFields: string[];
    warnings: string[];
    detectedArrayStatus: string;
    selectedProductionConfig?: {
      panelsCount: number | null;
      yearlyEnergyDcKwh: number | null;
      selectionReason: string;
    } | null;
  };
  scoreBreakdown: {
    score: number;
    confidence: number;
    components: Array<{
      name: string;
      contribution: number;
      explanation: string;
    }>;
  };
  dataQuality: {
    grade: string;
    confidence: number;
    availableSignals: string[];
    missingSignals: string[];
    warnings: string[];
  };
  maxRoofSolarCapacityKw: number | null;
  confirmedAnnualUsageKwh: number | null;
  estimatedEnergyNeedKw: number | null;
  reasons: string[];
  warnings: string[];
  verificationNeeded: boolean;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(resolveUrl(path), {
      ...init,
      signal: init?.signal ?? controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

function resolveUrl(path: string): string {
  return baseUrl ? `${baseUrl}${path}` : path;
}

export async function getApiHealth(): Promise<{ status: "ok"; service: string } | null> {
  return requestJson<{ status: "ok"; service: string }>("/health");
}

export async function getCapabilities(): Promise<ImageryCapabilitiesResponse | null> {
  return requestJson<ImageryCapabilitiesResponse>("/api/v1/capabilities");
}

export async function getTopLeads(): Promise<TodayDashboard | null> {
  return requestJson<TodayDashboard>("/api/v1/leads/top");
}

export async function getLeadOutcomes(outcome: "ALL" | "SAVED" | "SKIPPED" | "REVISIT" = "ALL"): Promise<LeadOutcomeCard[] | null> {
  return requestJson<LeadOutcomeCard[]>(`/api/v1/lead-outcomes?outcome=${encodeURIComponent(outcome)}`);
}

export async function resolveLocation(body: LocationResolveRequest): Promise<LocationResolveResponse | null> {
  try {
    const response = await fetch(resolveUrl("/api/v1/locations/resolve"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.status === 404) {
      return null;
    }
    if (response.status === 503) {
      throw new Error("Geocoding unavailable");
    }
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as LocationResolveResponse;
  } catch (error) {
    if (error instanceof Error && error.message === "Geocoding unavailable") {
      throw error;
    }
    return null;
  }
}

export async function reverseLocation(body: LocationReverseRequest): Promise<LocationResolveResponse | null> {
  try {
    const response = await fetch(resolveUrl("/api/v1/locations/reverse"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.status === 404) {
      return null;
    }
    if (response.status === 503) {
      throw new Error("Geocoding unavailable");
    }
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as LocationResolveResponse;
  } catch (error) {
    if (error instanceof Error && error.message === "Geocoding unavailable") {
      throw error;
    }
    return null;
  }
}

export async function getCommandCenter(): Promise<RevenueCommandCenter | null> {
  return requestJson<RevenueCommandCenter>("/api/v1/revenue/command-center");
}

export async function getProperty(id: string): Promise<PropertyDetailPayload | null> {
  return requestJson<PropertyDetailPayload>(`/api/v1/properties/${encodeURIComponent(id)}`);
}

export async function getPropertyBrief(id: string): Promise<DealBrief | null> {
  return requestJson<DealBrief>(`/api/v1/properties/${encodeURIComponent(id)}/brief`);
}

export async function analyzeProperty(address: string): Promise<PropertyDetailPayload | null> {
  return requestJson<PropertyDetailPayload>("/api/v1/properties/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address }),
  });
}

export async function scanAroundMe(radiusMiles = 10): Promise<DiscoverResponse | null> {
  return requestJson<DiscoverResponse>(`/api/v1/neighborhoods/discover?radiusMiles=${encodeURIComponent(radiusMiles)}`);
}

export async function startDiscoveryScan(body: DiscoveryScanRequest): Promise<DiscoveryScanJobResponse | null> {
  return requestJson<DiscoveryScanJobResponse>("/api/v1/discovery/scan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function scanDiscovery(body: DiscoveryScanRequest): Promise<DiscoveryScanResult | null> {
  const job = await startDiscoveryScan(body);
  if (!job?.scanId) {
    return null;
  }
  return waitForDiscoveryScan(job.scanId);
}

export async function getDiscoveryScan(scanId: string): Promise<DiscoveryScanStatusResponse | null> {
  return requestJson<DiscoveryScanStatusResponse>(`/api/v1/discovery/scans/${encodeURIComponent(scanId)}`);
}

export async function getDiscoveryScanResults(scanId: string, cursor?: string | null, limit = 20): Promise<DiscoveryScanResultsPage | null> {
  const params = new URLSearchParams();
  if (cursor) {
    params.set("cursor", cursor);
  }
  params.set("limit", String(limit));
  const suffix = params.toString();
  return requestJson<DiscoveryScanResultsPage>(`/api/v1/discovery/scans/${encodeURIComponent(scanId)}/results${suffix ? `?${suffix}` : ""}`);
}

async function waitForDiscoveryScan(scanId: string): Promise<DiscoveryScanResult | null> {
  const terminalStatuses: DiscoveryScanStatus[] = ["COMPLETE", "PARTIAL", "FAILED", "DISCOVERY_FAILED", "DATA_COVERAGE_UNAVAILABLE"];
  const deadline = Date.now() + 45_000;
  let current = await getDiscoveryScan(scanId);
  while (current && !terminalStatuses.includes(current.status) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 750));
    current = await getDiscoveryScan(scanId);
  }
  if (!current) {
    return null;
  }
  const results = await loadAllDiscoveryScanResults(scanId);
  return {
    scanId: current.scanId,
    currentLocation: current.currentLocation,
    radiusMiles: current.radiusMiles,
    candidateCount: current.candidateCount,
    analyzedCount: current.analyzedCount,
    googleSolarCalls: current.googleSolarCalls,
    estimatedCostUsd: current.estimatedCostUsd,
    propertiesFound: current.propertiesFound,
    qualifiedLeadCount: current.qualifiedLeadCount,
    solarAnalyzedCount: current.solarAnalyzedCount,
    results,
  };
}

async function loadAllDiscoveryScanResults(scanId: string): Promise<DiscoveryScanLead[]> {
  const results: DiscoveryScanLead[] = [];
  let cursor: string | null = null;
  while (true) {
    const page = await getDiscoveryScanResults(scanId, cursor, 100);
    if (!page) {
      break;
    }
    results.push(...page.results);
    if (!page.hasMore || !page.nextCursor) {
      break;
    }
    cursor = page.nextCursor;
  }
  return results;
}

export async function createRoute(body: RouteCreateRequest): Promise<RoutePlan | null> {
  return requestJson<RoutePlan>("/api/v1/routes/create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function getRouteNext(routeId: string): Promise<RouteNextResponse | null> {
  return requestJson<RouteNextResponse>(`/api/v1/routes/${encodeURIComponent(routeId)}/next`);
}

export async function getPropertyDataQuality(id: string): Promise<PropertyDataQualityResponse | null> {
  return requestJson<PropertyDataQualityResponse>(`/api/v1/properties/${encodeURIComponent(id)}/data-quality`);
}

export async function getMarketHotspots(params: {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  days: number;
}): Promise<MarketHotspotsResponse | null> {
  const query = new URLSearchParams({
    latitude: String(params.latitude),
    longitude: String(params.longitude),
    radiusMiles: String(params.radiusMiles),
    days: String(params.days),
  });
  return requestJson<MarketHotspotsResponse>(`/api/v1/markets/hotspots?${query.toString()}`);
}

export async function getMarketArea(id: string): Promise<MarketAreaDetail | null> {
  return requestJson<MarketAreaDetail>(`/api/v1/markets/${encodeURIComponent(id)}`);
}

export async function getMarketEvents(
  marketId: string,
  cursor?: string | null,
  limit = 20,
): Promise<MarketEventsResponse | null> {
  const params = new URLSearchParams();
  if (cursor) {
    params.set("cursor", cursor);
  }
  params.set("limit", String(limit));
  const suffix = params.toString();
  return requestJson<MarketEventsResponse>(`/api/v1/markets/${encodeURIComponent(marketId)}/events${suffix ? `?${suffix}` : ""}`);
}

export async function updateLeadOutcome(propertyId: string, outcome: LeadOutcome["outcome"], notes: string | null): Promise<LeadOutcome | null> {
  return requestJson<LeadOutcome>(`/api/v1/properties/${encodeURIComponent(propertyId)}/interactions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ outcome, notes }),
  });
}

export async function savePropertyVisualSignals(
  propertyId: string,
  body: HomeownerConfirmationState,
): Promise<PropertyDetailPayload | null> {
  return requestJson<PropertyDetailPayload>(`/api/v1/properties/${encodeURIComponent(propertyId)}/visual-signals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
