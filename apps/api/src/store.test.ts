import assert from "node:assert/strict";
import test from "node:test";
import fixture from "../../../packages/solar-api/test-fixtures/google-building-insights.json" assert { type: "json" };
import { InMemorySolarRepository } from "../../../packages/database/src/repository";
import {
  analyzeProperty,
  createRoute,
  getDiscoveryScanResultsPage,
  getDealBrief,
  getLeadOutcomes,
  getPropertyDetail,
  getRevenueCommandCenter,
  getRouteNext,
  getTodayDashboard,
  scanDiscovery,
  updateLeadOutcome,
  updatePropertyVisualSignals,
} from "./store";
import { GoogleMapsGeocoder } from "../../../packages/geospatial/src/google-geocoder";
import { GoogleSolarDataProvider } from "../../../packages/solar-api/src/providers/google-solar.provider";
import type { PropertySignal, RoofSegment } from "../../../packages/contracts/src/index";

class RecordingRepository extends InMemorySolarRepository {
  public readonly roofSegmentsByAssessment = new Map<string, RoofSegment[]>();

  override async replaceRoofSegments(solarAssessmentId: string, segments: RoofSegment[]): Promise<RoofSegment[]> {
    this.roofSegmentsByAssessment.set(solarAssessmentId, segments);
    return super.replaceRoofSegments(solarAssessmentId, segments);
  }
}

function createGeocoder(latitude: number, longitude: number) {
  return new GoogleMapsGeocoder({
    apiKey: "test-key",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          status: "OK",
          results: [
            {
              formatted_address: "308 Baughman St, West Newton, PA 15089, USA",
              place_id: "place-123",
              geometry: {
                location: { lat: latitude, lng: longitude },
                location_type: "ROOFTOP",
              },
              partial_match: false,
            },
          ],
        }),
        { status: 200 },
      ),
  });
}

function createSolarProvider(counter?: { count: number }) {
  return new GoogleSolarDataProvider({
    apiKey: "test-key",
    fetchImpl: async () => {
      if (counter) {
        counter.count += 1;
      }
      return new Response(JSON.stringify(fixture), { status: 200 });
    },
  });
}

test("analyzeProperty persists roof segments and computes a solar fit score from real-shaped data", async () => {
  const repository = new RecordingRepository();
  let geocodeFetchCount = 0;
  let solarFetchCount = 0;
  const geocoder = new GoogleMapsGeocoder({
    apiKey: "test-key",
    fetchImpl: async () => {
      geocodeFetchCount += 1;
      return new Response(
        JSON.stringify({
          status: "OK",
          results: [
            {
              formatted_address: "308 Baughman St, West Newton, PA 15089, USA",
              place_id: "place-123",
              geometry: {
                location: { lat: 40.211, lng: -79.768 },
                location_type: "ROOFTOP",
              },
              partial_match: false,
            },
          ],
        }),
        { status: 200 },
      );
    },
  });
  const solarProvider = new GoogleSolarDataProvider({
    apiKey: "test-key",
    fetchImpl: async () => {
      solarFetchCount += 1;
      return new Response(
        JSON.stringify(fixture),
        { status: 200 },
      );
    },
  });

  const firstResult = await analyzeProperty(
    {
      address: "308 Baughman St, West Newton, PA",
      municipality: "West Newton",
      county: "Westmoreland",
      state: "PA",
      postalCode: "15089",
    },
    repository,
    { geocoder, solarProvider },
  );

  const secondResult = await analyzeProperty(
    {
      address: "308 Baughman St, West Newton, PA",
      municipality: "West Newton",
      county: "Westmoreland",
      state: "PA",
      postalCode: "15089",
    },
    repository,
    { geocoder, solarProvider },
  );

  assert.equal(firstResult.property.normalizedAddress, "308 BAUGHMAN ST, WEST NEWTON, PA");
  assert.equal(firstResult.solarAssessment.provider, "google_solar");
  assert.equal(firstResult.solarAssessment.solarFitScore >= 60, true);
  assert.equal(firstResult.audit.distanceMeters != null && firstResult.audit.distanceMeters > 0, true);
  assert.equal(firstResult.audit.detectedArrayStatus, "DETECTED");
  assert.equal(firstResult.audit.selectedProductionConfig?.panelsCount, 28);
  assert.equal(firstResult.scoreBreakdown.components.some((component) => component.name === "sunlight"), true);
  assert.equal(firstResult.warnings.includes("Existing solar appears to be present at the property."), true);
  assert.equal(firstResult.reasons.some((reason) => reason.includes("Estimated array size")), true);
  assert.equal(repository.roofSegmentsByAssessment.get(firstResult.solarAssessment.id)?.length, 1);
  assert.equal(secondResult.solarAssessment.id, firstResult.solarAssessment.id);
  assert.equal(geocodeFetchCount, 1);
  assert.equal(solarFetchCount, 1);
});

