import assert from "node:assert/strict";
import test from "node:test";
import { CANONICAL_OPERATIONAL_SLOT_TIMES, decideOperationalBooking, normalizeCanonicalOperationalSlotTime } from "./operational-slots";

test("canonical operational slots match the official schedule times", () => {
  assert.deepEqual(CANONICAL_OPERATIONAL_SLOT_TIMES, ["10:00", "12:00", "14:00", "16:00", "18:00", "20:00"]);
  assert.equal(normalizeCanonicalOperationalSlotTime("18:00"), "18:00");
  assert.equal(normalizeCanonicalOperationalSlotTime("18:30"), null);
});

test("standard capacity accepts a booking without consulting closer count", () => {
  assert.deepEqual(decideOperationalBooking({ standardCapacity: 2, bookedCount: 1, overflowCount: 0, overflowPolicy: "ALLOW_WITH_WARNING" }), {
    allowed: true,
    isOverflow: false,
    remainingCapacity: 0,
  });
});

test("full slots require explicit overflow confirmation", () => {
  const state = { standardCapacity: 1, bookedCount: 1, overflowCount: 0, overflowPolicy: "ALLOW_WITH_WARNING" as const };
  assert.equal(decideOperationalBooking(state).reason, "OVERFLOW_REQUIRES_CONFIRMATION");
  assert.deepEqual(decideOperationalBooking(state, true), { allowed: true, isOverflow: true, remainingCapacity: 0 });
});

test("multiple overflow appointments remain allowed and classified after the boundary", () => {
  const firstOverflow = decideOperationalBooking({ standardCapacity: 4, bookedCount: 4, overflowCount: 0, overflowPolicy: "ALLOW_WITH_WARNING" }, true);
  const secondOverflow = decideOperationalBooking({ standardCapacity: 4, bookedCount: 5, overflowCount: 1, overflowPolicy: "ALLOW_WITH_WARNING" }, true);
  assert.equal(firstOverflow.isOverflow, true);
  assert.equal(secondOverflow.isOverflow, true);
  assert.equal(secondOverflow.remainingCapacity, 0);
});

test("blocked overflow stays blocked even when requested", () => {
  assert.equal(decideOperationalBooking({ standardCapacity: 1, bookedCount: 1, overflowCount: 0, overflowPolicy: "BLOCK" }, true).reason, "OVERFLOW_BLOCKED");
});
