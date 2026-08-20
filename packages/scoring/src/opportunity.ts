import type {
  ExistingSolarSignal,
  ExistingSolarResult,
  OpportunityScore,
  ScoreReason,
  ScoreWarning,
} from "../../contracts/src/index";

export type PropertyOpportunityFeatures = {
  solarPotentialScore: number;
  roofPermitRecencyScore: number;
  newConstructionScore: number;
  electricalUpgradeScore: number;
  highUsageConfidenceScore: number;
  homeownerInterestScore: number;
  ownerOccupancyScore: number;
  existingSolarPenalty: number;
  shadePenalty: number;
  staleDataPenalty: number;
};

export const scoringVersion = "2026-08-06.1";

const weights = {
  homeownerInterest: 0.25,
  solarPotential: 0.2,
  confirmedUsage: 0.15,
  roofPermitRecency: 0.12,
  newConstruction: 0.08,
  electricalUpgrade: 0.06,
  ownerOccupancy: 0.05,
  nearbyInstallSocialProof: 0.04,
  recentSale: 0.03,
  poolOrAdditionSignal: 0.02,
} as const;

export function calculateExistingSolarStatus(
  signals: ExistingSolarSignal[],
): ExistingSolarResult {
  const confirmed = signals.find((signal) => {
    return (
      ["homeowner_confirmed", "completed_permit", "utility_authorized"].includes(
        signal.signalType,
      ) && signal.confidence >= 0.9
    );
  });

  if (confirmed) {
    return {
      status: "confirmed",
      confidence: confirmed.confidence,
      evidence: [confirmed],
    };
  }

  const likelySignals = signals.filter((signal) => signal.confidence >= 0.7);
  if (likelySignals.length >= 2) {
    const averageConfidence =
      likelySignals.reduce((sum, signal) => sum + signal.confidence, 0) /
      likelySignals.length;
    return {
      status: "likely",
      confidence: averageConfidence,
      evidence: likelySignals,
    };
  }

  return {
    status: "unknown",
    confidence: 0,
    evidence: [],
  };
}

export function scoreOpportunity(
  features: PropertyOpportunityFeatures,
): OpportunityScore {
  const weighted =
    features.homeownerInterestScore * weights.homeownerInterest +
    features.solarPotentialScore * weights.solarPotential +
    features.highUsageConfidenceScore * weights.confirmedUsage +
    features.roofPermitRecencyScore * weights.roofPermitRecency +
    features.newConstructionScore * weights.newConstruction +
    features.electricalUpgradeScore * weights.electricalUpgrade +
    features.ownerOccupancyScore * weights.ownerOccupancy;

  const total = clampToHundred(
    weighted +
      features.existingSolarPenalty +
      features.shadePenalty +
      features.staleDataPenalty,
  );

  return {
    total,
    tier: tierFor(total),
    reasons: buildReasons(features),
    warnings: buildWarnings(features),
    calculatedAt: new Date().toISOString(),
    scoringVersion,
  };
}

function buildReasons(features: PropertyOpportunityFeatures): ScoreReason[] {
  const reasons: ScoreReason[] = [];

  if (features.roofPermitRecencyScore > 0) {
    reasons.push({
      code: "RECENT_ROOF_PERMIT",
      points: round(features.roofPermitRecencyScore * weights.roofPermitRecency),
      message: "Recent roof permit activity detected",
    });
  }
  if (features.solarPotentialScore > 0) {
    reasons.push({
      code: "HIGH_SOLAR_POTENTIAL",
      points: round(features.solarPotentialScore * weights.solarPotential),
      message: "Rooftop solar potential is strong",
    });
  }
  if (features.newConstructionScore > 0) {
    reasons.push({
      code: "NEW_CONSTRUCTION_SIGNAL",
      points: round(features.newConstructionScore * weights.newConstruction),
      message: "New construction or subdivision signal present",
    });
  }
  if (features.electricalUpgradeScore > 0) {
    reasons.push({
      code: "ELECTRICAL_UPGRADE_SIGNAL",
      points: round(features.electricalUpgradeScore * weights.electricalUpgrade),
      message: "Electrical service work may indicate readiness for solar",
    });
  }

  return reasons;
}

function buildWarnings(features: PropertyOpportunityFeatures): ScoreWarning[] {
  const warnings: ScoreWarning[] = [];

  if (features.existingSolarPenalty < 0) {
    warnings.push({
      code: "EXISTING_SOLAR_SIGNAL",
      message: "There is evidence of existing solar and the property should be reviewed carefully.",
    });
  }
  if (features.staleDataPenalty < 0) {
    warnings.push({
      code: "DATA_STALE",
      message: "Some source data is old enough to reduce confidence.",
    });
  }
  if (features.shadePenalty < 0) {
    warnings.push({
      code: "SHADE_RISK",
      message: "Imagery or model data suggests shading may reduce solar value.",
    });
  }

  return warnings;
}

function tierFor(score: number): "A" | "B" | "C" | "D" {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

function clampToHundred(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function round(value: number): number {
  return Math.round(value);
}
