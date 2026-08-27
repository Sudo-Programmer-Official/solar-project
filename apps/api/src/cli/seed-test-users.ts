import { createApiBootstrapContext } from "../bootstrap";
import { assertTestSeedEnvironment, seedTestUsers, TEST_USER_DEFINITIONS, TEST_USER_PASSWORD } from "./test-user-seed";

assertTestSeedEnvironment();

const context = await createApiBootstrapContext({ applyMigrations: true });
try {
  const seeded = await seedTestUsers(context.platformRepository);
  for (const definition of TEST_USER_DEFINITIONS) {
    const user = seeded.users[definition.email];
    console.log(`${user.email} ready (${user.roles.join(", ")})`);
  }
  console.log(`Development password: ${TEST_USER_PASSWORD}`);
} finally {
  await context.close();
}
