export const PermitCategory = {
  SOLAR: "solar",
  BATTERY: "battery",
  ROOF_REPLACEMENT: "roof_replacement",
  NEW_RESIDENTIAL: "new_residential",
  SUBDIVISION: "subdivision",
  ELECTRICAL_SERVICE: "electrical_service",
  EV_CHARGER: "ev_charger",
  HVAC: "hvac",
  POOL: "pool",
  ADDITION: "addition",
  RENOVATION: "renovation",
  DEMOLITION: "demolition",
  OTHER: "other",
} as const;

export type PermitCategory =
  (typeof PermitCategory)[keyof typeof PermitCategory];

export interface Jurisdiction {
  id: string;
  name: string;
  stateCode: string;
  countyName?: string | null;
  municipalityType?: string | null;
  timezone: string;
}

export interface ConnectorMetadata {
  id: string;
  name: string;
  sourceType:
    | "api"
    | "arcgis"
    | "csv"
    | "html"
    | "manual_upload"
    | "rtkl_response";
  baseUrl?: string;
  jurisdictionIds: string[];
  supportedDateRange?: {
    from?: string;
    to?: string;
  };
  termsReviewedAt?: string;
  robotsReviewedAt?: string;
  publicAccessConfirmed: boolean;
}

export interface PermitConnector {
  metadata(): ConnectorMetadata;
  discover(jurisdiction: Jurisdiction): Promise<DiscoveryResult>;
  fetchPage(cursor?: string): Promise<RawPermitPage>;
  normalize(record: unknown): Promise<NormalizedPermit>;
  healthCheck(): Promise<ConnectorHealth>;
  rateLimit(): RateLimitPolicy;
}

export interface DiscoveryResult {
  connectorId: string;
  sourceType: ConnectorMetadata["sourceType"];
  officialSourceUrl?: string;
  notes: string[];
  recordsEstimate?: number;
}

export interface RawPermitPage {
  cursor?: string;
  records: unknown[];
  hasMore: boolean;
  sourceFetchedAt: string;
}

export interface NormalizedPermit {
  sourceConnector: string;
  sourceRecordId: string;
  permitCategory: PermitCategory;
  originalDescription: string;
  normalizedDescription?: string;
  rawSource: unknown;
}

export interface ConnectorHealth {
  healthy: boolean;
  checkedAt: string;
  details?: string;
}

export interface RateLimitPolicy {
  requestsPerMinute: number;
  burst?: number;
  backoffMs?: number;
}

export interface OpportunityScore {
  total: number;
  tier: "A" | "B" | "C" | "D";
  reasons: ScoreReason[];
  warnings: ScoreWarning[];
  calculatedAt: string;
  scoringVersion: string;
}

