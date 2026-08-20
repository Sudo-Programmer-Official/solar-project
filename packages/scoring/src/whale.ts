export type UsageConfidence = "CONFIRMED" | "SELF_REPORTED" | "ESTIMATED";

export interface WhaleScoreInput {
  estimatedSystemKw?: number | null;
  annualUsageKwh?: number | null;
  usageConfidence: UsageConfidence;
  largeRoofSignal?: boolean;
  poolSignal?: boolean;
  confirmedEvSignal?: boolean;
  confirmedEvChargerSignal?: boolean;
  solarProductionPotential?: number | null;
}

export interface WhaleScoreResult {
  whaleScore: number;
  confidence: number;
  reasons: string[];
  verificationNeeded: string[];
}

export function calculateWhaleScore(input: WhaleScoreInput): WhaleScoreResult {
  const reasons: string[] = [];
  const verificationNeeded: string[] = [];

  const systemScore = scoreSystemSize(input.estimatedSystemKw);
  if ((input.estimatedSystemKw ?? 0) >= 15) {
    reasons.push(`Estimated maximum array size is ${formatNumber(input.estimatedSystemKw)} kW`);
  } else if ((input.estimatedSystemKw ?? 0) > 0) {
    reasons.push(`Estimated maximum array size is ${formatNumber(input.estimatedSystemKw)} kW`);
  }

  const usageScore = scoreUsage(input.annualUsageKwh);
  if (input.annualUsageKwh == null) {
    verificationNeeded.push("Request electric bill");
  } else if (input.annualUsageKwh >= 40000) {
    reasons.push("Annual usage is in the whale band");
  } else if (input.annualUsageKwh >= 25000) {
    reasons.push("Annual usage is very high");
  }

  if (input.largeRoofSignal) reasons.push("Large usable roof area");
  if (input.poolSignal) reasons.push("Pool observed");
  if (input.confirmedEvSignal) reasons.push("EV confirmed");
  if (input.confirmedEvChargerSignal) reasons.push("EV charger confirmed");
  if (input.confirmedEvSignal || input.confirmedEvChargerSignal) {
    verificationNeeded.push("Confirm EV/charging load");
  }

  const potentialScore = clamp01(input.solarProductionPotential ?? 0);
  const confidence = confidenceForUsage(input.usageConfidence);
  const combined =
    systemScore * 0.3 +
    usageScore * 0.4 +
    potentialScore * 0.2 +
    signalBonus(input) * 0.1;

  const adjusted = Math.round(combined * confidence);
  return {
    whaleScore: clampScore(adjusted),
    confidence: Math.round(confidence * 100),
    reasons: reasons.length > 0 ? reasons : ["Annual usage has not yet been confirmed"],
    verificationNeeded: dedupe(verificationNeeded.length > 0 ? verificationNeeded : ["Request electric bill"]),
  };
}

function scoreSystemSize(estimatedSystemKw?: number | null): number {
  if (!estimatedSystemKw) return 0.25;
  if (estimatedSystemKw >= 15) return 1;
  if (estimatedSystemKw >= 10) return 0.8;
  if (estimatedSystemKw >= 7) return 0.6;
  return 0.4;
}

function scoreUsage(annualUsageKwh?: number | null): number {
  if (annualUsageKwh == null) return 0.25;
  if (annualUsageKwh >= 40000) return 1;
  if (annualUsageKwh >= 25000) return 0.85;
  if (annualUsageKwh >= 15000) return 0.65;
  if (annualUsageKwh >= 10000) return 0.45;
  return 0.25;
}

function signalBonus(input: WhaleScoreInput): number {
  let bonus = 0;
  if (input.largeRoofSignal) bonus += 0.2;
  if (input.poolSignal) bonus += 0.1;
  if (input.confirmedEvSignal) bonus += 0.15;
  if (input.confirmedEvChargerSignal) bonus += 0.15;
  return Math.min(1, bonus);
}

function confidenceForUsage(confidence: UsageConfidence): number {
  switch (confidence) {
    case "CONFIRMED":
      return 1;
    case "SELF_REPORTED":
      return 0.78;
    case "ESTIMATED":
      return 0.55;
  }
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function formatNumber(value?: number | null): string {
  if (value == null) return "unknown";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
