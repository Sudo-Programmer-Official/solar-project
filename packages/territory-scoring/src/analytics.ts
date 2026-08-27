import type {
  AppointmentResultCategory,
  ConfidenceLevel,
  DeploymentAvoidance,
  DeploymentPlan,
  DeploymentRecommendation,
  FunnelMetrics,
  IntelligenceDashboard,
  IntelligenceFilters,
  MapLayer,
  MapPoint,
  MomentumSummary,
  NormalizedAppointment,
  OpportunityComponent,
  OpportunityScoreBreakdown,
  RepSummary,
  TerritoryDrilldownNode,
  TerritoryDrilldownResponse,
  TerritorySummary,
} from "@solar/analytics-contracts";
import {
  getCityCentroid,
  isValidCoordinate,
  normalizeTerritoryLabel,
  stableCoordinateOffset,
  territoryKey,
} from "@solar/geo-core";

const sittingResults = new Set<AppointmentResultCategory>(["CLOSED", "DID_NOT_CLOSE", "CREDIT_FAIL"]);
const cancellationResults = new Set<AppointmentResultCategory>(["CANCELLED_DQ", "RESCHEDULED"]);
export const MINIMUM_SAMPLE_SIZE = 10;
const TARGET_SAMPLE_SIZE = 30;
const BAYESIAN_PRIOR_STRENGTH = 20;
const REP_CAPACITY_UNITS = 12;
const mapLayers: MapLayer[] = ["SETS", "SITS", "CLOSES", "CANCELLATION_DQ", "CLOSE_RATE", "MOMENTUM_7D", "SATURATION", "OPPORTUNITY"];

export function buildDashboard(
  appointments: NormalizedAppointment[],
  filters: IntelligenceFilters = {},
  generatedAt = new Date().toISOString(),
): IntelligenceDashboard {
  const filtered = filterAppointments(appointments, filters);
  const anchorDate = latestDate(filtered);
  const benchmark = calculateBenchmark(filtered);
  const territoryBase = summarizeGroups(groupBy(filtered, (appointment) => territoryKey(appointment.region, appointment.city, appointment.hood)), benchmark, anchorDate);
  const territories = scoreTerritories(territoryBase, benchmark);
  const momentum = summarizeMomentum(filtered, anchorDate, benchmark);
  const momentumByKey = new Map(momentum.map((row) => [row.key, row]));
  const enrichedMomentum = momentum.map((row) => ({ ...row, opportunityScore: territories.find((territory) => territory.key === row.key)?.opportunityScore ?? 0 }));
  const ranking = [...territories].sort(compareTerritories);
  const byCity = scoreTerritories(
    summarizeGroups(groupBy(filtered, (appointment) => `${appointment.region}::${appointment.city ?? "Unknown"}`), benchmark, anchorDate),
    benchmark,
  ).sort((a, b) => b.closeRatePct - a.closeRatePct || b.totalSets - a.totalSets);
  const eastWest = scoreTerritories(
    summarizeGroups(groupBy(filtered, (appointment) => appointment.region), benchmark, anchorDate),
    benchmark,
  ).sort((a, b) => b.setToClosePct - a.setToClosePct);
  const map = buildMapPoints(filtered, ranking, momentumByKey);
  const deploymentPlan = buildDeploymentPlan(ranking, momentumByKey, anchorDate, generatedAt);

  return {
    generatedAt,
    filters,
    anchorDate,
    metrics: calculateMetrics(filtered),
    byCity,
    bySetter: summarizeRep(filtered, "SETTER"),
    byCloser: summarizeRep(filtered, "CLOSER"),
    momentum: enrichedMomentum.sort((a, b) => b.opportunityScore - a.opportunityScore || b.momentumPp - a.momentumPp),
    eastWest,
    ranking,
    map,
    mapLayers,
    deploymentPlan,
    source: {
      appointmentCount: filtered.length,
      traceEndpoint: "/api/v1/intelligence/appointments",
      drilldownEndpoint: "/api/v1/intelligence/territories",
    },
  };
}

