import {
  MarketEventType,
  type MarketAreaDetail,
  type MarketAreaSummary,
  type MarketCoverageLevel,
  type MarketEventsResponse,
  type MarketEvent,
  type MarketEventCounts,
  type MarketHotspotsResponse,
  type MarketProvenance,
  type MarketOpportunityScoreBreakdown,
  type ScanCenter,
} from "../../contracts/src/index";

export interface MarketDataProvider {
  id: string;
  supports(area: {
    center: ScanCenter;
    radiusMiles: number;
    days?: number;
  }): Promise<boolean>;
  fetchEvents(params: {
    center: ScanCenter;
    radiusMiles: number;
    dateFrom: string | null;
    dateTo: string | null;
  }): Promise<MarketEvent[]>;
}

type FixtureMarketSeed = Omit<MarketAreaDetail, "provenance" | "recentActivity" | "leadOpportunityCounts"> & {
  recentActivity: MarketEvent[];
  leadOpportunityCounts: {
    whales: number;
    highPriority: number;
    total: number;
  };
};

const FIXTURE_PROVIDER_ID = "fixture-market-demo";

const fixtureMarkets: FixtureMarketSeed[] = [
  buildFixtureMarket({
    id: "market-peters-township",
    name: "Peters Township",
    geographyType: "MUNICIPALITY",
    label: "Peters Township, PA",
    currentLocationLabel: "Peters Township, PA",
    centerLatitude: 40.3332,
    centerLongitude: -80.0843,
    radiusMiles: 24,
    marketScore: 92,
    solarMomentumScore: 82,
    solarSaturationScore: 34,
    leadOpportunityCount: 34,
    largePropertyCount: 26,
    highCapacityRoofCount: 23,
    counts: {
      roofPermits: 18,
      solarPermits: 8,
      newConstruction: 11,
      remodel: 6,
      electricalUpgrades: 7,
      evChargers: 4,
      batteries: 2,
      other: 5,
      total: 61,
    },
    coverage: {
      level: "HIGH",
      confidence: 88,
      availableSignals: ["roof permits", "solar permits", "new construction", "electrical upgrades"],
      missingSignals: ["live municipal permit connector"],
      warnings: ["Fixture/demo market signals until live permit connectors are enabled."],
    },
    whyHot: ["Heavy roof activity", "Low solar saturation", "Strong home-value band"],
    scoreBreakdown: {
      roofActivity: 92,
      constructionActivity: 74,
      solarMomentum: 81,
      solarSaturation: 28,
      largePropertyDensity: 84,
      highCapacityRoofDensity: 90,
      propertyValueSignal: 88,
      electricalUpgradeActivity: 67,
      dataConfidence: 88,
    },
    leadOpportunityCounts: { whales: 7, highPriority: 19, total: 34 },
    recentActivity: buildFixtureEvents("market-peters-township", "Peters Township", "PA", "Allegheny", [
      { type: MarketEventType.ROOF_PERMIT, address: "142 Longvue Dr", value: 24500, status: "ISSUED", confidence: 0.92, daysAgo: 3 },
      { type: MarketEventType.SOLAR_PERMIT, address: "29 McMurray Rd", value: 31800, status: "ISSUED", confidence: 0.91, daysAgo: 8 },
      { type: MarketEventType.NEW_CONSTRUCTION, address: "117 Hidden Valley Rd", value: 415000, status: "APPROVED", confidence: 0.88, daysAgo: 12 },
      { type: MarketEventType.ELECTRICAL_UPGRADE, address: "18 Glen Laurel Ct", value: 6200, status: "ISSUED", confidence: 0.85, daysAgo: 17 },
      { type: MarketEventType.REMODEL, address: "211 Crosswinds Dr", value: 16000, status: "PENDING", confidence: 0.76, daysAgo: 25 },
      { type: MarketEventType.EV_CHARGER, address: "510 Broughton Rd", value: 2400, status: "CONFIRMED", confidence: 0.81, daysAgo: 29 },
    ]),
  }),
  buildFixtureMarket({
    id: "market-north-huntingdon",
    name: "North Huntingdon",
    geographyType: "MUNICIPALITY",
    label: "North Huntingdon, PA",
    currentLocationLabel: "North Huntingdon, PA",
    centerLatitude: 40.3234,
    centerLongitude: -79.7301,
    radiusMiles: 24,
    marketScore: 88,
    solarMomentumScore: 77,
    solarSaturationScore: 42,
    leadOpportunityCount: 28,
    largePropertyCount: 20,
    highCapacityRoofCount: 18,
    counts: {
      roofPermits: 16,
      solarPermits: 7,
      newConstruction: 9,
      remodel: 8,
      electricalUpgrades: 9,
      evChargers: 3,
      batteries: 2,
      other: 4,
      total: 58,
    },
    coverage: {
      level: "HIGH",
      confidence: 84,
      availableSignals: ["roof permits", "new construction", "electrical upgrades"],
      missingSignals: ["live parcel feed"],
      warnings: ["Fixture/demo market signals until live permit connectors are enabled."],
    },
    whyHot: ["Active roof replacement", "Consistent new construction", "Good solar adoption signal"],
    scoreBreakdown: {
      roofActivity: 86,
      constructionActivity: 71,
      solarMomentum: 74,
      solarSaturation: 36,
      largePropertyDensity: 72,
      highCapacityRoofDensity: 78,
      propertyValueSignal: 80,
      electricalUpgradeActivity: 73,
      dataConfidence: 84,
    },
    leadOpportunityCounts: { whales: 5, highPriority: 16, total: 28 },
    recentActivity: buildFixtureEvents("market-north-huntingdon", "North Huntingdon", "PA", "Westmoreland", [
      { type: MarketEventType.ROOF_PERMIT, address: "4139 State Rte 30", value: 19400, status: "ISSUED", confidence: 0.89, daysAgo: 2 },
      { type: MarketEventType.NEW_CONSTRUCTION, address: "127 Devonwood Dr", value: 372000, status: "APPROVED", confidence: 0.84, daysAgo: 11 },
      { type: MarketEventType.ELECTRICAL_UPGRADE, address: "6131 Clay Pike", value: 5300, status: "ISSUED", confidence: 0.82, daysAgo: 19 },
      { type: MarketEventType.SOLAR_PERMIT, address: "3492 Route 136", value: 28600, status: "ISSUED", confidence: 0.9, daysAgo: 21 },
      { type: MarketEventType.REMODEL, address: "824 Hahntown Blvd", value: 14100, status: "PENDING", confidence: 0.72, daysAgo: 32 },
    ]),
  }),
  buildFixtureMarket({
    id: "market-hempfield",
    name: "Hempfield Township",
    geographyType: "GRID_CELL",
    label: "Hempfield Township, PA",
    currentLocationLabel: "Hempfield Township, PA",
    centerLatitude: 40.2951,
    centerLongitude: -79.5391,
    radiusMiles: 24,
    marketScore: 84,
    solarMomentumScore: 69,
    solarSaturationScore: 47,
    leadOpportunityCount: 21,
    largePropertyCount: 15,
    highCapacityRoofCount: 14,
    counts: {
      roofPermits: 12,
      solarPermits: 6,
      newConstruction: 8,
      remodel: 9,
      electricalUpgrades: 6,
      evChargers: 3,
      batteries: 1,
      other: 4,
      total: 49,
    },
    coverage: {
      level: "MEDIUM",
      confidence: 72,
      availableSignals: ["roof permits", "new construction", "remodels"],
      missingSignals: ["live utility bill data"],
      warnings: ["Fixture/demo market signals until live permit connectors are enabled."],
    },
    whyHot: ["Balanced roof and remodel activity", "Moderate saturation", "Large home pockets"],
    scoreBreakdown: {
      roofActivity: 76,
      constructionActivity: 62,
      solarMomentum: 64,
      solarSaturation: 44,
      largePropertyDensity: 70,
      highCapacityRoofDensity: 75,
      propertyValueSignal: 68,
      electricalUpgradeActivity: 61,
      dataConfidence: 72,
    },
    leadOpportunityCounts: { whales: 3, highPriority: 12, total: 21 },
    recentActivity: buildFixtureEvents("market-hempfield", "Hempfield Township", "PA", "Westmoreland", [
      { type: MarketEventType.NEW_CONSTRUCTION, address: "214 Coolspring Rd", value: 332000, status: "ISSUED", confidence: 0.83, daysAgo: 4 },
      { type: MarketEventType.ROOF_PERMIT, address: "731 Old Farm Rd", value: 18100, status: "APPROVED", confidence: 0.8, daysAgo: 15 },
      { type: MarketEventType.REMODEL, address: "1586 Lincoln Ave", value: 9200, status: "ISSUED", confidence: 0.79, daysAgo: 26 },
      { type: MarketEventType.ELECTRICAL_UPGRADE, address: "1032 McFarland Rd", value: 4900, status: "ISSUED", confidence: 0.77, daysAgo: 35 },
      { type: MarketEventType.EV_CHARGER, address: "2778 State Route 136", value: 2600, status: "CONFIRMED", confidence: 0.7, daysAgo: 42 },
    ]),
  }),
  buildFixtureMarket({
    id: "market-west-newton",
    name: "West Newton",
    geographyType: "NEIGHBORHOOD",
    label: "West Newton, PA",
    currentLocationLabel: "West Newton, PA",
    centerLatitude: 40.2107,
    centerLongitude: -79.7683,
    radiusMiles: 12,
    marketScore: 81,
    solarMomentumScore: 63,
    solarSaturationScore: 31,
    leadOpportunityCount: 12,
    largePropertyCount: 9,
    highCapacityRoofCount: 8,
    counts: {
      roofPermits: 9,
      solarPermits: 4,
      newConstruction: 4,
      remodel: 5,
      electricalUpgrades: 5,
      evChargers: 2,
      batteries: 1,
      other: 3,
      total: 33,
    },
    coverage: {
      level: "MEDIUM",
      confidence: 68,
      availableSignals: ["roof permits", "solar permits", "remodels"],
      missingSignals: ["live county feed"],
      warnings: ["Fixture/demo market signals until live permit connectors are enabled."],
    },
    whyHot: ["Known field territory", "Low solar saturation", "Accessible walkable density"],
    scoreBreakdown: {
      roofActivity: 65,
      constructionActivity: 48,
      solarMomentum: 60,
      solarSaturation: 30,
      largePropertyDensity: 52,
      highCapacityRoofDensity: 61,
      propertyValueSignal: 55,
      electricalUpgradeActivity: 57,
      dataConfidence: 68,
    },
    leadOpportunityCounts: { whales: 2, highPriority: 7, total: 12 },
    recentActivity: buildFixtureEvents("market-west-newton", "West Newton", "PA", "Westmoreland", [
      { type: MarketEventType.ROOF_PERMIT, address: "104 River Rd", value: 16400, status: "ISSUED", confidence: 0.86, daysAgo: 7 },
      { type: MarketEventType.SOLAR_PERMIT, address: "219 S Water St", value: 26800, status: "ISSUED", confidence: 0.85, daysAgo: 14 },
      { type: MarketEventType.REMODEL, address: "33 Vine St", value: 8100, status: "PENDING", confidence: 0.73, daysAgo: 21 },
      { type: MarketEventType.ELECTRICAL_UPGRADE, address: "16 Grand Ave", value: 4300, status: "ISSUED", confidence: 0.74, daysAgo: 36 },
    ]),
  }),
];

