import { createApiBootstrapContext } from "../bootstrap";
import { assertTestDataEnvironment } from "./test-user-seed";

assertTestDataEnvironment("clean QA field data");

const context = await createApiBootstrapContext({ applyMigrations: true });
try {
  const summary = await context.fieldOperationsRepository.cleanTestData();
  console.log(
    `Removed QA field data: ${summary.leads} leads, ${summary.appointments} appointments, ${summary.notes} notes, ${summary.billMetadata} bill metadata records, ${summary.activities} activities, ${summary.sheetSyncJobs} sheet-sync jobs, ${summary.availabilitySlots} availability slots.`,
  );
} finally {
  await context.close();
}
