import { createApiBootstrapContext } from "../bootstrap";
import {
  assertTestSeedEnvironment,
  seedDemoFieldData,
  seedTestUsers,
  TEST_USER_DEFINITIONS,
  TEST_USER_PASSWORD,
} from "./test-user-seed";

assertTestSeedEnvironment();

const context = await createApiBootstrapContext({ applyMigrations: true });
try {
  const seeded = await seedTestUsers(context.platformRepository);
  const fieldData = await seedDemoFieldData(context.fieldOperationsRepository, seeded);
  for (const definition of TEST_USER_DEFINITIONS) {
    const user = seeded.users[definition.email];
    console.log(`${user.email} ready (${user.roles.join(", ")})`);
  }
  console.log(`Development password: ${TEST_USER_PASSWORD}`);
  console.log(
    `Seeded QA data: ${fieldData.leads} leads, ${fieldData.appointments} appointments (${fieldData.unassignedAppointments} unassigned, ${fieldData.assignedAppointments} assigned), ${fieldData.closedLeads} closed, ${fieldData.followUpLeads} follow-up, ${fieldData.missingBillLeads} missing bill, ${fieldData.billMetadata} bill metadata record.`,
  );
} finally {
  await context.close();
}
