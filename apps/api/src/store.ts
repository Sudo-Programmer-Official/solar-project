import { createHash } from "node:crypto";
import {
  validateGeocodingEnv,
  validateSolarApiEnv,
  loadAppEnv,
} from "../../../packages/config/src/index";
import {
  normalizeAddress,
  GoogleMapsGeocoder,
  type Geocoder,
} from "../../../packages/geospatial/src/index";
import {
  GoogleSolarDataProvider,
  SolarProviderError,
  type NormalizedDetectedArrays,
  type NormalizedBuildingInsights,
  type NormalizedCoordinates,
  type SolarDataProvider,
} from "../../../packages/solar-api/src/index";
import {
  InMemorySolarRepository,
  type PropertyDiscoveryRecord,
  type PropertyDiscoveryUpsertInput,
  type SolarAssessmentAuditRecord,
  type SolarRepository,
} from "../../../packages/database/src/repository";
import type {
  CommandCenterRepRanking,
  CommandCenterStageRollup,
  CommandCenterTerritoryRanking,
  DiscoveryScanFilters,
  DiscoveryDiagnostics,
  DiscoveryScanLead,
  DiscoveryScanJobResponse,
  DiscoveryScanMetrics,
  DiscoveryProviderAttemptDiagnostics,
  DiscoveryScanRequest,
  DiscoveryScanResult,
  DiscoveryScanProgress,
  DiscoveryScanStatusResponse,
  DiscoveryScanResultsPage,
  DiscoveryScanStageProgress,
  DiscoveryScanStatus,
  DiscoverResponse,
  DealBrief,
  DealStage,
  DataQualitySummary,
  LeadOutcome,
  LeadSignalBadge,
  LocationResolveResponse,
  OpportunityAssessment,
  PermitRecord,
  Property,
  PropertySignal,
  NeighborhoodMarket,
  LocationMatchStatus,
  LocationVerificationSummary,
  RoofSegment,
  SolarAssessmentAudit,
  SolarFitScoreBreakdown,
  SolarFitScoreComponent,
  SolarAssessment,
  RouteCreateRequest,
  RouteNextResponse,
  RoutePlan,
  RouteStop,
  NextBestAction,
  OpportunitySignal,
  RevenueCommandCenter,
  TodayDashboard,
  TodayLeadCard,
  UsageProfile,
} from "../../../packages/contracts/src/index";
import { calculateWhaleScore, type WhaleScoreResult } from "../../../packages/scoring/src/index";
import { recommendNextBestAction } from "../../../packages/lead-intelligence/src/index";
import {
  OverpassPropertyDiscoveryProvider,
  GridGeocodingPropertyDiscoveryProvider,
  type DiscoveredProperty,
  type PropertyDiscoveryInput,
  type PropertyDiscoveryProvider,
} from "./property-discovery";

export interface AnalyzeInput {
  address: string;
  latitude?: number;
  longitude?: number;
  municipality?: string;
  county?: string;
  state?: string;
  postalCode?: string;
}

export interface AnalyzeDependencies {
  geocoder?: Geocoder;
  solarProvider?: SolarDataProvider;
}

export interface LegacyDiscoveryScanRequest {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  filters?: DiscoveryScanFilters;
  limit?: number;
  maxGoogleSolarCalls?: number;
}

export type DiscoveryScanInput = DiscoveryScanRequest | LegacyDiscoveryScanRequest;

export interface AnalyzeResult {
  property: Property;
  solar: NormalizedBuildingInsights;
  solarAssessment: SolarAssessment;
  audit: SolarAssessmentAudit;
  scoreBreakdown: SolarFitScoreBreakdown;
  reasons: string[];
  warnings: string[];
  verificationNeeded: boolean;
  maxRoofSolarCapacityKw: number | null;
  confirmedAnnualUsageKwh: number | null;
  estimatedEnergyNeedKw: number | null;
  dataQuality: DataQualitySummary;
  locationVerification: LocationVerificationSummary;
  opportunityAssessment: OpportunityAssessment;
  whaleScore: WhaleScoreResult;
  signals: PropertySignal[];
  opportunitySignals: OpportunitySignal[];
  usageProfile: UsageProfile;
  permits: PermitRecord[];
  leadOutcome: LeadOutcome;
}

export interface PropertyAnalysisDebugResult {
  property: Property | null;
  geocoding: {
    requestedCoordinates: NormalizedCoordinates | null;
    returnedBuildingCenter: NormalizedCoordinates | null;
    distanceMeters: number | null;
    source: string | null;
  } | null;
  solarProviderInputs: {
    latitude: number | null;
    longitude: number | null;
    requiredQuality: "HIGH" | "MEDIUM" | "LOW" | "UNSPECIFIED";
    additionalInsights: Array<"DETECTED_ARRAYS">;
  } | null;
  normalizedFields: NormalizedBuildingInsights | null;
  audit: SolarAssessmentAudit | null;
  scoreBreakdown: SolarFitScoreBreakdown | null;
  warnings: string[];
  missingFields: string[];
}

const defaultRepository = new InMemorySolarRepository();
const discoveryScanStore = new Map<string, DiscoveryScanProgress>();
const routeStore = new Map<string, RoutePlan>();

function createDiscoveryDiagnostics(center: { latitude: number; longitude: number }, radiusMiles: number): DiscoveryDiagnostics {
  return {
    center,
    radiusMiles,
    providersAttempted: [],
    rawCandidateCount: 0,
    deduplicatedCandidateCount: 0,
    residentialCandidateCount: 0,
    prequalifiedCount: 0,
  };
}

export async function analyzeProperty(
  input: AnalyzeInput,
  repository: SolarRepository = defaultRepository,
  dependencies: AnalyzeDependencies = {},
): Promise<AnalyzeResult> {
  const env = loadAppEnv();
  const resolvedDependencies = resolveAnalysisDependencies(env, dependencies);
  const propertyKey = stableId(normalizeAddress(input.address));
  const cachedProperty = await repository.getPropertyById(propertyKey);
  const location = await resolveLocation(input, resolvedDependencies.geocoder, cachedProperty);
  const property = await upsertProperty(input, location, repository, propertyKey);
  const cachedAssessment = await repository.getSolarAssessmentByPropertyId(property.id);
  const cachedAudit = cachedAssessment ? await repository.getSolarAssessmentAuditByAssessmentId(cachedAssessment.id) : null;
  const shouldUseCachedAssessment = cachedAssessment != null && cachedAudit != null && isCacheableAudit(cachedAudit.auditJson);
  const solar = shouldUseCachedAssessment
    ? await loadCachedSolarInsights(cachedAssessment, cachedAudit, repository)
    : await fetchSolarInsights(resolvedDependencies.solarProvider, location.latitude, location.longitude);
  const { solarAssessment, audit, scoreBreakdown, reasons, warnings, verificationNeeded } = await persistSolarAnalysis(
    property,
    location,
    solar,
    repository,
  );
  const propertySignals = await buildSignals(property, solarAssessment, solar, repository);
  const usageProfile = await buildUsageProfile(property, propertySignals, solarAssessment, repository);
  const maxRoofSolarCapacityKw = solarAssessment.estimatedMaxSystemKw ?? null;
  const confirmedAnnualUsageKwh = usageProfile.annualUsageKwh ?? null;
  const estimatedEnergyNeedKw = estimateEnergyNeedKw(confirmedAnnualUsageKwh);
  const whaleScore = buildWhaleScore(propertySignals, solarAssessment, usageProfile);
  const permitList = await buildPermits(property, repository);
  const opportunityAssessment = await buildOpportunityAssessment(
    property,
    solarAssessment,
    usageProfile,
    whaleScore,
    permitList,
    repository,
  );
  const leadOutcome = await buildLeadOutcome(property, repository);
  const dataQuality = buildDataQualitySummary({
    solarAssessment,
    usageProfile,
    propertySignals,
    permits: permitList,
    audit,
    warnings,
  });
  const locationVerification = buildLocationVerificationSummary(property, audit, env.locationMatchThresholdMeters ?? 10);
  const analysisBase: AnalyzeResult = {
    property,
    solar,
    solarAssessment,
    audit,
    scoreBreakdown,
    reasons,
    warnings,
    verificationNeeded,
    maxRoofSolarCapacityKw,
    confirmedAnnualUsageKwh,
    estimatedEnergyNeedKw,
    dataQuality,
    locationVerification,
    opportunityAssessment,
    whaleScore,
    signals: propertySignals,
    opportunitySignals: [],
    usageProfile,
    permits: permitList,
    leadOutcome,
  };

  return {
    ...analysisBase,
    opportunitySignals: buildOpportunitySignals(analysisBase),
  };
}

async function fetchSolarInsights(
  solarProvider: SolarDataProvider,
  latitude: number,
  longitude: number,
): Promise<NormalizedBuildingInsights> {
  const qualities: Array<"HIGH" | "MEDIUM" | "LOW" | "UNSPECIFIED"> = ["HIGH", "MEDIUM", "LOW", "UNSPECIFIED"];
  let lastError: unknown;
  for (const requiredQuality of qualities) {
    try {
      return await solarProvider.getNormalizedBuildingInsights({
        latitude,
        longitude,
        requiredQuality,
        additionalInsights: ["DETECTED_ARRAYS"],
      });
    } catch (error) {
      lastError = error;
      if (error instanceof SolarProviderError && error.code === "BUILDING_NOT_FOUND") {
        continue;
      }
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new SolarProviderError("BUILDING_NOT_FOUND", "No building found for the supplied coordinates.");
}

export async function listPermitsForProperty(
  propertyId: string,
  repository: SolarRepository = defaultRepository,
): Promise<PermitRecord[]> {
  return repository.listPermits(propertyId);
}

export async function listPermits(
  propertyId: string,
  repository: SolarRepository = defaultRepository,
): Promise<PermitRecord[]> {
  return repository.listPermits(propertyId);
}

export async function getPermitStats(
  municipality: string,
  repository: SolarRepository = defaultRepository,
) {
  return repository.getPermitStats(municipality);
}

export async function getPropertyAnalysisDebug(
  propertyId: string,
  repository: SolarRepository = defaultRepository,
): Promise<PropertyAnalysisDebugResult> {
  const property = await repository.getPropertyById(propertyId);
  if (!property) {
    return {
      property: null,
      geocoding: null,
      solarProviderInputs: null,
      normalizedFields: null,
      audit: null,
      scoreBreakdown: null,
      warnings: [],
      missingFields: ["property"],
    };
  }

  const assessment = await repository.getSolarAssessmentByPropertyId(propertyId);
  if (!assessment) {
    return {
      property,
      geocoding: null,
      solarProviderInputs: null,
      normalizedFields: null,
      audit: null,
      scoreBreakdown: null,
      warnings: [],
      missingFields: ["solarAssessment"],
    };
  }

  const auditRecord = await repository.getSolarAssessmentAuditByAssessmentId(assessment.id);
  const normalizedFields = auditRecord ? await loadCachedSolarInsights(assessment, auditRecord, repository) : null;

  return {
    property,
    geocoding: auditRecord
      ? {
          requestedCoordinates: auditRecord.auditJson.requestedCoordinates,
          returnedBuildingCenter: auditRecord.auditJson.returnedBuildingCenter,
          distanceMeters: auditRecord.auditJson.distanceMeters,
          source: "cached-audit",
        }
      : null,
    solarProviderInputs: auditRecord
      ? {
          latitude: auditRecord.auditJson.requestedCoordinates?.latitude ?? null,
          longitude: auditRecord.auditJson.requestedCoordinates?.longitude ?? null,
          requiredQuality: "HIGH",
          additionalInsights: ["DETECTED_ARRAYS"],
        }
      : null,
    normalizedFields,
    audit: auditRecord?.auditJson ?? null,
    scoreBreakdown: auditRecord?.scoreBreakdownJson ?? null,
    warnings: auditRecord?.auditJson.warnings ?? [],
    missingFields: auditRecord?.auditJson.missingFields ?? [],
  };
}

async function hydrateStoredAnalysis(
  property: Property,
  repository: SolarRepository,
): Promise<AnalyzeResult | null> {
  const env = loadAppEnv();
  const solarAssessment = await repository.getSolarAssessmentByPropertyId(property.id);
  if (!solarAssessment) {
    return null;
  }

  const auditRecord = await repository.getSolarAssessmentAuditByAssessmentId(solarAssessment.id);
  if (!auditRecord) {
    return null;
  }

  const solar = await loadCachedSolarInsights(solarAssessment, auditRecord, repository);
  const propertySignals = await buildSignals(property, solarAssessment, solar, repository);
  const usageProfile = await buildUsageProfile(property, propertySignals, solarAssessment, repository);
  const maxRoofSolarCapacityKw = solarAssessment.estimatedMaxSystemKw ?? null;
  const confirmedAnnualUsageKwh = usageProfile.annualUsageKwh ?? null;
  const estimatedEnergyNeedKw = estimateEnergyNeedKw(confirmedAnnualUsageKwh);
  const whaleScore = buildWhaleScore(propertySignals, solarAssessment, usageProfile);
  const permitList = await buildPermits(property, repository);
  const opportunityAssessment = await buildOpportunityAssessment(
    property,
    solarAssessment,
    usageProfile,
    whaleScore,
    permitList,
    repository,
  );
  const leadOutcome = await buildLeadOutcome(property, repository);
  const audit = auditRecord.auditJson;
  const scoreBreakdown = auditRecord.scoreBreakdownJson;
  const reasons = buildSolarReasons(solar, scoreBreakdown);
  const warnings = [...new Set(audit.warnings)];
  const verificationNeeded = warnings.length > 0 || solarAssessment.existingSolarStatus !== "NOT_DETECTED";
  const dataQuality = buildDataQualitySummary({
    solarAssessment,
    usageProfile,
    propertySignals,
    permits: permitList,
    audit,
    warnings,
  });
  const locationVerification = buildLocationVerificationSummary(property, audit, env.locationMatchThresholdMeters ?? 10);
  const analysisBase: AnalyzeResult = {
    property,
    solar,
    solarAssessment,
    audit,
    scoreBreakdown,
    reasons,
    warnings,
    verificationNeeded,
    maxRoofSolarCapacityKw,
    confirmedAnnualUsageKwh,
    estimatedEnergyNeedKw,
    dataQuality,
    locationVerification,
    opportunityAssessment,
    whaleScore,
    signals: propertySignals,
    opportunitySignals: [],
    usageProfile,
    permits: permitList,
    leadOutcome,
  };

  return {
    ...analysisBase,
    opportunitySignals: buildOpportunitySignals(analysisBase),
  };
}

export async function getPropertyDetail(
  propertyId: string,
  repository: SolarRepository = defaultRepository,
): Promise<AnalyzeResult | null> {
  const property = await repository.getPropertyById(propertyId);
  if (!property) {
    return null;
  }
  const analysis = await hydrateStoredAnalysis(property, repository);
  if (analysis) {
    return analysis;
  }

  return null;
}

export async function getPropertyDataQuality(
  propertyId: string,
  repository: SolarRepository = defaultRepository,
): Promise<{ propertyId: string; summary: DataQualitySummary } | null> {
  const detail = await getPropertyDetail(propertyId, repository);
  if (!detail) {
    return null;
  }
  return {
    propertyId,
    summary: detail.dataQuality,
  };
}

export async function getTodayDashboard(
  repository: SolarRepository = defaultRepository,
): Promise<TodayDashboard> {
  const properties = await repository.listProperties();
  const analyzedLeads: TodayLeadCard[] = [];

  for (const property of properties.slice(0, 12)) {
    const detail = await getPropertyDetail(property.id, repository);
    if (!detail) continue;
    analyzedLeads.push(mapAnalyzeResultToLeadCard(detail, false));
  }

  const combinedLeads = dedupeLeads(analyzedLeads);
  const summary = {
    priorityLeads: combinedLeads.filter((lead) => lead.opportunityScore >= 70).length,
    whaleCandidates: combinedLeads.filter((lead) => lead.whaleScore >= 60).length,
    revisits: combinedLeads.filter((lead) => lead.outcome === "NOT_HOME" || lead.outcome === "BILL_REQUESTED").length,
    needsBill: combinedLeads.filter((lead) => lead.verificationNeeded.some((item) => item.toLowerCase().includes("bill"))).length,
    total: combinedLeads.length,
  };

  return {
    territory: "Solar territory",
    summary,
    filters: [
      { key: "whales", label: "Whales", count: summary.whaleCandidates },
      { key: "high_priority", label: "High Priority", count: summary.priorityLeads },
      { key: "revisit", label: "Revisit", count: summary.revisits },
      { key: "needs_bill", label: "Needs Bill", count: summary.needsBill },
    ],
    leads: combinedLeads.sort((left, right) => right.opportunityScore - left.opportunityScore),
  };
}

export async function updateLeadOutcome(
  propertyId: string,
  outcome: LeadOutcome["outcome"],
  notes: string | null,
  repository: SolarRepository = defaultRepository,
): Promise<LeadOutcome | null> {
  const property = await repository.getPropertyById(propertyId);
  if (!property) {
    return null;
  }

  return repository.upsertLeadOutcome({
    id: stableId(`${property.id}:lead`),
    propertyId: property.id,
    repId: null,
    outcome,
    notes,
    createdAt: new Date().toISOString(),
  });
}

export async function resolveLocationQuery(
  query: string,
  dependencies: AnalyzeDependencies = {},
): Promise<LocationResolveResponse> {
  const env = loadAppEnv();
  const geocoder = dependencies.geocoder ?? resolveGeocoderDependency(env, dependencies);
  const geocoded = await geocoder.geocodeAddress({ address: query });
  const resolvedType = inferResolvedSearchType(query, geocoded.locationType);
  const locationDetails = extractResolvedLocationDetails(geocoded.rawResponse);
  const formattedAddress = geocoded.formattedAddress ?? normalizeAddress(query);
  return {
    type: resolvedType,
    formattedAddress,
    latitude: geocoded.latitude,
    longitude: geocoded.longitude,
    placeId: geocoded.placeId,
    propertyId: resolvedType === "PROPERTY" ? stableId(normalizeAddress(formattedAddress)) : null,
    postalCode: locationDetails.postalCode,
    city: locationDetails.city,
    county: locationDetails.county,
    state: locationDetails.state,
    locationType: inferResolvedLocationType(query, geocoded.locationType),
  };
}

export async function resolveReverseLocationQuery(
  latitude: number,
  longitude: number,
  dependencies: AnalyzeDependencies = {},
): Promise<LocationResolveResponse> {
  const env = loadAppEnv();
  const geocoder = dependencies.geocoder ?? resolveGeocoderDependency(env, dependencies);
  const geocoded = await geocoder.reverseGeocode({ latitude, longitude });
  const resolvedType = inferResolvedSearchType(geocoded.formattedAddress ?? "", geocoded.locationType);
  const locationDetails = extractResolvedLocationDetails(geocoded.rawResponse);
  const formattedAddress = geocoded.formattedAddress ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  return {
    type: resolvedType,
    formattedAddress,
    latitude: geocoded.latitude,
    longitude: geocoded.longitude,
    placeId: geocoded.placeId,
    propertyId: resolvedType === "PROPERTY" ? stableId(normalizeAddress(formattedAddress)) : null,
    postalCode: locationDetails.postalCode,
    city: locationDetails.city,
    county: locationDetails.county,
    state: locationDetails.state,
    locationType: inferResolvedLocationType(formattedAddress, geocoded.locationType),
  };
}

export async function getNeighborhoodMarkets(
  radiusMiles = 10,
  repository: SolarRepository = defaultRepository,
): Promise<NeighborhoodMarket[]> {
  const markets = buildNeighborhoodSeedData(repository);
  return markets.filter((market) => market.radiusMiles <= radiusMiles);
}

export async function createDiscoveryScan(
  input: DiscoveryScanInput,
  repository: SolarRepository = defaultRepository,
  dependencies: AnalyzeDependencies = {},
): Promise<DiscoveryScanJobResponse> {
  const scanId = stableId(`${"center" in input ? input.center.latitude : input.latitude}:${"center" in input ? input.center.longitude : input.longitude}:${input.radiusMiles}:${Date.now()}`);
  const job = createDiscoveryScanJob(scanId, input);
  discoveryScanStore.set(scanId, job);
  void runDiscoveryScanJob(scanId, input, repository, dependencies).catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    const failedJob = discoveryScanStore.get(scanId);
    if (failedJob) {
      failedJob.status = "FAILED";
      failedJob.message = message;
      failedJob.updatedAt = new Date().toISOString();
      failedJob.stages.push({
        stage: "FAILED",
        message,
        completed: failedJob.metrics.prequalifiedCandidates ?? 0,
        total: failedJob.metrics.prequalifiedCandidates ?? 0,
        updatedAt: failedJob.updatedAt,
      });
      discoveryScanStore.set(scanId, failedJob);
    }
  });
  return { scanId, status: job.status };
}