export function buildTerritoryDrilldown(
  appointments: NormalizedAppointment[],
  filters: IntelligenceFilters = {},
  generatedAt = new Date().toISOString(),
): TerritoryDrilldownResponse {
  const filtered = filterAppointments(appointments, filters);
  const benchmark = calculateBenchmark(filtered);
  const level: TerritoryDrilldownNode["level"] = filters.hood ? "STREET" : filters.city ? "HOOD" : "CITY";
  const grouped = groupBy(filtered, (appointment) => {
    if (level === "STREET") return `${appointment.region}::${appointment.city ?? "Unknown"}::${appointment.hood ?? "Unknown"}::${appointment.street ?? "Unknown street"}`;
    if (level === "HOOD") return `${appointment.region}::${appointment.city ?? "Unknown"}::${appointment.hood ?? "Unknown hood"}`;
    return `${appointment.region}::${appointment.city ?? "Unknown"}`;
  });
  const base = summarizeGroups(grouped, benchmark, latestDate(filtered));
  const scored = scoreTerritories(base, benchmark);
  const nodes = scored.map((territory): TerritoryDrilldownNode => ({
    key: territory.key,
    level,
    region: territory.region,
    city: territory.city,
    hood: territory.hood,
    street: territory.street,
    latitude: territory.latitude,
    longitude: territory.longitude,
    metrics: metricsWithoutTrace(territory),
    closeRatePct: territory.closeRatePct,
    sitRatePct: territory.sitRatePct,
    cancellationDqRatePct: territory.cancellationDqRatePct,
    confidence: territory.confidence,
    opportunityScore: territory.opportunityScore,
    traceAppointmentIds: territory.traceAppointmentIds,
  })).sort(compareDrilldownNodes);
  return {
    generatedAt,
    filters,
    nodes,
    sourceAppointmentIds: filtered.map((appointment) => appointment.id),
  };
}

export function filterAppointments(appointments: NormalizedAppointment[], filters: IntelligenceFilters = {}): NormalizedAppointment[] {
  const city = normalizeTerritoryLabel(filters.city);
  const hood = normalizeTerritoryLabel(filters.hood);
  const street = normalizeTerritoryLabel(filters.street);
  return appointments.filter((appointment) => {
    if (filters.from && (!appointment.appointmentDate || appointment.appointmentDate < filters.from)) return false;
    if (filters.to && (!appointment.appointmentDate || appointment.appointmentDate > filters.to)) return false;
    if (filters.region && filters.region !== "UNKNOWN" && appointment.region !== filters.region) return false;
    if (city && appointment.city !== city) return false;
    if (hood && appointment.hood !== hood) return false;
    if (street && appointment.street?.toLowerCase() !== street.toLowerCase()) return false;
    if (filters.setter && appointment.setter?.toLowerCase() !== filters.setter.toLowerCase()) return false;
    if (filters.closer && appointment.closer?.toLowerCase() !== filters.closer.toLowerCase()) return false;
    if (filters.result && appointment.resultCategory !== filters.result) return false;
    return true;
  });
}

export function calculateMetrics(appointments: NormalizedAppointment[]): FunnelMetrics {
  const traceAppointmentIds = appointments.map((appointment) => appointment.id);
  const totalSets = appointments.length;
  const confirmed = appointments.filter((appointment) => appointment.confirmed === true).length;
  const sits = appointments.filter((appointment) => sittingResults.has(appointment.resultCategory)).length;
  const closes = appointments.filter((appointment) => appointment.resultCategory === "CLOSED").length;
  const cancellationDq = appointments.filter((appointment) => cancellationResults.has(appointment.resultCategory)).length;
  const didNotClose = appointments.filter((appointment) => appointment.resultCategory === "DID_NOT_CLOSE").length;
  const creditFails = appointments.filter((appointment) => appointment.resultCategory === "CREDIT_FAIL").length;
  const rescheduled = appointments.filter((appointment) => appointment.resultCategory === "RESCHEDULED").length;
  return {
    totalSets,
    confirmed,
    sits,
    closes,
    cancellationDq,
    didNotClose,
    creditFails,
    rescheduled,
    setToClosePct: rate(closes, totalSets),
    sitToClosePct: rate(closes, sits),
    traceAppointmentIds,
  };
}

