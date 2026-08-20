import { randomUUID } from "node:crypto";
import fixture from "../../packages/solar-api/test-fixtures/google-building-insights.json" assert { type: "json" };
import { InMemorySolarRepository } from "../../packages/database/src/repository";
import { GoogleSolarDataProvider } from "../../packages/solar-api/src/providers/google-solar.provider";
import type {
  DiscoveryScanFilters,
  DiscoveryScanLead,
  DiscoveryScanResult,
  LeadOutcome,
  PropertySignal,
} from "@solar/contracts";
import {
  analyzeProperty,
  createRoute,
  getDealBrief,
  getLeadOutcomes,
  getPropertyDataQuality,
  getPropertyDetail,
  getRouteNext,
  getTodayDashboard,
  scanDiscovery,
  updateLeadOutcome,
} from "../../apps/api/src/store";

const ALTOONA = {
  label: "Altoona, PA 16602",
  latitude: 40.5071,
  longitude: -78.3942,
  placeId: "mock-altoona-place",
  locationType: "CITY" as const,
};

const PAGE_SIZE = 2;

interface ScanRecord {
  scanId: string;
  scanResult: DiscoveryScanResult;
  filters: DiscoveryScanFilters;
  readyAt: number;
}

interface RouteRecord {
  routeId: string;
}

export class MockHuntBackend {
  readonly repository = new InMemorySolarRepository();
  readonly solarProvider = new GoogleSolarDataProvider({
    apiKey: "test-key",
    fetchImpl: async () => new Response(JSON.stringify(fixture), { status: 200 }),
  });
  readonly scanRecords = new Map<string, ScanRecord>();
  readonly routeRecords = new Map<string, RouteRecord>();
  readonly scanRequests: string[] = [];
  readonly updateRequests: Array<{ propertyId: string; outcome: LeadOutcome["outcome"] }> = [];

  private seeded = false;
  private readonly seededIds: string[] = [];

  async init() {
    if (this.seeded) {
      return;
    }
    this.seeded = true;
    const baseLatitude = ALTOONA.latitude;
    const baseLongitude = ALTOONA.longitude;

    for (let index = 0; index < 25; index += 1) {
      const latitude = baseLatitude + index * 0.0014;
      const longitude = baseLongitude - index * 0.0011;
      const address = `${100 + index} Mock Ridge Dr, Altoona, PA 16602`;
      const analysis = await analyzeProperty(
        {
          address,
          municipality: "Altoona",
          county: "Blair",
          state: "PA",
          postalCode: "16602",
          latitude,
          longitude,
        },
        this.repository,
        { solarProvider: this.solarProvider },
      );
      this.seededIds.push(analysis.property.id);
    }

    for (const propertyId of this.seededIds.slice(0, 4)) {
      const signals = await this.repository.listPropertySignals(propertyId);
      const poolSignal: PropertySignal = {
        id: `pool-${propertyId}`,
        propertyId,
        signalType: "POOL_VISIBLE",
        source: "SATELLITE",
        valueJson: { observed: true },
        confidence: 0.96,
        observedAt: new Date().toISOString(),
        expiresAt: null,
      };
      await this.repository.replacePropertySignals(propertyId, [...signals, poolSignal]);
    }
  }

