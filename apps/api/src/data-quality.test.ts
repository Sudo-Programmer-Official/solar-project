import assert from "node:assert/strict";
import test from "node:test";
import {
  getImageryAgeMonths,
  getImageryFreshness,
  getImageryFreshnessThresholds,
} from "./data-quality";

const now = new Date("2026-09-10T00:00:00.000Z");

test("imagery freshness uses configurable 18/36 month bands", () => {
  assert.equal(getImageryFreshness("2025-04-10", now), "FRESH");
  assert.equal(getImageryFreshness("2024-01-10", now), "AGING");
  assert.equal(getImageryFreshness("2022-08-10", now), "STALE");
  assert.equal(getImageryFreshness(null, now), "UNKNOWN");
  assert.ok((getImageryAgeMonths("2025-04-10", now) ?? 0) < 18);
});

test("imagery freshness thresholds can be configured without accepting invalid values", () => {
  assert.deepEqual(getImageryFreshnessThresholds({ IMAGERY_FRESH_MONTHS: "12", IMAGERY_AGING_MONTHS: "24" }), {
    freshMonths: 12,
    agingMonths: 24,
  });
  assert.deepEqual(getImageryFreshnessThresholds({ IMAGERY_FRESH_MONTHS: "0", IMAGERY_AGING_MONTHS: "8" }), {
    freshMonths: 18,
    agingMonths: 18,
  });
});
