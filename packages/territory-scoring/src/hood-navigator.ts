export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** Provider-neutral terrain adapter. Implementations can use a DEM, routing API, or another verified source. */
export interface TerrainProvider {
  getElevation(point: GeoPoint): Promise<number | null>;
  getSlope(point: GeoPoint): Promise<number | null>;
}

export interface TerrainSignals {
  slopeDegrees?: number | null;
  elevationChangeMeters?: number | null;
  roadGradePercent?: number | null;
  walkingDifficulty?: number | null;
}

export interface FieldEfficiencyInputs {
  leadDensity: number;
  doorToDoorDistance: number;
  routeCompactness: number;
  roadAccessibility: number;
  terrainScore: number;
  strongLeadDensity: number;
  historicalFieldOutcome?: number | null;
}

export interface FieldEfficiencyBreakdown extends FieldEfficiencyInputs {
  score: number;
  historicalFieldOutcomeScore: number;
  weights: {
    leadDensity: number;
    doorToDoorDistance: number;
    routeCompactness: number;
    roadAccessibility: number;
    terrain: number;
    strongLeadDensity: number;
    historicalFieldOutcome: number;
  };
}

export interface ClusterTimeEstimateInput {
  propertyCount: number;
  distanceMilesFromStart: number;
  intraClusterMiles: number;
  doorTimeMinutes?: number;
  driveMinutesPerMile?: number;
  walkingMinutesPerMile?: number;
}

export const DEFAULT_DOOR_TIME_MINUTES = 2.5;

const FIELD_EFFICIENCY_WEIGHTS = {
  leadDensity: 0.25,
  doorToDoorDistance: 0.15,
  routeCompactness: 0.15,
  roadAccessibility: 0.15,
  terrain: 0.15,
  strongLeadDensity: 0.1,
  historicalFieldOutcome: 0.05,
} as const;

/**
 * Terrain changes field efficiency only. A missing terrain sample is represented as a
 * neutral 75 so solar opportunity is never reduced because terrain is unknown.
 */
export function calculateTerrainScore(signals: TerrainSignals = {}): number {
  const dimensions = [
    normalizedDifficulty(signals.slopeDegrees, 25),
    normalizedDifficulty(signals.elevationChangeMeters, 60),
    normalizedDifficulty(signals.roadGradePercent, 12),
    normalizePercent(signals.walkingDifficulty),
  ].filter((value): value is number => value != null);

  if (dimensions.length === 0) return 75;
  return round(100 - average(dimensions));
}

export function calculateFieldEfficiencyScore(inputs: FieldEfficiencyInputs): FieldEfficiencyBreakdown {
  const normalized = {
    leadDensity: clamp(inputs.leadDensity),
    doorToDoorDistance: clamp(inputs.doorToDoorDistance),
    routeCompactness: clamp(inputs.routeCompactness),
    roadAccessibility: clamp(inputs.roadAccessibility),
    terrainScore: clamp(inputs.terrainScore),
    strongLeadDensity: clamp(inputs.strongLeadDensity),
    historicalFieldOutcome: clamp(inputs.historicalFieldOutcome ?? 75),
  };
  const score = round(
    normalized.leadDensity * FIELD_EFFICIENCY_WEIGHTS.leadDensity +
      normalized.doorToDoorDistance * FIELD_EFFICIENCY_WEIGHTS.doorToDoorDistance +
      normalized.routeCompactness * FIELD_EFFICIENCY_WEIGHTS.routeCompactness +
      normalized.roadAccessibility * FIELD_EFFICIENCY_WEIGHTS.roadAccessibility +
      normalized.terrainScore * FIELD_EFFICIENCY_WEIGHTS.terrain +
      normalized.strongLeadDensity * FIELD_EFFICIENCY_WEIGHTS.strongLeadDensity +
      normalized.historicalFieldOutcome * FIELD_EFFICIENCY_WEIGHTS.historicalFieldOutcome,
  );
  return {
    ...normalized,
    historicalFieldOutcomeScore: normalized.historicalFieldOutcome,
    score,
    weights: FIELD_EFFICIENCY_WEIGHTS,
  };
}

export function estimateClusterMinutes(input: ClusterTimeEstimateInput): number {
  const driveMinutes = Math.max(0, input.distanceMilesFromStart) * (input.driveMinutesPerMile ?? 2.5);
  const walkingMinutes = Math.max(0, input.intraClusterMiles) * (input.walkingMinutesPerMile ?? 18);
  const doorMinutes = Math.max(0, input.propertyCount) * (input.doorTimeMinutes ?? DEFAULT_DOOR_TIME_MINUTES);
  return round(driveMinutes + walkingMinutes + doorMinutes);
}

export function calculateExpectedOpportunityPerRepHour(input: {
  averageOpportunityScore: number;
  fieldEfficiencyScore: number;
  historicalFieldOutcome?: number | null;
  propertyCount: number;
  estimatedMinutes: number;
}): number {
  const qualityAndEfficiency = clamp(input.averageOpportunityScore) * 0.7 + clamp(input.fieldEfficiencyScore) * 0.3;
  const outcomeMultiplier = 0.6 + clamp(input.historicalFieldOutcome ?? 75) / 250;
  const repHours = Math.max(input.estimatedMinutes / 60, 0.25);
  return round((qualityAndEfficiency * outcomeMultiplier * Math.max(0, input.propertyCount)) / repHours);
}

function normalizedDifficulty(value: number | null | undefined, maximum: number): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return clamp((Math.abs(value) / maximum) * 100);
}

function normalizePercent(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return clamp(value);
}

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function round(value: number): number {
  return Math.round(value);
}

