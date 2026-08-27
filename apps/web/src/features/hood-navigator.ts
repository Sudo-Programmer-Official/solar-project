import type { DiscoveryClusterSummary, DiscoveryScanLead, ScanCenter } from "@solar/contracts";
import {
  calculateExpectedOpportunityPerRepHour,
  calculateFieldEfficiencyScore,
  estimateClusterMinutes,
} from "../../../../packages/territory-scoring/src/hood-navigator";

export type OpportunityRouteMode = "BEST_OVERALL" | "HIGHEST_VALUE" | "FASTEST_DENSEST";

export interface NavigatorCluster extends DiscoveryClusterSummary {
  leads: DiscoveryScanLead[];
}

export interface NavigatorRouteStop {
  lead: DiscoveryScanLead;
  clusterId: string;
  sequence: number;
  distanceMilesFromPrevious: number;
}

export interface NavigatorRoute {
  mode: OpportunityRouteMode;
  label: string;
  description: string;
  clusterIds: string[];
  stops: NavigatorRouteStop[];
  distanceMiles: number;
  estimatedMinutes: number;
  highPriorityCount: number;
  whaleCount: number;
  expectedOpportunityPerRepHour: number;
}

const fallbackClusterRadiusMiles = 0.16;

export function buildNavigatorClusters(
  leads: DiscoveryScanLead[],
  sourceClusters: DiscoveryClusterSummary[] | undefined,
  scanCenter: ScanCenter,
): NavigatorCluster[] {
  if (sourceClusters && sourceClusters.length > 0) {
    return sourceClusters.map((cluster) => ({
      ...cluster,
      clusterId: cluster.clusterId ?? cluster.id,
      leads: leads.filter((lead) => (lead.clusterId ?? "") === (cluster.clusterId ?? cluster.id)),
    }));
  }

  const grouped = new Map<string, DiscoveryScanLead[]>();
  for (const lead of leads) {
    const key = lead.clusterId ?? fallbackClusterKey(lead, scanCenter);
    const group = grouped.get(key) ?? [];
    group.push(lead);
    grouped.set(key, group);
  }
  return [...grouped.entries()].map(([clusterId, clusterLeads]) => {
    const center = centroid(clusterLeads, scanCenter);
    const strongLeadCount = clusterLeads.filter((lead) => lead.opportunityScore >= 70).length;
    const whaleCount = clusterLeads.filter((lead) => lead.whaleScore >= 60).length;
    const averageOpportunityScore = average(clusterLeads.map((lead) => lead.opportunityScore));
    const averageCapacityKw = averageNullable(clusterLeads.map((lead) => lead.maxRoofSolarCapacityKw));
    const densityScore = Math.min(100, Math.round((clusterLeads.length / 10) * 100));
    const routeEfficiencyScore = Math.max(0, Math.round(100 - (distanceMiles(center, scanCenter) / Math.max(0.25, 1)) * 100));
    const fieldEfficiencyScore = calculateFieldEfficiencyScore({
      leadDensity: densityScore,
      doorToDoorDistance: routeEfficiencyScore,
      routeCompactness: routeEfficiencyScore,
      roadAccessibility: 75,
      terrainScore: 75,
      strongLeadDensity: clusterLeads.length > 0 ? (strongLeadCount / clusterLeads.length) * 100 : 0,
      historicalFieldOutcome: 75,
    }).score;
    const id = `local-${clusterId}`;
    return {
      id,
      clusterId: id,
      center,
      candidateCount: clusterLeads.length,
      propertyCount: clusterLeads.length,
      strongLeadCount,
      whaleCount,
      averageSolarScore: average(clusterLeads.map((lead) => lead.solarFitScore)),
      averageOpportunityScore,
      averageCapacityKw,
      densityScore,
      routeEfficiencyScore,
      terrainScore: 75,
      estimatedMinutes: estimateClusterMinutes({
        propertyCount: clusterLeads.length,
        distanceMilesFromStart: distanceMiles(center, scanCenter),
        intraClusterMiles: fallbackClusterRadiusMiles,
      }),
      fieldEfficiencyScore,
      fieldPriorityScore: Math.round(averageOpportunityScore * 0.7 + fieldEfficiencyScore * 0.3),
      leads: clusterLeads,
    };
  });
}

export function buildNavigatorRoutes(
  clusters: NavigatorCluster[],
  currentLocation: ScanCenter,
  doorTimeMinutes = 2.5,
  preferredClusterId?: string,
): NavigatorRoute[] {
  return [
    routeForMode("BEST_OVERALL", "Best Overall", "Balanced value, density, and movement.", clusters, currentLocation, doorTimeMinutes, preferredClusterId),
    routeForMode("HIGHEST_VALUE", "Highest Value", "Prioritizes strong opportunity and whale candidates.", clusters, currentLocation, doorTimeMinutes, preferredClusterId),
    routeForMode("FASTEST_DENSEST", "Fastest / Densest", "Keeps the walk compact and starts with the densest pocket.", clusters, currentLocation, doorTimeMinutes, preferredClusterId),
  ];
}