function calculateBenchmark(appointments: NormalizedAppointment[]) {
  const metrics = calculateMetrics(appointments);
  return {
    metrics,
    sitRatePct: smoothedRate(metrics.sits, metrics.totalSets, rate(metrics.sits, metrics.totalSets) || 50, BAYESIAN_PRIOR_STRENGTH),
    closeRatePct: smoothedRate(metrics.closes, metrics.sits, rate(metrics.closes, metrics.sits) || 20, BAYESIAN_PRIOR_STRENGTH),
    cancellationDqRatePct: smoothedRate(metrics.cancellationDq, metrics.totalSets, rate(metrics.cancellationDq, metrics.totalSets) || 20, BAYESIAN_PRIOR_STRENGTH),
  };
}

function summarizeGroups(groups: Map<string, NormalizedAppointment[]>, benchmark: ReturnType<typeof calculateBenchmark>, anchorDate: string | null): TerritorySummary[] {
  return [...groups.entries()].map(([key, group]) => {
    const first = group[0]!;
    const metrics = calculateMetrics(group);
    const lastWorkedDate = latestDate(group);
    const recent7 = anchorDate ? calculateMetrics(group.filter((appointment) => inWindow(appointment.appointmentDate, toUtcDate(anchorDate), 7))) : calculateMetrics([]);
    const recent30 = anchorDate ? calculateMetrics(group.filter((appointment) => inWindow(appointment.appointmentDate, toUtcDate(anchorDate), 30))) : calculateMetrics([]);
    const observedCloseRatePct = rate(metrics.closes, metrics.sits);
    const smoothedCloseRatePct = smoothedRate(metrics.closes, metrics.sits, benchmark.closeRatePct, BAYESIAN_PRIOR_STRENGTH);
    const sitRatePct = smoothedRate(metrics.sits, metrics.totalSets, benchmark.sitRatePct, BAYESIAN_PRIOR_STRENGTH);
    const cancellationDqRatePct = smoothedRate(metrics.cancellationDq, metrics.totalSets, benchmark.cancellationDqRatePct, BAYESIAN_PRIOR_STRENGTH);
    const recentPerformancePct = weightedRecentPerformance(recent7, recent30, benchmark.closeRatePct);
    const momentumPp = round(smoothedRate(recent7.closes, recent7.sits, benchmark.closeRatePct, BAYESIAN_PRIOR_STRENGTH) - smoothedRate(recent30.closes, recent30.sits, benchmark.closeRatePct, BAYESIAN_PRIOR_STRENGTH), 1);
    const centroid = centroidForGroup(group, key);
    const revisitCount = group.filter((appointment) => appointment.resultCategory === "DID_NOT_CLOSE" || appointment.resultCategory === "RESCHEDULED").length;
    return {
      ...metrics,
      key: key.toLowerCase(),
      region: first.region,
      city: first.city ?? "Unknown",
      hood: first.hood,
      street: first.street,
      closeRatePct: smoothedCloseRatePct,
      observedCloseRatePct,
      smoothedCloseRatePct,
      sitRatePct,
      cancellationDqRatePct,
      revisitCount,
      revisitRatePct: rate(revisitCount, metrics.totalSets),
      recentPerformancePct,
      momentumPp,
      daysSinceWorked: daysBetween(lastWorkedDate, anchorDate),
      lastWorkedDate,
      saturationPct: saturation(recent7.totalSets, recent30.totalSets),
      unworkedCapacity: 0,
      confidence: confidenceFor(metrics.totalSets),
      confidenceScore: sampleScore(metrics.totalSets),
      minimumSampleSize: MINIMUM_SAMPLE_SIZE,
      scoreBreakdown: emptyBreakdown(metrics.totalSets),
      opportunityScore: 0,
      deploymentPriority: "LOW" as const,
      latitude: centroid?.latitude ?? null,
      longitude: centroid?.longitude ?? null,
    };
  });
}