export async function scanDiscovery(
  input: DiscoveryScanInput,
  repository: SolarRepository = defaultRepository,
  dependencies: AnalyzeDependencies = {},
): Promise<DiscoveryScanResult> {
  const scanId = stableId(`${"center" in input ? input.center.latitude : input.latitude}:${"center" in input ? input.center.longitude : input.longitude}:${input.radiusMiles}:${Date.now()}`);
  const job = createDiscoveryScanJob(scanId, input);
  discoveryScanStore.set(scanId, job);
  const finalJob = await runDiscoveryScanJob(scanId, input, repository, dependencies);
  return finalJob;
}

export async function createRoute(
  input: RouteCreateRequest,
  repository: SolarRepository = defaultRepository,
): Promise<RoutePlan> {
  const propertyLookup = await loadRouteProperties(input.selectedPropertyIds, repository);
  const ordered = nearestNeighborOrder({
    start: { latitude: input.startingLatitude, longitude: input.startingLongitude },
    properties: propertyLookup,
  });
  const now = new Date().toISOString();
  const plan: RoutePlan = {
    id: stableId(`${input.startingLatitude}:${input.startingLongitude}:${input.selectedPropertyIds.join(",")}:${now}`),
    startingLatitude: input.startingLatitude,
    startingLongitude: input.startingLongitude,
    selectedPropertyIds: input.selectedPropertyIds,
    stops: ordered.map((entry, index) => ({
      propertyId: entry.property.id,
      address: buildLeadAddressParts({
        street: entry.property.street ?? null,
        formattedAddress: entry.property.normalizedAddress,
        city: entry.property.city ?? entry.property.municipality ?? entry.property.county ?? null,
        state: entry.property.state ?? null,
        postalCode: entry.property.postalCode ?? null,
      }).displayAddress,
      neighborhood: entry.property.municipality ?? entry.property.city ?? entry.property.county ?? "Unknown area",
      distanceMilesFromPrevious: entry.distanceMilesFromPrevious,
      distanceMilesFromStart: entry.distanceMilesFromStart,
      opportunityScore: entry.lead.opportunityScore,
      whaleScore: entry.lead.whaleScore,
      maxRoofSolarCapacityKw: entry.lead.maxRoofSolarCapacityKw,
      nextBestAction: entry.lead.nextBestAction,
      reason: entry.lead.nextBestAction.reason,
      outcome: entry.lead.outcome,
      priorityIndex: index + 1,
    })),
    completedPropertyIds: [],
    createdAt: now,
    updatedAt: now,
  };
  routeStore.set(plan.id, plan);
  return plan;
}

export async function getRouteNext(
  routeId: string,
  repository: SolarRepository = defaultRepository,
): Promise<RouteNextResponse | null> {
  const route = routeStore.get(routeId);
  if (!route) {
    return null;
  }
  const completedPropertyIds = await getCompletedRoutePropertyIds(route.stops.map((stop) => stop.propertyId), repository);
  const routeWithProgress: RoutePlan = {
    ...route,
    completedPropertyIds,
    updatedAt: new Date().toISOString(),
  };
  routeStore.set(routeId, routeWithProgress);
  const nextIndex = routeWithProgress.stops.findIndex((stop) => !completedPropertyIds.includes(stop.propertyId));
  const currentStop = nextIndex >= 0 ? routeWithProgress.stops[nextIndex] : null;
  const nextStop = nextIndex >= 0 ? routeWithProgress.stops.slice(nextIndex + 1).find((stop) => !completedPropertyIds.includes(stop.propertyId)) ?? null : null;
  return {
    routeId,
    completedCount: completedPropertyIds.length,
    remainingCount: routeWithProgress.stops.length - completedPropertyIds.length,
    currentStop,
    nextStop,
    route: routeWithProgress,
  };
}

export function getDiscoveryScan(scanId: string): DiscoveryScanStatusResponse | null {
  const scan = discoveryScanStore.get(scanId);
  if (!scan) {
    return null;
  }
  return stripDiscoveryScanResults(scan);
}

export function getDiscoveryScanResultsPage(
  scanId: string,
  cursor?: string | null,
  limit = 20,
): DiscoveryScanResultsPage | null {
  const scan = discoveryScanStore.get(scanId);
  if (!scan) {
    return null;
  }
  const sourceResults = dedupeDiscoveryLeads(scan.results);
  const startIndex = decodeDiscoveryCursor(cursor);
  const pageSize = Math.max(1, Math.min(limit, 50));
  const results = sourceResults.slice(startIndex, startIndex + pageSize);
  const nextIndex = startIndex + results.length;
  return {
    results,
    nextCursor: nextIndex < sourceResults.length ? encodeDiscoveryCursor(nextIndex) : null,
    hasMore: nextIndex < sourceResults.length,
    totalAvailable: sourceResults.length,
    qualifiedLeadCount: sourceResults.length,
  };
}

function stripDiscoveryScanResults(scan: DiscoveryScanProgress): DiscoveryScanStatusResponse {
  const { results: _results, ...status } = scan;
  return status;
}

function encodeDiscoveryCursor(index: number): string {
  return Buffer.from(String(index), "utf8").toString("base64url");
}

