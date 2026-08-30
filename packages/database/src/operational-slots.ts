export const CANONICAL_OPERATIONAL_SLOT_TIMES = [
  "10:00",
  "12:00",
  "14:00",
  "16:00",
  "18:00",
  "20:00",
] as const;

export type CanonicalOperationalSlotTime = (typeof CANONICAL_OPERATIONAL_SLOT_TIMES)[number];
export type OperationalOverflowPolicy = "ALLOW_WITH_WARNING" | "BLOCK";

export interface OperationalSlotCapacityState {
  standardCapacity: number;
  bookedCount: number;
  overflowCount: number;
  overflowPolicy: OperationalOverflowPolicy;
}

export interface OperationalBookingDecision {
  allowed: boolean;
  isOverflow: boolean;
  remainingCapacity: number;
  reason?: "CAPACITY_FULL" | "OVERFLOW_REQUIRES_CONFIRMATION" | "OVERFLOW_BLOCKED";
}

/**
 * Keeps the booking boundary independent from closer availability. Closer
 * availability is an assignment concern; this function is the operational
 * slot's source-of-truth capacity rule.
 */
export function decideOperationalBooking(
  state: OperationalSlotCapacityState,
  allowOverflow = false,
): OperationalBookingDecision {
  const standardCapacity = Math.max(0, Math.floor(state.standardCapacity));
  const bookedCount = Math.max(0, Math.floor(state.bookedCount));
  const remainingCapacity = Math.max(standardCapacity - bookedCount, 0);

  if (bookedCount < standardCapacity) {
    return { allowed: true, isOverflow: false, remainingCapacity: remainingCapacity - 1 };
  }
  if (state.overflowPolicy === "BLOCK") {
    return { allowed: false, isOverflow: false, remainingCapacity, reason: "OVERFLOW_BLOCKED" };
  }
  if (!allowOverflow) {
    return { allowed: false, isOverflow: true, remainingCapacity, reason: "OVERFLOW_REQUIRES_CONFIRMATION" };
  }
  return { allowed: true, isOverflow: true, remainingCapacity: 0 };
}

export function normalizeCanonicalOperationalSlotTime(value: string): CanonicalOperationalSlotTime | null {
  const normalized = value.trim().slice(0, 5);
  return (CANONICAL_OPERATIONAL_SLOT_TIMES as readonly string[]).includes(normalized)
    ? normalized as CanonicalOperationalSlotTime
    : null;
}