function scoreTerritories(rows: TerritorySummary[], benchmark: ReturnType<typeof calculateBenchmark>): TerritorySummary[] {
  const maxSets = rows.reduce((max, row) => Math.max(max, row.totalSets), 0);
  const capacityTarget = Math.max(MINIMUM_SAMPLE_SIZE * 2, Math.ceil(maxSets * 0.75));
  return rows.map((row) => {
    const unworkedCapacity = Math.max(0, capacityTarget - row.totalSets);
    const breakdown = calculateOpportunityScore(row, maxSets, capacityTarget, unworkedCapacity);
    return {
      ...row,
      unworkedCapacity,
      scoreBreakdown: breakdown,
      opportunityScore: breakdown.finalScore,
      deploymentPriority: priority(breakdown.finalScore, breakdown.confidence),
    };
  });
}

function calculateOpportunityScore(row: TerritorySummary, maxSets: number, capacityTarget: number, unworkedCapacity: number): OpportunityScoreBreakdown {
  const components: OpportunityComponent[] = [
    component("recentPerformance", "Recent performance", row.recentPerformancePct * 2, 18, row.recentPerformancePct, `${row.recentPerformancePct.toFixed(1)}% smoothed 7d/30d close performance`, "Blends recent 7-day and 30-day smoothed close rates."),
    component("sampleSize", "Sufficient sample", sampleScore(row.totalSets), 12, row.totalSets, `${row.totalSets} sets; minimum ${MINIMUM_SAMPLE_SIZE}`, row.totalSets >= MINIMUM_SAMPLE_SIZE ? "Meets the minimum sample threshold." : "Below the minimum sample threshold; ranking confidence is reduced."),
    component("closeRate", "Close rate", row.smoothedCloseRatePct * 2, 18, row.smoothedCloseRatePct, `${row.smoothedCloseRatePct.toFixed(1)}% smoothed close rate`, `Bayesian smoothing uses a ${BAYESIAN_PRIOR_STRENGTH}-observation prior.`),
    component("sitRate", "Sit rate", row.sitRatePct, 10, row.sitRatePct, `${row.sitRatePct.toFixed(1)}% smoothed sit rate`, "Rewards territories that turn sets into attended appointments."),
    component("setDensity", "Set density", maxSets > 0 ? (row.totalSets / maxSets) * 100 : 0, 10, row.totalSets, `${row.totalSets} sets relative to the busiest territory`, "Uses observed set volume to estimate field density."),
    component("momentum", "7d vs 30d momentum", clamp(50 + row.momentumPp * 5, 0, 100), 10, row.momentumPp, `${row.momentumPp >= 0 ? "+" : ""}${row.momentumPp.toFixed(1)}pp`, "Compares smoothed 7-day and 30-day close performance."),
    component("cancellationDq", "Low cancellation / DQ", clamp(100 - row.cancellationDqRatePct, 0, 100), 8, row.cancellationDqRatePct, `${row.cancellationDqRatePct.toFixed(1)}% cancellation / DQ`, "Rewards areas with fewer cancellations and DQs."),
    component("daysSinceWorked", "Days since worked", row.daysSinceWorked == null ? 50 : clamp((row.daysSinceWorked / 14) * 100, 0, 100), 5, row.daysSinceWorked, row.daysSinceWorked == null ? "No dated work" : `${row.daysSinceWorked} days`, "Prioritizes territories that have not been worked recently."),
    component("saturation", "Low saturation", row.saturationPct === 0 ? 70 : clamp(100 - row.saturationPct, 0, 100), 4, row.saturationPct, `${row.saturationPct.toFixed(0)}% of expected recent pace`, "Penalizes areas already receiving an unusually dense recent schedule."),
    component("unworkedInventory", "Available / unworked capacity", capacityTarget > 0 ? (unworkedCapacity / capacityTarget) * 100 : 0, 5, unworkedCapacity, `${unworkedCapacity} observed capacity units`, "Capacity proxy until property inventory is connected; property records can replace this input later."),
  ];
  const finalScore = Math.round(components.reduce((sum, item) => sum + item.contribution, 0));
  const confidenceScore = Math.round(clamp((sampleScore(row.totalSets) * 0.8) + (row.lastWorkedDate ? 20 : 0), 0, 100));
  return {
    finalScore,
    confidence: confidenceFor(row.totalSets),
    confidenceScore,
    sampleSize: row.totalSets,
    minimumSampleSize: MINIMUM_SAMPLE_SIZE,
    components,
  };
}