  async handle(url: URL, method: string, body?: unknown): Promise<{ status: number; json: unknown } | null> {
    if (method === "GET" && url.pathname === "/health") {
      return { status: 200, json: { status: "ok", service: "solar-api" } };
    }

    if (method === "GET" && url.pathname === "/api/v1/capabilities") {
      return { status: 200, json: { imagery: { satellite: true, streetView: false } } };
    }

    if (method === "POST" && url.pathname === "/api/v1/locations/resolve") {
      return { status: 200, json: buildLocationResponse() };
    }

    if (method === "POST" && url.pathname === "/api/v1/locations/reverse") {
      return { status: 200, json: buildLocationResponse() };
    }

    if (method === "GET" && url.pathname === "/api/v1/dashboard/today") {
      return { status: 200, json: await getTodayDashboard(this.repository) };
    }

    if (method === "GET" && url.pathname === "/api/v1/leads/top") {
      return { status: 200, json: await getTodayDashboard(this.repository) };
    }

    if (method === "GET" && url.pathname === "/api/v1/lead-outcomes") {
      const outcome = url.searchParams.get("outcome");
      const safeOutcome = outcome === "SAVED" || outcome === "SKIPPED" || outcome === "REVISIT" ? outcome : "ALL";
      return { status: 200, json: await getLeadOutcomes(this.repository, { outcome: safeOutcome }) };
    }

    if (method === "GET" && url.pathname === "/api/v1/revenue/command-center") {
      return { status: 200, json: { pipelineValue: 0, nextActions: [], topTerritory: [] } };
    }

    if (method === "POST" && url.pathname === "/api/v1/discovery/scan") {
      return this.startDiscoveryScan(body);
    }

    if (method === "GET" && /^\/api\/v1\/discovery\/scans\/[^/]+$/.test(url.pathname)) {
      const scanId = url.pathname.split("/")[5];
      return this.getDiscoveryScan(scanId);
    }

    if (method === "GET" && /^\/api\/v1\/discovery\/scans\/[^/]+\/results$/.test(url.pathname)) {
      const scanId = url.pathname.split("/")[5];
      const cursor = url.searchParams.get("cursor");
      const limit = Number(url.searchParams.get("limit") ?? "20");
      return this.getDiscoveryScanResults(scanId, cursor, Number.isFinite(limit) ? limit : 20);
    }

    if (method === "GET" && /^\/api\/v1\/properties\/[^/]+$/.test(url.pathname)) {
      const propertyId = decodeURIComponent(url.pathname.split("/")[4]);
      const detail = await getPropertyDetail(propertyId, this.repository);
      return detail ? { status: 200, json: detail } : { status: 404, json: { error: "Property not found" } };
    }

    if (method === "GET" && /^\/api\/v1\/properties\/[^/]+\/brief$/.test(url.pathname)) {
      const propertyId = decodeURIComponent(url.pathname.split("/")[4]);
      const detail = await getDealBrief(propertyId, this.repository);
      return detail ? { status: 200, json: detail } : { status: 404, json: { error: "Property not found" } };
    }

    if (method === "GET" && /^\/api\/v1\/properties\/[^/]+\/data-quality$/.test(url.pathname)) {
      const propertyId = decodeURIComponent(url.pathname.split("/")[4]);
      const detail = await getPropertyDataQuality(propertyId, this.repository);
      return detail ? { status: 200, json: detail } : { status: 404, json: { error: "Property not found" } };
    }

    if (method === "POST" && /^\/api\/v1\/properties\/[^/]+\/interactions$/.test(url.pathname)) {
      const propertyId = decodeURIComponent(url.pathname.split("/")[4]);
      const outcome = typeof body === "object" && body != null && "outcome" in body ? String((body as { outcome?: string }).outcome ?? "") : "";
      const notes = typeof body === "object" && body != null && "notes" in body ? (body as { notes?: string | null }).notes ?? null : null;
      const updated = await updateLeadOutcome(propertyId, outcome as LeadOutcome["outcome"], notes, this.repository);
      if (updated) {
        this.updateRequests.push({ propertyId, outcome: updated.outcome });
        return { status: 200, json: updated };
      }
      return { status: 404, json: { error: "Property not found" } };
    }

    if (method === "POST" && url.pathname === "/api/v1/routes/create") {
      const request = body as { startingLatitude: number; startingLongitude: number; selectedPropertyIds: string[] };
      const route = await createRoute(request, this.repository);
      this.routeRecords.set(route.id, { routeId: route.id });
      return { status: 200, json: route };
    }

    if (method === "GET" && /^\/api\/v1\/routes\/[^/]+\/next$/.test(url.pathname)) {
      const routeId = url.pathname.split("/")[4];
      return { status: 200, json: (await getRouteNext(routeId, this.repository)) ?? { error: "Route not found" } };
    }

    return null;
  }

