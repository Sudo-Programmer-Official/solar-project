import fs from "node:fs/promises";
import path from "node:path";

import type { SqlClient } from "./repository";

export interface AppliedMigrationsResult {
  migrationFiles: string[];
}

export async function runDatabaseMigrations(pool: SqlClient): Promise<AppliedMigrationsResult> {
  const repositoryRoot = await findRepositoryRoot();
  const schemaPath = path.join(repositoryRoot, "packages/database/src/schema.sql");
  const migrationsDir = path.join(repositoryRoot, "packages/database/migrations");

  const schemaSql = await fs.readFile(schemaPath, "utf8");
  await pool.query(schemaSql);

  const migrationFiles = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const migrationSql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    await pool.query(migrationSql);
  }

  return { migrationFiles };
}

async function findRepositoryRoot(): Promise<string> {
  let current = process.cwd();
  while (true) {
    const schemaPath = path.join(current, "packages/database/src/schema.sql");
    const migrationsPath = path.join(current, "packages/database/migrations");
    try {
      const [schemaStat, migrationsStat] = await Promise.all([fs.stat(schemaPath), fs.stat(migrationsPath)]);
      if (schemaStat.isFile() && migrationsStat.isDirectory()) {
        return current;
      }
    } catch {
      // Keep walking up until we find the workspace root.
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error("Unable to locate repository root for database migrations.");
    }
    current = parent;
  }
}