function component(key: string, label: string, score: number, weightPct: number, rawValue: number | null, displayValue: string, explanation: string): OpportunityComponent {
  const boundedScore = round(clamp(score, 0, 100), 1);
  return { key, label, score: boundedScore, weightPct, contribution: round(boundedScore * weightPct / 100, 1), rawValue, displayValue, explanation };
}

function summarizeRep(appointments: NormalizedAppointment[], role: "SETTER" | "CLOSER"): RepSummary[] {
  const groups = new Map<string, NormalizedAppointment[]>();
  for (const appointment of appointments) {
    const name = role === "SETTER" ? appointment.setter : appointment.closer;
    if (!name) continue;
    const group = groups.get(name.toLowerCase()) ?? [];
    group.push(appointment);
    groups.set(name.toLowerCase(), group);
  }
  return [...groups.values()].map((group) => {
    const first = group[0]!;
    const metrics = calculateMetrics(group);
    return {
      ...metrics,
      name: (role === "SETTER" ? first.setter : first.closer)!,
      role,
      closeRatePct: smoothedRate(metrics.closes, metrics.sits, 20, BAYESIAN_PRIOR_STRENGTH),
      territories: [...new Set(group.map((appointment) => appointment.city).filter((city): city is string => Boolean(city)))].sort(),
    };
  }).sort((a, b) => b.closeRatePct - a.closeRatePct || b.closes - a.closes || b.totalSets - a.totalSets);
}

function summarizeMomentum(appointments: NormalizedAppointment[], anchorDate: string | null, benchmark: ReturnType<typeof calculateBenchmark>): MomentumSummary[] {
  if (!anchorDate) return [];
  const groups = groupBy(appointments, (appointment) => territoryKey(appointment.region, appointment.city, appointment.hood));
  const anchor = toUtcDate(anchorDate);
  return [...groups.entries()].map(([key, group]) => {
    const recent7 = calculateMetrics(group.filter((appointment) => inWindow(appointment.appointmentDate, anchor, 7)));
    const recent30 = calculateMetrics(group.filter((appointment) => inWindow(appointment.appointmentDate, anchor, 30)));
    const momentumPp = round(smoothedRate(recent7.closes, recent7.sits, benchmark.closeRatePct, BAYESIAN_PRIOR_STRENGTH) - smoothedRate(recent30.closes, recent30.sits, benchmark.closeRatePct, BAYESIAN_PRIOR_STRENGTH), 1);
    const first = group[0]!;
    const centroid = centroidForGroup(group, key);
    return {
      key,
      region: first.region,
      city: first.city ?? "Unknown",
      hood: first.hood,
      recent7,
      recent30,
      momentumPp,
      direction: momentumPp >= 2 ? "HEATING_UP" : momentumPp <= -2 ? "DECLINING" : "STABLE",
      opportunityScore: 0,
      latitude: centroid?.latitude ?? null,
      longitude: centroid?.longitude ?? null,
    };
  });
}