export class FixtureMarketDataProvider implements MarketDataProvider {
  id = FIXTURE_PROVIDER_ID;

  async supports(): Promise<boolean> {
    return true;
  }

  async fetchEvents(params: {
    center: ScanCenter;
    radiusMiles: number;
    dateFrom: string | null;
    dateTo: string | null;
  }): Promise<MarketEvent[]> {
    const areas = this.listHotspots({
      center: params.center,
      radiusMiles: params.radiusMiles,
      days: params.dateFrom && params.dateTo ? daysBetween(params.dateFrom, params.dateTo) : 90,
    });
    return areas.flatMap((area) => this.getArea(area.id)?.recentActivity ?? []);
  }

  listHotspots(params: {
    center: ScanCenter;
    radiusMiles: number;
    days: number;
  }): MarketHotspotsResponse["areas"] {
    const dayFactor = clamp(0.65 + Math.min(0.35, params.days / 300));
    return fixtureMarkets
      .map((market) => {
        const distance = milesBetween(params.center, {
          latitude: market.centerLatitude,
          longitude: market.centerLongitude,
        });
        const score = Math.round((market.marketScore * (1 - Math.min(distance / Math.max(params.radiusMiles, 1) / 2.5, 0.26))) * dayFactor);
        const coverage = adjustCoverage(market.coverage, score);
        return {
          ...market,
          marketScore: score,
          coverage,
          whyHot: [...market.whyHot],
        };
      })
      .filter((market) => milesBetween(params.center, {
        latitude: market.centerLatitude,
        longitude: market.centerLongitude,
      }) <= Math.max(params.radiusMiles * 1.8, 120))
      .sort((left, right) => right.marketScore - left.marketScore);
  }