export interface Property {
  id: string;
  normalizedAddress: string;
  street?: string | null;
  city?: string | null;
  county?: string | null;
  state?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  parcelId?: string | null;
  municipality?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SolarAssessment {
  id: string;
  propertyId: string;
  provider: string;
  providerBuildingId?: string | null;
  imageryDate?: string | null;
  imageryProcessedDate?: string | null;
  imageryQuality?: string | null;
  roofAreaMeters2?: number | null;
  groundAreaMeters2?: number | null;
  maxArrayAreaMeters2?: number | null;
  maxArrayPanelsCount?: number | null;
  panelCapacityWatts?: number | null;
  maxSunshineHoursPerYear?: number | null;
  estimatedMaxSystemKw?: number | null;
  estimatedAnnualProductionKwh?: number | null;
  existingSolarStatus: "DETECTED" | "NOT_DETECTED" | "UNKNOWN";
  existingSolarConfidence?: number | null;
  roofComplexityScore?: number | null;
  shadeScore?: number | null;
  orientationScore?: number | null;
  solarFitScore: number;
  solarFitConfidence: number;
  assessmentVersion: string;
  providerPayloadReference?: string | null;
  auditJson?: SolarAssessmentAudit | null;
  scoreBreakdownJson?: SolarFitScoreBreakdown | null;
  assessedAt: string;
  createdAt: string;
}

export interface SolarAssessmentAudit {
  provider: string;
  providerVersion: string | null;
  buildingId: string | null;
  requestedCoordinates: SolarCoordinates | null;
  returnedBuildingCenter: SolarCoordinates | null;
  distanceMeters: number | null;
  imageryQuality: string | null;
  imageryDate: string | null;
  imageryProcessedDate: string | null;
  detectedArrayStatus: "DETECTED" | "NOT_DETECTED" | "UNKNOWN";
  detectedArrayCaptureDate: string | null;
  maxArrayPanelsCount: number | null;
  panelCapacityWatts: number | null;
  estimatedMaxSystemKw: number | null;
  systemSizeCalculation: {
    panelsCount: number | null;
    panelCapacityWatts: number | null;
    calculation: string;
  };
  selectedProductionConfig: {
    panelsCount: number | null;
    yearlyEnergyDcKwh: number | null;
    selectionReason: string;
  } | null;
  roofAreaMeters2: number | null;
  groundAreaMeters2: number | null;
  maxArrayAreaMeters2: number | null;
  roofSegmentCount: number;
  missingFields: string[];
  warnings: string[];
}

export interface SolarCoordinates {
  latitude: number;
  longitude: number;
}

export interface SolarFitScoreComponent {
  name:
    | "sunlight"
    | "usableRoofArea"
    | "systemSize"
    | "orientation"
    | "shade"
    | "roofComplexity"
    | "existingSolar";
  value: number | null;
  normalizedScore: number | null;
  weight: number;
  contribution: number;
  confidence: number;
  explanation: string;
}

export interface SolarFitScoreBreakdown {
  score: number;
  confidence: number;
  components: SolarFitScoreComponent[];
  missingFields: string[];
  warnings: string[];
  calculatedAt: string;
  scoringVersion: string;
}

export interface RoofSegment {
  id: string;
  solarAssessmentId: string;
  segmentIndex: number;
  areaMeters2?: number | null;
  pitchDegrees?: number | null;
  azimuthDegrees?: number | null;
  sunshineHours?: number | null;
  panelsCount?: number | null;
  yearlyEnergyDcKwh?: number | null;
}

export interface PropertySignal {
  id: string;
  propertyId: string;
  signalType:
    | "POOL_VISIBLE"
    | "EV_CONFIRMED"
    | "EV_CHARGER_CONFIRMED"
    | "LARGE_HOME"
    | "LARGE_ROOF"
    | "DETACHED_GARAGE"
    | "LARGE_DRIVEWAY"
    | "HEAVY_SHADE"
    | "LOW_SHADE"
    | "LARGE_LOT"
    | "RECENT_ROOF_PERMIT"
    | "EXISTING_SOLAR"
    | "HIGH_USAGE_CONFIRMED"
    | "HIGH_USAGE_ESTIMATED"
    | "POOL_HEATED_CONFIRMED"
    | "HIGH_SUMMER_BILL_CONFIRMED"
    | "POOL_EQUIPMENT_USAGE_CONFIRMED"
    | "OTHER";
  source:
    | "GOOGLE_SOLAR"
    | "SATELLITE"
    | "PERMIT"
    | "FIELD_REP"
    | "HOMEOWNER"
    | "UTILITY_BILL"
    | "PUBLIC_PROPERTY_DATA"
    | "MODEL";
  valueJson: unknown;
  confidence: number;
  observedAt: string;
  expiresAt?: string | null;
}

export interface PropertyVisualSignal {
  type:
    | "POOL"
    | "LARGE_ROOF"
    | "DETACHED_GARAGE"
    | "LARGE_DRIVEWAY"
    | "HEAVY_SHADE"
    | "LOW_SHADE"
    | "EXISTING_SOLAR"
    | "LARGE_LOT"
    | "OTHER";
  status: "DETECTED" | "NOT_DETECTED" | "UNKNOWN";
  confidence: number;
  source: "SATELLITE" | "SOLAR_API" | "PROPERTY_DATA" | "MANUAL";
  origin: "OBSERVED" | "MODELED" | "HOMEOWNER_CONFIRMED";
  observedAt?: string | null;
}

export interface ConversationInsight {
  title: string;
  reason: string;
  suggestedQuestion: string;
  verified: boolean;
}

export type HomeownerConfirmationAnswer = "YES" | "NO" | "UNKNOWN";

export interface HomeownerConfirmationState {
  poolHeated: HomeownerConfirmationAnswer;
  highSummerBill: HomeownerConfirmationAnswer;
  poolEquipmentIncreasesUsage: HomeownerConfirmationAnswer;
}

export interface OpportunitySignal {
  code: string;
  category: "SOLAR" | "ENERGY" | "PROPERTY" | "PERMIT" | "MARKET" | "FIELD" | "CRM";
  label: string;
  value: string | number | boolean | null;
  unit?: string | null;
  source: string;
  confidence: number;
  impact: number;
  observedAt: string;
  expiresAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface UsageProfile {
  id: string;
  propertyId: string;
  source: "UTILITY_BILL" | "HOMEOWNER" | "ESTIMATE";
  annualUsageKwh?: number | null;
  monthlyAverageKwh?: number | null;
  peakMonthKwh?: number | null;
  monthlyBillAverage?: number | null;
  confidence: number;
  createdAt: string;
}

export interface PermitRecord {
  id: string;
  propertyId?: string | null;
  municipality: string;
  county: string;
  state: string;
  permitNumber?: string | null;
  permitType: "SOLAR" | "ROOF" | "ELECTRICAL" | "BATTERY" | "BUILDING" | "OTHER";
  status: "SUBMITTED" | "PENDING" | "APPROVED" | "ISSUED" | "REJECTED" | "CLOSED" | "UNKNOWN";
  applicationDate?: string | null;
  issuedDate?: string | null;
  contractorName?: string | null;
  sourceProvider: string;
  sourceUrl?: string | null;
  confidence: number;
  retrievedAt: string;
}

export interface LeadOutcome {
  id: string;
  propertyId: string;
  repId?: string | null;
  outcome:
    | "NEW"
    | "UNTOUCHED"
    | "SAVED"
    | "SKIPPED"
    | "REVISIT"
    | "KNOCKED"
    | "NOT_HOME"
    | "CONVERSATION"
    | "NOT_INTERESTED"
    | "RENTER"
    | "DID_NOT_QUALIFY"
    | "BILL_REQUESTED"
    | "BILL_RECEIVED"
    | "APPOINTMENT_BOOKED"
    | "APPOINTMENT_COMPLETED"
    | "SIGNED"
    | "CANCELLED"
    | "INSTALLED";
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadOutcomeCard extends TodayLeadCard {
  updatedAt: string;
  imageryDate?: string | null;
  imageryProcessedDate?: string | null;
  imageryQuality?: string | null;
}

export type DealStage =
  | "LEAD"
  | "CONTACTED"
  | "BILL_REQUESTED"
  | "BILL_RECEIVED"
  | "APPOINTMENT_BOOKED"
  | "CONTRACT_SIGNED"
  | "PERMITTING"
  | "INSTALLATION"
  | "PTO"
  | "RECOVERY";

export interface NextBestAction {
  code:
    | "GET_BILL"
    | "REVISIT_6_PM"
    | "SEND_CONSULTANT"
    | "SPOUSE_REQUIRED"
    | "FOLLOW_UP_TUESDAY"
    | "REQUEST_ROOF_DOCUMENTATION"
    | "PERMIT_NEEDS_REVIEW"
    | "SCHEDULE_INSPECTION"
    | "RECOVER_CANCELLED_CUSTOMER"
    | "BOOK_CONSULTATION"
    | "VERIFY_LOADS"
    | "NO_ACTION";
  label: string;
  reason: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  tone: "sales" | "recovery" | "ops" | "manager";
}

export interface DealBrief {
  id: string;
  propertyId: string;
  propertyAddress: string;
  stage: DealStage;
  maxRoofSolarCapacityKw: number | null;
  confirmedAnnualUsageKwh: number | null;
  estimatedEnergyNeedKw: number | null;
  solarFitScore: number;
  whaleScore: number;
  estimatedSystemKw: number | null;
  estimatedAnnualProductionKwh: number | null;
  annualUsageKwh: number | null;
  billSummary: string;
  customerSignals: string[];
  conversationHistory: string[];
  objections: string[];
  nextBestAction: NextBestAction;
  consultantRecommendation: string;
  revenueAtRisk: number;
  updatedAt: string;
}

export type DataQualityGrade = "A" | "B" | "C" | "D" | "UNKNOWN";

export interface DataQualitySummary {
  grade: DataQualityGrade;
  confidence: number;
  availableSignals: string[];
  missingSignals: string[];
  warnings: string[];
}

export type LocationMatchStatus = "VERIFIED" | "REVIEW" | "MISMATCH" | "UNKNOWN";

export interface LocationVerificationSummary {
  geocodedLatitude?: number | null;
  geocodedLongitude?: number | null;
  solarBuildingCenterLatitude?: number | null;
  solarBuildingCenterLongitude?: number | null;
  distanceMeters: number | null;
  thresholdMeters: number;
  status: LocationMatchStatus;
}

export interface CommandCenterStageRollup {
  stage: DealStage;
  count: number;
  revenue: number;
}

export interface CommandCenterTerritoryRanking {
  territory: string;
  score: number;
  revenue: number;
  leadCount: number;
}

export interface CommandCenterRepRanking {
  rep: string;
  score: number;
  revenue: number;
  loadPercent: number;
}

export interface RevenueCommandCenter {
  generatedAt: string;
  today: string;
  pipelineValue: number;
  likelyInstallValue: number;
  revenueAtRisk: number;
  topTerritory: string;
  topRep: string;
  whaleOpportunities: number;
  billsWaiting: number;
  noShowsToRecover: number;
  permitsDelayed: number;
  installReady: number;
  stageRollup: CommandCenterStageRollup[];
  territoryRanking: CommandCenterTerritoryRanking[];
  repRanking: CommandCenterRepRanking[];
  nextActions: Array<{
    label: string;
    detail: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
  }>;
}

export interface NeighborhoodMarket {
  id: string;
  name: string;
  geographyType: "CENSUS_TRACT" | "BLOCK_GROUP" | "NEIGHBORHOOD" | "ZIP_CODE";
  currentLocationLabel: string;
  radiusMiles: number;
  marketScore: number;
  medianHomeValueBand: "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";
  largeHomeDensity: "LOW" | "MODERATE" | "HIGH";
  averageSolarPotentialKw: number | null;
  solarSaturation: "LOW" | "MODERATE" | "HIGH";
  permitActivity: "LOW" | "MODERATE" | "HIGH";
  whaleDensity: "LOW" | "MODERATE" | "HIGH";
  leadCount: number;
  ctaLabel: "VIEW LEADS" | "DISCOVER MORE";
}

export const MarketEventType = {
  ROOF_PERMIT: "ROOF_PERMIT",
  SOLAR_PERMIT: "SOLAR_PERMIT",
  NEW_CONSTRUCTION: "NEW_CONSTRUCTION",
  REMODEL: "REMODEL",
  ELECTRICAL_UPGRADE: "ELECTRICAL_UPGRADE",
  EV_CHARGER: "EV_CHARGER",
  BATTERY: "BATTERY",
  OTHER: "OTHER",
} as const;

export type MarketEventType = (typeof MarketEventType)[keyof typeof MarketEventType];

export type MarketCoverageLevel = "HIGH" | "MEDIUM" | "LOW" | "UNAVAILABLE";

export interface MarketEvent {
  id: string;
  type: MarketEventType;
  address: string | null;
  municipality: string | null;
  county: string | null;
  state: string;
  latitude: number | null;
  longitude: number | null;
  issuedDate: string | null;
  status: string | null;
  estimatedValue: number | null;
  source: string;
  sourceRecordId: string | null;
  sourceUrl: string | null;
  fetchedAt: string;
  confidence: number;
}

export interface MarketEventCounts {
  roofPermits: number;
  solarPermits: number;
  newConstruction: number;
  remodel: number;
  electricalUpgrades: number;
  evChargers: number;
  batteries: number;
  other: number;
  total: number;
}

export interface MarketOpportunityScoreBreakdown {
  roofActivity: number;
  constructionActivity: number;
  solarMomentum: number;
  solarSaturation: number;
  largePropertyDensity: number;
  highCapacityRoofDensity: number;
  propertyValueSignal: number;
  electricalUpgradeActivity: number;
  dataConfidence: number;
}

export interface MarketOpportunityScore {
  score: number;
  confidence: number;
  breakdown: MarketOpportunityScoreBreakdown;
}

export interface MarketProvenance {
  source: string;
  isFixture: boolean;
  fetchedAt: string;
  notes?: string[] | null;
}

export interface MarketCoverageSummary {
  level: MarketCoverageLevel;
  confidence: number;
  availableSignals: string[];
  missingSignals: string[];
  warnings: string[];
}

export interface MarketAreaSummary {
  id: string;
  name: string;
  geographyType: "ZIP" | "MUNICIPALITY" | "GRID_CELL" | "NEIGHBORHOOD";
  label: string;
  currentLocationLabel: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusMiles: number;
  marketScore: number;
  solarMomentumScore: number;
  solarSaturationScore: number;
  leadOpportunityCount: number;
  largePropertyCount: number;
  highCapacityRoofCount: number;
  counts: MarketEventCounts;
  coverage: MarketCoverageSummary;
  whyHot: string[];
}

export interface MarketHotspotsResponse {
  center: ScanCenter;
  radiusMiles: number;
  days: number;
  provenance: MarketProvenance;
  areas: MarketAreaSummary[];
}

export interface MarketAreaDetail extends MarketAreaSummary {
  scoreBreakdown: MarketOpportunityScoreBreakdown;
  recentActivity: MarketEvent[];
  leadOpportunityCounts: {
    whales: number;
    highPriority: number;
    total: number;
  };
  provenance: MarketProvenance;
}

export interface MarketEventsResponse {
  marketId: string;
  provenance: MarketProvenance;
  results: MarketEvent[];
  nextCursor: string | null;
  hasMore: boolean;
  totalAvailable: number;
}

export interface DiscoverResponse {
  currentLocation: string;
  radiusMiles: number;
  neighborhoods: NeighborhoodMarket[];
  properties: TodayLeadCard[];
}

export interface DiscoveryScanFilters {
  whaleCandidates?: boolean;
  highPriority?: boolean;
  minCapacityKw?: number;
  largeProperties?: boolean;
  recentRoofPermits?: boolean;
  highValueAreas?: boolean;
  noDetectedExistingSolar?: boolean;
  revisits?: boolean;
  lowSolarSaturation?: boolean;
  minimumSystemKw?: number | null;
  recentRoofPermit?: boolean;
  noDetectedSolar?: boolean;
  poolDetected?: boolean;
  largeRoof?: boolean;
  lowShade?: boolean;
  largeLot?: boolean;
  largeProperty?: boolean;
  highValueArea?: boolean;
  revisit?: boolean;
}

export interface LocationResolveRequest {
  query: string;
}

export interface LocationReverseRequest {
  latitude: number;
  longitude: number;
}

export interface LocationResolveResponse {
  type: "AREA" | "PROPERTY";
  formattedAddress: string;
  latitude: number;
  longitude: number;
  placeId: string | null;
  propertyId?: string | null;
  postalCode?: string | null;
  city?: string | null;
  county?: string | null;
  state?: string | null;
  locationType: "CITY" | "ZIP" | "ADDRESS" | "NEIGHBORHOOD" | "UNKNOWN";
}

export interface StreetViewPanoramaLocation {
  latitude: number;
  longitude: number;
}

export interface StreetViewMetadataResponse {
  available: boolean;
  panoId?: string | null;
  panoramaLocation: StreetViewPanoramaLocation | null;
  latitude?: number | null;
  longitude?: number | null;
  date: string | null;
  status: "OK" | "ZERO_RESULTS" | "NOT_FOUND" | "OVER_QUERY_LIMIT" | "REQUEST_DENIED" | "INVALID_REQUEST" | "UNKNOWN_ERROR" | "UNAVAILABLE";
}

export interface ImageryCapabilitiesResponse {
  imagery: {
    satellite: boolean;
    streetView: boolean;
  };
}

export interface ScanCenter {
  latitude: number;
  longitude: number;
}

export interface DiscoveryScanRequest {
  center: ScanCenter;
  radiusMiles: number;
  filters?: DiscoveryScanFilters;
  limit?: number;
  maxGoogleSolarCalls?: number;
}

export interface DiscoveryScanLead extends TodayLeadCard {
  distanceMiles: number | null;
  analysisStatus: "ANALYZED" | "ANALYZING" | "CACHED";
  candidateScore: number;
  routeReason: string;
  clusterId?: string | null;
  propertyOpportunityScore?: number;
  solarOpportunityScore?: number;
  fieldEfficiencyScore?: number;
  fieldPriorityScore?: number;
}

export type LowEfficiencyZoneLabel =
  | "LOW_LEAD_DENSITY"
  | "SPARSE_HOUSING"
  | "DIFFICULT_TERRAIN"
  | "LONG_DRIVEWAYS"
  | "POOR_ROAD_ACCESS"
  | "HIGH_EXISTING_SOLAR"
  | "LOW_PROPERTY_FIT"
  | "HIGH_PRIOR_REJECTION"
  | "ACCESS_RESTRICTION";

export interface NeighborhoodCluster {
  clusterId: string;
  center: ScanCenter;
  propertyCount: number;
  strongLeadCount: number;
  whaleCount: number;
  averageOpportunityScore: number;
  averageCapacityKw: number | null;
  densityScore: number;
  routeEfficiencyScore: number;
  terrainScore: number;
  estimatedMinutes: number;
  fieldEfficiencyScore: number;
  fieldPriorityScore: number;
  lowEfficiencyZones?: LowEfficiencyZoneLabel[];
}

export interface DiscoveryClusterSummary extends NeighborhoodCluster {
  id: string;
  candidateCount: number;
  averageSolarScore: number;
}

export const DiscoveryScanStage = {
  GEOCODING: "GEOCODING",
  PROPERTY_DISCOVERY: "PROPERTY_DISCOVERY",
  PERSISTENCE: "PERSISTENCE",
  PRE_RANKING: "PRE_RANKING",
  SOLAR_ANALYSIS: "SOLAR_ANALYSIS",
  FINAL_RANKING: "FINAL_RANKING",
} as const;

export type DiscoveryScanStage =
  (typeof DiscoveryScanStage)[keyof typeof DiscoveryScanStage];

export const DiscoveryScanStatus = {
  DISCOVERING: "DISCOVERING",
  PRE_RANKING: "PRE_RANKING",
  SOLAR_ANALYSIS: "SOLAR_ANALYSIS",
  FINAL_RANKING: "FINAL_RANKING",
  COMPLETE: "COMPLETE",
  PARTIAL: "PARTIAL",
  FAILED: "FAILED",
  DISCOVERY_FAILED: "DISCOVERY_FAILED",
  DATA_COVERAGE_UNAVAILABLE: "DATA_COVERAGE_UNAVAILABLE",
} as const;

export type DiscoveryScanStatus =
  (typeof DiscoveryScanStatus)[keyof typeof DiscoveryScanStatus];

export interface DiscoveryScanStageProgress {
  stage: DiscoveryScanStatus | DiscoveryScanStage;
  message: string;
  completed?: number | null;
  total?: number | null;
  updatedAt: string;
}

export const DiscoveryScanFailureCode = {
  DATA_COVERAGE_UNAVAILABLE: "DATA_COVERAGE_UNAVAILABLE",
  DATABASE_SCHEMA_MISMATCH: "DATABASE_SCHEMA_MISMATCH",
  DATABASE_UNAVAILABLE: "DATABASE_UNAVAILABLE",
  DATABASE_WRITE_FAILED: "DATABASE_WRITE_FAILED",
  DISCOVERY_PROVIDER_FAILED: "DISCOVERY_PROVIDER_FAILED",
  GEOCODING_REQUEST_FAILED: "GEOCODING_REQUEST_FAILED",
  GOOGLE_SOLAR_REQUEST_FAILED: "GOOGLE_SOLAR_REQUEST_FAILED",
  PERSISTENCE_FAILED: "PERSISTENCE_FAILED",
  PROVIDER_TEMPORARY_FAILURE: "PROVIDER_TEMPORARY_FAILURE",
  PROVIDER_TIMEOUT: "PROVIDER_TIMEOUT",
  PROPERTY_DISCOVERY_TIMEOUT: "PROPERTY_DISCOVERY_TIMEOUT",
} as const;

export type DiscoveryScanFailureCode =
  (typeof DiscoveryScanFailureCode)[keyof typeof DiscoveryScanFailureCode];

export interface DiscoveryScanError {
  code: DiscoveryScanFailureCode;
  message: string;
}

export interface DiscoveryProviderAttemptDiagnostics {
  provider: string;
  supported: boolean;
  requestCount: number;
  recordsReturned: number;
  recordsAccepted: number;
  recordsRejected: number;
  rejectionReasons: Record<string, number>;
  durationMs: number;
  error: string | null;
}

export interface DiscoveryDiagnostics {
  center: ScanCenter;
  radiusMiles: number;
  providersAttempted: DiscoveryProviderAttemptDiagnostics[];
  rawCandidateCount: number;
  deduplicatedCandidateCount: number;
  residentialCandidateCount: number;
  prequalifiedCount: number;
}

export interface DiscoveryScanResult {
  scanId: string;
  currentLocation: string;
  radiusMiles: number;
  candidateCount: number;
  analyzedCount: number;
  googleSolarCalls: number;
  estimatedCostUsd: number;
  propertiesFound: number;
  qualifiedLeadCount: number;
  solarAnalyzedCount: number;
  results: DiscoveryScanLead[];
  clusters?: DiscoveryClusterSummary[];
}

export interface DiscoveryScanResultsPage {
  results: DiscoveryScanLead[];
  nextCursor: string | null;
  hasMore: boolean;
  totalAvailable: number;
  qualifiedLeadCount: number;
}

export interface DiscoveryScanMetrics {
  rawDiscoveredCount: number;
  residentialCandidateCount: number;
  prequalifiedCount: number;
  solarEligibleCount: number;
  solarAnalyzedCount: number;
  qualifiedLeadCount: number;
  renderedLeadCount: number;
  discoveredProperties: number;
  discoveredCount: number;
  knownProperties: number;
  newProperties: number;
  prequalifiedCandidates: number;
  solarCalls: number;
  solarCallBudget: number;
  largeOpportunities: number;
  whaleCandidates: number;
  resultsFound: number;
  estimatedCostUsd: number;
  providerCalls: number;
  providerCoverage: string | null;
  durationMs: number | null;
  geocodingMs: number | null;
  dbCandidateLoadMs: number | null;
  externalDiscoveryMs: number | null;
  metadataPreloadMs: number | null;
  preRankingMs: number | null;
  solarAnalysisMs: number | null;
  finalRankingMs: number | null;
  candidateDiscoveryMs: number | null;
  dedupeMs: number | null;
  classificationMs: number | null;
  clusterMs: number | null;
  cheapRankingMs: number | null;
  firstBatchMs: number | null;
  solarEnrichmentMs: number | null;
  totalScanMs: number | null;
  totalMs: number | null;
}

export interface DiscoveryScanProgress extends DiscoveryScanResult {
  status: DiscoveryScanStatus;
  stage?: DiscoveryScanStage | null;
  center: ScanCenter;
  filters: DiscoveryScanFilters;
  metrics: DiscoveryScanMetrics;
  stages: DiscoveryScanStageProgress[];
  message: string;
  coverageUnavailable: boolean;
  error?: DiscoveryScanError | null;
  discoveryDiagnostics?: DiscoveryDiagnostics | null;
  startedAt: string;
  stageStartedAt: string;
  completedAt: string | null;
  warnings: string[];
  updatedAt: string;
}

export type DiscoveryScanStatusResponse = Omit<DiscoveryScanProgress, "results">;

export interface DiscoveryScanJobResponse {
  scanId: string;
  status: DiscoveryScanStatus;
}

export interface LeadSignalBadge {
  label: string;
  tone: "CONFIRMED" | "ESTIMATED" | "PUBLIC_RECORD" | "GOOGLE_SOLAR" | "MISSING" | "MODEL";
}

export interface TodayLeadCard {
  id: string;
  propertyId?: string | null;
  propertyUse?: "SINGLE_FAMILY" | "RESIDENTIAL" | "MULTI_FAMILY" | "COMMERCIAL" | "INDUSTRIAL" | "INSTITUTIONAL" | "UNKNOWN";
  latitude?: number | null;
  longitude?: number | null;
  distanceMiles?: number | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  address: string;
  neighborhood: string;
  opportunityScore: number;
  whaleScore: number;
  solarFitScore: number;
  confidence: number;
  maxRoofSolarCapacityKw: number | null;
  confirmedAnnualUsageKwh: number | null;
  estimatedEnergyNeedKw: number | null;
  maxSystemKw?: number | null;
  maxArrayPanelsCount?: number | null;
  estimatedAnnualProductionKwh: number | null;
  estimatedUsagePotentialKwh?: number | null;
  whaleConfidence?: number | null;
  sunshineHours?: number | null;
  imageryQuality?: string | null;
  existingSolarStatus?: "DETECTED" | "NOT_DETECTED" | "UNKNOWN";
  permitCount?: number;
  nextAction: string;
  nextBestAction: NextBestAction;
  reasons: string[];
  signals: string[];
  opportunitySignals?: OpportunitySignal[];
  visualSignals?: PropertyVisualSignal[];
  conversationInsights?: ConversationInsight[];
  homeownerConfirmations?: HomeownerConfirmationState | null;
  badges: LeadSignalBadge[];
  verificationNeeded: string[];
  outcome: LeadOutcome["outcome"];
  isDemo?: boolean;
  locationVerification?: LocationVerificationSummary;
}

export interface TodayDashboard {
  territory: string;
  summary: {
    priorityLeads: number;
    whaleCandidates: number;
    revisits: number;
    needsBill: number;
    total: number;
  };
  filters: Array<{
    key: "whales" | "high_priority" | "revisit" | "needs_bill";
    label: string;
    count: number;
  }>;
  leads: TodayLeadCard[];
}

export interface PropertyDataQualityResponse {
  propertyId: string;
  summary: DataQualitySummary;
}

export interface RouteCreateRequest {
  startingLatitude: number;
  startingLongitude: number;
  selectedPropertyIds: string[];
}

export interface RouteStop {
  propertyId: string;
  address: string;
  neighborhood: string;
  distanceMilesFromPrevious: number;
  distanceMilesFromStart: number;
  opportunityScore: number;
  whaleScore: number;
  maxRoofSolarCapacityKw: number | null;
  nextBestAction: NextBestAction;
  reason: string;
  outcome: LeadOutcome["outcome"];
  priorityIndex: number;
}

export interface RoutePlan {
  id: string;
  startingLatitude: number;
  startingLongitude: number;
  selectedPropertyIds: string[];
  stops: RouteStop[];
  completedPropertyIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RouteNextResponse {
  routeId: string;
  completedCount: number;
  remainingCount: number;
  currentStop: RouteStop | null;
  nextStop: RouteStop | null;
  route: RoutePlan;
}

export interface OpportunityAssessment {
  id: string;
  propertyId: string;
  solarFitScore: number;
  usageOpportunityScore: number;
  systemSizeScore: number;
  permitSignalScore: number;
  fieldPriorityScore: number;
  whaleScore: number;
  overallOpportunityScore: number;
  confidence: number;
  scoreVersion: string;
  explanationJson: unknown;
  createdAt: string;
}

export interface ScoreReason {
  code: string;
  points: number;
  message: string;
}

export interface ScoreWarning {
  code: string;
  message: string;
}

export interface ExistingSolarSignal {
  signalType:
    | "permit"
    | "imagery_model"
    | "field_observation"
    | "homeowner_confirmed"
    | "utility_authorized"
    | "assessor_record"
    | "completed_permit";
  status: string;
  confidence: number;
  observedDate?: string;
  sourceReference?: string | null;
}

export interface ExistingSolarResult {
  status: "confirmed" | "likely" | "unknown";
  confidence: number;
  evidence: ExistingSolarSignal[];
}

/**
 * Platform-level access contracts. These are shared by the web shell and the
 * API so modules can be enabled by permission instead of by separate apps.
 */
export const PlatformRole = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  SETTER: "SETTER",
  CLOSER: "CLOSER",
} as const;

export type PlatformRole = (typeof PlatformRole)[keyof typeof PlatformRole];

export type PlatformPermission =
  | "lead:create"
  | "lead:view-own"
  | "lead:view-assigned"
  | "lead:view-team"
  | "lead:view-all"
  | "lead:update-own"
  | "lead:update-all"
  | "appointment:create"
  | "appointment:view-own"
  | "appointment:view-assigned"
  | "appointment:view-team"
  | "appointment:assign"
  | "appointment:reassign"
  | "appointment:update-outcome"
  | "bill:upload"
  | "bill:view-assigned"
  | "bill:view-all"
  | "team:view"
  | "team:create-user"
  | "team:update-user"
  | "team:assign-role"
  | "analytics:view"
  | "reports:view"
  | "reports:view-own"
  | "reports:export"
  | "labs:view"
  | "system:manage"
  | "territory:view"
  | "territory:manage";

export type PlatformFeatureFlag =
  | "leadFinderEnabled"
  | "routeOptimizerEnabled"
  | "installationSignalsEnabled"
  | "aiTerritoryScoreEnabled";

export interface PlatformFeatureFlags {
  leadFinderEnabled: boolean;
  routeOptimizerEnabled: boolean;
  installationSignalsEnabled: boolean;
  aiTerritoryScoreEnabled: boolean;
}

export type PlatformModule =
  | "OVERVIEW"
  | "HOME"
  | "APPOINTMENTS"
  | "OPERATIONS"
  | "LEADS"
  | "SCHEDULE"
  | "MAP"
  | "TEAM"
  | "REPORTS"
  | "INSIGHTS"
  | "LABS"
  | "SYSTEM"
  | "MORE"
  | "LEAD_FINDER"
  | "HOOD_NAVIGATOR"
  | "INSTALLATION_SIGNALS"
  | "ROUTE_EXPERIMENT";

export interface PlatformModuleDefinition {
  id: PlatformModule;
  label: string;
  route: string;
  permission?: PlatformPermission;
  anyPermissions?: readonly PlatformPermission[];
  feature?: PlatformFeatureFlag;
  parent?: PlatformModule;
}

export const PLATFORM_MODULE_REGISTRY: readonly PlatformModuleDefinition[] = [
  { id: "OVERVIEW", label: "Overview", route: "/overview", permission: "system:manage" },
  { id: "HOME", label: "Home", route: "/home", anyPermissions: ["lead:create", "lead:view-own", "lead:view-assigned", "lead:view-team", "lead:view-all"] },
  { id: "APPOINTMENTS", label: "Appointments", route: "/appointments", anyPermissions: ["appointment:view-assigned", "appointment:view-team"] },
  { id: "OPERATIONS", label: "Operations", route: "/operations", anyPermissions: ["team:view", "appointment:assign"] },
  { id: "LEADS", label: "Leads", route: "/leads", anyPermissions: ["lead:view-own", "lead:view-assigned", "lead:view-team", "lead:view-all"] },
  { id: "SCHEDULE", label: "Schedule", route: "/schedule", anyPermissions: ["appointment:create", "appointment:view-own", "appointment:view-assigned", "appointment:view-team"] },
  { id: "MAP", label: "Map", route: "/map", permission: "analytics:view" },
  { id: "TEAM", label: "Team", route: "/team", permission: "team:view" },
  { id: "REPORTS", label: "Reports", route: "/reports", permission: "reports:view" },
  { id: "INSIGHTS", label: "Insights", route: "/insights", anyPermissions: ["analytics:view", "territory:view", "reports:view"] },
  { id: "LABS", label: "Labs", route: "/labs", permission: "labs:view" },
  { id: "SYSTEM", label: "System", route: "/system", permission: "system:manage" },
  { id: "MORE", label: "More", route: "/more" },
  { id: "LEAD_FINDER", label: "Lead Finder", route: "/labs/lead-finder", permission: "labs:view", feature: "leadFinderEnabled", parent: "LABS" },
  { id: "HOOD_NAVIGATOR", label: "Hood Navigator", route: "/labs/hood-navigator", permission: "labs:view", parent: "LABS" },
  { id: "INSTALLATION_SIGNALS", label: "Installation Signals", route: "/labs/installation-signals", permission: "labs:view", feature: "installationSignalsEnabled", parent: "LABS" },
  { id: "ROUTE_EXPERIMENT", label: "Route Experiments", route: "/labs/route", permission: "labs:view", feature: "routeOptimizerEnabled", parent: "LABS" },
];

export function resolvePlatformModules(
  permissions: readonly PlatformPermission[] | readonly ["*"],
  featureFlags: PlatformFeatureFlags,
): PlatformModule[] {
  const grantedPermissions = permissions as readonly string[];
  const can = (permission: PlatformPermission) => grantedPermissions.includes("*") || grantedPermissions.includes(permission);
  return PLATFORM_MODULE_REGISTRY
    .filter((module) => {
      const permissionAllowed = module.permission == null && module.anyPermissions == null
        ? true
        : module.permission != null
          ? can(module.permission)
          : module.anyPermissions?.some(can) ?? false;
      return permissionAllowed && (module.feature == null || featureFlags[module.feature]);
    })
    .map((module) => module.id);
}

export function primaryPlatformRoute(modules: readonly PlatformModule[]): string {
  const priority: readonly PlatformModule[] = ["OVERVIEW", "OPERATIONS", "APPOINTMENTS", "HOME"];
  const preferred = priority.find((module) => modules.includes(module));
  if (preferred) return PLATFORM_MODULE_REGISTRY.find((module) => module.id === preferred)?.route ?? "/home";
  return PLATFORM_MODULE_REGISTRY.find((module) => modules.includes(module.id) && module.id !== "MORE")?.route ?? "/more";
}

export interface PlatformUserContext {
  id: string | null;
  displayName: string;
  roles: readonly PlatformRole[];
  permissions: readonly PlatformPermission[] | readonly ["*"];
  featureFlags: PlatformFeatureFlags;
  modules: readonly PlatformModule[];
}

export const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, readonly PlatformPermission[] | readonly ["*"]> = {
  SUPER_ADMIN: ["*"],
  ADMIN: [
    "lead:view-team",
    "lead:update-all",
    "appointment:view-team",
    "appointment:assign",
    "appointment:reassign",
    "team:view",
    "team:create-user",
    "team:update-user",
    "team:assign-role",
    "analytics:view",
    "reports:view",
    "reports:export",
    "territory:view",
    "territory:manage",
  ],
  MANAGER: [
    "lead:view-own",
    "lead:view-team",
    "lead:update-all",
    "appointment:view-team",
    "appointment:assign",
    "appointment:reassign",
    "appointment:update-outcome",
    "team:view",
    "team:create-user",
    "team:update-user",
    "team:assign-role",
    "analytics:view",
    "reports:view",
    "reports:export",
    "territory:view",
  ],
  SETTER: [
    "lead:create",
    "lead:view-own",
    "lead:update-own",
    "appointment:create",
    "appointment:view-own",
    "bill:upload",
    "reports:view-own",
  ],
  CLOSER: [
    "lead:update-own",
    "lead:view-assigned",
    "appointment:view-assigned",
    "appointment:update-outcome",
    "bill:upload",
    "bill:view-assigned",
    "reports:view-own",
  ],
};

export const DEFAULT_PLATFORM_FEATURE_FLAGS: PlatformFeatureFlags = {
  leadFinderEnabled: true,
  routeOptimizerEnabled: false,
  installationSignalsEnabled: true,
  aiTerritoryScoreEnabled: false,
};

export function platformRoleCan(role: PlatformRole, permission: PlatformPermission): boolean {
  const permissions = PLATFORM_ROLE_PERMISSIONS[role];
  if (permissions[0] === "*") return true;
  return (permissions as readonly PlatformPermission[]).includes(permission);
}

export function platformRolesCan(roles: readonly PlatformRole[], permission: PlatformPermission): boolean {
  return roles.some((role) => platformRoleCan(role, permission));
}