function buildMapPoints(appointments: NormalizedAppointment[], ranking: TerritorySummary[], momentumByKey: Map<string, MomentumSummary>): MapPoint[] {
  const territories = new Map(ranking.map((row) => [row.key, row]));
  const exact = appointments.filter((appointment) => isValidCoordinate(appointment.latitude, appointment.longitude));
  const points: MapPoint[] = exact.map((appointment) => {
    const key = territoryKey(appointment.region, appointment.city, appointment.hood);
    const territory = territories.get(key);
    const momentum = momentumByKey.get(key);
    const sits = sittingResults.has(appointment.resultCategory) ? 1 : 0;
    const closes = appointment.resultCategory === "CLOSED" ? 1 : 0;
    const cancellationDq = cancellationResults.has(appointment.resultCategory) ? 1 : 0;
    return mapPoint({ key: appointment.id, appointmentId: appointment.id, label: appointment.street ?? appointment.city ?? "Appointment", appointment, latitude: appointment.latitude, longitude: appointment.longitude, coordinateSource: "PROPERTY", territory, momentum, sets: 1, sits, closes, cancellationDq });
  });
  for (const territory of ranking) {
    if (exact.some((appointment) => territoryKey(appointment.region, appointment.city, appointment.hood) === territory.key)) continue;
    const centroid = getCityCentroid(territory.city);
    if (!centroid) continue;
    const offset = stableCoordinateOffset(territory.key);
    points.push(mapPoint({
      key: territory.key,
      appointmentId: null,
      label: territory.hood && territory.hood !== territory.city ? `${territory.city} · ${territory.hood}` : territory.city,
      appointment: null,
      latitude: centroid.latitude + offset.latitude,
      longitude: centroid.longitude + offset.longitude,
      coordinateSource: "CITY_CENTROID",
      territory,
      momentum: momentumByKey.get(territory.key),
      sets: territory.totalSets,
      sits: territory.sits,
      closes: territory.closes,
      cancellationDq: territory.cancellationDq,
    }));
  }
  return points;
}

function mapPoint(input: {
  key: string;
  appointmentId: string | null;
  label: string;
  appointment: NormalizedAppointment | null;
  latitude: number | null;
  longitude: number | null;
  coordinateSource: MapPoint["coordinateSource"];
  territory: TerritorySummary | undefined;
  momentum: MomentumSummary | undefined;
  sets: number;
  sits: number;
  closes: number;
  cancellationDq: number;
}): MapPoint {
  const territory = input.territory;
  const closeRatePct = territory?.closeRatePct ?? rate(input.closes, input.sits);
  const momentumPp = territory?.momentumPp ?? input.momentum?.momentumPp ?? 0;
  const saturationPct = territory?.saturationPct ?? 0;
  const opportunityScore = territory?.opportunityScore ?? 0;
  const confidence = territory?.confidence ?? "LOW";
  return {
    key: input.key,
    appointmentId: input.appointmentId,
    label: input.label,
    region: input.appointment?.region ?? territory?.region ?? "UNKNOWN",
    city: input.appointment?.city ?? territory?.city ?? "Unknown",
    hood: input.appointment?.hood ?? territory?.hood ?? null,
    street: input.appointment?.street ?? null,
    latitude: input.latitude,
    longitude: input.longitude,
    coordinateSource: input.coordinateSource,
    layerValues: {
      SETS: input.sets,
      SITS: input.sits,
      CLOSES: input.closes,
      CANCELLATION_DQ: input.cancellationDq,
      CLOSE_RATE: closeRatePct,
      MOMENTUM_7D: round(50 + momentumPp * 5, 1),
      SATURATION: saturationPct,
      OPPORTUNITY: opportunityScore,
    },
    opportunityScore,
    closes: input.closes,
    sets: input.sets,
    sits: input.sits,
    cancellationDq: input.cancellationDq,
    closeRatePct,
    momentumPp,
    saturationPct,
    confidence,
    direction: input.momentum?.direction ?? (territory && territory.momentumPp >= 2 ? "HEATING_UP" : territory && territory.momentumPp <= -2 ? "DECLINING" : "STABLE"),
  };
}