  getArea(id: string): MarketAreaDetail | null {
    const market = fixtureMarkets.find((entry) => entry.id === id);
    if (!market) return null;
    return {
      ...market,
      provenance: fixtureProvenance(),
    };
  }

  getHotspots(params: {
    center: ScanCenter;
    radiusMiles: number;
    days: number;
  }): MarketHotspotsResponse {
    return {
      center: params.center,
      radiusMiles: params.radiusMiles,
      days: params.days,
      provenance: fixtureProvenance(),
      areas: this.listHotspots(params),
    };
  }

  getEventsPage(
    marketId: string,
    cursor: string | null,
    limit: number,
  ): MarketEventsResponse | null {
    const area = this.getArea(marketId);
    if (!area) {
      return null;
    }
    const start = cursor ? Number.parseInt(cursor, 10) : 0;
    const safeStart = Number.isFinite(start) && start >= 0 ? start : 0;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 50) : 20;
    const results = area.recentActivity.slice(safeStart, safeStart + safeLimit);
    const nextCursorIndex = safeStart + results.length;
    return {
      marketId,
      provenance: fixtureProvenance(),
      results,
      nextCursor: nextCursorIndex < area.recentActivity.length ? String(nextCursorIndex) : null,
      hasMore: nextCursorIndex < area.recentActivity.length,
      totalAvailable: area.recentActivity.length,
    };
  }
}

