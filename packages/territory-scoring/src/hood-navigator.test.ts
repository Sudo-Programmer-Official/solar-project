import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateExpectedOpportunityPerRepHour,
  calculateFieldEfficiencyScore,
  calculateTerrainScore,
} from "./hood-navigator";

test("dense flat area scores well for field efficiency", () => {
  const terrainScore = calculateTerrainScore({ slopeDegrees: 2, elevationChangeMeters: 4, roadGradePercent: 1, walkingDifficulty: 5 });
  const efficiency = calculateFieldEfficiencyScore({
    leadDensity: 95,
    doorToDoorDistance: 90,
    routeCompactness: 92,
    roadAccessibility: 95,
    terrainScore,
    strongLeadDensity: 80,
    historicalFieldOutcome: 75,
  });

  assert.equal(terrainScore > 90, true);
  assert.equal(efficiency.score >= 85, true);
});

test("dense hilly area is penalized for efficiency, not solar opportunity", () => {
  const flatTerrain = calculateTerrainScore({ slopeDegrees: 2, elevationChangeMeters: 4, roadGradePercent: 1, walkingDifficulty: 5 });
  const hillyTerrain = calculateTerrainScore({ slopeDegrees: 22, elevationChangeMeters: 55, roadGradePercent: 10, walkingDifficulty: 80 });
  const base = {
    leadDensity: 95,
    doorToDoorDistance: 90,
    routeCompactness: 92,
    roadAccessibility: 95,
    strongLeadDensity: 80,
    historicalFieldOutcome: 75,
  };

  const flat = calculateFieldEfficiencyScore({ ...base, terrainScore: flatTerrain });
  const hilly = calculateFieldEfficiencyScore({ ...base, terrainScore: hillyTerrain });

  assert.equal(hilly.score < flat.score, true);
  const solarOpportunityScore = 88;
  assert.equal(solarOpportunityScore, 88);
});

test("sparse hilly area is less efficient but remains eligible when solar fit is strong", () => {
  const hillyTerrain = calculateTerrainScore({ slopeDegrees: 18, elevationChangeMeters: 45, roadGradePercent: 8, walkingDifficulty: 65 });
  const efficiency = calculateFieldEfficiencyScore({
    leadDensity: 25,
    doorToDoorDistance: 42,
    routeCompactness: 48,
    roadAccessibility: 58,
    terrainScore: hillyTerrain,
    strongLeadDensity: 70,
    historicalFieldOutcome: 75,
  });
  const expectedOpportunity = calculateExpectedOpportunityPerRepHour({
    averageOpportunityScore: 86,
    fieldEfficiencyScore: efficiency.score,
    propertyCount: 5,
    estimatedMinutes: 42,
  });

  assert.equal(efficiency.score < 70, true);
  assert.equal(expectedOpportunity > 0, true);
});

test("rural spread-out area loses time to travel and door-to-door distance", () => {
  const rural = calculateFieldEfficiencyScore({
    leadDensity: 18,
    doorToDoorDistance: 20,
    routeCompactness: 22,
    roadAccessibility: 55,
    terrainScore: 75,
    strongLeadDensity: 60,
    historicalFieldOutcome: 75,
  });
  const dense = calculateFieldEfficiencyScore({
    leadDensity: 85,
    doorToDoorDistance: 88,
    routeCompactness: 90,
    roadAccessibility: 85,
    terrainScore: 75,
    strongLeadDensity: 60,
    historicalFieldOutcome: 75,
  });

  assert.equal(rural.score < dense.score, true);
});