test("analyzeProperty reduces confidence when roof and imagery inputs are missing", async () => {
  const repository = new InMemorySolarRepository();
  const geocoder = new GoogleMapsGeocoder({
    apiKey: "test-key",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          status: "OK",
          results: [
            {
              formatted_address: "123 Example St, Example, PA 00000, USA",
              place_id: "place-456",
              geometry: {
                location: { lat: 40.0, lng: -79.0 },
                location_type: "ROOFTOP",
              },
            },
          ],
        }),
        { status: 200 },
      ),
  });
  const solarProvider = new GoogleSolarDataProvider({
    apiKey: "test-key",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          version: "v1",
          imageryQuality: "MEDIUM",
          roofAreaMeters2: 80,
          solarPotential: {
            maxArrayAreaMeters2: 60,
            maxArrayPanelsCount: 12,
            panelCapacityWatts: 420,
            maxSunshineHoursPerYear: 1210,
            solarPanelConfigs: [
              {
                panelsCount: 12,
                yearlyEnergyDcKwh: 4800,
              },
            ],
          },
          wholeRoofStats: [],
          buildingStats: [],
        }),
        { status: 200 },
      ),
  });

  const result = await analyzeProperty(
    {
      address: "123 Example St, Example, PA",
      municipality: "Example",
      county: "Example",
      state: "PA",
      postalCode: "00000",
    },
    repository,
    { geocoder, solarProvider },
  );

  assert.equal(result.audit.missingFields.includes("imageryDate"), true);
  assert.equal(result.audit.missingFields.includes("roofSegmentStats"), true);
  assert.equal(result.scoreBreakdown.confidence < 100, true);
  assert.equal(result.audit.warnings.includes("MISSING_IMAGERY_DATE"), true);
  assert.equal(result.audit.warnings.includes("ROOF_SEGMENTS_UNAVAILABLE"), true);
});

