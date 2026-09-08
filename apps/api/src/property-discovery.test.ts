import assert from "node:assert/strict";
import test from "node:test";
import { GridGeocodingPropertyDiscoveryProvider, OverpassPropertyDiscoveryProvider, PropertyDiscoveryTimeoutError } from "./property-discovery";
import type { Geocoder } from "../../../packages/geospatial/src/index";

test("Overpass discovery aborts and reports provider timeouts", async () => {
  let signal: AbortSignal | undefined;
  const fetchImpl: typeof fetch = async (_input, init) => {
    signal = init?.signal ?? undefined;
    return new Promise<Response>((_resolve, reject) => {
      signal?.addEventListener("abort", () => reject(new Error("request aborted")), { once: true });
    });
  };
  const provider = new OverpassPropertyDiscoveryProvider(fetchImpl, 5);

  await assert.rejects(
    provider.discover({ latitude: 40.5071, longitude: -78.3942, radiusMiles: 1 }),
    (error: unknown) => error instanceof PropertyDiscoveryTimeoutError,
  );
  assert.equal(signal?.aborted, true);
});

test("grid fallback expands from spatial coverage, not the ranked result limit", async () => {
  let requests = 0;
  const geocoder: Geocoder = {
    geocodeAddress: async ({ address }) => ({
      formattedAddress: address,
      latitude: 40.5071,
      longitude: -78.3942,
      placeId: "geocode-address",
      locationType: "ROOFTOP",
      partialMatch: false,
      rawResponse: {},
    }),
    reverseGeocode: async ({ latitude, longitude }) => {
      requests += 1;
      return {
        formattedAddress: `${requests} Coverage St, Example, PA 16000`,
        latitude,
        longitude,
        placeId: `coverage-${requests}`,
        locationType: "ROOFTOP",
        partialMatch: false,
        rawResponse: {},
      };
    },
  };
  const provider = new GridGeocodingPropertyDiscoveryProvider(geocoder, { sampleMultiplier: 1 });
  const properties = await provider.discover({
    latitude: 40.5071,
    longitude: -78.3942,
    radiusMiles: 5,
    limit: 1,
    coverageCellCount: 80,
  });

  assert.equal(requests, 320);
  assert.equal(properties.length, 320);
});
