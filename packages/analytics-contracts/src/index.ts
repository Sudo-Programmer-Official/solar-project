export type SalesRegion = "EAST" | "WEST" | "UNKNOWN";

export type AppointmentResultCategory =
  | "CLOSED"
  | "DID_NOT_CLOSE"
  | "CREDIT_FAIL"
  | "CANCELLED_DQ"
  | "RESCHEDULED"
  | "UNKNOWN";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
export type MapLayer = "SETS" | "SITS" | "CLOSES" | "CANCELLATION_DQ" | "CLOSE_RATE" | "MOMENTUM_7D" | "SATURATION" | "OPPORTUNITY";

export interface NormalizedAppointment {
  id: string;
  sourceFile: string;
  sourceSheet: string;
  sourceRow: number;
  sourceBlock: number;
  region: SalesRegion;
  appointmentDate: string | null;
  appointmentTime: string | null;
  dateSet: string | null;
  customerName: string;
  phone: string | null;
  city: string | null;
  hood: string | null;
  street: string | null;
  latitude: number | null;
  longitude: number | null;
  setter: string | null;
  closer: string | null;
  confirmed: boolean | null;
  confirmedRaw: string | null;
  resultRaw: string | null;
  resultCategory: AppointmentResultCategory;
  setterNotes: string | null;
  closerNotes: string | null;
  dedupeKey: string;
  raw: Record<string, unknown>;
}

export interface ExcelParseDiagnostics {
  sourceFile: string;
  sheetsScanned: number;
  weeklySheets: number;
  blocksScanned: number;
  candidateRows: number;
  parsedAppointments: number;
  skippedRows: number;
  warnings: string[];
}

export interface ParseWorkbookResult {
  appointments: NormalizedAppointment[];
  diagnostics: ExcelParseDiagnostics;
}

export interface IntelligenceFilters {
  from?: string | null;
  to?: string | null;
  region?: SalesRegion | null;
  city?: string | null;
  hood?: string | null;
  street?: string | null;
  setter?: string | null;
  closer?: string | null;
  result?: AppointmentResultCategory | null;
}

export interface FunnelMetrics {
  totalSets: number;
  confirmed: number;
  sits: number;
  closes: number;
  cancellationDq: number;
  didNotClose: number;
  creditFails: number;
  rescheduled: number;
  setToClosePct: number;
  sitToClosePct: number;
  traceAppointmentIds: string[];
}

export interface TerritorySummary extends FunnelMetrics {
  key: string;
  region: SalesRegion;
  city: string;
  hood: string | null;
  street: string | null;
  closeRatePct: number;
  observedCloseRatePct: number;
  smoothedCloseRatePct: number;
  sitRatePct: number;
  cancellationDqRatePct: number;
  revisitCount: number;
  revisitRatePct: number;
  recentPerformancePct: number;
  momentumPp: number;
  daysSinceWorked: number | null;
  lastWorkedDate: string | null;
  saturationPct: number;
  unworkedCapacity: number;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  minimumSampleSize: number;
  scoreBreakdown: OpportunityScoreBreakdown;
  opportunityScore: number;
  deploymentPriority: "HIGH" | "MEDIUM" | "LOW";
  latitude: number | null;
  longitude: number | null;
}

export interface RepSummary extends FunnelMetrics {
  name: string;
  role: "SETTER" | "CLOSER";
  closeRatePct: number;
  territories: string[];
}

export interface MomentumSummary {
  key: string;
  region: SalesRegion;
  city: string;
  hood: string | null;
  recent7: FunnelMetrics;
  recent30: FunnelMetrics;
  momentumPp: number;
  direction: "HEATING_UP" | "DECLINING" | "STABLE";
  opportunityScore: number;
  latitude: number | null;
  longitude: number | null;
}

export interface MapPoint {
  key: string;
  appointmentId: string | null;
  label: string;
  region: SalesRegion;
  city: string;
  hood: string | null;
  street: string | null;
  latitude: number | null;
  longitude: number | null;
  coordinateSource: "PROPERTY" | "CITY_CENTROID" | "UNMAPPED";
  layerValues: Record<MapLayer, number>;
  opportunityScore: number;
  closes: number;
  sets: number;
  sits: number;
  cancellationDq: number;
  closeRatePct: number;
  momentumPp: number;
  saturationPct: number;
  confidence: ConfidenceLevel;
  direction: MomentumSummary["direction"];
}

export interface OpportunityComponent {
  key: string;
  label: string;
  score: number;
  weightPct: number;
  contribution: number;
  rawValue: number | null;
  displayValue: string;
  explanation: string;
}

export interface OpportunityScoreBreakdown {
  finalScore: number;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  sampleSize: number;
  minimumSampleSize: number;
  components: OpportunityComponent[];
}

export interface DeploymentRecommendation {
  territory: TerritorySummary;
  suggestedReps: number;
  reasons: string[];
  confidence: ConfidenceLevel;
  recentTrend: MomentumSummary["direction"];
  unworkedCapacity: number;
}

export interface DeploymentAvoidance {
  territory: TerritorySummary;
  reason: string;
  confidence: ConfidenceLevel;
  recentTrend: MomentumSummary["direction"];
}

export interface DeploymentPlan {
  generatedAt: string;
  anchorDate: string | null;
  recommendations: DeploymentRecommendation[];
  avoid: DeploymentAvoidance[];
  sourceAppointmentIds: string[];
  methodology: string[];
}

export type TerritoryDrilldownLevel = "CITY" | "HOOD" | "STREET";

export interface TerritoryDrilldownNode {
  key: string;
  level: TerritoryDrilldownLevel;
  region: SalesRegion;
  city: string;
  hood: string | null;
  street: string | null;
  latitude: number | null;
  longitude: number | null;
  metrics: FunnelMetrics;
  closeRatePct: number;
  sitRatePct: number;
  cancellationDqRatePct: number;
  confidence: ConfidenceLevel;
  opportunityScore: number;
  traceAppointmentIds: string[];
}

export interface TerritoryDrilldownResponse {
  generatedAt: string;
  filters: IntelligenceFilters;
  nodes: TerritoryDrilldownNode[];
  sourceAppointmentIds: string[];
}

export interface IntelligenceDashboard {
  generatedAt: string;
  filters: IntelligenceFilters;
  anchorDate: string | null;
  metrics: FunnelMetrics;
  byCity: TerritorySummary[];
  bySetter: RepSummary[];
  byCloser: RepSummary[];
  momentum: MomentumSummary[];
  eastWest: TerritorySummary[];
  ranking: TerritorySummary[];
  map: MapPoint[];
  mapLayers: MapLayer[];
  deploymentPlan: DeploymentPlan;
  source: {
    appointmentCount: number;
    traceEndpoint: string;
    drilldownEndpoint: string;
  };
}

export interface UploadResult {
  uploadId: string;
  filename: string;
  region: SalesRegion;
  parsedRows: number;
  insertedRows: number;
  duplicateRows: number;
  diagnostics: ExcelParseDiagnostics;
}

export interface AppointmentQueryResult {
  appointments: NormalizedAppointment[];
  total: number;
}