test("property detail surfaces pool signals, prompts, and homeowner confirmations", async () => {
  const repository = new InMemorySolarRepository();
  const geocoder = new GoogleMapsGeocoder({
    apiKey: "test-key",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          status: "OK",
          results: [
            {
              formatted_address: "512 Poolside Dr, Demo, PA 00000, USA",
              place_id: "place-pool",
              geometry: {
                location: { lat: 40.4, lng: -79.4 },
                location_type: "ROOFTOP",
              },
            },
          ],
        }),
        { status: 200 },
      ),
  });
  const solarProvider = new GoogleSolarDataProvider({
    apiKey: "test-key",
    fetchImpl: async () =>
      new Response(JSON.stringify(fixture), { status: 200 }),
  });

  const analyzed = await analyzeProperty(
    {
      address: "512 Poolside Dr, Demo, PA",
      municipality: "Demo",
      county: "Demo",
      state: "PA",
      postalCode: "00000",
    },
    repository,
    { geocoder, solarProvider },
  );

  const propertySignal: PropertySignal = {
    id: "signal-pool",
    propertyId: analyzed.property.id,
    signalType: "POOL_VISIBLE",
    source: "FIELD_REP",
    valueJson: { observed: true },
    confidence: 0.9,
    observedAt: new Date().toISOString(),
    expiresAt: null,
  };
  await repository.replacePropertySignals(analyzed.property.id, [propertySignal]);

  const withPool = await getPropertyDetail(analyzed.property.id, repository);
  assert.equal(withPool?.visualSignals.some((signal) => signal.type === "POOL" && signal.status === "DETECTED"), true);
  assert.equal(withPool?.conversationInsights.some((insight) => insight.title === "Ask about pool usage"), true);
  assert.equal(withPool?.conversationInsights.some((insight) => insight.verified), false);

  const updated = await updatePropertyVisualSignals(
    analyzed.property.id,
    {
      poolHeated: "YES",
      highSummerBill: "NO",
      poolEquipmentIncreasesUsage: "UNKNOWN",
    },
    repository,
  );

  assert.equal(updated?.homeownerConfirmations.poolHeated, "YES");
  assert.equal(updated?.homeownerConfirmations.highSummerBill, "NO");
  assert.equal(updated?.conversationInsights.some((insight) => insight.verified), true);

  const stored = await getPropertyDetail(analyzed.property.id, repository);
  assert.equal(stored?.homeownerConfirmations.poolHeated, "YES");
  assert.equal(stored?.visualSignals.some((signal) => signal.type === "POOL" && signal.origin === "HOMEOWNER_CONFIRMED"), true);
});

test("discovery pool filter narrows to detected pool properties", async () => {
  const repository = new InMemorySolarRepository();
  const geocoder = new GoogleMapsGeocoder({
    apiKey: "test-key",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          status: "OK",
          results: [
            {
              formatted_address: "100 Pool Ave, Demo, PA 00000, USA",
              place_id: "place-pool-a",
              geometry: {
                location: { lat: 40.41, lng: -79.41 },
                location_type: "ROOFTOP",
              },
            },
          ],
        }),
        { status: 200 },
      ),
  });
  const solarProvider = new GoogleSolarDataProvider({
    apiKey: "test-key",
    fetchImpl: async () =>
      new Response(JSON.stringify(fixture), { status: 200 }),
  });

  const poolLead = await analyzeProperty(
    {
      address: "100 Pool Ave, Demo, PA",
      municipality: "Demo",
      county: "Demo",
      state: "PA",
      postalCode: "00000",
    },
    repository,
    { geocoder, solarProvider },
  );
  await repository.replacePropertySignals(poolLead.property.id, [
    {
      id: "pool-signal",
      propertyId: poolLead.property.id,
      signalType: "POOL_VISIBLE",
      source: "FIELD_REP",
      valueJson: { observed: true },
      confidence: 0.95,
      observedAt: new Date().toISOString(),
      expiresAt: null,
    },
  ]);

  const noPoolLead = await analyzeProperty(
    {
      address: "101 Plain Ave, Demo, PA",
      municipality: "Demo",
      county: "Demo",
      state: "PA",
      postalCode: "00001",
    },
    repository,
    {
      geocoder: new GoogleMapsGeocoder({
        apiKey: "test-key",
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              status: "OK",
              results: [
                {
                  formatted_address: "101 Plain Ave, Demo, PA 00001, USA",
                  place_id: "place-pool-b",
                  geometry: {
                    location: { lat: 40.4105, lng: -79.4105 },
                    location_type: "ROOFTOP",
                  },
                },
              ],
            }),
            { status: 200 },
          ),
      }),
      solarProvider,
    },
  );

  const unfiltered = await scanDiscovery(
    {
      latitude: 40.41,
      longitude: -79.41,
      radiusMiles: 5,
      filters: {},
      limit: 25,
      maxGoogleSolarCalls: 0,
    },
    repository,
    { geocoder, solarProvider },
  );
  const poolOnly = await scanDiscovery(
    {
      latitude: 40.41,
      longitude: -79.41,
      radiusMiles: 5,
      filters: { poolDetected: true },
      limit: 25,
      maxGoogleSolarCalls: 0,
    },
    repository,
    { geocoder, solarProvider },
  );

  assert.equal(unfiltered.results.length >= 2, true);
  assert.equal(poolOnly.results.length, 1);
  assert.equal(poolOnly.results[0]?.propertyId, poolLead.property.id);
  assert.equal(poolOnly.results[0]?.visualSignals?.some((signal) => signal.type === "POOL" && signal.status === "DETECTED"), true);
  assert.equal(poolOnly.results[0]?.visualSignals?.every((signal) => signal.type !== "POOL" || signal.status === "DETECTED"), true);
  assert.equal(noPoolLead.property.id !== poolOnly.results[0]?.propertyId, true);
});

