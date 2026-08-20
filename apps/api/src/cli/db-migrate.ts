import { buildDatabaseUrl, loadAppEnv, validateRequiredEnv } from "../../../../packages/config/src/index";
import { createPostgresClient, runDatabaseMigrations } from "../../../../packages/database/src/index";
import { checkDatabaseHealth } from "../bootstrap";

async function main(): Promise<void> {
  const env = loadAppEnv();
  const missing = validateRequiredEnv(env);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const databaseUrl = buildDatabaseUrl(env);
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run migrations.");
  }

  const pool = await createPostgresClient(databaseUrl);
  try {
    const { migrationFiles } = await runDatabaseMigrations(pool);

    await checkDatabaseHealth(pool);
    process.stdout.write(
      `${JSON.stringify(
        {
          status: "ok",
          migrations: migrationFiles,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await pool.end?.();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