  getSnapshot(scanId: string) {
    const record = this.scanRecords.get(scanId);
    if (!record) {
      return null;
    }

    const now = Date.now();
    const isComplete = now >= record.readyAt;
    const visibleCount = isComplete ? record.scanResult.results.length : Math.min(PAGE_SIZE, record.scanResult.results.length);

    return {
      scanId,
      status: isComplete ? "COMPLETE" : "DISCOVERING",
      currentLocation: ALTOONA.label,
      radiusMiles: record.scanResult.radiusMiles,
      candidateCount: record.scanResult.results.length,
      analyzedCount: visibleCount,
      googleSolarCalls: visibleCount,
      estimatedCostUsd: Number((visibleCount * 0.02).toFixed(2)),
      propertiesFound: record.scanResult.results.length,
      qualifiedLeadCount: record.scanResult.results.length,
      solarAnalyzedCount: visibleCount,
      results: isComplete ? record.scanResult.results : record.scanResult.results.slice(0, PAGE_SIZE),
      center: { latitude: ALTOONA.latitude, longitude: ALTOONA.longitude },
      filters: record.filters,
      discoveryDiagnostics: null,
      message: isComplete ? `Built ${record.scanResult.results.length} leads` : "Analyzing top solar opportunities",
      coverageUnavailable: false,
      updatedAt: new Date().toISOString(),
      stages: [],
      metrics: {
        rawDiscoveredCount: record.scanResult.results.length,
        residentialCandidateCount: record.scanResult.results.length,
        prequalifiedCount: record.scanResult.results.length,
        solarEligibleCount: visibleCount,
        solarAnalyzedCount: visibleCount,
        qualifiedLeadCount: record.scanResult.results.length,
        renderedLeadCount: visibleCount,
        discoveredProperties: record.scanResult.results.length,
        discoveredCount: record.scanResult.results.length,
        knownProperties: record.scanResult.results.length,
        newProperties: 0,
        prequalifiedCandidates: record.scanResult.results.length,
        solarCalls: visibleCount,
        solarCallBudget: 25,
        largeOpportunities: record.scanResult.results.filter((lead) => lead.opportunityScore >= 70).length,
        whaleCandidates: record.scanResult.results.filter((lead) => lead.whaleScore >= 60).length,
        resultsFound: visibleCount,
        estimatedCostUsd: Number((visibleCount * 0.02).toFixed(2)),
        providerCalls: 0,
        providerCoverage: "database",
        durationMs: null,
      },
    };
  }

  async startDiscoveryScan(body: unknown) {
    const request = body as {
      center?: { latitude: number; longitude: number };
      latitude?: number;
      longitude?: number;
      radiusMiles?: number;
      filters?: DiscoveryScanFilters;
      limit?: number;
      maxGoogleSolarCalls?: number;
    };

    const center = request.center ?? { latitude: request.latitude ?? ALTOONA.latitude, longitude: request.longitude ?? ALTOONA.longitude };
    const scanResult = await this.buildDiscoveryResult(center, request.radiusMiles ?? 20, request.filters ?? {});
    const scanId = scanResult.scanId;
    this.scanRequests.push(scanId);
    this.scanRecords.set(scanId, {
      scanId,
      scanResult,
      filters: request.filters ?? {},
      readyAt: Date.now() + 3_000,
    });
    return { status: 202, json: { scanId, status: "DISCOVERING" } };
  }

  getDiscoveryScan(scanId: string) {
    const snapshot = this.getSnapshot(scanId);
    if (!snapshot) {
      return { status: 404, json: { error: "Scan not found" } };
    }
    return { status: 200, json: snapshot };
  }

