import type { FieldOperationalSlot } from "../services/api";

export function formatOperationalTime(startTime: string): string {
  const [rawHour, rawMinute] = startTime.split(":").map(Number);
  if (!Number.isFinite(rawHour) || !Number.isFinite(rawMinute)) return startTime;
  const hour = rawHour % 12 || 12;
  return `${hour}${rawMinute === 0 ? "" : `:${String(rawMinute).padStart(2, "0")}`} ${rawHour >= 12 ? "PM" : "AM"}`;
}

export function operationalSlotStateLabel(slot: Pick<FieldOperationalSlot, "bookedCount" | "overflowPolicy" | "status"> & { appointments?: unknown[] }): string {
  const hasBooking = slot.bookedCount > 0 || (slot.appointments?.length ?? 0) > 0;
  if (!hasBooking) return "Available";
  if (slot.status === "OPEN" && slot.overflowPolicy === "ALLOW_WITH_WARNING") return "Booked · Overflow available";
  return "Booked";
}

export function formatOperationalDate(date: string, options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, options);
}

export function localDayWindow(date = new Date()): { from: string; to: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function oneSlotPerDateAndTime(slots: FieldOperationalSlot[]): FieldOperationalSlot[] {
  const byDateAndTime = new Map<string, FieldOperationalSlot>();
  for (const slot of slots) {
    const key = `${slot.slotDate}:${slot.startTime}`;
    const current = byDateAndTime.get(key);
    if (!current || (current.teamId !== null && slot.teamId === null)) byDateAndTime.set(key, slot);
  }
  return [...byDateAndTime.values()];
}