test("lead outcomes persist across dashboard refreshes", async () => {
  const repository = new InMemorySolarRepository();
  const geocoder = new GoogleMapsGeocoder({
    apiKey: "test-key",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          status: "OK",
          results: [
            {
              formatted_address: "55 Demo St, Demo, PA 00000, USA",
              place_id: "place-789",
              geometry: {
                location: { lat: 40.1, lng: -79.2 },
                location_type: "ROOFTOP",
              },
            },
          ],
        }),
        { status: 200 },
      ),
  });
  const solarProvider = new GoogleSolarDataProvider({
    apiKey: "test-key",
    fetchImpl: async () =>
      new Response(
        JSON.stringify(fixture),
        { status: 200 },
      ),
  });

  const analysis = await analyzeProperty(
    {
      address: "55 Demo St, Demo, PA",
      municipality: "Demo",
      county: "Demo",
      state: "PA",
      postalCode: "00000",
    },
    repository,
    { geocoder, solarProvider },
  );

  const saved = await updateLeadOutcome(analysis.property.id, "NOT_HOME", "Left a card", repository);
  assert.equal(saved?.outcome, "NOT_HOME");

  const dashboard = await getTodayDashboard(repository);
  const lead = dashboard.leads.find((item) => item.propertyId === analysis.property.id);
  assert.equal(lead?.outcome, "NOT_HOME");
});

test("lead outcomes endpoint returns persisted dispositions only", async () => {
  const repository = new InMemorySolarRepository();
  const geocoder = new GoogleMapsGeocoder({
    apiKey: "test-key",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          status: "OK",
          results: [
            {
              formatted_address: "77 Queue Ave, Demo, PA 00000, USA",
              place_id: "place-777",
              geometry: {
                location: { lat: 40.3, lng: -79.4 },
                location_type: "ROOFTOP",
              },
            },
          ],
        }),
        { status: 200 },
      ),
  });
  const solarProvider = new GoogleSolarDataProvider({
    apiKey: "test-key",
    fetchImpl: async () =>
      new Response(
        JSON.stringify(fixture),
        { status: 200 },
      ),
  });

  const analysis = await analyzeProperty(
    {
      address: "77 Queue Ave, Demo, PA",
      municipality: "Demo",
      county: "Demo",
      state: "PA",
      postalCode: "00000",
    },
    repository,
    { geocoder, solarProvider },
  );

  const saved = await updateLeadOutcome(analysis.property.id, "SAVED", null, repository);
  assert.equal(saved?.outcome, "SAVED");
  assert.equal(typeof saved?.updatedAt, "string");

  const leads = await getLeadOutcomes(repository, { outcome: "SAVED" });
  assert.equal(leads.length, 1);
  assert.equal(leads[0]?.propertyId, analysis.property.id);
  assert.equal(leads[0]?.outcome, "SAVED");
  assert.equal(typeof leads[0]?.updatedAt, "string");
});

