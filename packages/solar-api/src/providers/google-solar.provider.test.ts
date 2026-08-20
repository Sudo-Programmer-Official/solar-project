import assert from "node:assert/strict";
import test from "node:test";
import fixture from "../../test-fixtures/google-building-insights.json" assert { type: "json" };
import { GoogleSolarDataProvider, SolarProviderError } from "./google-solar.provider";

function buildPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const base = fixture as Record<string, unknown>;
  return structuredClone({
    ...base,
    ...overrides,
    solarPotential: {
      ...(base.solarPotential as Record<string, unknown>),
      ...(overrides.solarPotential as Record<string, unknown> | undefined),
    },
  }) as Record<string, unknown>;
}

test("normalizeBuildingInsights maps Google Solar payload fields", () => {
  const provider = new GoogleSolarDataProvider({ apiKey: "test-key" });
  const normalized = provider.normalizeBuildingInsights(fixture);

  assert.equal(normalized.provider, "google_solar");
  assert.equal(normalized.providerVersion, "v1");
  assert.equal(normalized.imageryDate, "2024-05-11");
  assert.equal(normalized.imageryProcessedDate, "2024-05-21");
  assert.equal(normalized.imageryQuality, "HIGH");
  assert.equal(normalized.providerBuildingId, "building-123");
  assert.equal(normalized.maxArrayPanelsCount, 28);
  assert.equal(normalized.panelCapacityWatts, 410);
  assert.equal(normalized.maxArrayAreaMeters2, 120.2);
  assert.equal(normalized.maxSunshineHoursPerYear, 1452.8);
  assert.equal(normalized.estimatedMaxSystemKw, 11.48);
  assert.equal(normalized.estimatedAnnualProductionKwh, 12980.5);
  assert.equal(normalized.existingSolarStatus, "DETECTED");
  assert.equal(normalized.existingSolarConfidence, 0.98);
  assert.equal(normalized.detectedArrays.detectionStatus, "DETECTED");
  assert.equal(normalized.detectedArrays.latestCaptureDate, "2024-05-18");
  assert.equal(normalized.selectedProductionConfig?.panelsCount, 28);
  assert.equal(normalized.roofSegmentStats.length, 1);
  assert.equal(normalized.solarPanelConfigs.length, 1);
  assert.equal(normalized.solarPanels.length, 1);
});

test("normalizeBuildingInsights maps no-arrays-detected status", () => {
  const provider = new GoogleSolarDataProvider({ apiKey: "test-key" });
  const normalized = provider.normalizeBuildingInsights(
    buildPayload({
      detectedArrays: {
        detectionStatus: "DETECTION_STATUS_NO_ARRAYS_DETECTED",
        latestCaptureDate: "2024-05-18",
      },
    }),
  );

  assert.equal(normalized.existingSolarStatus, "NOT_DETECTED");
});

test("normalizeBuildingInsights maps missing detectedArrays to unknown", () => {
  const provider = new GoogleSolarDataProvider({ apiKey: "test-key" });
  const payload = buildPayload();
  delete payload.detectedArrays;
  const normalized = provider.normalizeBuildingInsights(payload);

  assert.equal(normalized.existingSolarStatus, "UNKNOWN");
  assert.equal(normalized.detectedArrays.detectionStatus, "UNKNOWN");
});

test("normalizeBuildingInsights marks missing imagery date and missing roof segments", () => {
  const provider = new GoogleSolarDataProvider({ apiKey: "test-key" });
  const payload = buildPayload({
    imageryDate: null,
    roofSegmentStats: [],
  });
  const normalized = provider.normalizeBuildingInsights(payload);

  assert.equal(normalized.warnings.includes("MISSING_IMAGERY_DATE"), true);
  assert.equal(normalized.warnings.includes("ROOF_SEGMENTS_UNAVAILABLE"), true);
  assert.equal(normalized.missingFields.includes("imageryDate"), true);
  assert.equal(normalized.missingFields.includes("roofSegmentStats"), true);
});

test("normalizeBuildingInsights selects the highest valid production config", () => {
  const provider = new GoogleSolarDataProvider({ apiKey: "test-key" });
  const payload = buildPayload({
    solarPotential: {
      solarPanelConfigs: [
        { panelsCount: 10, yearlyEnergyDcKwh: 4000 },
        { panelsCount: 20, yearlyEnergyDcKwh: 7800 },
        { panelsCount: 20, yearlyEnergyDcKwh: 8100 },
      ],
      maxArrayPanelsCount: 20,
      panelCapacityWatts: 400,
      maxSunshineHoursPerYear: 1450,
      maxArrayAreaMeters2: 100,
    },
  });
  const normalized = provider.normalizeBuildingInsights(payload);

  assert.equal(normalized.selectedProductionConfig?.panelsCount, 20);
  assert.equal(normalized.selectedProductionConfig?.yearlyEnergyDcKwh, 8100);
  assert.equal(normalized.estimatedAnnualProductionKwh, 8100);
});

test("normalizeBuildingInsights warns for large systems", () => {
  const provider = new GoogleSolarDataProvider({ apiKey: "test-key" });
  const payload = buildPayload({
    solarPotential: {
      solarPanelConfigs: [{ panelsCount: 80, yearlyEnergyDcKwh: 32500 }],
      maxArrayPanelsCount: 80,
      panelCapacityWatts: 400,
      maxSunshineHoursPerYear: 1500,
      maxArrayAreaMeters2: 160,
    },
  });
  const normalized = provider.normalizeBuildingInsights(payload);

  assert.equal(normalized.estimatedMaxSystemKw, 32);
  assert.equal(normalized.warnings.includes("LARGE_SYSTEM_REVIEW"), true);
});

test("getBuildingInsights maps HTTP failures to typed SolarProviderError", async () => {
  const provider = new GoogleSolarDataProvider({
    apiKey: "test-key",
    fetchImpl: async () => new Response(JSON.stringify({ error: "missing" }), { status: 404 }),
  });

  await assert.rejects(
    provider.getBuildingInsights({ latitude: 40.1, longitude: -79.1 }),
    (error: unknown) => {
      assert.ok(error instanceof SolarProviderError);
      assert.equal(error.code, "BUILDING_NOT_FOUND");
      return true;
    },
  );
});