  getDiscoveryScanResults(scanId: string, cursor: string | null, limit: number) {
    const record = this.scanRecords.get(scanId);
    if (!record) {
      return { status: 404, json: { error: "Scan not found" } };
    }
    const isComplete = Date.now() >= record.readyAt;
    const results = record.scanResult.results;
    const startIndex = cursor ? Number(Buffer.from(cursor, "base64url").toString("utf8")) || 0 : 0;
    const pageSize = Math.max(1, Math.min(limit || PAGE_SIZE, PAGE_SIZE));
    const pageResults = results.slice(startIndex, startIndex + pageSize);
    const nextIndex = startIndex + pageResults.length;
    return {
      status: 200,
      json: {
        results: pageResults,
        nextCursor: nextIndex < results.length ? Buffer.from(String(nextIndex), "utf8").toString("base64url") : null,
        hasMore: nextIndex < results.length,
        totalAvailable: results.length,
        qualifiedLeadCount: results.length,
        isComplete,
      },
    };
  }

  async getLeadIdsByOutcome(outcome: LeadOutcome["outcome"]) {
    const dashboard = await getTodayDashboard(this.repository);
    return dashboard.leads.filter((lead) => lead.outcome === outcome).map((lead) => lead.propertyId ?? lead.id);
  }

  async getDashboard() {
    return getTodayDashboard(this.repository);
  }

  async buildDiscoveryResult(center: { latitude: number; longitude: number }, radiusMiles: number, filters: DiscoveryScanFilters): Promise<DiscoveryScanResult> {
    const dashboard = await getTodayDashboard(this.repository);
    const filtered = dashboard.leads.filter((lead) => matchesDiscoveryFilter(lead, filters));
    const results = filtered.slice(0, 25).map((lead) => ({
      ...lead,
      distanceMiles: lead.distanceMiles ?? distanceMiles(center.latitude, center.longitude, lead.latitude ?? null, lead.longitude ?? null),
      analysisStatus: "ANALYZED",
      candidateScore: lead.opportunityScore,
      routeReason: lead.nextBestAction?.reason ?? "Highest-value nearby opportunity",
    })) as DiscoveryScanLead[];

    return {
      scanId: randomUUID(),
      currentLocation: ALTOONA.label,
      radiusMiles,
      candidateCount: results.length,
      analyzedCount: results.length,
      googleSolarCalls: 0,
      estimatedCostUsd: 0,
      propertiesFound: results.length,
      qualifiedLeadCount: results.length,
      solarAnalyzedCount: results.length,
      results,
    };
  }
}

function buildLocationResponse() {
  return {
    type: "AREA",
    formattedAddress: ALTOONA.label,
    latitude: ALTOONA.latitude,
    longitude: ALTOONA.longitude,
    placeId: ALTOONA.placeId,
    propertyId: null,
    postalCode: "16602",
    city: "Altoona",
    county: "Blair",
    state: "PA",
    locationType: ALTOONA.locationType,
  };
}

function matchesDiscoveryFilter(
  lead: Awaited<ReturnType<typeof getTodayDashboard>>["leads"][number],
  filters: DiscoveryScanFilters,
) {
  if (filters.poolDetected && !lead.visualSignals.some((signal) => signal.type === "POOL" && signal.status === "DETECTED")) {
    return false;
  }
  if (filters.largeRoof && !lead.visualSignals.some((signal) => signal.type === "LARGE_ROOF" && signal.status === "DETECTED")) {
    return false;
  }
  if (filters.lowShade && !lead.visualSignals.some((signal) => signal.type === "LOW_SHADE" && signal.status === "DETECTED")) {
    return false;
  }
  if (filters.largeLot && !lead.visualSignals.some((signal) => signal.type === "LARGE_LOT" && signal.status === "DETECTED")) {
    return false;
  }
  if (filters.noDetectedSolar && lead.existingSolarStatus !== "NOT_DETECTED") {
    return false;
  }
  if (filters.minimumSystemKw != null) {
    const capacity = lead.maxRoofSolarCapacityKw ?? lead.maxSystemKw ?? null;
    if (capacity == null || capacity < filters.minimumSystemKw) {
      return false;
    }
  }
  return true;
}

function distanceMiles(lat1: number, lng1: number, lat2: number | null, lng2: number | null) {
  if (lat2 == null || lng2 == null) {
    return null;
  }
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLng / 2) ** 2;
  return Math.round((2 * earthRadiusMiles * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) * 10) / 10;
}