export function fixtureProvenance(): MarketProvenance {
  return {
    source: "fixture_demo_market_signals",
    isFixture: true,
    fetchedAt: new Date().toISOString(),
    notes: ["Provider-neutral fixture data for UI development only."],
  };
}

function buildFixtureMarket(input: Omit<FixtureMarketSeed, "recentActivity" | "leadOpportunityCounts" | "coverage" | "scoreBreakdown" | "whyHot" | "counts"> & {
  counts: MarketEventCounts;
  coverage: MarketAreaSummary["coverage"];
  whyHot: string[];
  scoreBreakdown: MarketOpportunityScoreBreakdown;
  leadOpportunityCounts: { whales: number; highPriority: number; total: number };
  recentActivity: MarketEvent[];
}): FixtureMarketSeed {
  return {
    ...input,
  } as FixtureMarketSeed;
}

function buildFixtureEvents(
  marketId: string,
  municipality: string,
  state: string,
  county: string,
  items: Array<{
    type: MarketEvent["type"];
    address: string;
    value: number;
    status: string;
    confidence: number;
    daysAgo: number;
  }>,
): MarketEvent[] {
  return items.map((item, index) => ({
    id: `${marketId}-${index + 1}`,
    type: item.type,
    address: item.address,
    municipality,
    county,
    state,
    latitude: null,
    longitude: null,
    issuedDate: isoDaysAgo(item.daysAgo),
    status: item.status,
    estimatedValue: item.value,
    source: FIXTURE_PROVIDER_ID,
    sourceRecordId: `${marketId}-${index + 1}`,
    sourceUrl: null,
    fetchedAt: new Date().toISOString(),
    confidence: item.confidence,
  }));
}

function adjustCoverage(
  coverage: MarketAreaSummary["coverage"],
  score: number,
): MarketAreaSummary["coverage"] {
  const level: MarketCoverageLevel = score >= 80 ? "HIGH" : score >= 65 ? "MEDIUM" : score >= 45 ? "LOW" : "UNAVAILABLE";
  return {
    ...coverage,
    level,
    confidence: Math.max(coverage.confidence - (level === "HIGH" ? 0 : 4), 50),
  };
}

function milesBetween(center: ScanCenter, target: ScanCenter): number {
  const earthRadiusMeters = 6371000;
  const lat1 = (center.latitude * Math.PI) / 180;
  const lat2 = (target.latitude * Math.PI) / 180;
  const dLat = ((target.latitude - center.latitude) * Math.PI) / 180;
  const dLng = ((target.longitude - center.longitude) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const haversine =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return (2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine))) / 1609.344;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function isoDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const diff = toDate.getTime() - fromDate.getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}
