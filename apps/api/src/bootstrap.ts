import { buildDatabaseUrl, loadAppEnv, validateRequiredEnv } from "../../../packages/config/src/index";
import {
  createPostgresClient,
  InMemorySolarRepository,
  PostgresSolarRepository,
  runDatabaseMigrations,
  wrapPool,
  type SqlClient,
  type SolarRepository,
} from "../../../packages/database/src/index";

const expectedTables = [
  "properties",
  "solar_assessments",
  "solar_assessment_audits",
  "roof_segments",
  "property_discoveries",
  "property_signals",
  "usage_profiles",
  "permit_records",
  "lead_outcomes",
  "opportunity_assessments",
];

export interface ApiBootstrapContext {
  env: ReturnType<typeof loadAppEnv>;
  repository: SolarRepository;
  readyCheck: () => Promise<void>;
  close: () => Promise<void>;
}

export interface ApiBootstrapOptions {
  applyMigrations?: boolean;
}

export async function createApiBootstrapContext(options: ApiBootstrapOptions = {}): Promise<ApiBootstrapContext> {
  const env = loadAppEnv();
  const missing = validateRequiredEnv(env);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const databaseUrl = buildDatabaseUrl(env);
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to start the API.");
  }

  const pool = await createPostgresClient(databaseUrl);
  const repository = new PostgresSolarRepository(wrapPool(pool));
  const readyCheck = createDatabaseReadinessChecker(pool);

  if (options.applyMigrations) {
    await runDatabaseMigrations(pool);
  }

  await readyCheck();

  return {
    env,
    repository,
    readyCheck,
    close: async () => {
      await pool.end?.();
    },
  };
}

export async function createRepositoryFromEnv(): Promise<SolarRepository> {
  const context = await createApiBootstrapContext();
  return context.repository;
}

export function createMemoryRepository(): SolarRepository {
  return new InMemorySolarRepository();
}

export function createDatabaseReadinessChecker(pool: SqlClient) {
  return async function checkDatabaseReadiness(): Promise<void> {
    const connection = await pool.query<{ current_database: string; postgis_available: boolean }>(
      `
        SELECT
          current_database() AS current_database,
          EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'postgis') AS postgis_available
      `,
    );
    const row = connection.rows[0];
    if (!row) {
      throw new Error("Unable to verify database connection.");
    }

    const expectedDatabaseName = "solar_intelligence";
    if (row.current_database !== expectedDatabaseName) {
      throw new Error(`Connected to ${row.current_database}, expected ${expectedDatabaseName}.`);
    }
    if (!row.postgis_available) {
      throw new Error("PostGIS is not available on the configured database.");
    }

    const missingTables = await findMissingTables(pool);
    if (missingTables.length > 0) {
      throw new Error(`Missing expected tables: ${missingTables.join(", ")}`);
    }

  };
}

export async function checkDatabaseHealth(pool: SqlClient): Promise<void> {
  const checker = createDatabaseReadinessChecker(pool);
  await checker();
}

async function findMissingTables(pool: SqlClient): Promise<string[]> {
  const result = await pool.query<{ table_name: string | null }>(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
    `,
    [expectedTables],
  );
  const present = new Set(result.rows.map((row) => row.table_name).filter((value): value is string => Boolean(value)));
  return expectedTables.filter((table) => !present.has(table));
}