test("command center and deal brief expose next best action and revenue metrics", async () => {
  const repository = new InMemorySolarRepository();
  const geocoder = new GoogleMapsGeocoder({
    apiKey: "test-key",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          status: "OK",
          results: [
            {
              formatted_address: "308 Baughman St, West Newton, PA 15089, USA",
              place_id: "place-123",
              geometry: {
                location: { lat: 40.211, lng: -79.768 },
                location_type: "ROOFTOP",
              },
            },
          ],
        }),
        { status: 200 },
      ),
  });
  const solarProvider = new GoogleSolarDataProvider({
    apiKey: "test-key",
    fetchImpl: async () =>
      new Response(
        JSON.stringify(fixture),
        { status: 200 },
      ),
  });

  const analysis = await analyzeProperty(
    {
      address: "308 Baughman St, West Newton, PA",
      municipality: "West Newton",
      county: "Westmoreland",
      state: "PA",
      postalCode: "15089",
    },
    repository,
    { geocoder, solarProvider },
  );

  const brief = await getDealBrief(analysis.property.id, repository);
  const commandCenter = await getRevenueCommandCenter(repository);

  assert.equal((brief?.nextBestAction.label?.length ?? 0) > 0, true);
  assert.equal((brief?.consultantRecommendation?.length ?? 0) > 0, true);
  assert.equal(commandCenter.pipelineValue > 0, true);
  assert.equal(commandCenter.nextActions.length > 0, true);
  assert.equal(commandCenter.topTerritory.length > 0, true);
});

test("discovery scan scales from 5 to 10 to 20 miles", async () => {
  const repository = new InMemorySolarRepository();
  const scan5 = await scanDiscovery(
    {
      latitude: 40.2108,
      longitude: -79.7665,
      radiusMiles: 5,
      filters: {},
      limit: 50,
      maxGoogleSolarCalls: 0,
    },
    repository,
  );
  const scan10 = await scanDiscovery(
    {
      latitude: 40.2108,
      longitude: -79.7665,
      radiusMiles: 10,
      filters: {},
      limit: 50,
      maxGoogleSolarCalls: 0,
    },
    repository,
  );
  const scan20 = await scanDiscovery(
    {
      latitude: 40.2108,
      longitude: -79.7665,
      radiusMiles: 20,
      filters: {},
      limit: 50,
      maxGoogleSolarCalls: 0,
    },
    repository,
  );

  assert.equal(scan5.radiusMiles, 5);
  assert.equal(scan10.radiusMiles, 10);
  assert.equal(scan20.radiusMiles, 20);
  assert.equal(scan5.candidateCount <= scan10.candidateCount, true);
  assert.equal(scan10.candidateCount <= scan20.candidateCount, true);
  assert.equal(scan20.results.length >= scan10.results.length, true);
});