function buildDeploymentPlan(ranking: TerritorySummary[], momentumByKey: Map<string, MomentumSummary>, anchorDate: string | null, generatedAt: string): DeploymentPlan {
  const eligible = ranking.filter((territory) => territory.totalSets >= MINIMUM_SAMPLE_SIZE);
  const recommendations: DeploymentRecommendation[] = eligible.slice(0, 3).map((territory) => {
    const topComponents = territory.scoreBreakdown.components.filter((item) => item.contribution > 4).sort((a, b) => b.contribution - a.contribution).slice(0, 3);
    const trend = momentumByKey.get(territory.key)?.direction ?? "STABLE";
    return {
      territory,
      suggestedReps: Math.max(1, Math.min(5, Math.ceil(Math.max(1, territory.unworkedCapacity) / REP_CAPACITY_UNITS))),
      reasons: [...topComponents.map((item) => `${item.label}: ${item.displayValue}`), `${territory.confidence} confidence from ${territory.totalSets} sets`],
      confidence: territory.confidence,
      recentTrend: trend,
      unworkedCapacity: territory.unworkedCapacity,
    };
  });
  const avoidCandidates = ranking
    .filter((territory) => !recommendations.some((recommendation) => recommendation.territory.key === territory.key))
    .filter((territory) => territory.cancellationDqRatePct >= 35 || territory.confidence === "LOW" || territory.momentumPp <= -2)
    .sort((a, b) => a.opportunityScore - b.opportunityScore);
  const avoid: DeploymentAvoidance[] = avoidCandidates.slice(0, 3).map((territory) => ({
    territory,
    reason: territory.cancellationDqRatePct >= 35 ? `${territory.cancellationDqRatePct.toFixed(1)}% cancellation / DQ rate` : territory.confidence === "LOW" ? `Only ${territory.totalSets} sets; below the ${MINIMUM_SAMPLE_SIZE}-set threshold` : `Declining ${Math.abs(territory.momentumPp).toFixed(1)}pp momentum`,
    confidence: territory.confidence,
    recentTrend: momentumByKey.get(territory.key)?.direction ?? "STABLE",
  }));
  return {
    generatedAt,
    anchorDate,
    recommendations,
    avoid,
    sourceAppointmentIds: [...new Set([...recommendations, ...avoid].flatMap((item) => item.territory.traceAppointmentIds))],
    methodology: [
      `Rank only territories with at least ${MINIMUM_SAMPLE_SIZE} sets for deployment recommendations.`,
      `Use Bayesian smoothing with a ${BAYESIAN_PRIOR_STRENGTH}-observation prior for close, sit, and cancellation rates.`,
      `Suggested reps use an observed capacity proxy of ${REP_CAPACITY_UNITS} unworked units per rep until property inventory is connected.`,
    ],
  };
}

function centroidForGroup(group: NormalizedAppointment[], key: string): { latitude: number; longitude: number } | null {
  const exact = group.filter((appointment) => isValidCoordinate(appointment.latitude, appointment.longitude));
  if (exact.length > 0) return { latitude: exact.reduce((sum, appointment) => sum + appointment.latitude!, 0) / exact.length, longitude: exact.reduce((sum, appointment) => sum + appointment.longitude!, 0) / exact.length };
  const city = getCityCentroid(group[0]?.city ?? null);
  if (!city) return null;
  const offset = stableCoordinateOffset(key);
  return { latitude: city.latitude + offset.latitude, longitude: city.longitude + offset.longitude };
}

function groupBy(appointments: NormalizedAppointment[], keyer: (appointment: NormalizedAppointment) => string): Map<string, NormalizedAppointment[]> {
  const groups = new Map<string, NormalizedAppointment[]>();
  for (const appointment of appointments) {
    const key = keyer(appointment);
    const group = groups.get(key) ?? [];
    group.push(appointment);
    groups.set(key, group);
  }
  return groups;
}

