import { buildDatabaseUrl, loadAppEnv, validateRequiredEnv } from "../../../packages/config/src/index";
import {
  createPostgresClient,
  InMemorySolarRepository,
  PostgresSolarRepository,
  PostgresPlatformRepository,
  runDatabaseMigrations,
  wrapPool,
  type SqlClient,
  type SolarRepository,
  type PlatformRepository,
  PostgresFieldOperationsRepository,
  type FieldOperationsRepository,
} from "../../../packages/database/src/index";
import {
  PostgresIntelligenceRepository,
  type IntelligenceRepository,
} from "../../../packages/territory-scoring/src/index";

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

const expectedPlatformTables = [
  "users",
  "roles",
  "permissions",
  "user_roles",
  "role_permissions",
  "sessions",
  "invites",
  "audit_log",
  "teams",
  "user_teams",
  "leads",
  "closer_availability",
  "appointments",
  "notes",
  "bill_attachments",
  "activities",
  "sheet_sync_jobs",
];

const expectedIntelligenceTables = [
  "uploads",
  "appointments",
  "territory_daily",
  "rep_daily",
  "result_daily",
];

export interface ApiBootstrapContext {
  env: ReturnType<typeof loadAppEnv>;
  repository: SolarRepository;
  platformRepository: PlatformRepository;
  fieldOperationsRepository: FieldOperationsRepository;
  intelligenceRepository: IntelligenceRepository;
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
  const platformRepository = new PostgresPlatformRepository(wrapPool(pool));
  const fieldOperationsRepository = new PostgresFieldOperationsRepository(wrapPool(pool));
  const intelligenceRepository = new PostgresIntelligenceRepository(wrapPool(pool));
  const readyCheck = createDatabaseReadinessChecker(pool);

  if (options.applyMigrations) {
    await runDatabaseMigrations(pool);
  }

  await readyCheck();

  return {
    env,
    repository,
    platformRepository,
    fieldOperationsRepository,
    intelligenceRepository,
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
  const result = await pool.query<{ table_schema: string; table_name: string | null }>(
    `
      SELECT table_schema, table_name
      FROM information_schema.tables
       WHERE (table_schema = 'public' AND table_name = ANY($1::text[]))
         OR (table_schema = 'field_ops' AND table_name = ANY($2::text[]))
         OR (table_schema = 'sales' AND table_name = ANY($3::text[]))
         OR (table_schema = 'analytics' AND table_name = ANY($4::text[]))
    `,
    [expectedTables, expectedPlatformTables, ["uploads", "appointments"], ["territory_daily", "rep_daily", "result_daily"]],
  );
  const present = new Set(result.rows.map((row) => `${row.table_schema}.${row.table_name}`));
  return [
    ...expectedTables.filter((table) => !present.has(`public.${table}`)).map((table) => `public.${table}`),
    ...expectedPlatformTables.filter((table) => !present.has(`field_ops.${table}`)).map((table) => `field_ops.${table}`),
    ...expectedIntelligenceTables
      .filter((table) => !present.has(`${table === "uploads" || table === "appointments" ? "sales" : "analytics"}.${table}`))
      .map((table) => `${table === "uploads" || table === "appointments" ? "sales" : "analytics"}.${table}`),
  ];
}
