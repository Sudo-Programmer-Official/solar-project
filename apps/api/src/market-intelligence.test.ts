import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCoverageSummary,
  buildDiscoveryCoverageCells,
  classifyDiscoveryCapacityBand,
  classifyMarketCandidate,
} from "./market-intelligence";

test("coverage cells describe the requested radius without inventing measured coverage", () => {
  const cells = buildDiscoveryCoverageCells({ latitude: 40.5071, longitude: -78.3942 }, 2);
  assert.ok(cells.length > 1);
  assert.equal(new Set(cells.map((cell) => cell.key)).size, cells.length);

  const unavailable = buildCoverageSummary({
    cellCount: cells.length,
    source: null,
    sourceSucceeded: false,
    discoveredCellCount: 0,
    verifiedCellCount: 0,
    solarAnalyzedCellCount: 0,
    completeCellCount: 0,
  });
  assert.equal(unavailable.status, "UNAVAILABLE");
  assert.equal(unavailable.coveragePercent, null);
});

test("market funnel prioritizes exclusions and verification before scores", () => {
  assert.equal(classifyMarketCandidate({
    propertyUse: "SINGLE_FAMILY",
    address: "3306 Pleasant Valley Blvd",
    verificationStatus: "VERIFIED",
    existingSolarStatus: "DETECTED",
    solarScore: 95,
    whaleScore: 95,
    strongScore: 95,
  }), "EXISTING_SOLAR");

  assert.equal(classifyMarketCandidate({
    propertyUse: "SINGLE_FAMILY",
    address: "3306 Pleasant Valley Blvd",
    verificationStatus: "REVIEW",
    existingSolarStatus: "UNKNOWN",
    solarScore: 95,
    whaleScore: 95,
    strongScore: 95,
  }), "UNVERIFIED");

  assert.equal(classifyMarketCandidate({
    propertyUse: "SINGLE_FAMILY",
    address: "3306 Pleasant Valley Blvd",
    verificationStatus: "VERIFIED",
    existingSolarStatus: "NOT_DETECTED",
    solarScore: 90,
    whaleScore: 65,
    strongScore: 90,
    capacityKw: 22,
  }), "WHALE");
  assert.equal(classifyDiscoveryCapacityBand(17), "LARGE");
  assert.equal(classifyDiscoveryCapacityBand(31), "MEGA_WHALE");
});