function metricsWithoutTrace(territory: TerritorySummary): FunnelMetrics {
  return {
    totalSets: territory.totalSets,
    confirmed: territory.confirmed,
    sits: territory.sits,
    closes: territory.closes,
    cancellationDq: territory.cancellationDq,
    didNotClose: territory.didNotClose,
    creditFails: territory.creditFails,
    rescheduled: territory.rescheduled,
    setToClosePct: territory.setToClosePct,
    sitToClosePct: territory.sitToClosePct,
    traceAppointmentIds: territory.traceAppointmentIds,
  };
}

function emptyBreakdown(sampleSize: number): OpportunityScoreBreakdown {
  return { finalScore: 0, confidence: confidenceFor(sampleSize), confidenceScore: sampleScore(sampleSize), sampleSize, minimumSampleSize: MINIMUM_SAMPLE_SIZE, components: [] };
}

function weightedRecentPerformance(recent7: FunnelMetrics, recent30: FunnelMetrics, benchmarkCloseRate: number): number {
  const recent7Rate = smoothedRate(recent7.closes, recent7.sits, benchmarkCloseRate, BAYESIAN_PRIOR_STRENGTH);
  const recent30Rate = smoothedRate(recent30.closes, recent30.sits, benchmarkCloseRate, BAYESIAN_PRIOR_STRENGTH);
  return round(recent7Rate * 0.6 + recent30Rate * 0.4, 1);
}

function saturation(recent7Sets: number, recent30Sets: number): number {
  if (recent7Sets === 0 || recent30Sets === 0) return 0;
  return round((recent7Sets / Math.max(1, recent30Sets * 7 / 30)) * 100, 1);
}

function daysBetween(lastWorkedDate: string | null, anchorDate: string | null): number | null {
  if (!lastWorkedDate || !anchorDate) return null;
  return Math.max(0, Math.round((toUtcDate(anchorDate).getTime() - toUtcDate(lastWorkedDate).getTime()) / 86400000));
}

function confidenceFor(sampleSize: number): ConfidenceLevel {
  return sampleSize >= TARGET_SAMPLE_SIZE ? "HIGH" : sampleSize >= MINIMUM_SAMPLE_SIZE ? "MEDIUM" : "LOW";
}

function sampleScore(sampleSize: number): number {
  return round(clamp((sampleSize / TARGET_SAMPLE_SIZE) * 100, 0, 100), 1);
}

function compareTerritories(a: TerritorySummary, b: TerritorySummary): number {
  const aEligible = a.totalSets >= MINIMUM_SAMPLE_SIZE ? 1 : 0;
  const bEligible = b.totalSets >= MINIMUM_SAMPLE_SIZE ? 1 : 0;
  return bEligible - aEligible || b.opportunityScore - a.opportunityScore || b.confidenceScore - a.confidenceScore || b.closes - a.closes;
}

function compareDrilldownNodes(a: TerritoryDrilldownNode, b: TerritoryDrilldownNode): number {
  return b.opportunityScore - a.opportunityScore || b.metrics.totalSets - a.metrics.totalSets;
}

function priority(score: number, confidence: ConfidenceLevel): TerritorySummary["deploymentPriority"] {
  if (confidence === "LOW") return score >= 55 ? "MEDIUM" : "LOW";
  return score >= 65 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW";
}

function latestDate(appointments: NormalizedAppointment[]): string | null {
  return appointments.map((appointment) => appointment.appointmentDate).filter((date): date is string => Boolean(date)).sort().at(-1) ?? null;
}

function inWindow(value: string | null, anchor: Date, days: number): boolean {
  if (!value) return false;
  const date = toUtcDate(value);
  const start = new Date(anchor);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return date >= start && date <= anchor;
}

function toUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? round((numerator / denominator) * 100, 1) : 0;
}

function smoothedRate(successes: number, trials: number, priorPct: number, priorStrength: number): number {
  return round(((successes + (priorPct / 100) * priorStrength) / (trials + priorStrength)) * 100, 1);
}

function round(value: number, decimals: number): number {
  const power = 10 ** decimals;
  return Math.round(value * power) / power;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