test("discovery paginates uniquely and excludes obvious commercial properties", async () => {
  const repository = new InMemorySolarRepository();
  const baseLatitude = 40.0;
  const baseLongitude = -79.0;

  for (let index = 0; index < 25; index += 1) {
    const offset = index * 0.001;
    await repository.upsertProperty({
      id: `res-${index}`,
      normalizedAddress: `10${index} Example St, Example, PA`,
      street: `10${index} Example St`,
      city: "Example",
      county: "Example",
      state: "PA",
      postalCode: `16${String(index).padStart(3, "0")}`,
      latitude: baseLatitude + offset,
      longitude: baseLongitude + offset,
      parcelId: `parcel-${index}`,
      municipality: "Example",
      createdAt: new Date().toISOString(),
    });
  }

  await repository.upsertProperty({
    id: "res-duplicate-a",
    normalizedAddress: "500 Duplicate Ave, Example, PA",
    street: "500 Duplicate Ave",
    city: "Example",
    county: "Example",
    state: "PA",
    postalCode: "16000",
    latitude: baseLatitude + 0.012,
    longitude: baseLongitude + 0.012,
    parcelId: "parcel-duplicate",
    municipality: "Example",
    createdAt: new Date().toISOString(),
  });
  await repository.upsertProperty({
    id: "res-duplicate-b",
    normalizedAddress: "500 Duplicate Ave, Example, PA",
    street: "500 Duplicate Ave",
    city: "Example",
    county: "Example",
    state: "PA",
    postalCode: "16000",
    latitude: baseLatitude + 0.012,
    longitude: baseLongitude + 0.012,
    parcelId: "parcel-duplicate",
    municipality: "Example",
    createdAt: new Date().toISOString(),
  });
  await repository.upsertProperty({
    id: "commercial-1",
    normalizedAddress: "1 Convention Center Dr, Example, PA",
    street: "1 Convention Center Dr",
    city: "Example",
    county: "Example",
    state: "PA",
    postalCode: "16001",
    latitude: baseLatitude + 0.013,
    longitude: baseLongitude + 0.013,
    parcelId: "parcel-commercial",
    municipality: "Example",
    createdAt: new Date().toISOString(),
  });

  const scan = await scanDiscovery(
    {
      latitude: baseLatitude,
      longitude: baseLongitude,
      radiusMiles: 5,
      filters: {},
      limit: 50,
      maxGoogleSolarCalls: 0,
    },
    repository,
  );

  const firstPage = getDiscoveryScanResultsPage(scan.scanId, null, 20);
  const secondPage = firstPage?.nextCursor ? getDiscoveryScanResultsPage(scan.scanId, firstPage.nextCursor, 20) : null;

  assert.equal(scan.results.length, 25);
  assert.equal(firstPage?.results.length, 20);
  assert.equal(firstPage?.hasMore, true);
  assert.equal(firstPage?.totalAvailable, 25);
  assert.equal(secondPage?.results.length, 5);
  assert.equal(secondPage?.hasMore, false);
  assert.equal(secondPage?.totalAvailable, 25);
  assert.equal(
    [...(firstPage?.results ?? []), ...(secondPage?.results ?? [])].some((lead) =>
      lead.address.toLowerCase().includes("convention center"),
    ),
    false,
  );
  assert.equal(
    new Set([...(firstPage?.results ?? []), ...(secondPage?.results ?? [])].map((lead) => lead.propertyId ?? lead.id)).size,
    25,
  );
});

test("discovery respects the Google Solar call limit", async () => {
  const repository = new InMemorySolarRepository();
  const counter = { count: 0 };
  const scan = await scanDiscovery(
    {
      latitude: 40.2108,
      longitude: -79.7665,
      radiusMiles: 20,
      filters: {},
      limit: 10,
      maxGoogleSolarCalls: 2,
    },
    repository,
    {
      geocoder: createGeocoder(40.211, -79.768),
      solarProvider: createSolarProvider(counter),
    },
  );

  assert.equal(counter.count <= 2, true);
  assert.equal(scan.googleSolarCalls <= 2, true);
  assert.equal(scan.results.length > 0, true);
});

test("route creation uses nearest-neighbor ordering and advances after outcomes", async () => {
  const repository = new InMemorySolarRepository();
  const scan = await scanDiscovery(
    {
      latitude: 40.2108,
      longitude: -79.7665,
      radiusMiles: 20,
      filters: {},
      limit: 5,
      maxGoogleSolarCalls: 0,
    },
    repository,
  );

  const selectedPropertyIds = scan.results.slice(0, 3).map((lead) => lead.propertyId ?? lead.id);
  const route = await createRoute(
    {
      startingLatitude: 40.2108,
      startingLongitude: -79.7665,
      selectedPropertyIds,
    },
    repository,
  );
  const firstNext = await getRouteNext(route.id, repository);
  assert.equal(firstNext?.currentStop?.propertyId, route.stops[0]?.propertyId);
  assert.equal(firstNext?.remainingCount, route.stops.length);

  if (firstNext?.currentStop) {
    await updateLeadOutcome(firstNext.currentStop.propertyId, "NOT_HOME", "Skipped at the door", repository);
  }

  const secondNext = await getRouteNext(route.id, repository);
  assert.equal((secondNext?.completedCount ?? 0) >= 1, true);
  assert.equal((secondNext?.remainingCount ?? 0) < (firstNext?.remainingCount ?? 0), true);
});
