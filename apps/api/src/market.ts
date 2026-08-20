import type {
  MarketAreaDetail,
  MarketAreaSummary,
  MarketEventsResponse,
  MarketHotspotsResponse,
  MarketProvenance,
  ScanCenter,
} from "../../../packages/contracts/src/index";
import { FixtureMarketDataProvider, fixtureProvenance } from "../../../packages/permit-connectors/src/index";

const provider = new FixtureMarketDataProvider();

export async function getMarketHotspots(input: {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  days: number;
}): Promise<MarketHotspotsResponse> {
  return provider.getHotspots({
    center: { latitude: input.latitude, longitude: input.longitude },
    radiusMiles: input.radiusMiles,
    days: input.days,
  });
}

export async function getMarketArea(id: string): Promise<MarketAreaDetail | null> {
  return provider.getArea(id);
}

export async function getMarketEvents(
  marketId: string,
  cursor: string | null,
  limit: number,
): Promise<MarketEventsResponse | null> {
  return provider.getEventsPage(marketId, cursor, limit);
}

export function getMarketProvenance(): MarketProvenance {
  return fixtureProvenance();
}

export function isMarketAreaSummary(area: MarketAreaSummary): area is MarketAreaSummary {
  return Boolean(area.id && area.name);
}

export function normalizeMarketCenter(latitude: number, longitude: number): ScanCenter {
  return { latitude, longitude };
}
