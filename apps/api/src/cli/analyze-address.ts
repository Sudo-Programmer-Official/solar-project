import { createRepositoryFromEnv } from "../bootstrap";
import { analyzeProperty } from "../store";

async function main(): Promise<void> {
  const address = process.argv.slice(2).join(" ").trim() || "308 Baughman St, West Newton, PA";
  const repository = await createRepositoryFromEnv();
  const result = await analyzeProperty(
    {
      address,
      municipality: "West Newton",
      county: "Westmoreland",
      state: "PA",
    },
    repository,
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        address,
        propertyId: result.property.id,
        googleCoordinates: {
          latitude: result.audit.requestedCoordinates?.latitude ?? null,
          longitude: result.audit.requestedCoordinates?.longitude ?? null,
        },
        solarBuildingCenter: result.audit.returnedBuildingCenter,
        distanceMeters: result.audit.distanceMeters,
        detectedArrayStatus: result.audit.detectedArrayStatus,
        detectedArrayCaptureDate: result.audit.detectedArrayCaptureDate,
        imageryDate: result.audit.imageryDate,
        imageryProcessedDate: result.audit.imageryProcessedDate,
        imageryQuality: result.audit.imageryQuality,
        roofSegmentCount: result.audit.roofSegmentCount,
        maxArrayPanelsCount: result.audit.maxArrayPanelsCount,
        panelCapacityWatts: result.audit.panelCapacityWatts,
        solarFitScore: result.solarAssessment.solarFitScore,
        confidence: result.solarAssessment.solarFitConfidence,
        estimatedMaxSystemKw: result.solarAssessment.estimatedMaxSystemKw,
        estimatedAnnualProductionKwh: result.solarAssessment.estimatedAnnualProductionKwh,
        selectedProductionConfig: result.audit.selectedProductionConfig,
        systemSizeCalculation: result.audit.systemSizeCalculation,
        scoreBreakdown: result.scoreBreakdown,
        verificationNeeded: result.verificationNeeded,
        warnings: result.warnings,
        reasons: result.reasons,
        missingFields: result.audit.missingFields,
      },
      null,
      2,
    )}\n`,
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