function routeForMode(
  mode: OpportunityRouteMode,
  label: string,
  description: string,
  clusters: NavigatorCluster[],
  currentLocation: ScanCenter,
  doorTimeMinutes: number,
  preferredClusterId?: string,
): NavigatorRoute {
  const remaining = new Set(clusters.map((cluster) => cluster.clusterId));
  const orderedClusters: NavigatorCluster[] = [];
  let cursor = currentLocation;

  while (remaining.size > 0) {
    const candidates = clusters.filter((cluster) => remaining.has(cluster.clusterId));
    const preferred = orderedClusters.length === 0 && preferredClusterId
      ? candidates.find((cluster) => cluster.clusterId === preferredClusterId)
      : undefined;
    const next = preferred ?? [...candidates].sort((left, right) => routeClusterScore(right, mode, cursor) - routeClusterScore(left, mode, cursor))[0];
    if (!next) break;
    orderedClusters.push(next);
    remaining.delete(next.clusterId);
    cursor = next.center;
  }

  const stops: NavigatorRouteStop[] = [];
  let previous: ScanCenter = currentLocation;
  for (const cluster of orderedClusters) {
    for (const lead of orderLeads(cluster.leads, cluster.center)) {
      if (lead.latitude == null || lead.longitude == null) continue;
      const point = { latitude: lead.latitude, longitude: lead.longitude };
      stops.push({
        lead,
        clusterId: cluster.clusterId,
        sequence: stops.length + 1,
        distanceMilesFromPrevious: round(distanceMiles(previous, point), 1),
      });
      previous = point;
    }
  }

  const distance = round(stops.reduce((sum, stop) => sum + stop.distanceMilesFromPrevious, 0), 1);
  const estimatedMinutes = Math.max(
    1,
    Math.round(distance * 2.5 + stops.length * doorTimeMinutes),
  );
  const averageOpportunityScore = average(stops.map((stop) => stop.lead.opportunityScore));
  const fieldEfficiencyScore = average(orderedClusters.map((cluster) => cluster.fieldEfficiencyScore));
  return {
    mode,
    label,
    description,
    clusterIds: orderedClusters.map((cluster) => cluster.clusterId),
    stops,
    distanceMiles: distance,
    estimatedMinutes,
    highPriorityCount: stops.filter((stop) => stop.lead.opportunityScore >= 70).length,
    whaleCount: stops.filter((stop) => stop.lead.whaleScore >= 60).length,
    expectedOpportunityPerRepHour: calculateExpectedOpportunityPerRepHour({
      averageOpportunityScore,
      fieldEfficiencyScore,
      propertyCount: stops.length,
      estimatedMinutes,
    }),
  };
}

function routeClusterScore(cluster: NavigatorCluster, mode: OpportunityRouteMode, cursor: ScanCenter): number {
  const distancePenalty = distanceMiles(cursor, cluster.center) * 18;
  if (mode === "HIGHEST_VALUE") {
    return cluster.averageOpportunityScore * 0.7 + cluster.whaleCount * 8 + (cluster.averageCapacityKw ?? 0) * 0.7 - distancePenalty * 0.35;
  }
  if (mode === "FASTEST_DENSEST") {
    return cluster.densityScore * 0.55 + cluster.routeEfficiencyScore * 0.3 + cluster.strongLeadCount * 2 - cluster.estimatedMinutes * 0.15 - distancePenalty;
  }
  return cluster.fieldPriorityScore * 0.8 + cluster.fieldEfficiencyScore * 0.2 - distancePenalty;
}

function orderLeads(leads: DiscoveryScanLead[], start: ScanCenter): DiscoveryScanLead[] {
  const remaining = leads.filter((lead) => lead.latitude != null && lead.longitude != null).slice();
  const ordered: DiscoveryScanLead[] = [];
  let cursor = start;
  while (remaining.length > 0) {
    remaining.sort((left, right) => distanceMiles(cursor, pointOf(right)) - distanceMiles(cursor, pointOf(left)));
    const next = remaining.pop();
    if (!next) break;
    ordered.push(next);
    cursor = pointOf(next);
  }
  return ordered;
}

function pointOf(lead: DiscoveryScanLead): ScanCenter {
  return { latitude: lead.latitude ?? 0, longitude: lead.longitude ?? 0 };
}

function centroid(leads: DiscoveryScanLead[], fallback: ScanCenter): ScanCenter {
  const points = leads.filter((lead) => lead.latitude != null && lead.longitude != null);
  return points.length > 0
    ? {
        latitude: average(points.map((lead) => lead.latitude ?? fallback.latitude)),
        longitude: average(points.map((lead) => lead.longitude ?? fallback.longitude)),
      }
    : fallback;
}

function fallbackClusterKey(lead: DiscoveryScanLead, center: ScanCenter): string {
  const lat = Math.round(((lead.latitude ?? center.latitude) - center.latitude) / 0.002);
  const lng = Math.round(((lead.longitude ?? center.longitude) - center.longitude) / 0.002);
  return `${lat}:${lng}`;
}

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function averageNullable(values: Array<number | null | undefined>): number | null {
  const available = values.filter((value): value is number => value != null && Number.isFinite(value));
  return available.length > 0 ? round(average(available), 1) : null;
}

function distanceMiles(left: ScanCenter, right: ScanCenter): number {
  const lat = (right.latitude - left.latitude) * 69;
  const lng = (right.longitude - left.longitude) * 69 * Math.cos((left.latitude * Math.PI) / 180);
  return Math.sqrt(lat * lat + lng * lng);
}

function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
