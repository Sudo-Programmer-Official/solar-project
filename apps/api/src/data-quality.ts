export type ImageryFreshness = "FRESH" | "AGING" | "STALE" | "UNKNOWN";

export interface ImageryFreshnessThresholds {
  freshMonths: number;
  agingMonths: number;
}

export const DEFAULT_IMAGERY_FRESHNESS_THRESHOLDS: ImageryFreshnessThresholds = {
  freshMonths: 18,
  agingMonths: 36,
};

export function getImageryFreshnessThresholds(
  env: Record<string, string | undefined> = process.env,
): ImageryFreshnessThresholds {
  const freshMonths = readPositiveNumber(env.IMAGERY_FRESH_MONTHS, DEFAULT_IMAGERY_FRESHNESS_THRESHOLDS.freshMonths);
  const configuredAgingMonths = readPositiveNumber(env.IMAGERY_AGING_MONTHS, DEFAULT_IMAGERY_FRESHNESS_THRESHOLDS.agingMonths);
  return {
    freshMonths,
    agingMonths: Math.max(freshMonths, configuredAgingMonths),
  };
}

export function getImageryAgeMonths(
  imageryDate: string | null | undefined,
  now = new Date(),
): number | null {
  if (!imageryDate) return null;
  const capturedAt = parseDateOnly(imageryDate);
  if (!capturedAt) return null;
  const ageDays = Math.max(0, now.getTime() - capturedAt.getTime()) / 86_400_000;
  return Math.round((ageDays / 30.4375) * 10) / 10;
}

export function getImageryFreshness(
  imageryDate: string | null | undefined,
  now = new Date(),
  thresholds = getImageryFreshnessThresholds(),
): ImageryFreshness {
  const ageMonths = getImageryAgeMonths(imageryDate, now);
  if (ageMonths == null) return "UNKNOWN";
  if (ageMonths < thresholds.freshMonths) return "FRESH";
  if (ageMonths <= thresholds.agingMonths) return "AGING";
  return "STALE";
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) return null;
  return parsed;
}

function readPositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
