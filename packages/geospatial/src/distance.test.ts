import assert from "node:assert/strict";
import test from "node:test";
import { calculateDistanceMiles, calculateDistanceMeters } from "./distance";

test("calculateDistanceMiles uses latitude/longitude in the documented order", () => {
  const miles = calculateDistanceMiles(40.2108, -79.7665, 40.2608, -79.7665);
  assert.ok(miles != null);
  assert.ok(miles > 3.4 && miles < 3.6, `expected roughly 3.5 miles, got ${miles}`);
  assert.equal(calculateDistanceMiles(40.2608, -79.7665, 40.2108, -79.7665)?.toFixed(6), miles.toFixed(6));
});

test("distance helper returns null for incomplete or invalid coordinates", () => {
  assert.equal(calculateDistanceMiles(null, -79.7, 40.2, -79.7), null);
  assert.equal(calculateDistanceMiles(91, -79.7, 40.2, -79.7), null);
  assert.equal(calculateDistanceMeters(40.2, -181, 40.2, -79.7), null);
});