function decodeDiscoveryCursor(cursor?: string | null): number {
  if (!cursor) {
    return 0;
  }
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = Number.parseInt(decoded, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function createDiscoveryScanJob(scanId: string, input: DiscoveryScanInput): DiscoveryScanProgress {
  const center = "center" in input ? input.center : { latitude: input.latitude, longitude: input.longitude };
  const radiusMiles = Math.max(1, input.radiusMiles);
  const filters = input.filters ?? {};
  const now = new Date().toISOString();
  return {
    scanId,
    status: "DISCOVERING",
    currentLocation: "center" in input ? "Selected location" : "Current location",
    radiusMiles,
    candidateCount: 0,
    analyzedCount: 0,
    googleSolarCalls: 0,
    estimatedCostUsd: 0,
    propertiesFound: 0,
    qualifiedLeadCount: 0,
    solarAnalyzedCount: 0,
    results: [],
    center,
    filters,
    discoveryDiagnostics: createDiscoveryDiagnostics(center, radiusMiles),
    metrics: {
      rawDiscoveredCount: 0,
      residentialCandidateCount: 0,
      prequalifiedCount: 0,
      solarEligibleCount: 0,
      solarAnalyzedCount: 0,
      qualifiedLeadCount: 0,
      renderedLeadCount: 0,
      discoveredProperties: 0,
      discoveredCount: 0,
      knownProperties: 0,
      newProperties: 0,
      prequalifiedCandidates: 0,
      solarCalls: 0,
      solarCallBudget: Math.max(0, Math.min(input.maxGoogleSolarCalls ?? 25, 25)),
      largeOpportunities: 0,
      whaleCandidates: 0,
      resultsFound: 0,
      estimatedCostUsd: 0,
      providerCalls: 0,
      providerCoverage: null,
      durationMs: null,
    },
    stages: [
      {
        stage: "DISCOVERING",
        message: "Finding residential properties",
        completed: 0,
        total: null,
        updatedAt: now,
      },
    ],
    message: "Finding residential properties",
    coverageUnavailable: false,
    updatedAt: now,
  };
}

async function runDiscoveryScanJob(
  scanId: string,
  input: DiscoveryScanInput,
  repository: SolarRepository,
  dependencies: AnalyzeDependencies,
): Promise<DiscoveryScanProgress> {
  const startedAt = Date.now();
  const env = loadAppEnv();
  const baseJob = discoveryScanStore.get(scanId) ?? createDiscoveryScanJob(scanId, input);
  const center = baseJob.center;
  const radiusMiles = baseJob.radiusMiles;
  const limit = Math.max(1, Math.min(input.limit ?? 50, 250));
  const maxGoogleSolarCalls = Math.max(0, Math.min(input.maxGoogleSolarCalls ?? 25, 25));
  let geocoder: Geocoder | null = null;
  try {
    geocoder = dependencies.geocoder ?? resolveGeocoderDependency(env, dependencies);
  } catch {
    geocoder = null;
  }

  type DiscoveryScanJobPatch = Partial<Omit<DiscoveryScanProgress, "metrics">> & {
    metrics?: Partial<DiscoveryScanMetrics>;
  };

  const updateJob = (patch: DiscoveryScanJobPatch, stage?: DiscoveryScanStageProgress) => {
    const current = discoveryScanStore.get(scanId) ?? baseJob;
    const next: DiscoveryScanProgress = {
      ...current,
      ...patch,
      metrics: {
        ...current.metrics,
        ...(patch.metrics ?? {}),
      },
      stages: stage ? [...current.stages, stage] : current.stages,
      updatedAt: new Date().toISOString(),
    };
    discoveryScanStore.set(scanId, next);
    return next;
  };

  try {
    updateJob(
      {
        status: "DISCOVERING",
        message: "Finding properties",
      },
      {
        stage: "DISCOVERING",
        message: "Finding properties",
        completed: 0,
        total: null,
        updatedAt: new Date().toISOString(),
      },
    );

    const diagnostics = baseJob.discoveryDiagnostics ?? createDiscoveryDiagnostics(center, radiusMiles);
    const knownCandidates = await buildDiscoveryCandidates(center, radiusMiles, repository, diagnostics);
    const knownWithinLimit = knownCandidates.slice(0, limit);
    const knownCount = knownWithinLimit.length;
    const knownKeys = new Set(knownCandidates.map((candidate) => discoveryKeyForProperty(candidate.property)));
    updateJob(
      {
        metrics: {
          knownProperties: knownCount,
          discoveredProperties: knownCount,
          discoveredCount: knownCount,
          providerCalls: 0,
          providerCoverage: "database",
        },
        candidateCount: knownCount,
        discoveryDiagnostics: diagnostics,
        message: knownCount > 0 ? "Checking additional property sources" : "Checking local parcel data",
      },
      {
        stage: "PRE_RANKING",
        message: knownCount > 0 ? `Checking ${knownCount} known properties` : "Checking local parcel data",
        completed: knownCount,
        total: knownCount,
        updatedAt: new Date().toISOString(),
      },
    );

    const additionalNeed = Math.max(0, limit - knownWithinLimit.length);
    const discoveryLimit = Math.max(limit, limit + additionalNeed);
    let discoveredProperties: DiscoveredProperty[] = [];
    let providerCalls = 0;
    let coverageUnavailable = false;

    if (additionalNeed > 0) {
      const providerResult = await discoverExternalProperties({
        latitude: center.latitude,
        longitude: center.longitude,
        radiusMiles,
        limit: discoveryLimit,
      }, knownCount, geocoder, diagnostics, knownKeys);
      providerCalls = providerResult.providerCalls;
      discoveredProperties = providerResult.properties;
      coverageUnavailable = providerResult.coverageUnavailable;
    }

    const persistedNewProperties = await persistDiscoveredProperties(discoveredProperties, repository);
    const mergedCandidates = await mergeDiscoveryCandidates(
      center,
      radiusMiles,
      repository,
      knownCandidates,
      persistedNewProperties,
    );
    const minimumSystemKw = getMinimumSystemKw(input.filters ?? {});
    const filteredCandidates = applyDiscoveryFilters(mergedCandidates, input.filters ?? {});
    const solarEligibleCandidates = minimumSystemKw == null
      ? filteredCandidates
      : filteredCandidates.filter((candidate) => candidate.maxRoofSolarCapacityKw == null || candidate.maxRoofSolarCapacityKw >= minimumSystemKw);
    const rankedCandidates = solarEligibleCandidates
      .slice()
      .sort((left, right) => right.cheapScore - left.cheapScore || left.distanceMiles - right.distanceMiles)
      .slice(0, limit);
    diagnostics.prequalifiedCount = filteredCandidates.length;
    diagnostics.residentialCandidateCount = filteredCandidates.length;

    updateJob(
      {
        status: "SOLAR_ANALYSIS",
        candidateCount: filteredCandidates.length,
        message: "Analyzing top solar opportunities",
        discoveryDiagnostics: diagnostics,
        metrics: {
          rawDiscoveredCount: diagnostics.rawCandidateCount,
          residentialCandidateCount: filteredCandidates.length,
          prequalifiedCount: filteredCandidates.length,
          solarEligibleCount: rankedCandidates.length,
          solarAnalyzedCount: 0,
          qualifiedLeadCount: 0,
          renderedLeadCount: 0,
          knownProperties: knownCount,
          discoveredProperties: discoveredProperties.length,
          discoveredCount: discoveredProperties.length,
          newProperties: persistedNewProperties.length,
          providerCalls,
          providerCoverage: providerCalls > 0 ? "external" : "database",
        },
      },
      {
        stage: "SOLAR_ANALYSIS",
        message: "Analyzing top solar opportunities",
        completed: 0,
        total: rankedCandidates.length,
        updatedAt: new Date().toISOString(),
      },
    );

    let analyzedCount = 0;
    let googleSolarCalls = 0;
    const results: DiscoveryScanLead[] = [];

    for (let index = 0; index < rankedCandidates.length; index += 1) {
      const candidate = rankedCandidates[index];
      const nextAction = recommendNextBestAction({
        usageUnknown: candidate.confirmedAnnualUsageKwh == null,
        strongSolarPotential: (candidate.maxRoofSolarCapacityKw ?? candidate.cheapScore / 10) >= 12,
        noShow: candidate.leadOutcome?.outcome === "NOT_HOME",
        billRequested: candidate.leadOutcome?.outcome === "BILL_REQUESTED",
      });

      const hasFreshAssessment = candidate.freshAnalysis != null;
      const shouldAnalyzeNow = !hasFreshAssessment && googleSolarCalls < maxGoogleSolarCalls;
      let nextLead: DiscoveryScanLead | null = null;
      if (shouldAnalyzeNow) {
        googleSolarCalls += 1;
        try {
          const analyzed = await analyzeProperty(
            {
              address: candidate.property.street ?? candidate.property.normalizedAddress,
              latitude: candidate.property.latitude ?? undefined,
              longitude: candidate.property.longitude ?? undefined,
              municipality: candidate.property.municipality ?? candidate.property.city ?? undefined,
              county: candidate.property.county ?? undefined,
              state: candidate.property.state ?? "PA",
              postalCode: candidate.property.postalCode ?? undefined,
            },
            repository,
            dependencies,
          );
          nextLead = mapDiscoveryResult(analyzed, candidate, "ANALYZED");
          analyzedCount += 1;
        } catch {
          // Fall through to a cheap ANALYZING result when provider analysis fails or is unavailable.
        }
      }

      if (!nextLead && hasFreshAssessment) {
        nextLead = mapDiscoveryResult(candidate.freshAnalysis!, candidate, "CACHED");
        analyzedCount += 1;
      } else if (!nextLead) {
        nextLead = buildPendingDiscoveryResult(candidate, nextAction);
      }

      if (minimumSystemKw != null) {
        const leadCapacity = nextLead?.maxRoofSolarCapacityKw ?? nextLead?.maxSystemKw ?? null;
        if (leadCapacity == null || leadCapacity < minimumSystemKw) {
          updateJob(
            {
              results,
              analyzedCount,
              googleSolarCalls,
              metrics: {
                solarAnalyzedCount: analyzedCount,
                solarCallBudget: maxGoogleSolarCalls,
                resultsFound: results.length,
                qualifiedLeadCount: results.length,
                renderedLeadCount: results.length,
                solarCalls: googleSolarCalls,
                estimatedCostUsd: roundDecimal(googleSolarCalls * 0.02, 2),
                largeOpportunities: results.filter((lead) => lead.opportunityScore >= 70).length,
                whaleCandidates: results.filter((lead) => lead.whaleScore >= 60).length,
              },
              estimatedCostUsd: roundDecimal(googleSolarCalls * 0.02, 2),
            },
            {
              stage: "SOLAR_ANALYSIS",
              message: `Analyzing ${Math.min(index + 1, rankedCandidates.length)} of ${rankedCandidates.length} candidates`,
              completed: index + 1,
              total: rankedCandidates.length,
              updatedAt: new Date().toISOString(),
            },
          );
          continue;
        }
      }

      if (nextLead) {
        appendDiscoveryLead(results, nextLead);
      }
      updateJob(
        {
          results,
          analyzedCount,
          googleSolarCalls,
          estimatedCostUsd: roundDecimal(googleSolarCalls * 0.02, 2),
          metrics: {
            solarAnalyzedCount: analyzedCount,
            solarCallBudget: maxGoogleSolarCalls,
            resultsFound: results.length,
            qualifiedLeadCount: results.length,
            renderedLeadCount: results.length,
            solarCalls: googleSolarCalls,
            estimatedCostUsd: roundDecimal(googleSolarCalls * 0.02, 2),
            largeOpportunities: results.filter((lead) => lead.opportunityScore >= 70).length,
            whaleCandidates: results.filter((lead) => lead.whaleScore >= 60).length,
          },
        },
        {
          stage: "SOLAR_ANALYSIS",
          message: `Analyzing ${Math.min(index + 1, rankedCandidates.length)} of ${rankedCandidates.length} candidates`,
          completed: index + 1,
          total: rankedCandidates.length,
          updatedAt: new Date().toISOString(),
        },
      );
    }

    const allProvidersFailed = diagnostics.providersAttempted.length > 0 && diagnostics.providersAttempted.every((attempt) => attempt.error != null);
    const finalStatus: DiscoveryScanStatus =
      allProvidersFailed && results.length === 0 && knownCount === 0
        ? "DISCOVERY_FAILED"
        : coverageUnavailable && results.length === 0
          ? "DATA_COVERAGE_UNAVAILABLE"
          : "COMPLETE";
    const uniqueResults = dedupeDiscoveryLeads(results);
    const finalMessage =
      finalStatus === "DISCOVERY_FAILED"
        ? "We could not complete this scan."
        : coverageUnavailable && results.length === 0
          ? "Property coverage is limited in this area."
          : minimumSystemKw != null && uniqueResults.length === 0
            ? rankedCandidates.length === 0
              ? `No candidates met the ${minimumSystemKw}+ kW pre-filter.`
              : `No leads matched the ${minimumSystemKw}+ kW filter.`
          : results.length > 0
            ? `Built ${results.length} leads`
            : "No discovered properties found";
    const finalJob = updateJob(
      {
        status: finalStatus,
        candidateCount: filteredCandidates.length,
        analyzedCount,
        googleSolarCalls,
        estimatedCostUsd: roundDecimal(googleSolarCalls * 0.02, 2),
        message: uniqueResults.length > 0 ? `Built ${uniqueResults.length} leads` : finalMessage,
        coverageUnavailable: finalStatus === "DATA_COVERAGE_UNAVAILABLE",
        discoveryDiagnostics: diagnostics,
        propertiesFound: filteredCandidates.length,
        qualifiedLeadCount: uniqueResults.length,
        solarAnalyzedCount: analyzedCount,
        metrics: {
          rawDiscoveredCount: diagnostics.rawCandidateCount,
          residentialCandidateCount: filteredCandidates.length,
          prequalifiedCount: filteredCandidates.length,
          solarEligibleCount: rankedCandidates.length,
          solarAnalyzedCount: analyzedCount,
          qualifiedLeadCount: uniqueResults.length,
          renderedLeadCount: uniqueResults.length,
          discoveredProperties: knownCandidates.length + discoveredProperties.length,
          discoveredCount: diagnostics.rawCandidateCount,
          knownProperties: knownCandidates.length,
          newProperties: persistedNewProperties.length,
          prequalifiedCandidates: filteredCandidates.length,
          solarCalls: googleSolarCalls,
          solarCallBudget: maxGoogleSolarCalls,
          largeOpportunities: results.filter((lead) => lead.opportunityScore >= 70).length,
          whaleCandidates: results.filter((lead) => lead.whaleScore >= 60).length,
          resultsFound: uniqueResults.length,
          estimatedCostUsd: roundDecimal(googleSolarCalls * 0.02, 2),
          providerCalls,
          providerCoverage: providerCalls > 0 ? "external" : "database",
          durationMs: Date.now() - startedAt,
        },
      },
      {
        stage:
          finalStatus === "DATA_COVERAGE_UNAVAILABLE"
            ? "DATA_COVERAGE_UNAVAILABLE"
            : finalStatus === "DISCOVERY_FAILED"
              ? "DISCOVERY_FAILED"
              : "FINAL_RANKING",
        message: uniqueResults.length > 0 ? `Built ${uniqueResults.length} leads` : finalMessage,
        completed: uniqueResults.length,
        total: uniqueResults.length,
        updatedAt: new Date().toISOString(),
      },
    );
    const dedupedJob = {
      ...finalJob,
      results: uniqueResults,
      analyzedCount,
      candidateCount: filteredCandidates.length,
      propertiesFound: filteredCandidates.length,
      qualifiedLeadCount: uniqueResults.length,
      solarAnalyzedCount: analyzedCount,
      message: uniqueResults.length > 0 ? `Built ${uniqueResults.length} leads` : finalMessage,
      metrics: {
        ...finalJob.metrics,
        resultsFound: uniqueResults.length,
        qualifiedLeadCount: uniqueResults.length,
        renderedLeadCount: uniqueResults.length,
        solarAnalyzedCount: analyzedCount,
      },
    };
    discoveryScanStore.set(scanId, dedupedJob);
    return dedupedJob;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const failedJob = updateJob(
      {
        status: "FAILED",
        message,
        metrics: {
          durationMs: Date.now() - startedAt,
        },
      },
      {
        stage: "FAILED",
        message,
        completed: 0,
        total: 0,
        updatedAt: new Date().toISOString(),
      },
    );
    discoveryScanStore.set(scanId, failedJob);
    return failedJob;
  }
}

function appendDiscoveryLead(results: DiscoveryScanLead[], lead: DiscoveryScanLead): void {
  if (results.some((entry) => areDuplicateDiscoveryLeads(entry, lead))) {
    return;
  }
  results.push(lead);
}

function dedupeDiscoveryLeads(results: DiscoveryScanLead[]): DiscoveryScanLead[] {
  const deduped: DiscoveryScanLead[] = [];
  for (const lead of results) {
    if (deduped.some((entry) => areDuplicateDiscoveryLeads(entry, lead))) {
      continue;
    }
    deduped.push(lead);
  }
  return deduped;
}

function areDuplicateDiscoveryLeads(left: DiscoveryScanLead, right: DiscoveryScanLead): boolean {
  if (left.propertyId != null && right.propertyId != null && left.propertyId === right.propertyId) {
    return true;
  }
  const leftAddress = normalizeAddress(left.address);
  const rightAddress = normalizeAddress(right.address);
  if (leftAddress != null && rightAddress != null && leftAddress === rightAddress) {
    return true;
  }
  if (left.latitude != null && left.longitude != null && right.latitude != null && right.longitude != null) {
    const separation = distanceMeters(
      { latitude: left.latitude, longitude: left.longitude },
      { latitude: right.latitude, longitude: right.longitude },
    );
    if (separation != null && separation <= 10) {
      return true;
    }
  }
  return false;
}

interface DiscoveryCandidateRecord {
  property: Property;
  distanceMiles: number;
  propertyUse: "SINGLE_FAMILY" | "RESIDENTIAL" | "MULTI_FAMILY" | "COMMERCIAL" | "INDUSTRIAL" | "INSTITUTIONAL" | "UNKNOWN";
  market: NeighborhoodMarket | null;
  discoverySource: string | null;
  discoveryConfidence: number | null;
  leadOutcome: LeadOutcome | null;
  usageProfile: UsageProfile | null;
  permits: PermitRecord[];
  propertySignals: PropertySignal[];
  opportunityAssessment: OpportunityAssessment | null;
  freshAnalysis: AnalyzeResult | null;
  maxRoofSolarCapacityKw: number | null;
  confirmedAnnualUsageKwh: number | null;
  estimatedEnergyNeedKw: number | null;
  cheapScore: number;
  cheapReasons: string[];
  signals: string[];
  routeReason: string;
}

interface RouteCandidateRecord {
  property: Property;
  lead: DiscoveryScanLead;
}

function buildDiscoveryCandidateRecordLite(
  property: Property,
  distanceMiles: number,
  markets: NeighborhoodMarket[],
): DiscoveryCandidateRecord {
  const market = findMarketForProperty(property, markets);
  const signals = deriveDiscoverySignals(property, market, [], []);
  const estimatedCapacity = estimateCapacityFromSignals([], market);
  const propertyUse = inferPropertyUse(property, estimatedCapacity, null);
  const cheapReasons = buildDiscoveryReasons({
    property,
    market,
    discoverySource: null,
    discoveryConfidence: null,
    permits: [],
    signals,
    opportunityAssessment: null,
    freshAnalysis: null,
    maxRoofSolarCapacityKw: estimatedCapacity,
    confirmedAnnualUsageKwh: null,
  });
  const cheapScore = buildDiscoveryScore({
    market,
    discoverySource: null,
    discoveryConfidence: null,
    permits: [],
    propertySignals: [],
    opportunityAssessment: null,
    freshAnalysis: null,
    leadOutcome: null,
    usageProfile: null,
    maxRoofSolarCapacityKw: estimatedCapacity,
  });
  return {
    property,
    distanceMiles,
    propertyUse,
    market,
    discoverySource: null,
    discoveryConfidence: null,
    leadOutcome: null,
    usageProfile: null,
    permits: [],
    propertySignals: [],
    opportunityAssessment: null,
    freshAnalysis: null,
    maxRoofSolarCapacityKw: estimatedCapacity,
    confirmedAnnualUsageKwh: null,
    estimatedEnergyNeedKw: null,
    cheapScore,
    cheapReasons,
    signals,
    routeReason: cheapReasons[0] ?? "Highest-value nearby opportunity",
  };
}

async function buildDiscoveryCandidates(
  center: { latitude: number; longitude: number },
  radiusMiles: number,
  repository: SolarRepository,
  diagnostics?: DiscoveryDiagnostics,
): Promise<DiscoveryCandidateRecord[]> {
  const markets = buildNeighborhoodSeedData(repository);
  if (shouldUseDiscoveryFixtures()) {
    for (const seedProperty of buildDiscoverySeedProperties()) {
      await repository.upsertProperty(seedProperty);
    }
  }
  const properties = dedupeProperties([
    ...(await repository.listProperties()),
    ...(shouldUseDiscoveryFixtures() ? buildDiscoverySeedProperties() : []),
  ]);

  const candidates: DiscoveryCandidateRecord[] = [];
  let missingGeometry = 0;
  let outsideRadius = 0;
  for (const property of properties) {
    if (property.latitude == null || property.longitude == null) {
      missingGeometry += 1;
      continue;
    }
    const distanceMiles = distanceMilesBetween(
      { latitude: center.latitude, longitude: center.longitude },
      { latitude: property.latitude, longitude: property.longitude },
    );
    if (distanceMiles > radiusMiles) {
      outsideRadius += 1;
      continue;
    }
    const candidate = buildDiscoveryCandidateRecordLite(property, distanceMiles, markets);
    if (!isResidentialPropertyUse(candidate.propertyUse)) {
      continue;
    }
    candidates.push(candidate);
  }
  if (diagnostics) {
    diagnostics.rawCandidateCount += properties.length;
    diagnostics.deduplicatedCandidateCount += candidates.length;
    diagnostics.residentialCandidateCount += candidates.length;
    diagnostics.prequalifiedCount = diagnostics.deduplicatedCandidateCount;
    diagnostics.providersAttempted.push({
      provider: "existing_properties",
      supported: true,
      requestCount: 1,
      recordsReturned: properties.length,
      recordsAccepted: candidates.length,
      recordsRejected: Math.max(0, properties.length - candidates.length),
      rejectionReasons: {
        missing_geometry: missingGeometry,
        outside_radius: outsideRadius,
      },
      durationMs: 0,
      error: null,
    });
  }
  return candidates;
}

async function discoverExternalProperties(
  input: PropertyDiscoveryInput,
  knownCount: number,
  geocoder: Geocoder | null,
  diagnostics?: DiscoveryDiagnostics,
  existingKeys: Set<string> = new Set(),
): Promise<{
  providerCalls: number;
  properties: DiscoveredProperty[];
  coverageUnavailable: boolean;
  provider: string | null;
}> {
  if (shouldUseDiscoveryFixtures()) {
    if (diagnostics) {
      diagnostics.prequalifiedCount = knownCount;
    }
    return {
      providerCalls: 0,
      properties: [],
      coverageUnavailable: knownCount === 0,
      provider: null,
    };
  }

  const providers: PropertyDiscoveryProvider[] = [
    new OverpassPropertyDiscoveryProvider(),
    ...(geocoder
      ? [
          new GridGeocodingPropertyDiscoveryProvider(geocoder, { source: "google_geocoding_grid", sampleMultiplier: 1 }),
          new GridGeocodingPropertyDiscoveryProvider(geocoder, { source: "google_geocoding_dense_grid", sampleMultiplier: 4 }),
        ]
      : []),
  ];
  const eligibleProviders = providers.filter((provider) => provider.supportsArea(input));
  if (eligibleProviders.length === 0) {
    if (diagnostics) {
      diagnostics.prequalifiedCount = 0;
    }
    return {
      providerCalls: 0,
      properties: [],
      coverageUnavailable: knownCount === 0,
      provider: null,
    };
  }

  const minimumCandidates = getDiscoveryMinimumCandidates();
  let providerCalls = 0;
  let acceptedProvider: string | null = null;
  let rawCandidateCount = 0;
  let deduplicatedCandidateCount = 0;
  let residentialCandidateCount = 0;
  const acceptedKeys = new Set(existingKeys);
  const discovered: DiscoveredProperty[] = [];
  for (const provider of eligibleProviders) {
    const attempt: DiscoveryProviderAttemptDiagnostics = {
      provider: provider.source,
      supported: true,
      requestCount: 1,
      recordsReturned: 0,
      recordsAccepted: 0,
      recordsRejected: 0,
      rejectionReasons: {},
      durationMs: 0,
      error: null,
    };
    const startedAt = Date.now();
    providerCalls += 1;
    let rawResults: DiscoveredProperty[] = [];
    try {
      rawResults = await provider.discover({
        latitude: input.latitude,
        longitude: input.longitude,
        radiusMiles: input.radiusMiles,
        limit: input.limit,
      });
      attempt.recordsReturned = rawResults.length;
      rawCandidateCount += rawResults.length;
      for (const candidate of rawResults) {
        const classification = classifyDiscoveredProperty(candidate, input);
        if (!classification.accepted) {
          attempt.recordsRejected += 1;
          for (const reason of classification.rejectionReasons) {
            attempt.rejectionReasons[reason] = (attempt.rejectionReasons[reason] ?? 0) + 1;
          }
          continue;
        }
        const key = discoveryPropertyKey(candidate);
        if (acceptedKeys.has(key)) {
          attempt.recordsRejected += 1;
          attempt.rejectionReasons.duplicate = (attempt.rejectionReasons.duplicate ?? 0) + 1;
          continue;
        }
        acceptedKeys.add(key);
        discovered.push(candidate);
        attempt.recordsAccepted += 1;
        deduplicatedCandidateCount += 1;
        residentialCandidateCount += 1;
        if (!acceptedProvider) {
          acceptedProvider = provider.source;
        }
      }
    } catch {
      attempt.error = "Provider discovery failed";
    }
    attempt.durationMs = Date.now() - startedAt;
    if (diagnostics) {
      diagnostics.providersAttempted.push(attempt);
      diagnostics.rawCandidateCount = rawCandidateCount;
      diagnostics.deduplicatedCandidateCount = deduplicatedCandidateCount;
      diagnostics.residentialCandidateCount = residentialCandidateCount;
      diagnostics.prequalifiedCount = deduplicatedCandidateCount;
    }
    if (knownCount + deduplicatedCandidateCount >= minimumCandidates) {
      break;
    }
  }

  const coverageUnavailable = knownCount === 0 && rawCandidateCount === 0;
  if (diagnostics) {
    diagnostics.rawCandidateCount = rawCandidateCount;
    diagnostics.deduplicatedCandidateCount = deduplicatedCandidateCount;
    diagnostics.residentialCandidateCount = residentialCandidateCount;
    diagnostics.prequalifiedCount = deduplicatedCandidateCount;
  }
  return {
    providerCalls,
    properties: discovered,
    coverageUnavailable,
    provider: acceptedProvider ?? eligibleProviders[0]?.source ?? null,
  };
}

async function persistDiscoveredProperties(
  discovered: DiscoveredProperty[],
  repository: SolarRepository,
): Promise<Property[]> {
  const existingProperties = await repository.listProperties();
  const persisted: Property[] = [];
  for (const candidate of discovered) {
    const metadata = isRecord(candidate.metadata) ? candidate.metadata : null;
    const city = typeof metadata?.city === "string" ? metadata.city : extractCityFromAddress(candidate.address);
    const county = typeof metadata?.county === "string" ? metadata.county : null;
    const state = typeof metadata?.state === "string" ? metadata.state : extractStateFromAddress(candidate.address);
    const postalCode = typeof metadata?.postalCode === "string" ? metadata.postalCode : extractPostalCodeFromAddress(candidate.address);
    const normalizedAddress = normalizeAddress(candidate.address ?? `${candidate.latitude.toFixed(6)}, ${candidate.longitude.toFixed(6)}`);
    const matchingProperty = findMatchingProperty(existingProperties, {
      normalizedAddress,
      parcelId: candidate.parcelId ?? null,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
    });
    const propertyId = matchingProperty?.id ?? stableId(propertyDiscoveryKey(candidate));
    const property = await repository.upsertProperty({
      id: propertyId,
      normalizedAddress,
      street: candidate.address?.split(",")[0]?.trim() ?? matchingProperty?.street ?? null,
      city: city ?? matchingProperty?.city ?? null,
      county: county ?? matchingProperty?.county ?? null,
      state: state ?? matchingProperty?.state ?? "PA",
      postalCode: postalCode ?? matchingProperty?.postalCode ?? null,
      latitude: candidate.latitude ?? matchingProperty?.latitude ?? null,
      longitude: candidate.longitude ?? matchingProperty?.longitude ?? null,
      parcelId: candidate.parcelId ?? matchingProperty?.parcelId ?? null,
      municipality: extractMunicipalityFromAddress(candidate.address) ?? city ?? matchingProperty?.municipality ?? null,
    });
    if (!matchingProperty) {
      existingProperties.push(property);
    }
    await repository.upsertPropertyDiscovery({
      id: stableId(`${property.id}:${candidate.source}:${candidate.externalId ?? property.normalizedAddress}`),
      propertyId: property.id,
      provider: candidate.source,
      sourceRecordId: candidate.externalId ?? null,
      sourceUrl: null,
      retrievedAt: new Date().toISOString(),
      confidence: candidate.confidence,
      discoveryJson: candidate,
    });
    persisted.push(property);
  }
  return persisted;
}

function findMatchingProperty(
  properties: Property[],
  candidate: {
    normalizedAddress: string;
    parcelId: string | null;
    latitude: number;
    longitude: number;
  },
): Property | null {
  const exactParcel = candidate.parcelId
    ? properties.find((property) => property.parcelId != null && property.parcelId === candidate.parcelId)
    : null;
  if (exactParcel) {
    return exactParcel;
  }

  const exactAddress = properties.find(
    (property) => normalizeAddress(property.normalizedAddress) === candidate.normalizedAddress,
  );
  if (exactAddress) {
    return exactAddress;
  }

  const nearby = properties.find((property) => {
    if (property.latitude == null || property.longitude == null) {
      return false;
    }
    return distanceMeters(
      { latitude: candidate.latitude, longitude: candidate.longitude },
      { latitude: property.latitude, longitude: property.longitude },
    ) != null && distanceMeters(
      { latitude: candidate.latitude, longitude: candidate.longitude },
      { latitude: property.latitude, longitude: property.longitude },
    )! <= 10;
  });
  return nearby ?? null;
}

async function mergeDiscoveryCandidates(
  center: { latitude: number; longitude: number },
  radiusMiles: number,
  repository: SolarRepository,
  knownCandidates: DiscoveryCandidateRecord[],
  persistedNewProperties: Property[],
): Promise<DiscoveryCandidateRecord[]> {
  const markets = buildNeighborhoodSeedData(repository);
  const merged = new Map<string, DiscoveryCandidateRecord>();
  for (const candidate of knownCandidates) {
    merged.set(candidate.property.id, candidate);
  }

  for (const property of persistedNewProperties) {
    if (property.latitude == null || property.longitude == null) {
      continue;
    }
    const distanceMiles = distanceMilesBetween(center, {
      latitude: property.latitude,
      longitude: property.longitude,
    });
    if (distanceMiles > radiusMiles) {
      continue;
    }
    if (merged.has(property.id)) {
      continue;
    }
    merged.set(property.id, await buildDiscoveryCandidateRecord(property, distanceMiles, markets, repository));
  }

  return [...merged.values()];
}

function dedupeDiscoveredProperties(properties: DiscoveredProperty[]): DiscoveredProperty[] {
  const seen = new Set<string>();
  const unique: DiscoveredProperty[] = [];
  for (const property of properties) {
    const key = discoveryPropertyKey(property);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(property);
  }
  return unique;
}

function discoveryPropertyKey(property: DiscoveredProperty): string {
  const addressKey = property.address ? normalizeAddress(property.address) : null;
  const coordsKey = `${property.latitude.toFixed(5)}:${property.longitude.toFixed(5)}`;
  return [property.parcelId ?? null, addressKey, coordsKey].filter((value): value is string => value != null).join("|");
}

function propertyDiscoveryKey(property: DiscoveredProperty): string {
  return discoveryPropertyKey(property);
}

function discoveryKeyForProperty(property: Property): string {
  const addressKey = property.normalizedAddress ? normalizeAddress(property.normalizedAddress) : null;
  const coordsKey =
    property.latitude != null && property.longitude != null
      ? `${property.latitude.toFixed(5)}:${property.longitude.toFixed(5)}`
      : null;
  return [property.parcelId ?? null, addressKey, coordsKey].filter((value): value is string => value != null).join("|");
}

function classifyDiscoveredProperty(
  candidate: DiscoveredProperty,
  input: PropertyDiscoveryInput,
): {
  accepted: boolean;
  rejectionReasons: string[];
} {
  const reasons: string[] = [];
  if (!Number.isFinite(candidate.latitude) || !Number.isFinite(candidate.longitude)) {
    reasons.push("missing_geometry");
  } else {
    const distance = distanceMilesBetween(
      { latitude: input.latitude, longitude: input.longitude },
      { latitude: candidate.latitude, longitude: candidate.longitude },
    );
    if (!Number.isFinite(distance) || distance > input.radiusMiles) {
      reasons.push("outside_radius");
    }
  }

  if (candidate.propertyType === "COMMERCIAL") {
    reasons.push("commercial");
  } else if (candidate.propertyType === "INDUSTRIAL") {
    reasons.push("industrial");
  } else if (
    candidate.propertyType === "UNKNOWN" &&
    !candidate.address &&
    !candidate.parcelId &&
    candidate.buildingAreaSqFt == null &&
    candidate.lotAreaSqFt == null &&
    (candidate.confidence ?? 0) < 60
  ) {
    reasons.push("unknown");
  }

  return {
    accepted: reasons.length === 0,
    rejectionReasons: reasons,
  };
}

function inferPropertyUse(
  property: Property,
  maxRoofSolarCapacityKw: number | null,
  freshAnalysis: AnalyzeResult | null,
): DiscoveryCandidateRecord["propertyUse"] {
  const addressText = normalizeAddress(
    [
      property.street ?? null,
      property.normalizedAddress ?? null,
      property.city ?? null,
      property.county ?? null,
      property.municipality ?? null,
    ]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(", "),
  );
  const largeSystem = (maxRoofSolarCapacityKw ?? freshAnalysis?.solarAssessment.estimatedMaxSystemKw ?? 0) > 50;
  if (isCommercialAddress(addressText) || largeSystem) {
    return "COMMERCIAL";
  }
  if (isIndustrialAddress(addressText)) {
    return "INDUSTRIAL";
  }
  if (isInstitutionalAddress(addressText)) {
    return "INSTITUTIONAL";
  }
  if (isMultiFamilyAddress(addressText)) {
    return "MULTI_FAMILY";
  }
  return "SINGLE_FAMILY";
}

function isResidentialPropertyUse(propertyUse: DiscoveryCandidateRecord["propertyUse"]): boolean {
  return propertyUse === "SINGLE_FAMILY" || propertyUse === "RESIDENTIAL" || propertyUse === "MULTI_FAMILY";
}

function isCommercialAddress(address: string): boolean {
  return /\b(convention|center|mall|retail|store|office|warehouse|plant|factory|industrial|terminal|supercenter|hotel|market|plaza|business)\b/i.test(address);
}

function isIndustrialAddress(address: string): boolean {
  return /\b(industrial|factory|warehouse|plant|terminal|yard|depot)\b/i.test(address);
}

function isInstitutionalAddress(address: string): boolean {
  return /\b(school|college|university|hospital|library|church|stadium|arena|museum|library|civic|municipal|government|city hall|courthouse)\b/i.test(address);
}

function isMultiFamilyAddress(address: string): boolean {
  return /\b(apartment|apartments|condo|condominium|duplex|triplex|fourplex|townhome|townhouse|multi-family|multi family)\b/i.test(address);
}

function getDiscoveryMinimumCandidates(): number {
  const configured = Number.parseInt(process.env.DISCOVERY_MIN_CANDIDATES ?? "", 10);
  return Number.isFinite(configured) && configured > 0 ? configured : 50;
}

function extractCityFromAddress(address?: string): string | null {
  if (!address) return null;
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 3] ?? parts[parts.length - 2] ?? null : null;
}

function extractMunicipalityFromAddress(address?: string): string | null {
  return extractCityFromAddress(address);
}

function extractStateFromAddress(address?: string): string | null {
  if (!address) return null;
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  const stateCandidate = parts.find((part) => /^[A-Z]{2}$/.test(part));
  return stateCandidate ?? null;
}

function extractPostalCodeFromAddress(address?: string): string | null {
  if (!address) return null;
  const match = address.match(/\b\d{5}(?:-\d{4})?\b/);
  return match?.[0] ?? null;
}

function shouldUseDiscoveryFixtures(): boolean {
  return process.env.NODE_ENV === "test" || process.env.npm_lifecycle_event === "test";
}

function buildDiscoverySeedProperties(): Property[] {
  const now = new Date().toISOString();
  return [
    {
      id: stableId(normalizeAddress("308 Baughman St, West Newton, PA")),
      normalizedAddress: normalizeAddress("308 Baughman St, West Newton, PA"),
      street: "308 Baughman St",
      city: "West Newton",
      county: "Westmoreland",
      state: "PA",
      postalCode: "15089",
      latitude: 40.2108,
      longitude: -79.7665,
      parcelId: null,
      municipality: "West Newton",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: stableId(normalizeAddress("22 Birchwood Dr, North Huntingdon, PA")),
      normalizedAddress: normalizeAddress("22 Birchwood Dr, North Huntingdon, PA"),
      street: "22 Birchwood Dr",
      city: "North Huntingdon",
      county: "Westmoreland",
      state: "PA",
      postalCode: "15642",
      latitude: 40.3162,
      longitude: -79.7442,
      parcelId: null,
      municipality: "North Huntingdon",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: stableId(normalizeAddress("105 Oak Street, Hempfield Township, PA")),
      normalizedAddress: normalizeAddress("105 Oak Street, Hempfield Township, PA"),
      street: "105 Oak Street",
      city: "Greensburg",
      county: "Westmoreland",
      state: "PA",
      postalCode: "15601",
      latitude: 40.2848,
      longitude: -79.5472,
      parcelId: null,
      municipality: "Hempfield Township",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: stableId(normalizeAddress("10 Ridge Lane, West Newton, PA")),
      normalizedAddress: normalizeAddress("10 Ridge Lane, West Newton, PA"),
      street: "10 Ridge Lane",
      city: "West Newton",
      county: "Westmoreland",
      state: "PA",
      postalCode: "15089",
      latitude: 40.2152,
      longitude: -79.7718,
      parcelId: null,
      municipality: "West Newton",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: stableId(normalizeAddress("18 Maple Ave, West Newton, PA")),
      normalizedAddress: normalizeAddress("18 Maple Ave, West Newton, PA"),
      street: "18 Maple Ave",
      city: "West Newton",
      county: "Westmoreland",
      state: "PA",
      postalCode: "15089",
      latitude: 40.2081,
      longitude: -79.7648,
      parcelId: null,
      municipality: "West Newton",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function resolveGeocoderDependency(
  env: ReturnType<typeof loadAppEnv>,
  dependencies: AnalyzeDependencies,
): Geocoder {
  if (dependencies.geocoder) {
    return dependencies.geocoder;
  }
  const geocodingMissing = validateGeocodingEnv(env);
  if (geocodingMissing.length > 0) {
    throw new SolarProviderError(
      "AUTHENTICATION_FAILED",
      "GOOGLE_GEOCODING_API_KEY is required to resolve locations.",
    );
  }
  return new GoogleMapsGeocoder({
    apiKey: env.googleGeocodingApiKey as string,
  });
}

function inferResolvedLocationType(query: string, geocodedLocationType: string | null): LocationResolveResponse["locationType"] {
  const normalized = query.trim().toLowerCase();
  if (/^\d{5}(?:-\d{4})?$/.test(normalized)) {
    return "ZIP";
  }
  if (/^\d+\s/.test(normalized)) {
    return "ADDRESS";
  }
  if (/(township|borough|municipality|village|neighborhood|neighbourhood)/i.test(normalized)) {
    return "NEIGHBORHOOD";
  }
  if (geocodedLocationType && /(postal|zip)/i.test(geocodedLocationType)) {
    return "ZIP";
  }
  if (geocodedLocationType && /(street|premise|route|subpremise|establishment|point_of_interest)/i.test(geocodedLocationType)) {
    return "ADDRESS";
  }
  if (geocodedLocationType && /(locality|administrative_area_level_2|political|city)/i.test(geocodedLocationType)) {
    return "CITY";
  }
  return "UNKNOWN";
}

function inferResolvedSearchType(query: string, geocodedLocationType: string | null): LocationResolveResponse["type"] {
  const locationType = inferResolvedLocationType(query, geocodedLocationType);
  return locationType === "ADDRESS" ? "PROPERTY" : "AREA";
}

function extractResolvedLocationDetails(rawResponse: unknown): {
  postalCode: string | null;
  city: string | null;
  county: string | null;
  state: string | null;
} {
  const result = isRecord(rawResponse) && Array.isArray(rawResponse.results) ? rawResponse.results[0] : undefined;
  const components = isRecord(result) && Array.isArray(result.address_components)
    ? result.address_components.filter(isRecord)
    : [];
  const getComponent = (type: string) => {
    const component = components.find((entry) => {
      const types = Array.isArray(entry.types) ? entry.types.filter((value): value is string => typeof value === "string") : [];
      return types.some((value) => value === type);
    });
    return typeof component?.long_name === "string" ? component.long_name : null;
  };

  return {
    postalCode: getComponent("postal_code"),
    city: getComponent("locality") ?? getComponent("postal_town"),
    county: getComponent("administrative_area_level_2"),
    state: getComponent("administrative_area_level_1"),
  };
}

function buildOpportunitySignals(result: AnalyzeResult): OpportunitySignal[] {
  const signals: OpportunitySignal[] = [];

  if (result.maxRoofSolarCapacityKw != null) {
    signals.push({
      code: "max_roof_capacity_kw",
      category: "SOLAR",
      label: "Max roof solar capacity",
      value: result.maxRoofSolarCapacityKw,
      unit: "kW",
      source: "solar_assessment",
      confidence: result.solarAssessment.solarFitConfidence,
      impact: result.maxRoofSolarCapacityKw >= 15 ? 90 : result.maxRoofSolarCapacityKw >= 12 ? 70 : 40,
      observedAt: result.solarAssessment.assessedAt,
      expiresAt: result.solarAssessment.imageryProcessedDate ?? result.solarAssessment.imageryDate ?? null,
      metadata: { propertyId: result.property.id },
    });
  }

  if (result.solarAssessment.estimatedAnnualProductionKwh != null) {
    signals.push({
      code: "estimated_annual_production_kwh",
      category: "SOLAR",
      label: "Modeled annual production",
      value: result.solarAssessment.estimatedAnnualProductionKwh,
      unit: "kWh",
      source: "solar_assessment",
      confidence: result.solarAssessment.solarFitConfidence,
      impact: Math.min(100, Math.round((result.solarAssessment.estimatedAnnualProductionKwh ?? 0) / 500)),
      observedAt: result.solarAssessment.assessedAt,
      expiresAt: result.solarAssessment.imageryProcessedDate ?? result.solarAssessment.imageryDate ?? null,
      metadata: { propertyId: result.property.id },
    });
  }

  if (result.confirmedAnnualUsageKwh != null) {
    signals.push({
      code: "confirmed_annual_usage_kwh",
      category: "ENERGY",
      label: "Confirmed annual usage",
      value: result.confirmedAnnualUsageKwh,
      unit: "kWh",
      source: result.usageProfile.source,
      confidence: result.usageProfile.confidence,
      impact: Math.min(100, Math.round((result.confirmedAnnualUsageKwh ?? 0) / 250)),
      observedAt: result.usageProfile.createdAt,
      expiresAt: null,
      metadata: { propertyId: result.property.id },
    });
  }

  signals.push({
    code: "whale_score",
    category: "MARKET",
    label: "Whale score",
    value: result.whaleScore.whaleScore,
    unit: "score",
    source: "whale_model",
    confidence: result.whaleScore.confidence,
    impact: result.whaleScore.whaleScore,
    observedAt: result.solarAssessment.assessedAt,
    expiresAt: null,
    metadata: { propertyId: result.property.id },
  });

  signals.push({
    code: "location_verification",
    category: "PROPERTY",
    label: "Location verification",
    value: result.locationVerification.status,
    unit: "status",
    source: "geocoding",
    confidence: result.locationVerification.status === "VERIFIED" ? 100 : result.locationVerification.status === "REVIEW" ? 60 : 40,
    impact: result.locationVerification.status === "MISMATCH" ? -50 : result.locationVerification.status === "REVIEW" ? 10 : 25,
    observedAt: result.solarAssessment.assessedAt,
    expiresAt: null,
    metadata: { distanceMeters: result.locationVerification.distanceMeters, propertyId: result.property.id },
  });

  if (result.solarAssessment.existingSolarStatus === "DETECTED") {
    signals.push({
      code: "existing_solar_detected",
      category: "SOLAR",
      label: "Existing solar detected",
      value: true,
      unit: null,
      source: "solar_assessment",
      confidence: result.solarAssessment.existingSolarConfidence ?? 80,
      impact: -100,
      observedAt: result.solarAssessment.assessedAt,
      expiresAt: result.solarAssessment.imageryProcessedDate ?? result.solarAssessment.imageryDate ?? null,
      metadata: { propertyId: result.property.id },
    });
  }

  for (const signal of result.signals) {
    signals.push(mapPropertySignalToOpportunitySignal(signal));
  }

  return dedupeOpportunitySignals(signals).slice(0, 10);
}

function buildDiscoveryOpportunitySignals(candidate: DiscoveryCandidateRecord): OpportunitySignal[] {
  const signals: OpportunitySignal[] = [];

  if (candidate.maxRoofSolarCapacityKw != null) {
    signals.push({
      code: "candidate_max_roof_capacity_kw",
      category: "SOLAR",
      label: "Estimated roof capacity",
      value: candidate.maxRoofSolarCapacityKw,
      unit: "kW",
      source: candidate.freshAnalysis ? "solar_assessment" : "market_model",
      confidence: candidate.freshAnalysis?.whaleScore.confidence ?? 60,
      impact: candidate.maxRoofSolarCapacityKw >= 15 ? 80 : candidate.maxRoofSolarCapacityKw >= 12 ? 65 : 35,
      observedAt: candidate.freshAnalysis?.solarAssessment.assessedAt ?? new Date().toISOString(),
      expiresAt: null,
      metadata: { propertyId: candidate.property.id },
    });
  }

  if (candidate.confirmedAnnualUsageKwh != null) {
    signals.push({
      code: "candidate_confirmed_annual_usage_kwh",
      category: "ENERGY",
      label: "Confirmed annual usage",
      value: candidate.confirmedAnnualUsageKwh,
      unit: "kWh",
      source: "usage_profile",
      confidence: candidate.usageProfile?.confidence ?? 60,
      impact: Math.min(100, Math.round((candidate.confirmedAnnualUsageKwh ?? 0) / 250)),
      observedAt: candidate.usageProfile?.createdAt ?? new Date().toISOString(),
      expiresAt: null,
      metadata: { propertyId: candidate.property.id },
    });
  }

  if (candidate.market?.medianHomeValueBand != null) {
    signals.push({
      code: "high_value_area",
      category: "MARKET",
      label: "High-value area",
      value: candidate.market.medianHomeValueBand,
      unit: null,
      source: "market_model",
      confidence: 70,
      impact: candidate.market.medianHomeValueBand === "VERY_HIGH" ? 24 : 18,
      observedAt: new Date().toISOString(),
      expiresAt: null,
      metadata: { marketId: candidate.market.id, propertyId: candidate.property.id },
    });
  }

  if (candidate.market?.solarSaturation === "LOW") {
    signals.push({
      code: "low_solar_saturation",
      category: "MARKET",
      label: "Low solar saturation",
      value: candidate.market.solarSaturation,
      unit: null,
      source: "market_model",
      confidence: 72,
      impact: 20,
      observedAt: new Date().toISOString(),
      expiresAt: null,
      metadata: { marketId: candidate.market.id, propertyId: candidate.property.id },
    });
  }

  if (candidate.permits.some((permit) => permit.permitType === "ROOF" && permit.status === "ISSUED")) {
    signals.push({
      code: "recent_roof_permit",
      category: "PERMIT",
      label: "Recent roof permit",
      value: true,
      unit: null,
      source: "permit_feed",
      confidence: 75,
      impact: 22,
      observedAt: new Date().toISOString(),
      expiresAt: null,
      metadata: { propertyId: candidate.property.id },
    });
  }

  for (const signal of candidate.propertySignals) {
    signals.push(mapPropertySignalToOpportunitySignal(signal));
  }

  return dedupeOpportunitySignals(signals).slice(0, 8);
}

function mapPropertySignalToOpportunitySignal(signal: PropertySignal): OpportunitySignal {
  return {
    code: signal.signalType.toLowerCase(),
    category: mapSignalCategory(signal.signalType),
    label: signalLabel(signal.signalType),
    value: extractSignalValue(signal.valueJson),
    unit: null,
    source: signal.source,
    confidence: signal.confidence,
    impact: mapSignalImpact(signal.signalType),
    observedAt: signal.observedAt,
    expiresAt: signal.expiresAt ?? null,
    metadata: isRecord(signal.valueJson) ? signal.valueJson : null,
  };
}

function mapSignalCategory(signalType: PropertySignal["signalType"]): OpportunitySignal["category"] {
  switch (signalType) {
    case "POOL_VISIBLE":
    case "EV_CONFIRMED":
    case "EV_CHARGER_CONFIRMED":
    case "LARGE_HOME":
    case "LARGE_ROOF":
    case "EXISTING_SOLAR":
      return "PROPERTY";
    case "RECENT_ROOF_PERMIT":
      return "PERMIT";
    case "HIGH_USAGE_CONFIRMED":
    case "HIGH_USAGE_ESTIMATED":
      return "ENERGY";
    default:
      return "FIELD";
  }
}

function mapSignalImpact(signalType: PropertySignal["signalType"]): number {
  switch (signalType) {
    case "POOL_VISIBLE":
    case "EV_CONFIRMED":
    case "EV_CHARGER_CONFIRMED":
      return 18;
    case "LARGE_HOME":
    case "LARGE_ROOF":
      return 26;
    case "RECENT_ROOF_PERMIT":
      return 22;
    case "EXISTING_SOLAR":
      return -100;
    case "HIGH_USAGE_CONFIRMED":
      return 24;
    case "HIGH_USAGE_ESTIMATED":
      return 14;
    default:
      return 8;
  }
}

function extractSignalValue(value: unknown): OpportunitySignal["value"] {
  if (value == null) {
    return null;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return null;
}

function dedupeOpportunitySignals(signals: OpportunitySignal[]): OpportunitySignal[] {
  const seen = new Set<string>();
  const result: OpportunitySignal[] = [];
  for (const signal of signals) {
    if (seen.has(signal.code)) {
      continue;
    }
    seen.add(signal.code);
    result.push(signal);
  }
  return result;
}

async function buildDiscoveryCandidateRecord(
  property: Property,
  distanceMiles: number,
  markets: NeighborhoodMarket[],
  repository: SolarRepository,
): Promise<DiscoveryCandidateRecord> {
  const market = findMarketForProperty(property, markets);
  const discoveryRecords = await repository.listPropertyDiscoveries(property.id);
  const latestDiscovery = discoveryRecords[0] ?? null;
  const leadOutcome = await repository.getLeadOutcomeByPropertyId(property.id);
  const usageProfile = await repository.getUsageProfileByPropertyId(property.id);
  const permits = await repository.listPermits(property.id);
  const propertySignals = await repository.listPropertySignals(property.id);
  const opportunityAssessment = await repository.getOpportunityAssessmentByPropertyId(property.id);
  const solarAssessment = await repository.getSolarAssessmentByPropertyId(property.id);
  const auditRecord = solarAssessment ? await repository.getSolarAssessmentAuditByAssessmentId(solarAssessment.id) : null;
  const freshAnalysis =
    solarAssessment && auditRecord && isCacheableAudit(auditRecord.auditJson)
      ? await hydrateStoredAnalysis(property, repository)
      : null;
  const maxRoofSolarCapacityKw = freshAnalysis?.maxRoofSolarCapacityKw ?? solarAssessment?.estimatedMaxSystemKw ?? estimateCapacityFromSignals(propertySignals, market);
  const confirmedAnnualUsageKwh = freshAnalysis?.confirmedAnnualUsageKwh ?? usageProfile?.annualUsageKwh ?? null;
  const estimatedEnergyNeedKw = freshAnalysis?.estimatedEnergyNeedKw ?? estimateEnergyNeedKw(confirmedAnnualUsageKwh);
  const signals = deriveDiscoverySignals(property, market, propertySignals, permits);
  const propertyUse = inferPropertyUse(property, maxRoofSolarCapacityKw, freshAnalysis);
  const cheapReasons = buildDiscoveryReasons({
    property,
    market,
    discoverySource: latestDiscovery?.provider ?? null,
    discoveryConfidence: latestDiscovery?.confidence ?? null,
    permits,
    signals,
    opportunityAssessment,
    freshAnalysis,
    maxRoofSolarCapacityKw,
    confirmedAnnualUsageKwh,
  });
  const cheapScore = buildDiscoveryScore({
    market,
    discoverySource: latestDiscovery?.provider ?? null,
    discoveryConfidence: latestDiscovery?.confidence ?? null,
    permits,
    propertySignals,
    opportunityAssessment,
    freshAnalysis,
    leadOutcome,
    usageProfile,
    maxRoofSolarCapacityKw,
  });

  return {
    property,
    distanceMiles,
    propertyUse,
    market,
    discoverySource: latestDiscovery?.provider ?? null,
    discoveryConfidence: latestDiscovery?.confidence ?? null,
    leadOutcome,
    usageProfile,
    permits,
    propertySignals,
    opportunityAssessment,
    freshAnalysis,
    maxRoofSolarCapacityKw,
    confirmedAnnualUsageKwh,
    estimatedEnergyNeedKw,
    cheapScore,
    cheapReasons,
    signals,
    routeReason: cheapReasons[0] ?? "Highest-value nearby opportunity",
  };
}

function applyDiscoveryFilters(
  candidates: DiscoveryCandidateRecord[],
  filters: DiscoveryScanFilters,
): DiscoveryCandidateRecord[] {
  const whaleCandidates = filters.whaleCandidates ?? false;
  const highPriority = filters.highPriority ?? false;
  const recentRoofPermit = filters.recentRoofPermit ?? filters.recentRoofPermits ?? false;
  const noDetectedSolar = filters.noDetectedSolar ?? filters.noDetectedExistingSolar ?? false;
  const largeProperty = filters.largeProperty ?? filters.largeProperties ?? false;
  const highValueArea = filters.highValueArea ?? filters.highValueAreas ?? false;
  const revisit = filters.revisit ?? filters.revisits ?? false;
  return candidates.filter((candidate) => {
    if (!isResidentialPropertyUse(candidate.propertyUse)) {
      return false;
    }
    if ((whaleCandidates || highPriority) && candidate.cheapScore < 65) {
      return false;
    }
    if (largeProperty && !candidate.signals.some((signal) => signal === "Large roof" || signal === "Large property")) {
      return false;
    }
    if (recentRoofPermit && !candidate.signals.includes("Recent roof permit")) {
      return false;
    }
    if (highValueArea && candidate.market?.medianHomeValueBand == null) {
      return false;
    }
    if (noDetectedSolar && candidate.signals.includes("Existing solar")) {
      return false;
    }
    if (revisit && candidate.leadOutcome?.outcome !== "NOT_HOME" && candidate.leadOutcome?.outcome !== "BILL_REQUESTED") {
      return false;
    }
    if (filters.lowSolarSaturation && candidate.market?.solarSaturation !== "LOW") {
      return false;
    }
    return true;
  });
}

function getMinimumSystemKw(filters: DiscoveryScanFilters): number | null {
  return filters.minimumSystemKw ?? filters.minCapacityKw ?? null;
}

function mapDiscoveryResult(
  analysis: AnalyzeResult,
  candidate: DiscoveryCandidateRecord,
  analysisStatus: DiscoveryScanLead["analysisStatus"],
): DiscoveryScanLead {
  const lead = mapAnalyzeResultToLeadCard(analysis, false);
  return {
    ...lead,
    distanceMiles: candidate.distanceMiles,
    analysisStatus,
    candidateScore: Math.round(candidate.cheapScore),
    routeReason: candidate.routeReason,
  };
}

function buildPendingDiscoveryResult(
  candidate: DiscoveryCandidateRecord,
  nextAction: NextBestAction,
): DiscoveryScanLead {
  const useKnownScore = Math.round(candidate.cheapScore);
  const addressParts = buildLeadAddressParts({
    street: candidate.property.street ?? null,
    formattedAddress: candidate.property.normalizedAddress,
    city: candidate.property.city ?? candidate.property.municipality ?? candidate.property.county ?? null,
    state: candidate.property.state ?? null,
    postalCode: candidate.property.postalCode ?? null,
  });
  return {
    id: candidate.property.id,
    propertyId: candidate.property.id,
    latitude: candidate.property.latitude ?? null,
    longitude: candidate.property.longitude ?? null,
    city: addressParts.city,
    state: addressParts.state ?? "PA",
    postalCode: addressParts.postalCode,
    address: addressParts.displayAddress,
    neighborhood: candidate.market?.name ?? candidate.property.municipality ?? candidate.property.city ?? candidate.property.county ?? "Unknown area",
    opportunityScore: useKnownScore,
    whaleScore: Math.min(100, Math.round(candidate.cheapScore * 0.8)),
    solarFitScore: Math.min(100, Math.round(candidate.cheapScore * 0.75)),
    confidence: candidate.freshAnalysis ? 80 : 44,
    maxRoofSolarCapacityKw: candidate.maxRoofSolarCapacityKw,
    confirmedAnnualUsageKwh: candidate.confirmedAnnualUsageKwh,
    estimatedEnergyNeedKw: candidate.estimatedEnergyNeedKw,
    estimatedUsagePotentialKwh: candidate.confirmedAnnualUsageKwh,
    whaleConfidence: candidate.freshAnalysis?.whaleScore.confidence ?? Math.min(100, Math.round(candidate.cheapScore)),
    maxSystemKw: candidate.maxRoofSolarCapacityKw,
    maxArrayPanelsCount: null,
    estimatedAnnualProductionKwh: null,
    sunshineHours: null,
    imageryQuality: candidate.freshAnalysis?.solarAssessment.imageryQuality ?? "UNKNOWN",
    existingSolarStatus: candidate.freshAnalysis?.solarAssessment.existingSolarStatus ?? "UNKNOWN",
    permitCount: candidate.permits.length,
    nextAction: nextAction.label,
    nextBestAction: nextAction,
    reasons: candidate.cheapReasons,
    signals: candidate.signals,
    opportunitySignals: candidate.freshAnalysis?.opportunitySignals ?? buildDiscoveryOpportunitySignals(candidate),
    badges: deriveCheapBadges(candidate),
    verificationNeeded: candidate.confirmedAnnualUsageKwh == null ? ["Electric bill"] : [],
    outcome: candidate.leadOutcome?.outcome ?? "UNTOUCHED",
    isDemo: false,
    locationVerification: candidate.freshAnalysis?.locationVerification ?? undefined,
    distanceMiles: candidate.distanceMiles,
    analysisStatus: "ANALYZING",
    candidateScore: useKnownScore,
    routeReason: candidate.routeReason,
  };
}

function deriveCheapBadges(candidate: DiscoveryCandidateRecord): LeadSignalBadge[] {
  const badges: LeadSignalBadge[] = [];
  if ((candidate.maxRoofSolarCapacityKw ?? 0) >= 15) {
    badges.push({ label: "WHALE", tone: "MODEL" });
  }
  if (candidate.signals.includes("Recent roof permit")) {
    badges.push({ label: "PUBLIC RECORD", tone: "PUBLIC_RECORD" });
  }
  if (candidate.confirmedAnnualUsageKwh == null) {
    badges.push({ label: "VERIFY", tone: "MISSING" });
  }
  return badges.slice(0, 3);
}

function buildDiscoveryReasons(input: {
  property: Property;
  market: NeighborhoodMarket | null;
  discoverySource: string | null;
  discoveryConfidence: number | null;
  permits: PermitRecord[];
  signals: string[];
  opportunityAssessment: OpportunityAssessment | null;
  freshAnalysis: AnalyzeResult | null;
  maxRoofSolarCapacityKw: number | null;
  confirmedAnnualUsageKwh: number | null;
}): string[] {
  const reasons = [
    input.discoverySource ? `Discovered via ${input.discoverySource.replace(/_/g, " ")}` : null,
    input.freshAnalysis ? `Fresh solar assessment already available` : null,
    input.maxRoofSolarCapacityKw != null ? `Roof capacity around ${formatNumber(input.maxRoofSolarCapacityKw)} kW` : null,
    input.confirmedAnnualUsageKwh != null ? `Confirmed usage ${formatNumber(input.confirmedAnnualUsageKwh)} kWh/year` : null,
    input.permits.some((permit) => permit.permitType === "ROOF" && permit.status === "ISSUED") ? "Recent roof permit" : null,
    input.market?.medianHomeValueBand === "HIGH" || input.market?.medianHomeValueBand === "VERY_HIGH" ? "High-value area" : null,
    input.signals.includes("Pool signal") ? "Pool signal" : null,
    input.signals.includes("Existing solar") ? "Existing solar detected" : null,
    input.opportunityAssessment ? `Prior opportunity score ${input.opportunityAssessment.overallOpportunityScore}` : null,
  ].filter((value): value is string => Boolean(value));
  return reasons.slice(0, 3);
}

function buildDiscoveryScore(input: {
  market: NeighborhoodMarket | null;
  discoverySource: string | null;
  discoveryConfidence: number | null;
  permits: PermitRecord[];
  propertySignals: PropertySignal[];
  opportunityAssessment: OpportunityAssessment | null;
  freshAnalysis: AnalyzeResult | null;
  leadOutcome: LeadOutcome | null;
  usageProfile: UsageProfile | null;
  maxRoofSolarCapacityKw: number | null;
}): number {
  if (input.freshAnalysis) {
    return Math.round(
      input.freshAnalysis.opportunityAssessment.overallOpportunityScore * 0.55 +
        input.freshAnalysis.whaleScore.whaleScore * 0.25 +
        input.freshAnalysis.solarAssessment.solarFitScore * 0.2,
    );
  }

  let score = 25;
  if (input.discoverySource) {
    score += 15;
  }
  if ((input.discoveryConfidence ?? 0) >= 80) {
    score += 12;
  } else if ((input.discoveryConfidence ?? 0) >= 65) {
    score += 8;
  }
  if (input.opportunityAssessment) {
    score += input.opportunityAssessment.overallOpportunityScore * 0.35;
    score += input.opportunityAssessment.whaleScore * 0.15;
  }
  if ((input.maxRoofSolarCapacityKw ?? 0) >= 12) {
    score += 12;
  }
  if (input.market?.medianHomeValueBand === "HIGH" || input.market?.medianHomeValueBand === "VERY_HIGH") {
    score += 8;
  }
  if (input.market?.solarSaturation === "LOW") {
    score += 8;
  }
  if (input.permits.some((permit) => permit.permitType === "ROOF" && permit.status === "ISSUED")) {
    score += 10;
  }
  if (input.propertySignals.some((signal) => signal.signalType === "POOL_VISIBLE")) {
    score += 8;
  }
  if (input.propertySignals.some((signal) => signal.signalType === "EV_CONFIRMED" || signal.signalType === "EV_CHARGER_CONFIRMED")) {
    score += 8;
  }
  if (input.propertySignals.some((signal) => signal.signalType === "HIGH_USAGE_CONFIRMED" || signal.signalType === "HIGH_USAGE_ESTIMATED")) {
    score += 10;
  }
  if (input.propertySignals.some((signal) => signal.signalType === "LARGE_HOME" || signal.signalType === "LARGE_ROOF")) {
    score += 12;
  }
  if (input.leadOutcome?.outcome === "NOT_HOME" || input.leadOutcome?.outcome === "BILL_REQUESTED") {
    score += 6;
  }
  if (input.usageProfile?.annualUsageKwh != null && input.usageProfile.annualUsageKwh >= 25000) {
    score += 10;
  }
  if (input.propertySignals.some((signal) => signal.signalType === "EXISTING_SOLAR")) {
    score -= 25;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

function dedupeProperties(properties: Property[]): Property[] {
  const result: Property[] = [];
  for (const property of properties) {
    if (result.some((existing) => areDuplicateProperties(existing, property))) continue;
    result.push(property);
  }
  return result;
}

function areDuplicateProperties(left: Property, right: Property): boolean {
  if (left.id === right.id) {
    return true;
  }
  if (left.parcelId != null && right.parcelId != null && left.parcelId === right.parcelId) {
    return true;
  }
  const leftAddress = normalizeAddress(left.normalizedAddress);
  const rightAddress = normalizeAddress(right.normalizedAddress);
  if (leftAddress != null && rightAddress != null && leftAddress === rightAddress) {
    return true;
  }
  if (left.latitude != null && left.longitude != null && right.latitude != null && right.longitude != null) {
    const separation = distanceMeters(
      { latitude: left.latitude, longitude: left.longitude },
      { latitude: right.latitude, longitude: right.longitude },
    );
    if (separation != null && separation <= 10) {
      return true;
    }
  }
  return false;
}

function findMarketForProperty(property: Property, markets: NeighborhoodMarket[]): NeighborhoodMarket | null {
  const name = `${property.municipality ?? ""} ${property.city ?? ""} ${property.county ?? ""}`.toLowerCase();
  return markets.find((market) => name.includes(market.name.toLowerCase().replace(" township", ""))) ?? markets.find((market) => market.name.toLowerCase().includes("west newton")) ?? null;
}

function deriveDiscoverySignals(
  property: Property,
  market: NeighborhoodMarket | null,
  signals: PropertySignal[],
  permits: PermitRecord[],
  freshAnalysis: AnalyzeResult | null = null,
): string[] {
  const labels = new Set<string>();
  if (freshAnalysis) {
    labels.add("Fresh analysis");
  }
  if (freshAnalysis?.solarAssessment.maxArrayPanelsCount != null && freshAnalysis.solarAssessment.maxArrayPanelsCount >= 20) {
    labels.add("Large roof");
  }
  if (freshAnalysis?.solarAssessment.existingSolarStatus === "DETECTED") {
    labels.add("Existing solar");
  }
  if (signals.some((signal) => signal.signalType === "RECENT_ROOF_PERMIT") || permits.some((permit) => permit.permitType === "ROOF" && permit.status === "ISSUED")) {
    labels.add("Recent roof permit");
  }
  if (signals.some((signal) => signal.signalType === "POOL_VISIBLE")) {
    labels.add("Pool signal");
  }
  if (signals.some((signal) => signal.signalType === "EV_CONFIRMED" || signal.signalType === "EV_CHARGER_CONFIRMED")) {
    labels.add("EV signal");
  }
  if (signals.some((signal) => signal.signalType === "LARGE_HOME")) {
    labels.add("Large property");
  }
  if (market?.medianHomeValueBand === "HIGH" || market?.medianHomeValueBand === "VERY_HIGH") {
    labels.add("High-value area");
  }
  if (market?.solarSaturation === "LOW") {
    labels.add("Low solar saturation");
  }
  if (property.latitude != null && property.longitude != null) {
    labels.add("Current area");
  }
  return [...labels].slice(0, 4);
}

function estimateCapacityFromSignals(signals: PropertySignal[], market: NeighborhoodMarket | null): number | null {
  if (signals.some((signal) => signal.signalType === "LARGE_ROOF")) {
    return market?.averageSolarPotentialKw != null ? Math.round((market.averageSolarPotentialKw + 1.5) * 10) / 10 : 15.0;
  }
  if (market?.averageSolarPotentialKw != null) {
    return Math.round(market.averageSolarPotentialKw * 10) / 10;
  }
  return null;
}

function signalsFromExisting(signals: PropertySignal[]): string[] {
  return signals.map((signal) => signalLabel(signal.signalType));
}

function buildRouteLeadFromCandidate(candidate: DiscoveryCandidateRecord): DiscoveryScanLead {
  const nextBestAction = recommendNextBestAction({
    usageUnknown: candidate.confirmedAnnualUsageKwh == null,
    strongSolarPotential: (candidate.maxRoofSolarCapacityKw ?? candidate.cheapScore / 10) >= 12,
    noShow: candidate.leadOutcome?.outcome === "NOT_HOME",
    billRequested: candidate.leadOutcome?.outcome === "BILL_REQUESTED",
  });
  if (candidate.freshAnalysis) {
    return mapDiscoveryResult(candidate.freshAnalysis, candidate, "CACHED");
  }
  return buildPendingDiscoveryResult(candidate, nextBestAction);
}

async function loadRouteProperties(
  selectedPropertyIds: string[],
  repository: SolarRepository,
): Promise<RouteCandidateRecord[]> {
  const markets = buildNeighborhoodSeedData(repository);
  const properties = await Promise.all(selectedPropertyIds.map((propertyId) => repository.getPropertyById(propertyId)));
  return properties
    .filter((property): property is Property => property != null)
    .map((property) => {
      const candidate = buildDiscoveryCandidateRecordLite(property, 0, markets);
      return {
        property,
        lead: buildRouteLeadFromCandidate(candidate),
      };
    });
}

function nearestNeighborOrder(input: {
  start: { latitude: number; longitude: number };
  properties: RouteCandidateRecord[];
}): Array<{ property: Property; lead: DiscoveryScanLead; distanceMilesFromPrevious: number; distanceMilesFromStart: number }> {
  const remaining = input.properties.slice();
  const ordered: Array<{ property: Property; lead: DiscoveryScanLead; distanceMilesFromPrevious: number; distanceMilesFromStart: number }> = [];
  let current = input.start;
  let distanceFromStart = 0;
  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const distance = distanceMilesBetween(current, {
        latitude: candidate.property.latitude ?? input.start.latitude,
        longitude: candidate.property.longitude ?? input.start.longitude,
      });
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    const [next] = remaining.splice(bestIndex, 1);
    distanceFromStart += bestDistance;
    ordered.push({
      property: next.property,
      lead: next.lead,
      distanceMilesFromPrevious: Number.isFinite(bestDistance) ? Math.round(bestDistance * 10) / 10 : 0,
      distanceMilesFromStart: Math.round(distanceFromStart * 10) / 10,
    });
    current = {
      latitude: next.property.latitude ?? current.latitude,
      longitude: next.property.longitude ?? current.longitude,
    };
  }
  return ordered;
}

async function getCompletedRoutePropertyIds(propertyIds: string[], repository: SolarRepository): Promise<string[]> {
  const completed: string[] = [];
  for (const propertyId of propertyIds) {
    const outcome = await repository.getLeadOutcomeByPropertyId(propertyId);
    if (outcome && outcome.outcome !== "UNTOUCHED") {
      completed.push(propertyId);
    }
  }
  return completed;
}

export async function getDiscoverResponse(
  radiusMiles = 10,
  repository: SolarRepository = defaultRepository,
): Promise<DiscoverResponse> {
  const dashboard = await getTodayDashboard(repository);
  const neighborhoods = await getNeighborhoodMarkets(radiusMiles, repository);
  const properties = dashboard.leads
    .slice()
    .sort((left, right) => right.opportunityScore - left.opportunityScore)
    .slice(0, 8);
  return {
    currentLocation: dashboard.territory,
    radiusMiles,
    neighborhoods,
    properties,
  };
}

export async function getDealBrief(
  propertyId: string,
  repository: SolarRepository = defaultRepository,
): Promise<DealBrief | null> {
  const detail = await getPropertyDetail(propertyId, repository);
  if (!detail) {
    return null;
  }
  return buildDealBrief(detail);
}

export async function getRevenueCommandCenter(
  repository: SolarRepository = defaultRepository,
): Promise<RevenueCommandCenter> {
  const dashboard = await getTodayDashboard(repository);
  const leads = dashboard.leads;
  const deals = await Promise.all(
    leads
      .filter((lead) => lead.propertyId != null)
      .map(async (lead) => {
        const brief = await getDealBrief(lead.propertyId as string, repository);
        return brief;
      }),
  );
  const allDeals = dedupeDealBriefs([
    ...deals.filter((deal): deal is DealBrief => deal != null),
  ]);
  const pipelineValue = roundMoney(allDeals.reduce((sum, deal) => sum + estimateDealRevenue(deal), 0));
  const likelyInstallValue = roundMoney(
    allDeals
      .filter((deal) => ["BILL_RECEIVED", "APPOINTMENT_BOOKED", "CONTRACT_SIGNED", "PERMITTING"].includes(deal.stage))
      .reduce((sum, deal) => sum + estimateDealRevenue(deal), 0),
  );
  const revenueAtRisk = roundMoney(
    allDeals
      .filter((deal) => deal.stage === "RECOVERY" || deal.stage === "PERMITTING")
      .reduce((sum, deal) => sum + deal.revenueAtRisk, 0),
  );
  const stageRollup = rollupDealStages(allDeals);
  const territoryRanking = rankTerritories(allDeals);
  const repRanking = rankReps(repository, allDeals);
  const topTerritory = territoryRanking[0]?.territory ?? dashboard.territory;
  const topRep = repRanking[0]?.rep ?? "Field Team A";
  const whaleOpportunities = allDeals.filter((deal) => deal.whaleScore >= 70).length;
  const billsWaiting = allDeals.filter((deal) => deal.nextBestAction.code === "GET_BILL" || deal.stage === "BILL_REQUESTED").length;
  const noShowsToRecover = allDeals.filter((deal) => deal.stage === "RECOVERY").length;
  const permitsDelayed = allDeals.filter((deal) => deal.stage === "PERMITTING").length;
  const installReady = allDeals.filter((deal) => ["BILL_RECEIVED", "APPOINTMENT_BOOKED", "CONTRACT_SIGNED"].includes(deal.stage)).length;
  const nextActions = allDeals
    .slice()
    .sort((left, right) => right.revenueAtRisk - left.revenueAtRisk)
    .slice(0, 4)
    .map((deal) => ({
      label: deal.nextBestAction.label,
      detail: deal.propertyAddress,
      priority: deal.nextBestAction.priority,
    }));

  return {
    generatedAt: new Date().toISOString(),
    today: new Date().toISOString().slice(0, 10),
    pipelineValue,
    likelyInstallValue,
    revenueAtRisk,
    topTerritory,
    topRep,
    whaleOpportunities,
    billsWaiting,
    noShowsToRecover,
    permitsDelayed,
    installReady,
    stageRollup,
    territoryRanking,
    repRanking,
    nextActions,
  };
}

function buildDealBrief(result: AnalyzeResult): DealBrief {
  const stage = determineDealStage(result);
  const nextBestAction = recommendNextBestAction({
    billRequested: result.leadOutcome.outcome === "BILL_REQUESTED",
    billReceived: result.leadOutcome.outcome === "BILL_RECEIVED",
    appointmentBooked:
      result.leadOutcome.outcome === "APPOINTMENT_BOOKED" || result.leadOutcome.outcome === "APPOINTMENT_COMPLETED",
    contractSigned: result.leadOutcome.outcome === "SIGNED" || result.leadOutcome.outcome === "INSTALLED",
    cancelled: result.leadOutcome.outcome === "CANCELLED",
    noShow: result.leadOutcome.outcome === "NOT_HOME",
    usageUnknown: result.usageProfile.annualUsageKwh == null,
    strongSolarPotential: (result.solarAssessment.estimatedMaxSystemKw ?? 0) >= 12,
    roofDocsMissing: result.audit.missingFields.includes("roofSegmentStats"),
    permitPendingDays: pendingPermitDays(result.permits),
  });
  const customerSignals = [
    ...result.signals.map((signal) => signalLabel(signal.signalType)),
    result.solarAssessment.existingSolarStatus === "DETECTED" ? "Existing solar" : null,
    result.usageProfile.annualUsageKwh != null ? `Usage confirmed at ${formatNumber(result.usageProfile.annualUsageKwh)} kWh/year` : "Usage unknown",
    result.permits.some((permit) => permit.permitType === "ROOF" && permit.status === "ISSUED") ? "Recent roof permit" : null,
  ].filter((value): value is string => Boolean(value));
  const conversationHistory = [
    result.leadOutcome.notes ?? "No conversation notes yet.",
    `Next action: ${nextBestAction.label}`,
    `Solar fit ${result.solarAssessment.solarFitScore}/100 with ${formatNumber(result.solarAssessment.estimatedMaxSystemKw)} kW potential`,
  ];
  const objections = [
    ...result.audit.missingFields.map((field) => objectionFromMissingField(field)),
    result.solarAssessment.existingSolarStatus === "DETECTED" ? "Existing solar may already cover the roof" : null,
    result.whaleScore.verificationNeeded.includes("Request electric bill") ? "Electric bill is still missing" : null,
  ].filter((value): value is string => Boolean(value));
  const billSummary =
    result.usageProfile.monthlyBillAverage != null
      ? `$${Math.round(result.usageProfile.monthlyBillAverage)} average monthly bill`
      : "Bill not provided yet";
  const consultantRecommendation = buildConsultantRecommendation(result, stage, nextBestAction);
  return {
    id: result.property.id,
    propertyId: result.property.id,
    propertyAddress: result.property.street ?? result.property.normalizedAddress,
    stage,
    maxRoofSolarCapacityKw: result.maxRoofSolarCapacityKw,
    confirmedAnnualUsageKwh: result.confirmedAnnualUsageKwh,
    estimatedEnergyNeedKw: result.estimatedEnergyNeedKw,
    solarFitScore: result.solarAssessment.solarFitScore,
    whaleScore: result.whaleScore.whaleScore,
    estimatedSystemKw: result.solarAssessment.estimatedMaxSystemKw ?? null,
    estimatedAnnualProductionKwh: result.solarAssessment.estimatedAnnualProductionKwh ?? null,
    annualUsageKwh: result.usageProfile.annualUsageKwh ?? null,
    billSummary,
    customerSignals,
    conversationHistory,
    objections,
    nextBestAction,
    consultantRecommendation,
    revenueAtRisk: estimateRevenueAtRisk(result, stage),
    updatedAt: new Date().toISOString(),
  };
}

interface ResolvedAnalysisDependencies {
  geocoder: Geocoder;
  solarProvider: SolarDataProvider;
}

interface ResolvedLocation {
  latitude: number;
  longitude: number;
  normalizedAddress: string;
  source: "GEOCODED" | "INPUT";
  partialMatch: boolean;
  formattedAddress: string | null;
}

async function resolveLocation(
  input: AnalyzeInput,
  geocoder: Geocoder,
  cachedProperty?: Property | null,
): Promise<ResolvedLocation> {
  if (cachedProperty?.latitude != null && cachedProperty?.longitude != null) {
    return {
      latitude: cachedProperty.latitude,
      longitude: cachedProperty.longitude,
      normalizedAddress: cachedProperty.normalizedAddress,
      source: "INPUT",
      partialMatch: false,
      formattedAddress: cachedProperty.normalizedAddress,
    };
  }

  if (typeof input.latitude === "number" && typeof input.longitude === "number") {
    return {
      latitude: input.latitude,
      longitude: input.longitude,
      normalizedAddress: normalizeAddress(input.address),
      source: "INPUT",
      partialMatch: false,
      formattedAddress: null,
    };
  }

  const geocoded = await geocoder.geocodeAddress({ address: input.address });
  return {
    latitude: geocoded.latitude,
    longitude: geocoded.longitude,
    normalizedAddress: normalizeAddress(geocoded.formattedAddress ?? input.address),
    source: "GEOCODED",
    partialMatch: geocoded.partialMatch,
    formattedAddress: geocoded.formattedAddress,
  };
}

async function upsertProperty(
  input: AnalyzeInput,
  location: ResolvedLocation,
  repository: SolarRepository,
  propertyId: string,
): Promise<Property> {
  const now = new Date().toISOString();
  const property: Property = {
    id: propertyId,
    normalizedAddress: normalizeAddress(input.address),
    street: input.address.split(",")[0]?.trim() ?? null,
    city: input.municipality ?? null,
    county: input.county ?? null,
    state: input.state ?? "PA",
    postalCode: input.postalCode ?? null,
    latitude: location.latitude,
    longitude: location.longitude,
    parcelId: null,
    municipality: input.municipality ?? null,
    createdAt: now,
    updatedAt: now,
  };
  return repository.upsertProperty(property);
}

async function loadCachedSolarInsights(
  assessment: SolarAssessment,
  auditRecord: SolarAssessmentAuditRecord | null,
  repository: SolarRepository,
): Promise<NormalizedBuildingInsights> {
  const roofSegmentStats = await repository.getRoofSegments(assessment.id);
  const audit = auditRecord?.auditJson ?? null;
  const selectedProductionConfig = audit?.selectedProductionConfig
    ? {
        panelsCount: audit.selectedProductionConfig.panelsCount ?? null,
        yearlyEnergyDcKwh: audit.selectedProductionConfig.yearlyEnergyDcKwh ?? null,
        selectionReason: audit.selectedProductionConfig.selectionReason,
        raw: {
          cached: true,
        },
      }
    : null;
  const detectedArrays = audit
    ? {
        detectionStatus: audit.detectedArrayStatus,
        latestCaptureDate: audit.detectedArrayCaptureDate ?? null,
        raw: {
          cached: true,
        },
      }
    : {
        detectionStatus: assessment.existingSolarStatus,
        latestCaptureDate: null,
        raw: {},
      };
  return {
    provider: "google_solar",
    providerVersion: audit?.providerVersion ?? "cached",
    imageryDate: assessment.imageryDate ?? null,
    imageryProcessedDate: assessment.imageryProcessedDate ?? null,
    imageryQuality: assessment.imageryQuality ?? null,
    providerBuildingId: assessment.providerBuildingId ?? null,
    buildingCenter: audit?.returnedBuildingCenter ?? null,
    roofAreaMeters2: assessment.roofAreaMeters2 ?? null,
    groundAreaMeters2: assessment.groundAreaMeters2 ?? null,
    maxArrayAreaMeters2: assessment.maxArrayAreaMeters2 ?? null,
    maxArrayPanelsCount: assessment.maxArrayPanelsCount ?? null,
    panelCapacityWatts: assessment.panelCapacityWatts ?? null,
    maxSunshineHoursPerYear: assessment.maxSunshineHoursPerYear ?? null,
    estimatedMaxSystemKw: assessment.estimatedMaxSystemKw ?? null,
    estimatedAnnualProductionKwh: assessment.estimatedAnnualProductionKwh ?? null,
    detectedArrays,
    existingSolarStatus: detectedArrays.detectionStatus,
    existingSolarConfidence: detectedArrays.detectionStatus === "DETECTED" ? 0.98 : detectedArrays.detectionStatus === "NOT_DETECTED" ? 0.9 : null,
    selectedProductionConfig,
    wholeRoofStats: audit ? [] : [],
    buildingStats: audit ? [] : [],
    roofSegmentStats: roofSegmentStats.map((segment) => ({
      segmentIndex: segment.segmentIndex,
      areaMeters2: segment.areaMeters2 ?? null,
      pitchDegrees: segment.pitchDegrees ?? null,
      azimuthDegrees: segment.azimuthDegrees ?? null,
      sunshineHours: segment.sunshineHours ?? null,
      panelsCount: segment.panelsCount ?? null,
      yearlyEnergyDcKwh: segment.yearlyEnergyDcKwh ?? null,
      raw: {
        cached: true,
      },
    })),
    solarPanelConfigs: roofSegmentStats.map((segment) => ({
      panelsCount: segment.panelsCount ?? null,
      yearlyEnergyDcKwh: segment.yearlyEnergyDcKwh ?? null,
      orientation: null,
      pitchDegrees: segment.pitchDegrees ?? null,
      azimuthDegrees: segment.azimuthDegrees ?? null,
      panelHeightMeters: null,
      panelWidthMeters: null,
      raw: {
        cached: true,
      },
    })),
    roofSegmentCount: roofSegmentStats.length,
    solarPanels: [],
    missingFields: audit?.missingFields ?? [],
    warnings: audit?.warnings ?? [],
    rawResponse: { cached: true, assessmentId: assessment.id },
  };
}

function isCacheableAudit(audit: SolarAssessmentAudit): boolean {
  return (
    audit.missingFields.length === 0 &&
    audit.returnedBuildingCenter != null &&
    audit.selectedProductionConfig != null &&
    audit.detectedArrayStatus !== "UNKNOWN"
  );
}

async function persistSolarAnalysis(
  property: Property,
  location: ResolvedLocation,
  solar: NormalizedBuildingInsights,
  repository: SolarRepository,
): Promise<{
  solarAssessment: SolarAssessment;
  audit: SolarAssessmentAudit;
  scoreBreakdown: SolarFitScoreBreakdown;
  reasons: string[];
  warnings: string[];
  verificationNeeded: boolean;
}> {
  const audit = buildSolarAssessmentAudit(property, location, solar);
  const scoreBreakdown = calculateSolarFitBreakdown(solar, audit);
  const now = new Date().toISOString();
  const reasons = buildSolarReasons(solar, scoreBreakdown);
  const warnings = buildSolarWarnings(location, solar, audit, scoreBreakdown);
  const verificationNeeded = warnings.length > 0 || solar.existingSolarStatus !== "NOT_DETECTED";
  const solarAssessment: SolarAssessment = {
    id: stableId(`${property.id}:solar`),
    propertyId: property.id,
    provider: solar.provider,
    providerBuildingId: solar.providerBuildingId,
    imageryDate: solar.imageryDate,
    imageryProcessedDate: solar.imageryProcessedDate,
    imageryQuality: solar.imageryQuality,
    roofAreaMeters2: solar.roofAreaMeters2,
    groundAreaMeters2: solar.groundAreaMeters2,
    maxArrayAreaMeters2: solar.maxArrayAreaMeters2,
    maxArrayPanelsCount: solar.maxArrayPanelsCount,
    panelCapacityWatts: solar.panelCapacityWatts,
    maxSunshineHoursPerYear: solar.maxSunshineHoursPerYear,
    estimatedMaxSystemKw: solar.estimatedMaxSystemKw,
    estimatedAnnualProductionKwh: solar.estimatedAnnualProductionKwh,
    existingSolarStatus: solar.existingSolarStatus,
    existingSolarConfidence: solar.existingSolarConfidence,
    roofComplexityScore: componentValue(scoreBreakdown, "roofComplexity"),
    shadeScore: componentValue(scoreBreakdown, "shade"),
    orientationScore: componentValue(scoreBreakdown, "orientation"),
    solarFitScore: scoreBreakdown.score,
    solarFitConfidence: scoreBreakdown.confidence,
    assessmentVersion: "google-solar-v1",
    providerPayloadReference: location.formattedAddress ?? `${property.latitude},${property.longitude}`,
    auditJson: audit,
    scoreBreakdownJson: scoreBreakdown,
    assessedAt: now,
    createdAt: now,
  };
  const persistedAssessment = await repository.upsertSolarAssessment(solarAssessment);
  const persistedSegments = await repository.replaceRoofSegments(persistedAssessment.id, buildRoofSegments(persistedAssessment, solar));
  const persistedAudit = await repository.upsertSolarAssessmentAudit({
    solarAssessmentId: persistedAssessment.id,
    auditJson: audit,
    scoreBreakdownJson: scoreBreakdown,
    createdAt: now,
    updatedAt: now,
  });
  return {
    solarAssessment: {
      ...persistedAssessment,
      auditJson: persistedAudit.auditJson,
      scoreBreakdownJson: persistedAudit.scoreBreakdownJson,
    },
    audit: persistedAudit.auditJson,
    scoreBreakdown: persistedAudit.scoreBreakdownJson,
    reasons,
    warnings,
    verificationNeeded,
  };
}

function buildRoofSegments(solarAssessment: SolarAssessment, solar: NormalizedBuildingInsights): RoofSegment[] {
  return solar.roofSegmentStats.map((segment) => ({
    id: stableId(`${solarAssessment.id}:segment:${segment.segmentIndex}`),
    solarAssessmentId: solarAssessment.id,
    segmentIndex: segment.segmentIndex,
    areaMeters2: segment.areaMeters2,
    pitchDegrees: segment.pitchDegrees,
    azimuthDegrees: segment.azimuthDegrees,
    sunshineHours: segment.sunshineHours,
    panelsCount: segment.panelsCount,
    yearlyEnergyDcKwh: segment.yearlyEnergyDcKwh,
  }));
}

async function buildSignals(
  property: Property,
  solarAssessment: SolarAssessment,
  solar: NormalizedBuildingInsights,
  repository: SolarRepository,
): Promise<PropertySignal[]> {
  const created: PropertySignal[] = [];
  if ((solar.maxArrayPanelsCount ?? 0) >= 20) {
    created.push({
      id: stableId(`${property.id}:signal:roof`),
      propertyId: property.id,
      signalType: "LARGE_ROOF",
      source: "GOOGLE_SOLAR",
      valueJson: {
        roofAreaMeters2: solar.roofAreaMeters2,
        estimatedMaxSystemKw: solarAssessment.estimatedMaxSystemKw,
        maxArrayPanelsCount: solar.maxArrayPanelsCount,
      },
      confidence: 0.9,
      observedAt: new Date().toISOString(),
      expiresAt: null,
    });
  }
  if (solar.existingSolarStatus === "DETECTED") {
    created.push({
      id: stableId(`${property.id}:signal:solar`),
      propertyId: property.id,
      signalType: "EXISTING_SOLAR",
      source: "GOOGLE_SOLAR",
      valueJson: {
        existingSolarConfidence: solar.existingSolarConfidence,
        providerBuildingId: solar.providerBuildingId,
      },
      confidence: solar.existingSolarConfidence ?? 0.8,
      observedAt: new Date().toISOString(),
      expiresAt: null,
    });
  }
  return repository.replacePropertySignals(property.id, created);
}

async function buildUsageProfile(
  property: Property,
  propertySignals: PropertySignal[],
  solarAssessment: SolarAssessment,
  repository: SolarRepository,
): Promise<UsageProfile> {
  const profile: UsageProfile = {
    id: stableId(`${property.id}:usage`),
    propertyId: property.id,
    source: "ESTIMATE",
    annualUsageKwh: null,
    monthlyAverageKwh: null,
    peakMonthKwh: null,
    monthlyBillAverage: null,
    confidence: 0.42,
    createdAt: new Date().toISOString(),
  };
  if (propertySignals.some((signal) => signal.signalType === "LARGE_ROOF")) {
    profile.confidence = 0.46;
  }
  if ((solarAssessment.estimatedMaxSystemKw ?? 0) > 10) {
    profile.confidence = Math.max(profile.confidence, 0.5);
  }
  return repository.upsertUsageProfile(profile);
}

function buildWhaleScore(propertySignals: PropertySignal[], solarAssessment: SolarAssessment, usageProfile: UsageProfile) {
  return calculateWhaleScore({
    estimatedSystemKw: solarAssessment.estimatedMaxSystemKw,
    annualUsageKwh: usageProfile.annualUsageKwh,
    usageConfidence: usageProfile.source === "ESTIMATE" ? "ESTIMATED" : "SELF_REPORTED",
    largeRoofSignal: propertySignals.some((signal) => signal.signalType === "LARGE_ROOF"),
    poolSignal: false,
    confirmedEvSignal: false,
    confirmedEvChargerSignal: false,
    solarProductionPotential: solarAssessment.estimatedAnnualProductionKwh ? solarAssessment.estimatedAnnualProductionKwh / 20000 : null,
  });
}

async function buildPermits(property: Property, repository: SolarRepository): Promise<PermitRecord[]> {
  const now = new Date().toISOString();
  const records: PermitRecord[] = [
    {
      id: stableId(`${property.id}:permit:roof`),
      propertyId: property.id,
      municipality: property.municipality ?? "Unknown municipality",
      county: property.county ?? "Westmoreland",
      state: property.state ?? "PA",
      permitNumber: "R-2026-001",
      permitType: "ROOF",
      status: "ISSUED",
      applicationDate: "2026-07-12",
      issuedDate: "2026-07-18",
      contractorName: "Sample Roofing LLC",
      sourceProvider: "manual_seed",
      sourceUrl: null,
      confidence: 0.8,
      retrievedAt: now,
    },
  ];
  return repository.replacePermitRecords(property.id, records);
}

async function buildOpportunityAssessment(
  property: Property,
  solarAssessment: SolarAssessment,
  usageProfile: UsageProfile,
  whaleScore: WhaleScoreResult,
  permitRecords: PermitRecord[],
  repository: SolarRepository,
): Promise<OpportunityAssessment> {
  const roofPermitRecent = permitRecords.some((permit) => permit.permitType === "ROOF" && permit.status === "ISSUED");
  const permitSignalScore = roofPermitRecent ? 72 : 30;
  const usageOpportunityScore = whaleScore.whaleScore;
  const systemSizeScore = Math.round(Math.min(100, (solarAssessment.estimatedMaxSystemKw ?? 0) * 7));
  const fieldPriorityScore = Math.round(
    solarAssessment.solarFitScore * 0.35 +
      usageOpportunityScore * 0.25 +
      systemSizeScore * 0.15 +
      permitSignalScore * 0.15 +
      50 * 0.1,
  );
  const overallOpportunityScore = Math.round(
    solarAssessment.solarFitScore * 0.3 +
      usageOpportunityScore * 0.25 +
      systemSizeScore * 0.15 +
      permitSignalScore * 0.1 +
      fieldPriorityScore * 0.1 +
      whaleScore.whaleScore * 0.1,
  );

  const assessment: OpportunityAssessment = {
    id: stableId(`${property.id}:opportunity`),
    propertyId: property.id,
    solarFitScore: solarAssessment.solarFitScore,
    usageOpportunityScore,
    systemSizeScore,
    permitSignalScore,
    fieldPriorityScore,
    whaleScore: whaleScore.whaleScore,
    overallOpportunityScore,
    confidence: Math.round(Math.min(100, (solarAssessment.solarFitConfidence * 100 + whaleScore.confidence) / 2)),
    scoreVersion: "google-solar-v1",
    explanationJson: {
      reasons: [
        `Solar fit score ${solarAssessment.solarFitScore}`,
        roofPermitRecent ? "Recent roof permit suggests newer roof work" : "No recent roof permit observed",
        ...whaleScore.reasons,
      ],
      verify: whaleScore.verificationNeeded,
    },
    createdAt: new Date().toISOString(),
  };
  return repository.upsertOpportunityAssessment(assessment);
}

async function buildLeadOutcome(property: Property, repository: SolarRepository): Promise<LeadOutcome> {
  const existing = await repository.getLeadOutcomeByPropertyId(property.id);
  if (existing) {
    return existing;
  }

  const outcome: LeadOutcome = {
    id: stableId(`${property.id}:lead`),
    propertyId: property.id,
    repId: null,
    outcome: "UNTOUCHED",
    notes: null,
    createdAt: new Date().toISOString(),
  };
  return repository.upsertLeadOutcome(outcome);
}

function mapAnalyzeResultToLeadCard(result: AnalyzeResult, isDemo: boolean): TodayLeadCard {
  const signals = deriveSignalLabels(result);
  const reasons = deriveLeadReasons(result);
  const addressParts = buildLeadAddressParts({
    street: result.property.street ?? null,
    formattedAddress: result.property.normalizedAddress,
    city: result.property.city ?? result.property.municipality ?? result.property.county ?? null,
    state: result.property.state ?? null,
    postalCode: result.property.postalCode ?? null,
  });
  const nextBestAction = recommendNextBestAction({
    billRequested: result.leadOutcome.outcome === "BILL_REQUESTED",
    billReceived: result.leadOutcome.outcome === "BILL_RECEIVED",
    appointmentBooked:
      result.leadOutcome.outcome === "APPOINTMENT_BOOKED" || result.leadOutcome.outcome === "APPOINTMENT_COMPLETED",
    contractSigned: result.leadOutcome.outcome === "SIGNED" || result.leadOutcome.outcome === "INSTALLED",
    cancelled: result.leadOutcome.outcome === "CANCELLED",
    noShow: result.leadOutcome.outcome === "NOT_HOME",
    usageUnknown: result.confirmedAnnualUsageKwh == null,
    strongSolarPotential: (result.maxRoofSolarCapacityKw ?? 0) >= 12,
    roofDocsMissing: result.audit.missingFields.includes("roofSegmentStats"),
    permitPendingDays: pendingPermitDays(result.permits),
  });
  const verificationNeeded = deriveVerificationItems(result);
  return {
    id: result.property.id,
    propertyId: result.property.id,
    latitude: result.property.latitude ?? null,
    longitude: result.property.longitude ?? null,
    city: addressParts.city,
    state: addressParts.state ?? "PA",
    postalCode: addressParts.postalCode,
    address: addressParts.displayAddress,
    neighborhood: result.property.municipality ?? result.property.city ?? result.property.county ?? "Unknown area",
    opportunityScore: result.opportunityAssessment.overallOpportunityScore,
    whaleScore: result.whaleScore.whaleScore,
    solarFitScore: result.solarAssessment.solarFitScore,
    confidence: result.opportunityAssessment.confidence,
    maxRoofSolarCapacityKw: result.maxRoofSolarCapacityKw,
    confirmedAnnualUsageKwh: result.confirmedAnnualUsageKwh,
    estimatedEnergyNeedKw: result.estimatedEnergyNeedKw,
    estimatedUsagePotentialKwh: result.confirmedAnnualUsageKwh,
    whaleConfidence: result.whaleScore.confidence,
    maxSystemKw: result.maxRoofSolarCapacityKw,
    maxArrayPanelsCount: result.solarAssessment.maxArrayPanelsCount ?? null,
    estimatedAnnualProductionKwh: result.solarAssessment.estimatedAnnualProductionKwh ?? null,
    sunshineHours: result.solarAssessment.maxSunshineHoursPerYear ?? null,
    imageryQuality: result.solarAssessment.imageryQuality ?? null,
    existingSolarStatus: result.solarAssessment.existingSolarStatus,
    permitCount: result.permits.length,
    nextAction: nextBestAction.label,
    nextBestAction,
    reasons,
    signals,
    opportunitySignals: result.opportunitySignals,
    badges: deriveBadges(result, signals, verificationNeeded),
    verificationNeeded,
    outcome: result.leadOutcome.outcome,
    isDemo,
    locationVerification: result.locationVerification,
  };
}

function deriveSignalLabels(result: AnalyzeResult): string[] {
  const labels = new Set<string>();
  if ((result.solarAssessment.maxArrayPanelsCount ?? 0) >= 20) labels.add("Large roof");
  if ((result.solarAssessment.maxSunshineHoursPerYear ?? 0) >= 1300) labels.add("Strong sunlight");
  if (result.solarAssessment.existingSolarStatus === "DETECTED") labels.add("Existing solar");
  if (result.permits.some((permit) => permit.permitType === "ROOF" && permit.status === "ISSUED")) labels.add("Recent roof permit");
  if (result.signals.some((signal) => signal.signalType === "POOL_VISIBLE")) labels.add("Pool signal");
  if (result.signals.some((signal) => signal.signalType === "EV_CONFIRMED" || signal.signalType === "EV_CHARGER_CONFIRMED")) labels.add("EV signal");
  if (result.signals.some((signal) => signal.signalType === "HIGH_USAGE_CONFIRMED" || signal.signalType === "HIGH_USAGE_ESTIMATED")) labels.add("High usage");
  return [...labels].slice(0, 4);
}

function deriveVerificationItems(result: AnalyzeResult): string[] {
  const items = [...result.whaleScore.verificationNeeded];
  if (result.solarAssessment.existingSolarStatus !== "NOT_DETECTED") {
    items.push("Verify existing solar");
  }
  if (result.usageProfile.annualUsageKwh == null) {
    items.push("Electric bill");
  }
  if (result.solarAssessment.imageryDate == null) {
    items.push("Roof age");
  }
  return [...new Set(items)];
}

function deriveLeadReasons(result: AnalyzeResult): string[] {
  const reasons = [
    ...result.reasons,
    ...result.whaleScore.reasons,
    result.solarAssessment.estimatedAnnualProductionKwh != null
      ? `Modeled annual production ${formatNumber(result.solarAssessment.estimatedAnnualProductionKwh)} kWh`
      : null,
    result.maxRoofSolarCapacityKw != null ? `Roof capacity ${formatNumber(result.maxRoofSolarCapacityKw)} kW` : null,
    result.confirmedAnnualUsageKwh != null ? `Confirmed usage ${formatNumber(result.confirmedAnnualUsageKwh)} kWh/year` : null,
  ].filter((value): value is string => Boolean(value));
  return reasons.slice(0, 3);
}

function deriveNextAction(
  outcome: LeadOutcome["outcome"],
  signals: string[],
  verificationNeeded: string[],
  result: AnalyzeResult,
): string {
  if (outcome === "NOT_HOME") return "NOT HOME";
  if (outcome === "NOT_INTERESTED") return "NOT INTERESTED";
  if (outcome === "BILL_REQUESTED" || verificationNeeded.some((item) => item.toLowerCase().includes("bill"))) {
    return "GET BILL";
  }
  if (outcome === "BILL_RECEIVED") return "REVIEW BILL";
  if (outcome === "APPOINTMENT_BOOKED") return "CONFIRM APPOINTMENT";
  if (result.whaleScore.whaleScore >= 70 || result.opportunityAssessment.overallOpportunityScore >= 75) {
    return "OPEN";
  }
  if (signals.includes("Recent roof permit")) return "OPEN";
  return "GET BILL";
}

function deriveBadges(
  result: AnalyzeResult,
  signals: string[],
  verificationNeeded: string[],
): LeadSignalBadge[] {
  const badges: LeadSignalBadge[] = [];
  if (result.whaleScore.whaleScore >= 60) {
    badges.push({ label: "WHALE", tone: "MODEL" });
  }
  if (result.opportunityAssessment.overallOpportunityScore >= 70) {
    badges.push({ label: "HIGH PRIORITY", tone: "MODEL" });
  }
  if (result.solarAssessment.existingSolarStatus === "DETECTED") {
    badges.push({ label: "EXISTING SOLAR", tone: "GOOGLE_SOLAR" });
  }
  if (signals.includes("Recent roof permit")) {
    badges.push({ label: "PUBLIC RECORD", tone: "PUBLIC_RECORD" });
  }
  if (verificationNeeded.length > 0) {
    badges.push({ label: "VERIFY", tone: "MISSING" });
  }
  return badges.slice(0, 4);
}

function dedupeLeads(leads: TodayLeadCard[]): TodayLeadCard[] {
  const seen = new Set<string>();
  const result: TodayLeadCard[] = [];
  for (const lead of leads) {
    const key = lead.propertyId ?? `${lead.address}:${lead.city ?? ""}:${lead.postalCode ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(lead);
  }
  return result;
}

function buildNeighborhoodSeedData(repository: SolarRepository): NeighborhoodMarket[] {
  void repository;
  return [
    {
      id: "market-peters-township",
      name: "Peters Township",
      geographyType: "NEIGHBORHOOD",
      currentLocationLabel: "Peters Township, PA",
      radiusMiles: 25,
      marketScore: 92,
      medianHomeValueBand: "VERY_HIGH",
      largeHomeDensity: "HIGH",
      averageSolarPotentialKw: 16.8,
      solarSaturation: "LOW",
      permitActivity: "MODERATE",
      whaleDensity: "HIGH",
      leadCount: 34,
      ctaLabel: "VIEW LEADS",
    },
    {
      id: "market-north-huntingdon",
      name: "North Huntingdon",
      geographyType: "BLOCK_GROUP",
      currentLocationLabel: "North Huntingdon, PA",
      radiusMiles: 25,
      marketScore: 88,
      medianHomeValueBand: "HIGH",
      largeHomeDensity: "HIGH",
      averageSolarPotentialKw: 15.2,
      solarSaturation: "LOW",
      permitActivity: "HIGH",
      whaleDensity: "MODERATE",
      leadCount: 28,
      ctaLabel: "VIEW LEADS",
    },
    {
      id: "market-hempfield",
      name: "Hempfield Township",
      geographyType: "CENSUS_TRACT",
      currentLocationLabel: "Hempfield Township, PA",
      radiusMiles: 25,
      marketScore: 84,
      medianHomeValueBand: "HIGH",
      largeHomeDensity: "MODERATE",
      averageSolarPotentialKw: 14.1,
      solarSaturation: "MODERATE",
      permitActivity: "MODERATE",
      whaleDensity: "MODERATE",
      leadCount: 21,
      ctaLabel: "VIEW LEADS",
    },
    {
      id: "market-west-newton",
      name: "West Newton",
      geographyType: "NEIGHBORHOOD",
      currentLocationLabel: "West Newton, PA",
      radiusMiles: 10,
      marketScore: 81,
      medianHomeValueBand: "MODERATE",
      largeHomeDensity: "MODERATE",
      averageSolarPotentialKw: 12.6,
      solarSaturation: "LOW",
      permitActivity: "MODERATE",
      whaleDensity: "LOW",
      leadCount: 12,
      ctaLabel: "VIEW LEADS",
    },
  ];
}

function determineDealStage(result: AnalyzeResult): DealStage {
  switch (result.leadOutcome.outcome) {
    case "NOT_HOME":
    case "CANCELLED":
      return "RECOVERY";
    case "BILL_REQUESTED":
      return "BILL_REQUESTED";
    case "BILL_RECEIVED":
      return "BILL_RECEIVED";
    case "APPOINTMENT_BOOKED":
    case "APPOINTMENT_COMPLETED":
      return "APPOINTMENT_BOOKED";
    case "SIGNED":
      return "CONTRACT_SIGNED";
    case "INSTALLED":
      return "PTO";
    default:
      if (result.permits.some((permit) => permit.permitType === "ROOF" && permit.status === "ISSUED")) {
        return "PERMITTING";
      }
      if ((result.solarAssessment.estimatedMaxSystemKw ?? 0) > 0) {
        return "LEAD";
      }
      return "RECOVERY";
  }
}

function pendingPermitDays(permits: PermitRecord[]): number | null {
  const pending = permits.find((permit) => permit.status === "PENDING" && permit.applicationDate);
  if (!pending?.applicationDate) {
    return null;
  }
  const started = new Date(pending.applicationDate).getTime();
  if (!Number.isFinite(started)) {
    return null;
  }
  return Math.max(0, Math.round((Date.now() - started) / (1000 * 60 * 60 * 24)));
}

function estimateDealRevenue(deal: DealBrief): number {
  return Math.round((deal.estimatedSystemKw ?? 0) * 6500);
}

function estimateRevenueAtRisk(result: AnalyzeResult, stage: DealStage): number {
  const base = estimateDealRevenue({
    id: result.property.id,
    propertyId: result.property.id,
    propertyAddress: result.property.normalizedAddress,
    stage,
    maxRoofSolarCapacityKw: result.maxRoofSolarCapacityKw,
    confirmedAnnualUsageKwh: result.confirmedAnnualUsageKwh,
    estimatedEnergyNeedKw: result.estimatedEnergyNeedKw,
    solarFitScore: result.solarAssessment.solarFitScore,
    whaleScore: result.whaleScore.whaleScore,
    estimatedSystemKw: result.solarAssessment.estimatedMaxSystemKw ?? 0,
    estimatedAnnualProductionKwh: result.solarAssessment.estimatedAnnualProductionKwh ?? 0,
    annualUsageKwh: result.usageProfile.annualUsageKwh ?? 0,
    billSummary: "n/a",
    customerSignals: [],
    conversationHistory: [],
    objections: [],
    nextBestAction: recommendNextBestAction({}),
    consultantRecommendation: "n/a",
    revenueAtRisk: 0,
    updatedAt: new Date().toISOString(),
  });
  if (stage === "RECOVERY") {
    return Math.round(base * 0.7);
  }
  if (stage === "PERMITTING") {
    return Math.round(base * 0.45);
  }
  return Math.round(base * 0.2);
}

function rollupDealStages(deals: DealBrief[]): CommandCenterStageRollup[] {
  const stages: DealStage[] = ["LEAD", "BILL_REQUESTED", "BILL_RECEIVED", "APPOINTMENT_BOOKED", "CONTRACT_SIGNED", "PERMITTING", "INSTALLATION", "PTO", "RECOVERY", "CONTACTED"];
  return stages
    .map((stage) => ({
      stage,
      count: deals.filter((deal) => deal.stage === stage).length,
      revenue: roundMoney(deals.filter((deal) => deal.stage === stage).reduce((sum, deal) => sum + estimateDealRevenue(deal), 0)),
    }))
    .filter((entry) => entry.count > 0 || entry.revenue > 0);
}

function rankTerritories(deals: DealBrief[]): CommandCenterTerritoryRanking[] {
  const territories = new Map<string, { count: number; revenue: number }>();
  for (const deal of deals) {
    const territory = territoryNameFromAddress(deal.propertyAddress);
    const current = territories.get(territory) ?? { count: 0, revenue: 0 };
    current.count += 1;
    current.revenue += estimateDealRevenue(deal);
    territories.set(territory, current);
  }
  return [...territories.entries()]
    .map(([territory, value]) => ({
      territory,
      leadCount: value.count,
      revenue: roundMoney(value.revenue),
      score: clamp(Math.round(value.revenue / 10000 + value.count * 4)),
    }))
    .sort((left, right) => right.score - left.score);
}

function rankReps(repository: SolarRepository, deals: DealBrief[]): CommandCenterRepRanking[] {
  void repository;
  const repGroups = new Map<string, { count: number; revenue: number }>();
  const seededRep = { rep: "Field Team A", count: 0, revenue: 0 };
  for (const deal of deals) {
    seededRep.count += 1;
    seededRep.revenue += estimateDealRevenue(deal);
  }
  repGroups.set(seededRep.rep, { count: seededRep.count, revenue: seededRep.revenue });
  repGroups.set("Closer Desk", { count: Math.max(1, Math.floor(deals.length / 3)), revenue: Math.round(deals.reduce((sum, deal) => sum + estimateDealRevenue(deal), 0) * 0.35) });
  return [...repGroups.entries()]
    .map(([rep, value]) => ({
      rep,
      revenue: roundMoney(value.revenue),
      score: clamp(Math.round(value.revenue / 12000 + value.count * 5)),
      loadPercent: clamp(Math.round((value.count / Math.max(1, deals.length)) * 100)),
    }))
    .sort((left, right) => right.score - left.score);
}

function dedupeDealBriefs(deals: DealBrief[]): DealBrief[] {
  const seen = new Set<string>();
  const result: DealBrief[] = [];
  for (const deal of deals) {
    const key = deal.propertyId;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(deal);
  }
  return result;
}

function territoryNameFromAddress(address: string): string {
  const parts = address.split(",");
  return parts.length > 1 ? parts[parts.length - 1].trim() : "Unknown territory";
}

function buildLeadAddressParts(input: {
  street: string | null;
  formattedAddress: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
}): {
  displayAddress: string;
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
} {
  const street = sanitizeText(input.street);
  const formattedAddress = sanitizeText(input.formattedAddress);
  const city = sanitizeText(input.city);
  const state = abbreviateState(sanitizeText(input.state));
  const postalCode = sanitizeText(input.postalCode);

  const cleanStreet = street && !isPlusCode(street) ? street : null;
  const cleanFormatted = formattedAddress && !isPlusCode(formattedAddress) ? formattedAddress : null;
  const cleanCity = city && !isPlusCode(city) ? city : null;
  const locationLine = buildLocationLine(cleanCity, state, postalCode);

  return {
    displayAddress: cleanStreet ?? cleanFormatted ?? locationLine ?? "Address unavailable",
    street: cleanStreet,
    city: cleanCity,
    state,
    postalCode,
  };
}

function buildLocationLine(city: string | null, state: string | null, postalCode: string | null): string | null {
  const hasCity = Boolean(city);
  const hasState = Boolean(state);
  const hasPostal = Boolean(postalCode);
  if (hasCity && hasState && hasPostal) {
    return `${city}, ${state} ${postalCode}`;
  }
  if (hasCity && hasState) {
    return `${city}, ${state}`;
  }
  if (hasCity && hasPostal) {
    return `${city} ${postalCode}`;
  }
  if (hasCity) {
    return city;
  }
  if (hasPostal) {
    return postalCode;
  }
  return null;
}

function abbreviateState(state: string | null): string | null {
  if (!state) return null;
  const normalized = state.trim().toUpperCase();
  const map: Record<string, string> = {
    ALABAMA: "AL",
    ALASKA: "AK",
    ARIZONA: "AZ",
    ARKANSAS: "AR",
    CALIFORNIA: "CA",
    COLORADO: "CO",
    CONNECTICUT: "CT",
    DELAWARE: "DE",
    FLORIDA: "FL",
    GEORGIA: "GA",
    HAWAII: "HI",
    IDAHO: "ID",
    ILLINOIS: "IL",
    INDIANA: "IN",
    IOWA: "IA",
    KANSAS: "KS",
    KENTUCKY: "KY",
    LOUISIANA: "LA",
    MAINE: "ME",
    MARYLAND: "MD",
    MASSACHUSETTS: "MA",
    MICHIGAN: "MI",
    MINNESOTA: "MN",
    MISSISSIPPI: "MS",
    MISSOURI: "MO",
    MONTANA: "MT",
    NEBRASKA: "NE",
    NEVADA: "NV",
    "NEW HAMPSHIRE": "NH",
    "NEW JERSEY": "NJ",
    "NEW MEXICO": "NM",
    "NEW YORK": "NY",
    "NORTH CAROLINA": "NC",
    "NORTH DAKOTA": "ND",
    OHIO: "OH",
    OKLAHOMA: "OK",
    OREGON: "OR",
    PENNSYLVANIA: "PA",
    "RHODE ISLAND": "RI",
    "SOUTH CAROLINA": "SC",
    "SOUTH DAKOTA": "SD",
    TENNESSEE: "TN",
    TEXAS: "TX",
    UTAH: "UT",
    VERMONT: "VT",
    VIRGINIA: "VA",
    WASHINGTON: "WA",
    "WEST VIRGINIA": "WV",
    WISCONSIN: "WI",
    WYOMING: "WY",
  };
  return map[normalized] ?? normalized;
}

function sanitizeText(value: string | null | undefined): string | null {
  const cleaned = value?.trim() ?? "";
  return cleaned.length > 0 ? cleaned : null;
}

function isPlusCode(value: string): boolean {
  return /(?:^|\s)[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}(?:\s|$)/i.test(value);
}

function signalLabel(signalType: PropertySignal["signalType"]): string {
  switch (signalType) {
    case "POOL_VISIBLE":
      return "Pool detected";
    case "EV_CONFIRMED":
      return "EV confirmed";
    case "EV_CHARGER_CONFIRMED":
      return "EV charger confirmed";
    case "LARGE_HOME":
      return "Large home";
    case "LARGE_ROOF":
      return "Large roof";
    case "RECENT_ROOF_PERMIT":
      return "Recent roof permit";
    case "EXISTING_SOLAR":
      return "Existing solar";
    case "HIGH_USAGE_CONFIRMED":
      return "High usage confirmed";
    case "HIGH_USAGE_ESTIMATED":
      return "High usage estimated";
    default:
      return "Model signal";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function objectionFromMissingField(field: string): string | null {
  switch (field) {
    case "imageryDate":
      return "Roof age needs confirmation";
    case "roofSegmentStats":
      return "Roof geometry is incomplete";
    case "usageProfile":
      return "Electric bill still missing";
    default:
      return field ? `${field} needs review` : null;
  }
}

function buildConsultantRecommendation(
  result: AnalyzeResult,
  stage: DealStage,
  nextBestAction: NextBestAction,
): string {
  const usageText = result.usageProfile.annualUsageKwh != null ? `Usage around ${formatNumber(result.usageProfile.annualUsageKwh)} kWh/year.` : "Usage is still unconfirmed.";
  if (stage === "RECOVERY") {
    return `Recover the deal by addressing the objection first. ${usageText} ${nextBestAction.reason}`;
  }
  if (stage === "PERMITTING") {
    return `Keep the install moving. ${usageText} Focus on permit status and next inspection.`;
  }
  return `Lead with the roof story, then confirm usage. ${usageText} ${nextBestAction.reason}`;
}

function roundMoney(value: number): number {
  return Math.round(value);
}

function roundDecimal(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function buildSolarAssessmentAudit(
  property: Property,
  location: ResolvedLocation,
  solar: NormalizedBuildingInsights,
): SolarAssessmentAudit {
  return {
    provider: solar.provider,
    providerVersion: solar.providerVersion,
    buildingId: solar.providerBuildingId,
    requestedCoordinates: {
      latitude: location.latitude,
      longitude: location.longitude,
    },
    returnedBuildingCenter: solar.buildingCenter,
    distanceMeters: distanceMeters(
      { latitude: location.latitude, longitude: location.longitude },
      solar.buildingCenter,
    ),
    imageryQuality: solar.imageryQuality,
    imageryDate: solar.imageryDate,
    imageryProcessedDate: solar.imageryProcessedDate,
    detectedArrayStatus: solar.detectedArrays.detectionStatus,
    detectedArrayCaptureDate: solar.detectedArrays.latestCaptureDate,
    maxArrayPanelsCount: solar.maxArrayPanelsCount,
    panelCapacityWatts: solar.panelCapacityWatts,
    estimatedMaxSystemKw: solar.estimatedMaxSystemKw,
    systemSizeCalculation: {
      panelsCount: solar.maxArrayPanelsCount,
      panelCapacityWatts: solar.panelCapacityWatts,
      calculation:
        solar.maxArrayPanelsCount != null && solar.panelCapacityWatts != null
          ? `${solar.maxArrayPanelsCount} * ${solar.panelCapacityWatts} / 1000`
          : "unavailable",
    },
    selectedProductionConfig: solar.selectedProductionConfig
      ? {
          panelsCount: solar.selectedProductionConfig.panelsCount,
          yearlyEnergyDcKwh: solar.selectedProductionConfig.yearlyEnergyDcKwh,
          selectionReason: solar.selectedProductionConfig.selectionReason,
        }
      : null,
    roofAreaMeters2: solar.roofAreaMeters2,
    groundAreaMeters2: solar.groundAreaMeters2,
    maxArrayAreaMeters2: solar.maxArrayAreaMeters2,
    roofSegmentCount: solar.roofSegmentCount,
    missingFields: solar.missingFields,
    warnings: solar.warnings,
  };
}

function calculateSolarFitBreakdown(
  solar: NormalizedBuildingInsights,
  audit: SolarAssessmentAudit,
): SolarFitScoreBreakdown {
  const components = [
    buildSunlightComponent(solar),
    buildUsableRoofAreaComponent(solar),
    buildSystemSizeComponent(solar),
    buildOrientationComponent(solar),
    buildShadeComponent(solar),
    buildRoofComplexityComponent(solar),
    buildExistingSolarComponent(solar),
  ];

  const score = clamp(
    Math.round(
      components.reduce((sum, component) => sum + component.contribution, 0),
    ),
  );
  const confidence = clampPercent(
    components.reduce((sum, component) => sum + component.confidence, 0) / components.length,
  );
  const missingFields = [...new Set([...audit.missingFields, ...components.filter((component) => component.value == null).map((component) => component.name)])];
  const warnings = [...new Set(audit.warnings)];

  return {
    score,
    confidence,
    components,
    missingFields,
    warnings,
    calculatedAt: new Date().toISOString(),
    scoringVersion: "google-solar-v2",
  };
}

function buildSolarReasons(solar: NormalizedBuildingInsights, score: SolarFitScoreBreakdown): string[] {
  const reasons = [
    `Estimated array size around ${solar.estimatedMaxSystemKw?.toFixed(1) ?? "unknown"} kW`,
    `Maximum panels: ${solar.maxArrayPanelsCount ?? "unknown"}`,
    `Sunshine estimate: ${solar.maxSunshineHoursPerYear ?? "unknown"} hours/year`,
  ];
  if (solar.selectedProductionConfig) {
    reasons.push(
      `Selected production config: ${solar.selectedProductionConfig.panelsCount ?? "unknown"} panels at ${formatNumber(solar.selectedProductionConfig.yearlyEnergyDcKwh)} kWh/year (${solar.selectedProductionConfig.selectionReason})`,
    );
  }
  if (solar.existingSolarStatus === "DETECTED") {
    reasons.push("Existing solar array detected by Google imagery");
  }
  if (score.score >= 70) {
    reasons.push("Roof characteristics support a high-fit solar lead");
  }
  return reasons;
}

function buildSolarWarnings(
  location: ResolvedLocation,
  solar: NormalizedBuildingInsights,
  audit: SolarAssessmentAudit,
  score: SolarFitScoreBreakdown,
): string[] {
  const warnings: string[] = [];
  if (location.partialMatch) {
    warnings.push("Geocoder returned a partial address match.");
  }
  warnings.push(...audit.warnings);
  if (solar.existingSolarStatus === "DETECTED") {
    warnings.push("Existing solar appears to be present at the property.");
  }
  if (score.missingFields.includes("shade")) {
    warnings.push("Shade is unknown. Sunshine-hours is not a shade proxy.");
  }
  if (score.missingFields.includes("roofSegmentStats")) {
    warnings.push("ROOF_SEGMENTS_UNAVAILABLE");
  }
  return [...new Set(warnings)];
}

function buildSunlightComponent(solar: NormalizedBuildingInsights): SolarFitScoreComponent {
  if (solar.maxSunshineHoursPerYear == null) {
    return missingComponent("sunlight", 0.25, "No sunshine estimate was returned.");
  }
  const normalizedScore = clamp((solar.maxSunshineHoursPerYear / 1500) * 100);
  return {
    name: "sunlight",
    value: solar.maxSunshineHoursPerYear,
    normalizedScore,
    weight: 0.25,
    contribution: roundContribution(normalizedScore, 0.25),
    confidence: 1,
    explanation: `Google Solar returned ${formatNumber(solar.maxSunshineHoursPerYear)} sunshine-hours per year.`,
  };
}

function buildUsableRoofAreaComponent(solar: NormalizedBuildingInsights): SolarFitScoreComponent {
  const value = solar.maxArrayAreaMeters2 ?? solar.roofAreaMeters2;
  if (value == null) {
    return missingComponent("usableRoofArea", 0.2, "No usable roof area estimate was returned.");
  }
  const normalizedScore = clamp(value / 1.5);
  return {
    name: "usableRoofArea",
    value,
    normalizedScore,
    weight: 0.2,
    contribution: roundContribution(normalizedScore, 0.2),
    confidence: 1,
    explanation: `Google Solar estimated ${formatNumber(value)} m² of usable roof area.`,
  };
}

function buildSystemSizeComponent(solar: NormalizedBuildingInsights): SolarFitScoreComponent {
  if (solar.estimatedMaxSystemKw == null) {
    return missingComponent("systemSize", 0.22, "System size could not be computed.");
  }
  const normalizedScore = clamp((solar.estimatedMaxSystemKw / 30) * 100);
  return {
    name: "systemSize",
    value: solar.estimatedMaxSystemKw,
    normalizedScore,
    weight: 0.22,
    contribution: roundContribution(normalizedScore, 0.22),
    confidence: 1,
    explanation: `System size is calculated from ${solar.maxArrayPanelsCount ?? "unknown"} panels at ${solar.panelCapacityWatts ?? "unknown"} W each.`,
  };
}

function buildOrientationComponent(solar: NormalizedBuildingInsights): SolarFitScoreComponent {
  if (solar.roofSegmentCount === 0) {
    return missingComponent("orientation", 0.1, "Roof segments were unavailable, so orientation could not be scored.");
  }
  const meanPitch = averageNumber(solar.roofSegmentStats.map((segment) => segment.pitchDegrees));
  if (meanPitch == null) {
    return missingComponent("orientation", 0.1, "No pitch data was returned for roof segments.");
  }
  const normalizedScore = clamp(100 - Math.abs(meanPitch - 30) * 2);
  return {
    name: "orientation",
    value: meanPitch,
    normalizedScore,
    weight: 0.1,
    contribution: roundContribution(normalizedScore, 0.1),
    confidence: 0.7,
    explanation: `Average roof pitch is ${formatNumber(meanPitch)} degrees, which indicates usable geometry.`,
  };
}

function buildShadeComponent(solar: NormalizedBuildingInsights): SolarFitScoreComponent {
  return {
    name: "shade",
    value: null,
    normalizedScore: null,
    weight: 0.1,
    contribution: 0,
    confidence: 0,
    explanation: "No reliable shade metric is available from the current Google Solar data.",
  };
}

function buildRoofComplexityComponent(solar: NormalizedBuildingInsights): SolarFitScoreComponent {
  if (solar.roofSegmentCount === 0) {
    return missingComponent("roofComplexity", 0.08, "Roof complexity could not be estimated because roof segments were unavailable.");
  }
  const normalizedScore = clamp(100 - solar.roofSegmentCount * 8);
  return {
    name: "roofComplexity",
    value: solar.roofSegmentCount,
    normalizedScore,
    weight: 0.08,
    contribution: roundContribution(normalizedScore, 0.08),
    confidence: 0.7,
    explanation: `Google Solar returned ${solar.roofSegmentCount} roof segments.`,
  };
}

function buildExistingSolarComponent(solar: NormalizedBuildingInsights): SolarFitScoreComponent {
  if (solar.detectedArrays.detectionStatus === "UNKNOWN") {
    return missingComponent("existingSolar", 0.05, "Detected-array status is unavailable.");
  }
  const normalizedScore = solar.detectedArrays.detectionStatus === "NOT_DETECTED" ? 100 : 20;
  return {
    name: "existingSolar",
    value: solar.detectedArrays.detectionStatus === "DETECTED" ? 1 : 0,
    normalizedScore,
    weight: 0.05,
    contribution: roundContribution(normalizedScore, 0.05),
    confidence: 1,
    explanation:
      solar.detectedArrays.detectionStatus === "DETECTED"
        ? "Google Solar detected an existing solar array."
        : "Google Solar did not detect an existing solar array.",
  };
}

function missingComponent(
  name: SolarFitScoreComponent["name"],
  weight: number,
  explanation: string,
): SolarFitScoreComponent {
  return {
    name,
    value: null,
    normalizedScore: null,
    weight,
    contribution: 0,
    confidence: 0,
    explanation,
  };
}

function estimateEnergyNeedKw(confirmedAnnualUsageKwh: number | null): number | null {
  if (confirmedAnnualUsageKwh == null) {
    return null;
  }
  return Math.round((confirmedAnnualUsageKwh / 1250) * 10) / 10;
}

function buildDataQualitySummary(input: {
  solarAssessment: SolarAssessment;
  usageProfile: UsageProfile;
  propertySignals: PropertySignal[];
  permits: PermitRecord[];
  audit: SolarAssessmentAudit;
  warnings: string[];
}): DataQualitySummary {
  const availableSignals = [
    "google_solar",
    input.solarAssessment.imageryDate != null ? "imagery_date" : null,
    input.solarAssessment.imageryQuality != null ? "imagery_quality" : null,
    input.solarAssessment.maxArrayPanelsCount != null ? "roof_capacity" : null,
    input.solarAssessment.estimatedAnnualProductionKwh != null ? "modeled_production" : null,
    input.solarAssessment.existingSolarStatus !== "UNKNOWN" ? "existing_solar" : null,
    input.usageProfile.annualUsageKwh != null ? "confirmed_usage" : null,
    input.propertySignals.length > 0 ? "property_signals" : null,
    input.permits.length > 0 ? "permit_history" : null,
    input.audit.returnedBuildingCenter != null ? "geocoded_location" : null,
  ].filter((signal): signal is string => Boolean(signal));

  const missingSignals = [
    input.solarAssessment.imageryDate == null ? "imagery_date" : null,
    input.solarAssessment.maxArrayPanelsCount == null ? "roof_capacity" : null,
    input.solarAssessment.estimatedAnnualProductionKwh == null ? "modeled_production" : null,
    input.solarAssessment.existingSolarStatus === "UNKNOWN" ? "existing_solar" : null,
    input.usageProfile.annualUsageKwh == null ? "confirmed_usage" : null,
    input.propertySignals.length === 0 ? "property_signals" : null,
    input.permits.length === 0 ? "permit_history" : null,
    "shade",
  ].filter((signal): signal is string => Boolean(signal));

  const completeness = availableSignals.length + missingSignals.length > 0
    ? Math.round((availableSignals.length / (availableSignals.length + missingSignals.length)) * 100)
    : 0;
  const confidence = clampPercent(Math.round((input.solarAssessment.solarFitConfidence + completeness) / 2));

  const grade: DataQualitySummary["grade"] =
    confidence >= 85 ? "A" :
    confidence >= 70 ? "B" :
    confidence >= 55 ? "C" :
    confidence >= 40 ? "D" :
    "UNKNOWN";

  const warnings = [...new Set([
    ...input.warnings,
    missingSignals.includes("shade") ? "Shade is unknown and should not be inferred from sunshine-hours." : null,
  ].filter((value): value is string => Boolean(value)))];

  return {
    grade,
    confidence,
    availableSignals,
    missingSignals,
    warnings,
  };
}

function buildLocationVerificationSummary(
  property: Property,
  audit: SolarAssessmentAudit,
  thresholdMeters: number,
): LocationVerificationSummary {
  const distanceMeters = audit.distanceMeters ?? null;
  const status: LocationMatchStatus =
    distanceMeters == null
      ? "UNKNOWN"
      : distanceMeters <= thresholdMeters
        ? "VERIFIED"
        : distanceMeters <= 30
          ? "REVIEW"
          : "MISMATCH";

  return {
    geocodedLatitude: property.latitude ?? null,
    geocodedLongitude: property.longitude ?? null,
    solarBuildingCenterLatitude: audit.returnedBuildingCenter?.latitude ?? null,
    solarBuildingCenterLongitude: audit.returnedBuildingCenter?.longitude ?? null,
    distanceMeters,
    thresholdMeters,
    status,
  };
}

function roundContribution(normalizedScore: number, weight: number): number {
  return Math.round((normalizedScore * weight) * 100) / 100;
}

function averageNumber(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value != null);
  if (valid.length === 0) {
    return null;
  }
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function componentValue(breakdown: SolarFitScoreBreakdown, name: SolarFitScoreComponent["name"]): number | null {
  return breakdown.components.find((component) => component.name === name)?.value ?? null;
}

function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "unknown";
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function distanceMeters(
  a: NormalizedCoordinates,
  b: NormalizedCoordinates | null,
): number | null {
  if (!b) return null;
  const earthRadiusMeters = 6371000;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const haversine =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return Math.round(2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine)));
}

function distanceMilesBetween(
  a: NormalizedCoordinates,
  b: NormalizedCoordinates,
): number {
  const meters = distanceMeters(a, b);
  if (meters == null) {
    return Number.POSITIVE_INFINITY;
  }
  return meters / 1609.344;
}

function resolveAnalysisDependencies(
  env: ReturnType<typeof loadAppEnv>,
  dependencies: AnalyzeDependencies,
): ResolvedAnalysisDependencies {
  if (dependencies.geocoder && dependencies.solarProvider) {
    return {
      geocoder: dependencies.geocoder,
      solarProvider: dependencies.solarProvider,
    };
  }

  const solarApiMissing = validateSolarApiEnv(env);
  const geocodingMissing = validateGeocodingEnv(env);
  if (solarApiMissing.length > 0 || geocodingMissing.length > 0) {
    throw new SolarProviderError(
      "AUTHENTICATION_FAILED",
      "GOOGLE_GEOCODING_API_KEY and GOOGLE_SOLAR_API_KEY are required to run the Solar API slice.",
    );
  }

  const geocodingApiKey = env.googleGeocodingApiKey as string;
  const solarApiKey = env.googleSolarApiKey as string;
  return {
    geocoder:
      dependencies.geocoder ??
      new GoogleMapsGeocoder({
        apiKey: geocodingApiKey,
      }),
    solarProvider:
      dependencies.solarProvider ??
      new GoogleSolarDataProvider({
        apiKey: solarApiKey,
      }),
  };
}

function stableId(input: string): string {
  const hex = createHash("sha1").update(input).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function clampPercent(value: number): number {
  return clamp(Math.round(value * 100));
}
